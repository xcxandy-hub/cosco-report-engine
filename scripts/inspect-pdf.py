#!/usr/bin/env python3
import argparse
import json
import logging
import subprocess
import unicodedata
from pathlib import Path

import pdfplumber
from PIL import Image

logging.getLogger("pdfminer").setLevel(logging.ERROR)

A4_PORTRAIT_PT = (595.28, 841.89)
A4_TOLERANCE_PT = 3.0


def parse_args():
    parser = argparse.ArgumentParser(description="Render and inspect a report PDF.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--expected-pages", type=int)
    parser.add_argument("--expected-document", type=Path, help="Read the expected page count from a compiled ReportDocument JSON file.")
    parser.add_argument("--dpi", type=int, default=96)
    return parser.parse_args()


def ink_ratio(image):
    grayscale = image.convert("L")
    pixels = grayscale.get_flattened_data() if hasattr(grayscale, "get_flattened_data") else grayscale.getdata()
    ink = sum(1 for value in pixels if value < 245)
    return ink / max(1, image.width * image.height)


def create_contact_sheet(images, output):
    columns = min(3, len(images))
    rows = (len(images) + columns - 1) // columns
    gap = 24
    cell_width = 420
    cell_height = 594
    sheet = Image.new("RGB", (gap + columns * (cell_width + gap), gap + rows * (cell_height + gap)), "#e8ecef")
    for index, image in enumerate(images):
        thumbnail = image.copy()
        thumbnail.thumbnail((cell_width, cell_height), Image.Resampling.LANCZOS)
        column = index % columns
        row = index // columns
        x = gap + column * (cell_width + gap) + (cell_width - thumbnail.width) // 2
        y = gap + row * (cell_height + gap) + (cell_height - thumbnail.height) // 2
        sheet.paste(thumbnail.convert("RGB"), (x, y))
    sheet.save(output)


def actual_orientation(width, height):
    return "portrait" if height >= width else "landscape"


def matches_a4(width, height, orientation):
    expected_width, expected_height = A4_PORTRAIT_PT
    if orientation == "landscape":
        expected_width, expected_height = expected_height, expected_width
    return abs(width - expected_width) <= A4_TOLERANCE_PT and abs(height - expected_height) <= A4_TOLERANCE_PT


def page_file_number(path):
    try:
        return int(path.stem.rsplit("-", 1)[1])
    except (IndexError, ValueError):
        return 0


def main():
    args = parse_args()
    if args.expected_pages is not None and args.expected_document is not None:
        raise SystemExit("use either --expected-pages or --expected-document, not both")
    expected_pages = args.expected_pages
    expected_orientations = None
    if args.expected_document is not None:
        document = json.loads(args.expected_document.read_text(encoding="utf-8"))
        pages = document.get("pages") if isinstance(document, dict) else None
        if not isinstance(pages, list) or not pages:
            raise SystemExit("expected ReportDocument JSON with a non-empty pages array")
        expected_pages = len(pages)
        expected_orientations = [page.get("orientation") if isinstance(page, dict) else None for page in pages]
        if any(orientation not in {"portrait", "landscape"} for orientation in expected_orientations):
            raise SystemExit("expected every ReportDocument page orientation to be portrait or landscape")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for stale_page in args.output_dir.glob("page-*.png"):
        stale_page.unlink()
    prefix = args.output_dir / "page"
    subprocess.run(["pdftoppm", "-png", "-r", str(args.dpi), str(args.pdf), str(prefix)], check=True)

    with pdfplumber.open(args.pdf) as report:
        extracted = [unicodedata.normalize("NFKC", (page.extract_text() or "").strip()) for page in report.pages]
        page_sizes = []
        for index, page in enumerate(report.pages):
            orientation = actual_orientation(page.width, page.height)
            page_sizes.append({
                "widthPt": round(page.width, 2),
                "heightPt": round(page.height, 2),
                "expectedOrientation": expected_orientations[index] if expected_orientations and index < len(expected_orientations) else None,
                "actualOrientation": orientation,
                "a4Matched": matches_a4(page.width, page.height, orientation)
            })

    page_files = sorted(args.output_dir.glob("page-*.png"), key=page_file_number)
    images = [Image.open(path) for path in page_files]
    ratios = [round(ink_ratio(image), 6) for image in images]
    errors = []
    warnings = []
    if expected_pages is not None and len(extracted) != expected_pages:
        errors.append(f"expected {expected_pages} pages, found {len(extracted)}")
    if len(page_files) != len(extracted):
        errors.append(f"rendered {len(page_files)} images for {len(extracted)} PDF pages")
    for index, page_size in enumerate(page_sizes):
        if not page_size["a4Matched"]:
            errors.append(f"page {index + 1} is not A4 ({page_size['widthPt']} x {page_size['heightPt']} pt)")
        expected_orientation = page_size["expectedOrientation"]
        if expected_orientation and page_size["actualOrientation"] != expected_orientation:
            errors.append(f"page {index + 1} orientation expected {expected_orientation}, found {page_size['actualOrientation']}")
    for index, text in enumerate(extracted):
        if not text:
            errors.append(f"page {index + 1} has no searchable text")
    for index, ratio in enumerate(ratios):
        if ratio < 0.003:
            warnings.append(f"page {index + 1} is visually sparse ({ratio:.2%} ink)")

    extracted_path = args.output_dir / "extracted-text.txt"
    extracted_path.write_text("\n\n".join(f"=== PAGE {index + 1} ===\n{text}" for index, text in enumerate(extracted)), encoding="utf-8")
    contact_path = args.output_dir / "contact-sheet.png"
    create_contact_sheet(images, contact_path)
    inspection = {
        "pdf": str(args.pdf.resolve()),
        "pages": len(extracted),
        "pageSizes": page_sizes,
        "searchableCharacters": [len(text) for text in extracted],
        "inkRatios": ratios,
        "errors": errors,
        "warnings": warnings,
        "contactSheet": str(contact_path.resolve()),
        "extractedText": str(extracted_path.resolve())
    }
    (args.output_dir / "inspection.json").write_text(json.dumps(inspection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pages": inspection["pages"], "errors": errors, "warnings": warnings}, ensure_ascii=False))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

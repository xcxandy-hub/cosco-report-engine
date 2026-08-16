import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { PNG } from "pngjs";

const run = promisify(execFile);
const [, , input = "dist/index.html", outputDir = "artifacts/visual-qa"] = process.argv;
const absoluteOutput = resolve(outputDir);
const pdfPath = resolve(absoluteOutput, "report.pdf");
const pagePrefix = resolve(absoluteOutput, "page");

await mkdir(absoluteOutput, { recursive: true });
await run(process.execPath, ["scripts/print-pdf.mjs", input, pdfPath], { maxBuffer: 4 * 1024 * 1024 });

try {
  await run("pdftoppm", ["-png", "-r", "96", pdfPath, pagePrefix], { maxBuffer: 4 * 1024 * 1024 });
} catch (error) {
  throw new Error(`无法调用 pdftoppm。请先安装 Poppler，再重试视觉检查。\n${error instanceof Error ? error.message : ""}`);
}

const pageFiles = (await readdir(absoluteOutput))
  .filter((name) => /^page-\d+\.png$/.test(name))
  .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
if (!pageFiles.length) throw new Error("没有生成逐页 PNG");

const pages = await Promise.all(pageFiles.map(async (name) => ({
  name,
  image: PNG.sync.read(await readFile(resolve(absoluteOutput, name)))
})));
const columns = Math.min(3, pages.length);
const rows = Math.ceil(pages.length / columns);
const gap = 28;
const cellWidth = Math.max(...pages.map(({ image }) => image.width));
const cellHeight = Math.max(...pages.map(({ image }) => image.height));
const sheet = new PNG({
  width: gap + columns * (cellWidth + gap),
  height: gap + rows * (cellHeight + gap),
  colorType: 6
});

for (let offset = 0; offset < sheet.data.length; offset += 4) {
  sheet.data[offset] = 232;
  sheet.data[offset + 1] = 236;
  sheet.data[offset + 2] = 239;
  sheet.data[offset + 3] = 255;
}

pages.forEach(({ image }, index) => {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = gap + column * (cellWidth + gap) + Math.floor((cellWidth - image.width) / 2);
  const y = gap + row * (cellHeight + gap) + Math.floor((cellHeight - image.height) / 2);
  PNG.bitblt(image, sheet, 0, 0, image.width, image.height, x, y);
});

const contactSheet = resolve(absoluteOutput, "contact-sheet.png");
await writeFile(contactSheet, PNG.sync.write(sheet));
console.log(`视觉检查产物：${pageFiles.length} 页`);
console.log(`逐页目录：${absoluteOutput}`);
console.log(`总览拼图：${contactSheet}`);


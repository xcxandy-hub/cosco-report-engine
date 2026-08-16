import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(".");
const temporaryDirectory = await mkdtemp(join(tmpdir(), "local-report-studio-dynamic-pages-"));
const packagePath = join(temporaryDirectory, "report-package.json");
const dataPath = join(temporaryDirectory, "data.json");
const documentPath = join(temporaryDirectory, "document.json");
const htmlPath = join(temporaryDirectory, "generator.html");
const pdfPath = join(temporaryDirectory, "report.pdf");
const renderedPath = join(temporaryDirectory, "rendered");

const execute = (args) => run(process.execPath, args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });

try {
  const baseline = JSON.parse(await readFile(join(root, "report-packages/finance-brief/report-package.json"), "utf8"));
  const reportPackage = {
    ...baseline,
    id: "dynamic-pages-test",
    name: "动态页数测试",
    description: "20 页交替横竖 A4 可重放测试",
    pages: Array.from({ length: 20 }, (_, index) => {
      const pageNumber = index + 1;
      const orientation = index % 2 === 0 ? "portrait" : "landscape";
      return {
        id: `dynamic-page-${String(pageNumber).padStart(2, "0")}`,
        name: `动态测试 ${pageNumber}`,
        section: "动态页数",
        master: "standard",
        orientation,
        elements: [{
          id: `dynamic-title-${String(pageNumber).padStart(2, "0")}`,
          type: "text",
          name: `第 ${pageNumber} 页标题`,
          semanticRole: "title",
          x: 18,
          y: 24,
          w: orientation === "portrait" ? 174 : 261,
          h: 20,
          z: 1,
          content: `动态页数测试 ${pageNumber} / 20`,
          style: { fontSlot: "display", fontSize: 28, color: "text", lineHeight: 1.2 }
        }]
      };
    })
  };
  await Promise.all([
    writeFile(packagePath, `${JSON.stringify(reportPackage, null, 2)}\n`),
    writeFile(dataPath, "{}\n")
  ]);

  await execute(["scripts/report-engine-cli.mjs", "validate", packagePath, dataPath]);
  await execute(["scripts/report-engine-cli.mjs", "compile", packagePath, dataPath, documentPath]);
  await execute(["scripts/report-engine-cli.mjs", "build", packagePath, dataPath, "dist/index.html", htmlPath]);
  await execute(["scripts/print-pdf.mjs", htmlPath, pdfPath]);
  await execute(["scripts/run-inspect-pdf.mjs", pdfPath, renderedPath, "--expected-document", documentPath]);

  const [document, inspection] = await Promise.all([
    readFile(documentPath, "utf8").then(JSON.parse),
    readFile(join(renderedPath, "inspection.json"), "utf8").then(JSON.parse)
  ]);
  assert.equal(document.pages.length, 20);
  assert.equal(inspection.pages, 20);
  assert.deepEqual(inspection.errors, []);
  assert.deepEqual(inspection.warnings, []);
  inspection.pageSizes.forEach((page, index) => {
    assert.equal(page.expectedOrientation, index % 2 === 0 ? "portrait" : "landscape");
    assert.equal(page.actualOrientation, page.expectedOrientation);
    assert.equal(page.a4Matched, true);
  });
  console.log("动态页数测试通过：20 页交替纵横 A4 已完成编译、单 HTML 构建、真实 PDF 打印和逐页检查；20 不是内核上限。");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

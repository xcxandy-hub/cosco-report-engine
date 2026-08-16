import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "artifacts", "template-visual-qa");
const BRAND_ASSET_IDS = {
  logoColor: "builtin-cosco-logo-color-v1",
  logoWhite: "builtin-cosco-logo-white-v1",
  logoLockup: "builtin-cosco-logo-lockup-v1",
  coverAerialPort: "builtin-cover-aerial-port-v1",
  coverCityShip: "builtin-cover-city-ship-v1",
  coverTerminal: "builtin-cover-terminal-v1",
  coverOpenWater: "builtin-cover-open-water-v1",
  coverRiver: "builtin-cover-river-v1"
};

const ASSET_FILES = [
  [BRAND_ASSET_IDS.logoColor, "src/assets/brand/cosco-logo-color.png", "image/png", 1024, 663],
  [BRAND_ASSET_IDS.logoWhite, "src/assets/brand/cosco-logo-white.png", "image/png", 1024, 663],
  [BRAND_ASSET_IDS.logoLockup, "src/assets/brand/cosco-logo-lockup.png", "image/png", 1800, 480],
  [BRAND_ASSET_IDS.coverAerialPort, "src/assets/brand/covers/cover-aerial-port.jpg", "image/jpeg", 1920, 1268],
  [BRAND_ASSET_IDS.coverCityShip, "src/assets/brand/covers/cover-city-ship.jpg", "image/jpeg", 1920, 1210],
  [BRAND_ASSET_IDS.coverTerminal, "src/assets/brand/covers/cover-terminal.jpg", "image/jpeg", 1920, 1440],
  [BRAND_ASSET_IDS.coverOpenWater, "src/assets/brand/covers/cover-open-water.jpg", "image/jpeg", 1920, 1280],
  [BRAND_ASSET_IDS.coverRiver, "src/assets/brand/covers/cover-river.jpg", "image/jpeg", 1912, 1440]
];

async function transpile(relativePath) {
  const source = await readFile(path.join(ROOT, relativePath), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}

function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`命令失败：node ${args.join(" ")}`);
}

const contextBase = { structuredClone, atob, btoa, console, Date, Math };
const modelExports = {};
vm.runInNewContext(await transpile("src/model.ts"), { ...contextBase, exports: modelExports, module: { exports: modelExports } });
const templateExports = {};
vm.runInNewContext(await transpile("src/page-templates.ts"), {
  ...contextBase,
  exports: templateExports,
  module: { exports: templateExports },
  require: (request) => {
    if (request === "./model") return modelExports;
    if (request === "./brand-assets") return { BRAND_ASSET_IDS };
    throw new Error(`不允许的视觉矩阵依赖：${request}`);
  }
});

const assets = [];
const assetData = {};
for (const [id, relativePath, mime, width, height] of ASSET_FILES) {
  const file = path.join(ROOT, relativePath);
  const bytes = await readFile(file);
  const info = await stat(file);
  assets.push({
    id,
    kind: "image",
    mime,
    width,
    height,
    byteSize: info.size,
    hash: createHash("sha256").update(bytes).digest("hex"),
    sourceName: path.basename(relativePath),
    optimized: true,
    originalRetained: false
  });
  assetData[id] = `data:${mime};base64,${bytes.toString("base64")}`;
}

const meta = {
  title: "航运经营分析模板矩阵",
  organization: "示例航运企业",
  period: "2026年8月",
  author: "经营分析部",
  confidentiality: "内部资料 注意保密"
};
const theme = {
  id: "template-matrix",
  name: "航运机构蓝",
  primary: "#174f78",
  secondary: "#dce9f1",
  accent: "#d24a3a",
  text: "#15232d",
  muted: "#65747d",
  paper: "#fbfcfd",
  surface: "#eef3f6",
  line: "#c7d2d9",
  positive: "#267052",
  negative: "#b43a42",
  chartPalette: ["#174f78", "#4f89aa", "#94afbf", "#d24a3a", "#6a765f", "#9b7b52"],
  fontFamily: "\"PingFang SC\", \"Microsoft YaHei\", Arial, sans-serif",
  fontSlots: {
    display: "\"PingFang SC\", \"Microsoft YaHei\", Arial, sans-serif",
    body: "\"PingFang SC\", \"Microsoft YaHei\", Arial, sans-serif",
    numeric: "\"SF Pro Display\", \"Helvetica Neue\", Arial, sans-serif"
  }
};
const bodyStyle = { fontSize: 10, fontSlot: "body", color: "text", background: "transparent", lineHeight: 1.35, padding: 0 };

function text(id, name, x, y, w, h, z, content, style = {}) {
  return { id, type: "text", name, x, y, w, h, z, content, style: { ...bodyStyle, ...style } };
}

function contentPage(template, orientation, pageNumber, totalPages) {
  const portrait = orientation === "portrait";
  const width = portrait ? 210 : 297;
  const elements = [
    text(`${template.id}-${orientation}-title`, "页面标题", 18, 26, width - 36, 16, 1, `${template.label} · ${portrait ? "竖版" : "横版"}`, { fontSize: 28, fontSlot: "display", fontWeight: 750 }),
    text(`${template.id}-${orientation}-subtitle`, "页面摘要", 18, 47, width - 36, 14, 2, "结构、指标与行动建议保持在同一视觉制度内，所有页眉页脚元素均可继续微调。", { color: "muted" })
  ];
  const cardY = portrait ? 69 : 65;
  const cardW = portrait ? 52 : 70;
  const cardGap = portrait ? 9 : 12;
  [
    ["营业收入", "216.0", "亿元"],
    ["利润总额", "31.0", "亿元"],
    ["箱量", "201.0", "万TEU"]
  ].forEach(([label, value, unit], index) => {
    const x = 18 + index * (cardW + cardGap);
    elements.push({ id: `${template.id}-${orientation}-card-${index}`, type: "box", name: `${label}卡片`, x, y: cardY, w: cardW, h: 34, z: 3 + index * 3, style: { background: "paper", borderColor: "line", borderWidth: 0.3, radius: 1 } });
    elements.push(text(`${template.id}-${orientation}-card-label-${index}`, `${label}标题`, x + 4, cardY + 4, cardW - 8, 5, 4 + index * 3, label, { fontSize: 8, color: "muted" }));
    elements.push(text(`${template.id}-${orientation}-card-value-${index}`, `${label}数值`, x + 4, cardY + 13, cardW - 8, 11, 5 + index * 3, `${value} ${unit}`, { fontSize: 18, fontSlot: "numeric", fontWeight: 750, color: "primary" }));
  });
  const chartY = portrait ? 113 : 108;
  const chartW = portrait ? 112 : 164;
  const chartH = portrait ? 66 : 67;
  elements.push(text(`${template.id}-${orientation}-chart-caption`, "图表标题", 18, chartY - 9, chartW, 6, 13, "月度收入与利润趋势", { fontSize: 9, fontWeight: 700 }));
  elements.push({
    id: `${template.id}-${orientation}-chart`, type: "chart", name: "月度收入与利润趋势", x: 18, y: chartY, w: chartW, h: chartH, z: 14,
    chartKind: "combo", style: { background: "white", showLabel: true, showLegend: true, padding: 2 },
    chart: {
      categories: ["3月", "4月", "5月", "6月", "7月"], categoryIds: ["3月", "4月", "5月", "6月", "7月"],
      series: [
        { id: "收入", name: "收入", values: [188, 192, 198, 204, 216], kind: "bar", axis: "left", unit: "亿元" },
        { id: "利润", name: "利润", values: [19, 21, 24, 26, 31], kind: "line", axis: "right", unit: "亿元" }
      ]
    }
  });
  const sideX = 18 + chartW + (portrait ? 7 : 9);
  const sideW = width - sideX - 18;
  elements.push(text(`${template.id}-${orientation}-table-caption`, "表格标题", sideX, chartY - 9, sideW, 6, 15, "经营判断", { fontSize: 9, fontWeight: 700 }));
  elements.push({
    id: `${template.id}-${orientation}-table`, type: "table", name: "经营判断", x: sideX, y: chartY, w: sideW, h: portrait ? 66 : 38, z: 16,
    style: { fontSize: 8, fontSlot: "body", color: "text", background: "white", borderColor: "line", padding: 1 },
    table: { headers: ["指标", "本期", "同比"], rows: [["收入", "216.0", "+6.3%"], ["利润", "31.0", "+19.2%"], ["箱量", "201.0", "+4.8%"]] }
  });
  if (!portrait) {
    elements.push({ id: `${template.id}-${orientation}-quote-box`, type: "box", name: "行动建议底色", x: sideX, y: chartY + 44, w: sideW, h: 23, z: 17, style: { background: "secondary", radius: 1 } });
    elements.push(text(`${template.id}-${orientation}-quote`, "行动建议", sideX + 4, chartY + 49, sideW - 8, 13, 18, "锁定高贡献航线资源，控制低效成本增量。", { fontSize: 9, fontWeight: 650 }));
  } else {
    elements.push({ id: `${template.id}-${orientation}-quote-box`, type: "box", name: "行动建议底色", x: 18, y: 190, w: width - 36, h: 44, z: 17, style: { background: "secondary", radius: 1 } });
    elements.push(text(`${template.id}-${orientation}-quote`, "行动建议", 25, 200, width - 50, 22, 18, "增长质量好于规模表现；下一周期应继续提高高毛利业务占比，并提前锁定关键资源。", { fontSize: 11, fontWeight: 650 }));
  }
  elements.push(text(`${template.id}-${orientation}-source`, "资料来源", 18, portrait ? 248 : 181, width - 36, 6, 19, "资料来源：合成经营数据，仅用于模板验收", { fontSize: 8, color: "muted" }));
  const page = { id: `chrome-${template.id}-${orientation}`, name: `${template.label}${portrait ? "竖版" : "横版"}`, section: "模板矩阵", master: "data", orientation, elements };
  templateExports.applyChromeTemplate(page, meta, template.id, pageNumber, totalPages, "all");
  page.elements.forEach((element, index) => {
    if (element.presetId?.startsWith("chrome-template:")) element.id = `${page.id}-${element.presetSlot}`;
    element.z = index + 1;
  });
  return page;
}

const pages = [];
for (const template of templateExports.COVER_TEMPLATES) {
  for (const orientation of ["portrait", "landscape"]) {
    const page = {
      id: `cover-${template.id}-${orientation}`,
      name: `${template.label}${orientation === "portrait" ? "竖版" : "横版"}`,
      section: "封面模板",
      master: "cover",
      orientation,
      masterProps: { imageAssetId: template.previewAssetId, focal: { x: 50, y: 50 } },
      elements: [
        text(`${template.id}-${orientation}-seed-title`, "封面标题", 18, 80, 170, 28, 1, `${template.label}报告设计`, { fontSize: 28, fontSlot: "display", fontWeight: 750 }),
        text(`${template.id}-${orientation}-seed-subtitle`, "封面副标题", 18, 112, 170, 16, 2, `${orientation === "portrait" ? "竖版" : "横版"}独立构图 · 蒙版、标题、Logo 与期次均可编辑`, { fontSize: 10, color: "muted" })
      ]
    };
    templateExports.applyCoverTemplate(page, meta, template.id, assets);
    page.elements.forEach((element, index) => { element.id = `${page.id}-${element.presetSlot}`; element.z = index + 1; });
    pages.push(page);
  }
}
const totalPages = pages.length + templateExports.CHROME_TEMPLATES.length * 2;
for (const template of templateExports.CHROME_TEMPLATES) {
  for (const orientation of ["portrait", "landscape"]) pages.push(contentPage(template, orientation, pages.length + 1, totalPages));
}
pages.forEach((page) => page.elements.forEach((element) => { delete element.runs; }));

const reportPackage = {
  engineVersion: "0.1",
  authoringMode: "independent",
  id: "template-visual-matrix",
  version: "1.0.0",
  documentUpdatedAt: "2026-08-16T08:00:00.000Z",
  name: "模板横竖版视觉矩阵",
  description: "5 套封面和 3 套页眉页脚的横竖版真实打印矩阵。",
  meta,
  theme,
  pageSetup: { grid: 5, margin: 18, snap: true, showGrid: false, footerMode: "all", printDpi: 150 },
  assets,
  assetData,
  pages
};

const scratch = await mkdtemp(path.join(tmpdir(), "cosco-template-visual-qa-"));
try {
  const packagePath = path.join(scratch, "report-package.json");
  const dataPath = path.join(scratch, "data.json");
  const documentPath = path.join(scratch, "document.json");
  const htmlPath = path.join(scratch, "template-matrix.html");
  const pdfPath = path.join(scratch, "template-matrix.pdf");
  const renderedPath = path.join(scratch, "rendered");
  await writeFile(packagePath, `${JSON.stringify(reportPackage, null, 2)}\n`);
  await writeFile(dataPath, "{}\n");
  run(["scripts/report-engine-cli.mjs", "compile", packagePath, dataPath, documentPath]);
  run(["scripts/report-engine-cli.mjs", "build", packagePath, dataPath, path.join(ROOT, "dist", "index.html"), htmlPath]);
  run(["scripts/print-pdf.mjs", htmlPath, pdfPath]);
  run(["scripts/run-inspect-pdf.mjs", pdfPath, renderedPath, "--expected-document", documentPath]);
  const inspection = JSON.parse(await readFile(path.join(renderedPath, "inspection.json"), "utf8"));
  if (inspection.pages !== totalPages || inspection.errors.length || inspection.warnings.length) throw new Error("模板视觉矩阵存在页数、方向、空白或渲染问题");
  await mkdir(OUTPUT_DIR, { recursive: true });
  await copyFile(path.join(renderedPath, "contact-sheet.png"), path.join(OUTPUT_DIR, "contact-sheet.png"));
  inspection.pdf = "temporary/template-matrix.pdf";
  inspection.contactSheet = "artifacts/template-visual-qa/contact-sheet.png";
  inspection.extractedText = "temporary/template-matrix-extracted-text.txt";
  await writeFile(path.join(OUTPUT_DIR, "inspection.json"), `${JSON.stringify(inspection, null, 2)}\n`);
  console.log(`模板视觉矩阵通过：${totalPages} 页，5 套封面与 3 套页眉页脚均覆盖横竖版。`);
} finally {
  await rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

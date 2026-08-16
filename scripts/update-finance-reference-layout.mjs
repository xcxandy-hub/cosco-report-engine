import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const packageUrl = new URL("report-packages/finance-brief/report-package.json", root);

async function transpile(relativePath) {
  const source = await readFile(new URL(relativePath, root), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
}

const contextBase = { structuredClone, atob, btoa, console, Date, Math };
const modelExports = {};
vm.runInNewContext(await transpile("src/model.ts"), { ...contextBase, exports: modelExports, module: { exports: modelExports } });

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
const templateExports = {};
vm.runInNewContext(await transpile("src/page-templates.ts"), {
  ...contextBase,
  exports: templateExports,
  module: { exports: templateExports },
  require: (request) => {
    if (request === "./model") return modelExports;
    if (request === "./brand-assets") return { BRAND_ASSET_IDS };
    throw new Error(`不允许的布局生成依赖：${request}`);
  }
});

const sourceAssets = [
  { id: BRAND_ASSET_IDS.logoColor, file: "src/assets/brand/cosco-logo-color.png", mime: "image/png", width: 1024, height: 663 },
  { id: BRAND_ASSET_IDS.logoWhite, file: "src/assets/brand/cosco-logo-white.png", mime: "image/png", width: 1024, height: 663 },
  { id: BRAND_ASSET_IDS.coverCityShip, file: "src/assets/brand/covers/cover-city-ship.jpg", mime: "image/jpeg", width: 1920, height: 1210 }
];

const reportPackage = JSON.parse(await readFile(packageUrl, "utf8"));
reportPackage.version = "2.1.0";
reportPackage.documentUpdatedAt = "2026-08-16T08:00:00.000Z";
reportPackage.description = "智能体生成高密度作者初版，用户在本机直接编辑每个文字、图片、蒙版、图表、表格、标签与页眉页脚；各数据组件互不关联。";
reportPackage.assets = [];
reportPackage.assetData = {};
for (const source of sourceAssets) {
  const bytes = await readFile(new URL(source.file, root));
  reportPackage.assets.push({
    id: source.id,
    kind: "image",
    mime: source.mime,
    width: source.width,
    height: source.height,
    byteSize: bytes.length,
    hash: createHash("sha256").update(bytes).digest("hex"),
    sourceName: source.file.split("/").at(-1),
    optimized: true,
    originalRetained: false
  });
  reportPackage.assetData[source.id] = `data:${source.mime};base64,${bytes.toString("base64")}`;
}

const cover = reportPackage.pages.find((page) => page.master === "cover");
if (!cover) throw new Error("财务简报参考包缺少封面");
const existingCoverImage = cover.elements.find((element) => element.presetSlot === "cover-image");
if (existingCoverImage) existingCoverImage.assetId = BRAND_ASSET_IDS.coverCityShip;
templateExports.applyCoverTemplate(cover, reportPackage.meta, "cinematic-fullbleed");
cover.elements.forEach((element, index) => {
  element.id = `${cover.id}--${element.presetSlot || `element-${index + 1}`}`;
  element.z = index + 1;
});

reportPackage.pages.forEach((page, index) => {
  if (!["standard", "data", "section"].includes(page.master)) return;
  templateExports.applyChromeTemplate(page, reportPackage.meta, "brand-rail", index + 1, reportPackage.pages.length, reportPackage.pageSetup?.footerMode);
  page.elements.forEach((element, elementIndex) => {
    if (element.presetId?.startsWith("chrome-template:")) element.id = `${page.id}--${element.presetSlot || `chrome-${elementIndex + 1}`}`;
  });
});

reportPackage.pages.forEach((page) => page.elements.forEach((element) => { delete element.runs; }));

await writeFile(packageUrl, `${JSON.stringify(reportPackage, null, 2)}\n`);
console.log(`已升级财务简报参考包：${reportPackage.pages.length} 页，${reportPackage.assets.length} 个初始图片资产。`);

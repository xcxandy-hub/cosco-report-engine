import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const modelSource = await readFile(new URL("src/model.ts", root), "utf8");
const compiled = ts.transpileModule(modelSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, {
  exports: exportsObject,
  module: { exports: exportsObject },
  structuredClone,
  atob,
  btoa,
  console
});
const { MAX_IMPORTED_ASSET_COUNT, normalizeProject, scaleImageCrop } = exportsObject;

const theme = {
  id: "test",
  name: "测试",
  primary: "#174f78",
  secondary: "#dce9f1",
  accent: "#d24a3a",
  text: "#15232d",
  muted: "#65747d",
  paper: "#ffffff",
  surface: "#eef3f6",
  line: "#c7d2d9",
  positive: "#267052",
  negative: "#b43a42",
  chartPalette: ["#174f78", "#d24a3a"],
  fontFamily: "Arial",
  fontSlots: { display: "Arial", body: "Arial", numeric: "Arial" }
};
const style = { fontSize: 10, color: "text", background: "transparent", borderColor: "transparent" };
const legacy = {
  version: "1.3",
  meta: { title: "迁移测试", organization: "测试机构", period: "2026-08", author: "测试", confidentiality: "内部资料" },
  theme,
  pageSetup: { grid: 5, margin: 18, snap: true, showGrid: true, footerMode: "all", printDpi: 300 },
  usedFontSlots: ["display", "body", "numeric"],
  assets: [],
  pages: [{
    id: "page-1",
    name: "测试页",
    section: "测试",
    master: "data",
    orientation: "portrait",
    elements: [
      { id: "title-1", type: "title", name: "标题", x: 18, y: 18, w: 174, h: 15, z: 1, content: "页面标题", style: { ...style, fontSize: 28 } },
      { id: "kpi-1", type: "kpi", name: "收入", x: 18, y: 40, w: 55, h: 35, z: 2, content: "营业收入", value: "128.6", unit: "亿元", note: "同比 +8.4%", style: { ...style, background: "white", borderColor: "line", padding: 4 } },
      { id: "quote-1", type: "quote", name: "结论", x: 80, y: 40, w: 112, h: 35, z: 3, content: "结构持续改善。", note: "研究判断", style: { ...style, background: "secondary" } },
      { id: "chart-1", type: "combo-chart", name: "组合图", x: 18, y: 85, w: 82, h: 72, z: 4, content: "规模与增速", chart: { categories: ["1月", "2月"], series: [{ name: "收入", values: [1, 2], kind: "bar", axis: "left" }, { name: "增速", values: [3, 4], kind: "line", axis: "right" }] }, style: { ...style, showLabel: true, showLegend: true } },
      { id: "table-1", type: "table", name: "数据表", x: 108, y: 85, w: 84, h: 72, z: 5, content: "经营指标", table: { headers: ["指标", "本期"], rows: [["收入", "128.6"]] }, style: { ...style, fontSize: 8 } },
      { id: "source-1", type: "source", name: "资料来源", x: 18, y: 165, w: 174, h: 7, z: 6, content: "资料来源：测试数据", style: { ...style, fontSize: 8, color: "muted" } }
    ]
  }],
  updatedAt: "2026-08-15T00:00:00.000Z"
};

const first = normalizeProject(legacy).document;
const elements = first.pages[0].elements;
assert.equal(first.version, "1.5");
assert.ok(elements.every((element) => ["text", "box", "divider", "image", "chart", "table"].includes(element.type)));
assert.ok(elements.every((element) => !Object.hasOwn(element, "value") && !Object.hasOwn(element, "unit") && !Object.hasOwn(element, "note")));

const kpiGroup = elements.filter((element) => element.groupId === "group-kpi-1");
assert.equal(kpiGroup.length, 5);
assert.deepEqual(new Set(kpiGroup.map((element) => element.semanticRole).filter(Boolean)), new Set(["kpi-label", "kpi-value", "kpi-unit", "kpi-note"]));
assert.equal(elements.find((element) => element.id === "chart-1")?.chartKind, "combo");
assert.ok(elements.find((element) => element.id === "chart-1")?.chart?.categoryIds?.every(Boolean));
assert.ok(elements.find((element) => element.id === "chart-1")?.chart?.series.every((series) => Boolean(series.id)));
assert.equal(elements.find((element) => element.id === "source-1")?.semanticRole, "source");
assert.ok(elements.filter((element) => element.semanticRole === "caption").some((element) => element.content === "规模与增速"));
assert.ok(elements.filter((element) => element.semanticRole === "caption").some((element) => element.content === "经营指标"));

const second = normalizeProject(first).document;
assert.equal(second.pages[0].elements.length, first.pages[0].elements.length);
assert.deepEqual(second.pages[0].elements.map((element) => ({ id: element.id, type: element.type, role: element.semanticRole, groupId: element.groupId })), first.pages[0].elements.map((element) => ({ id: element.id, type: element.type, role: element.semanticRole, groupId: element.groupId })));

const oldest = structuredClone(legacy);
oldest.version = "1.0";
oldest.pages[0].elements = [];
const migratedOldest = normalizeProject(oldest).document;
assert.ok(migratedOldest.pages[0].elements.some((element) => element.role === "footer-page-number"));

const pngData = `data:image/png;base64,${Buffer.from("89504e470d0a1a0a", "hex").toString("base64")}`;
const withAsset = structuredClone(first);
withAsset.assets = [{ id: "asset-1", kind: "image", mime: "image/png", width: 1, height: 1, byteSize: 999 }];
withAsset.assetData = { "asset-1": pngData };
const normalizedAsset = normalizeProject(withAsset);
assert.equal(normalizedAsset.assetData["asset-1"], pngData);
assert.equal(normalizedAsset.document.assets[0].byteSize, 8);
const missingPortableAsset = structuredClone(withAsset);
delete missingPortableAsset.assetData["asset-1"];
assert.throws(() => normalizeProject(missingPortableAsset, { requireAssetData: true }), /缺少图片资产数据/);
const duplicatePortableAsset = structuredClone(withAsset);
duplicatePortableAsset.assets.push(structuredClone(duplicatePortableAsset.assets[0]));
assert.throws(() => normalizeProject(duplicatePortableAsset, { requireAssetData: true }), /重复的图片资产 ID/);
const unsafeAssetId = structuredClone(withAsset);
unsafeAssetId.assets[0].id = "../private";
unsafeAssetId.assetData = { "../private": pngData };
assert.throws(() => normalizeProject(unsafeAssetId, { requireAssetData: true }), /资产 ID 无效/);

assert.deepEqual(
  JSON.parse(JSON.stringify(scaleImageCrop(
    { sx: 6000, sy: 1000, sw: 1500, sh: 2000 },
    { width: 8000, height: 4000 },
    { width: 4096, height: 2048 }
  ))),
  { sx: 3072, sy: 512, sw: 768, sh: 1024 }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(scaleImageCrop(
    { sx: 6000, sy: 1000, sw: 1500, sh: 2000 },
    { width: 8000, height: 4000 },
    { width: 2048, height: 4096 }
  ))),
  { sx: 1536, sy: 1024, sw: 384, sh: 2048 }
);

const tooManyAssets = structuredClone(first);
tooManyAssets.assets = Array.from({ length: MAX_IMPORTED_ASSET_COUNT + 1 }, (_, index) => ({
  id: `asset-${index}`,
  kind: "image",
  mime: "image/png",
  width: 1,
  height: 1,
  byteSize: 0
}));
assert.throws(() => normalizeProject(tooManyAssets), /图片资产超过/);
const excessivePixelMetadata = structuredClone(withAsset);
excessivePixelMetadata.assets[0].width = 20000;
excessivePixelMetadata.assets[0].height = 20000;
assert.throws(() => normalizeProject(excessivePixelMetadata), /像素尺寸超过单图上限/);

const unsafeImports = [
  { label: "remote URL", mutate: (project) => { project.assetData["asset-1"] = "https://example.invalid/private.png"; } },
  { label: "MIME mismatch", mutate: (project) => { project.assets[0].mime = "image/jpeg"; } },
  { label: "spoofed signature", mutate: (project) => { project.assetData["asset-1"] = "data:image/png;base64,bm90LWEtcG5n"; } },
  { label: "undeclared asset data", mutate: (project) => { project.assetData.undeclared = pngData; } }
];
for (const scenario of unsafeImports) {
  const project = structuredClone(withAsset);
  scenario.mutate(project);
  assert.throws(() => normalizeProject(project), undefined, scenario.label);
}

const unsafeLegacyImage = structuredClone(legacy);
unsafeLegacyImage.pages[0].elements = [{
  id: "legacy-image",
  type: "image",
  name: "不安全旧图片",
  x: 10,
  y: 10,
  w: 20,
  h: 20,
  z: 1,
  image: "https://example.invalid/private.png",
  style
}];
assert.throws(() => normalizeProject(unsafeLegacyImage), /图片资产|本地 base64 data URL/);

const unsafeThemes = [
  { label: "remote paper", mutate: (project) => { project.theme.paper = "url(https://example.invalid/leak)"; } },
  { label: "remote font", mutate: (project) => { project.theme.fontSlots.body = "url(https://example.invalid/font.woff2)"; } },
  { label: "remote palette", mutate: (project) => { project.theme.chartPalette[0] = "https://example.invalid/palette.css"; } }
];
for (const scenario of unsafeThemes) {
  const project = structuredClone(first);
  scenario.mutate(project);
  assert.throws(() => normalizeProject(project), undefined, scenario.label);
}

console.log(`迁移测试通过：1.3 的 ${legacy.pages[0].elements.length} 个旧元素展开为 ${elements.length} 个 1.5 原子元素；图片裁切缩放、数量/像素上限及不安全工程均已验证。`);

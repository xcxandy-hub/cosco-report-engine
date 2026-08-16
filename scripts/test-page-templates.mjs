import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const root = new URL("../", import.meta.url);

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
    throw new Error(`不允许的测试依赖：${request}`);
  }
});

const { PAGE_MM } = modelExports;
const { COVER_TEMPLATES, CHROME_TEMPLATES, applyCoverTemplate, applyChromeTemplate, syncPageDecorationElements } = templateExports;
assert.equal(COVER_TEMPLATES.length, 5);
assert.equal(CHROME_TEMPLATES.length, 3);
assert.equal(new Set(COVER_TEMPLATES.map((item) => item.id)).size, 5);
assert.equal(new Set(CHROME_TEMPLATES.map((item) => item.id)).size, 3);

const meta = {
  title: "测试报告标题",
  organization: "测试机构",
  period: "2026年8月",
  author: "测试部门",
  confidentiality: "内部资料"
};
const style = { fontSize: 10, fontSlot: "body", color: "text", background: "transparent", lineHeight: 1.2 };
const atomicTypes = new Set(["text", "box", "divider", "image", "chart", "table"]);
const snapshots = new Map();

for (const template of COVER_TEMPLATES) {
  for (const orientation of ["portrait", "landscape"]) {
    const page = {
      id: `cover-${template.id}-${orientation}`,
      name: "封面",
      section: "月度经营分析",
      master: "cover",
      orientation,
      masterProps: { imageAssetId: "custom-cover", crop: { sx: 12, sy: 24, sw: 800, sh: 600 }, focal: { x: 35, y: 62 }, imageStyle: { overlayKind: "none", overlayColor: "primary", overlayColor2: "transparent", overlayAngle: 0, blendMode: "multiply", strength: 0.5, grade: "film", vignette: "light" } },
      elements: [
        { id: "old-title", type: "text", name: "封面标题", semanticRole: "title", x: 10, y: 10, w: 100, h: 20, z: 1, content: "保留的人工标题", runs: [{ text: "保留的人工标题" }], style },
        { id: "old-subtitle", type: "text", name: "封面副标题", x: 10, y: 32, w: 100, h: 10, z: 2, content: "保留的人工副标题", runs: [{ text: "保留的人工副标题" }], style },
        { id: "old-logo", type: "image", name: "封面 Logo", x: 10, y: 5, w: 20, h: 12, z: 3, assetId: BRAND_ASSET_IDS.logoColor, style: { background: "transparent" } }
      ]
    };
    const result = applyCoverTemplate(page, meta, template.id);
    const size = PAGE_MM[orientation];
    assert.ok(page.elements.length >= 10, `${template.id}/${orientation} 信息密度不足`);
    assert.ok(page.elements.every((item) => atomicTypes.has(item.type)), `${template.id}/${orientation} 出现非原子元素`);
    assert.ok(page.elements.every((item) => !item.locked && item.presetId === `cover-template:${template.id}`), `${template.id}/${orientation} 模板元素不可直接编辑`);
    assert.equal(new Set(page.elements.map((item) => item.presetSlot)).size, page.elements.length, `${template.id}/${orientation} 模板槽位重复`);
    assert.equal(page.elements.find((item) => item.presetSlot === "cover-title")?.content, "保留的人工标题");
    assert.equal(page.elements.find((item) => item.presetSlot === "cover-subtitle")?.content, "保留的人工副标题");
    const coverImage = page.elements.find((item) => item.presetSlot === "cover-image");
    assert.equal(coverImage?.assetId, "custom-cover", `${template.id}/${orientation} 误把 Logo 当成封面图`);
    assert.deepEqual(coverImage?.crop, { sx: 12, sy: 24, sw: 800, sh: 600 }, `${template.id}/${orientation} 丢失母版裁切`);
    assert.equal(coverImage?.imageStyle?.grade, "film", `${template.id}/${orientation} 丢失母版图片风格`);
    assert.equal(page.masterProps.imageAssetId, undefined);
    assert.equal(result.requiredAssetIds.length, 1, `${template.id}/${orientation} 安装了未使用的模板预览图或 Logo`);
    assert.ok(!result.requiredAssetIds.includes(template.previewAssetId), `${template.id}/${orientation} 保留自定义封面时仍安装预览图`);
    page.elements.forEach((item) => {
      assert.ok(Number.isFinite(item.x) && Number.isFinite(item.y) && item.w > 0 && item.h > 0, `${template.id}/${orientation}/${item.presetSlot} 几何无效`);
      assert.ok(item.y >= 0 && item.y + item.h <= size.height + 0.01, `${template.id}/${orientation}/${item.presetSlot} 纵向越界`);
      assert.ok(item.x >= 0 && item.x + item.w <= size.width + 0.01, `${template.id}/${orientation}/${item.presetSlot} 横向越界`);
    });
    snapshots.set(`${template.id}-${orientation}`, page.elements.map((item) => [item.presetSlot, item.x, item.y, item.w, item.h]));
  }
  assert.notDeepEqual(snapshots.get(`${template.id}-portrait`), snapshots.get(`${template.id}-landscape`), `${template.id} 横竖版不应共享同一组几何`);

  const blankPage = { id: `blank-${template.id}`, name: "空封面", section: "", master: "cover", orientation: "portrait", elements: [] };
  const blankResult = applyCoverTemplate(blankPage, meta, template.id);
  assert.equal(blankPage.elements.find((item) => item.presetSlot === "cover-image")?.assetId, template.previewAssetId);
  assert.equal(blankResult.requiredAssetIds.length, 2, `${template.id} 空封面没有只安装当前 Logo 与预览图`);
  assert.ok(blankResult.requiredAssetIds.includes(template.previewAssetId));
}

const focalPage = {
  id: "cover-focal",
  name: "焦点封面",
  section: "",
  master: "cover",
  orientation: "portrait",
  masterProps: { imageAssetId: "focal-cover", focal: { x: 75, y: 25 } },
  elements: []
};
applyCoverTemplate(focalPage, meta, "cinematic-fullbleed", [{ id: "focal-cover", kind: "image", mime: "image/jpeg", width: 1000, height: 1000, byteSize: 1 }]);
const focalCrop = focalPage.elements.find((item) => item.presetSlot === "cover-image")?.crop;
assert.ok(focalCrop && focalCrop.sx > 0 && focalCrop.sy === 0, "母版只有焦点时没有转换为封面元素裁切");

for (const template of CHROME_TEMPLATES) {
  for (const orientation of ["portrait", "landscape"]) {
    const size = PAGE_MM[orientation];
    const page = {
      id: `content-${template.id}-${orientation}`,
      name: "内容页",
      section: "经营表现",
      master: "data",
      orientation,
      elements: [
        { id: "content-title", type: "text", name: "内容标题", semanticRole: "title", x: 18, y: 24, w: size.width - 36, h: 16, z: 9, content: "内容不能被模板删除", runs: [{ text: "内容不能被模板删除" }], style },
        { id: "old-footer", type: "text", name: "旧页码", role: "footer-page-number", x: 10, y: size.height - 10, w: 10, h: 4, z: 10, content: "99", runs: [{ text: "99" }], style }
      ]
    };
    const result = applyChromeTemplate(page, meta, template.id, 7, 9, "confidentiality-last");
    const chrome = page.elements.filter((item) => item.presetId === `chrome-template:${template.id}`);
    assert.equal(page.elements.filter((item) => item.id === "content-title").length, 1, `${template.id}/${orientation} 删除了正文`);
    assert.equal(page.elements.filter((item) => item.id === "old-footer").length, 0, `${template.id}/${orientation} 保留了旧母版元素`);
    assert.ok(chrome.length >= 7, `${template.id}/${orientation} 页眉页脚元素不足`);
    assert.ok(chrome.every((item) => atomicTypes.has(item.type) && !item.locked), `${template.id}/${orientation} 页眉页脚不可编辑`);
    assert.equal(chrome.find((item) => item.role === "footer-page-number")?.content, "07");
    assert.equal(chrome.find((item) => item.presetSlot === "footer-confidentiality")?.content, "", `${template.id}/${orientation} 未遵守密级仅末页`);
    assert.ok(chrome.some((item) => item.type === "image" && item.assetId === BRAND_ASSET_IDS.logoColor));
    assert.deepEqual(Array.from(result.requiredAssetIds), [BRAND_ASSET_IDS.logoColor]);
    chrome.forEach((item) => {
      assert.ok(item.x >= 0 && item.y >= 0 && item.x + item.w <= size.width + 0.01 && item.y + item.h <= size.height + 0.01, `${template.id}/${orientation}/${item.presetSlot} 越界`);
    });
    applyChromeTemplate(page, meta, template.id, 9, 9, "confidentiality-last");
    assert.equal(page.elements.find((item) => item.presetSlot === "footer-confidentiality")?.content, meta.confidentiality, `${template.id}/${orientation} 末页没有显示密级`);
  }
}

const lifecyclePages = [1, 2, 3].map((pageNumber) => {
  const page = { id: `lifecycle-${pageNumber}`, name: `页面 ${pageNumber}`, section: `章节 ${pageNumber}`, master: "data", orientation: "landscape", elements: [] };
  applyChromeTemplate(page, meta, "minimal-rule", pageNumber, 3, "confidentiality-last");
  return page;
});
const lifecycleReport = {
  version: "1.5",
  meta: { ...meta },
  theme: {},
  pageSetup: { grid: 5, margin: 18, snap: true, showGrid: false, footerMode: "confidentiality-last" },
  usedFontSlots: [],
  assets: [],
  pages: lifecyclePages,
  updatedAt: "2026-08-16T08:00:00.000Z"
};
syncPageDecorationElements(lifecycleReport);
assert.equal(lifecyclePages[0].elements.find((item) => item.presetSlot === "footer-confidentiality")?.content, "");
assert.equal(lifecyclePages[2].elements.find((item) => item.presetSlot === "footer-confidentiality")?.content, meta.confidentiality);
lifecycleReport.pages.pop();
syncPageDecorationElements(lifecycleReport);
assert.equal(lifecyclePages[1].elements.find((item) => item.presetSlot === "footer-confidentiality")?.content, meta.confidentiality, "删除末页后新末页没有恢复密级");
lifecycleReport.pageSetup.footerMode = "all";
lifecycleReport.meta.organization = "更新后的机构";
lifecycleReport.pages[0].section = "更新后的章节";
syncPageDecorationElements(lifecycleReport);
assert.equal(lifecyclePages[0].elements.find((item) => item.presetSlot === "footer-confidentiality")?.content, meta.confidentiality, "切换每页显示后旧模板页没有恢复密级");
assert.equal(lifecyclePages[0].elements.find((item) => item.presetSlot === "header-organization")?.content, "更新后的机构", "机构名变化后模板页眉没有同步");
assert.equal(lifecyclePages[0].elements.find((item) => item.presetSlot === "header-section")?.content, "更新后的章节", "章节变化后模板页眉没有同步");
assert.equal(lifecyclePages[1].elements.find((item) => item.role === "footer-page-number")?.content, "02", "删除页面后页码没有同步");

console.log("模板测试通过：5 套封面与 3 套页眉页脚均覆盖横竖版，保持原子化、可编辑、内容保留和页面边界。 ");

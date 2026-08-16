import assert from "node:assert/strict";
import { loadVisualOverrides } from "./visual-overrides-loader.mjs";

const { applyVisualOverrides, createVisualOverrides, visualOverrideCount } = await loadVisualOverrides();

const base = {
  version: "1.5",
  meta: { title: "测试", organization: "机构", period: "2026-08", author: "测试", confidentiality: "内部" },
  theme: { id: "test", name: "测试", primary: "#00508e", secondary: "#4f7f9f", accent: "#d70110", text: "#14232c", muted: "#65747d", paper: "#ffffff", surface: "#eef3f6", line: "#c7d2d9", positive: "#267052", negative: "#b43a42", chartPalette: ["#00508e"], fontFamily: "Arial", fontSlots: { display: "Arial", body: "Arial", numeric: "Arial" } },
  pageSetup: { grid: 5, margin: 18, snap: true, showGrid: false, footerMode: "all", printDpi: 300 },
  usedFontSlots: ["display", "body", "numeric"],
  assets: [],
  pages: [{
    id: "page-1", name: "数据页", section: "测试", master: "data", orientation: "landscape", elements: [
      { id: "title-1", type: "text", name: "标题", x: 18, y: 18, w: 100, h: 12, z: 1, content: "基线标题", runs: [{ text: "基线标题" }], style: { fontSize: 14, color: "text" } },
      { id: "chart-1", type: "chart", name: "趋势", x: 18, y: 40, w: 160, h: 90, z: 2, chartKind: "line", chart: { categories: ["1月", "2月"], categoryIds: ["jan", "feb"], series: [{ id: "revenue", name: "收入", values: [1, 2] }] }, chartLabels: { mode: "auto", sparseEvery: 2 }, style: { showLabel: true } }
    ]
  }],
  updatedAt: "2026-08-15T00:00:00.000Z"
};

const edited = structuredClone(base);
edited.meta.period = "人工伪改期间";
edited.pages[0].elements[0].x = 24;
edited.pages[0].elements[0].content = "人工标题";
edited.pages[0].elements[0].runs = [{ text: "人工标题" }];
edited.pages[0].elements[0].z = 3;
edited.pages[0].elements[1].chart.series[0].values = [9, 9];
edited.pages[0].elements[1].z = 1;
edited.pages[0].elements[1].chartLabels = { mode: "sparse", sparseEvery: 3, offsets: { landscape: { "revenue::feb": { dx: 3.5, dy: -2 } } } };

const protectedIds = new Set(["chart-1"]);
const overrides = createVisualOverrides(base, edited, { packageId: "test", packageVersion: "1" }, protectedIds);
assert.ok(visualOverrideCount(overrides) >= 2);
assert.equal(overrides.document?.meta, undefined);

const refreshed = structuredClone(base);
refreshed.meta.period = "2026-09";
refreshed.pages[0].elements[1].chart.series[0].values = [10, 20];
const applied = applyVisualOverrides(refreshed, overrides, protectedIds);
const appliedTitle = applied.document.pages[0].elements.find((element) => element.id === "title-1");
const appliedChart = applied.document.pages[0].elements.find((element) => element.id === "chart-1");
assert.equal(appliedTitle.x, 24);
assert.equal(appliedTitle.content, "人工标题");
assert.equal(applied.document.meta.period, "2026-09");
assert.ok(appliedTitle.z > appliedChart.z);
assert.deepEqual(appliedChart.chart.series[0].values, [10, 20]);
assert.equal(appliedChart.chartLabels.offsets.landscape["revenue::feb"].dx, 3.5);
assert.equal(appliedChart.chartLabels.offsets.portrait, undefined);

const forgedOverrides = structuredClone(overrides);
forgedOverrides.document = { ...(forgedOverrides.document || {}), meta: { ...base.meta, period: "FORGED-META" } };
forgedOverrides.pages["page-1"].elements["chart-1"].patch = {
  ...(forgedOverrides.pages["page-1"].elements["chart-1"].patch || {}),
  content: "FORGED-CONTENT",
  runs: [{ text: "FORGED-CONTENT" }],
  chart: { categories: ["伪造"], categoryIds: ["forged"], series: [{ id: "revenue", name: "收入", values: [999] }] }
};
const forgedApplied = applyVisualOverrides(refreshed, forgedOverrides, protectedIds).document;
assert.equal(forgedApplied.meta.period, "2026-09");
assert.deepEqual(forgedApplied.pages[0].elements.find((element) => element.id === "chart-1").chart.series[0].values, [10, 20]);

const destructiveEdit = structuredClone(base);
destructiveEdit.pages[0].elements = destructiveEdit.pages[0].elements.filter((element) => element.id !== "chart-1");
const protectedRemoval = createVisualOverrides(base, destructiveEdit, { packageId: "test", packageVersion: "1" }, protectedIds);
assert.equal(protectedRemoval.pages?.["page-1"]?.elements?.["chart-1"]?.removed, undefined);
assert.ok(applyVisualOverrides(base, protectedRemoval, protectedIds).document.pages[0].elements.some((element) => element.id === "chart-1"));

const copiedChart = structuredClone(base.pages[0].elements.find((element) => element.id === "chart-1"));
copiedChart.id = "chart-copy";
copiedChart.name = "趋势 副本";
copiedChart.x += 4;
copiedChart.y += 4;
const duplicateEdit = structuredClone(base);
duplicateEdit.pages[0].elements.push(copiedChart);
const protectedDuplicate = createVisualOverrides(base, duplicateEdit, { packageId: "test", packageVersion: "1" }, protectedIds);
assert.equal(protectedDuplicate.pages?.["page-1"]?.elements?.["chart-copy"]?.added, undefined);

const forgedDestructiveOverrides = structuredClone(overrides);
forgedDestructiveOverrides.pages["page-1"].elements["chart-1"] = { removed: true };
forgedDestructiveOverrides.pages["page-1"].elements["chart-copy"] = { added: copiedChart };
const forgedDestructiveApplied = applyVisualOverrides(refreshed, forgedDestructiveOverrides, protectedIds).document;
assert.ok(forgedDestructiveApplied.pages[0].elements.some((element) => element.id === "chart-1"));
assert.ok(!forgedDestructiveApplied.pages[0].elements.some((element) => element.id === "chart-copy"));

const pagePatchAttack = structuredClone(overrides);
pagePatchAttack.pages["page-1"].patch = {
  name: "允许修改的页名",
  elements: [copiedChart, { ...copiedChart, id: "chart-copy" }]
};
pagePatchAttack.pages["page-1"].elementOrder = { 0: "chart-copy" };
pagePatchAttack.pages["page-1"].elements["chart-1"].patch = {
  ...(pagePatchAttack.pages["page-1"].elements["chart-1"].patch || {}),
  id: "forged-id",
  type: "box",
  role: "forged-role"
};
const pagePatchApplied = applyVisualOverrides(refreshed, pagePatchAttack, protectedIds).document;
assert.equal(pagePatchApplied.pages[0].name, "允许修改的页名");
assert.equal(pagePatchApplied.pages[0].elements.length, 2);
assert.ok(!pagePatchApplied.pages[0].elements.some((element) => element.id === "chart-copy"));
const pagePatchChart = pagePatchApplied.pages[0].elements.find((element) => element.id === "chart-1");
assert.equal(pagePatchChart.type, "chart");
assert.equal(pagePatchChart.role, undefined);
assert.deepEqual(pagePatchChart.chart.series[0].values, [10, 20]);

const addedTypeAttack = structuredClone(overrides);
addedTypeAttack.pages["page-1"].elements["old-fact-image"] = {
  added: { ...copiedChart, id: "old-fact-image", type: "image", content: "OLD SECRET", runs: undefined, chart: undefined }
};
for (const type of ["text", "chart", "table"]) {
  addedTypeAttack.pages["page-1"].elements[`blank-${type}`] = {
    added: { id: `blank-${type}`, type, name: `blank-${type}`, x: 1, y: 1, w: 10, h: 10, z: 9, style: {} }
  };
}
const addedTypeApplied = applyVisualOverrides(refreshed, addedTypeAttack, protectedIds).document;
const addedIds = addedTypeApplied.pages[0].elements.map((element) => element.id);
assert.ok(addedIds.includes("old-fact-image"));
assert.equal(addedTypeApplied.pages[0].elements.find((element) => element.id === "old-fact-image").content, undefined);
assert.ok(!addedIds.includes("blank-text"));
assert.ok(!addedIds.includes("blank-chart"));
assert.ok(!addedIds.includes("blank-table"));

const removedBase = structuredClone(base);
removedBase.pages[0].elements = removedBase.pages[0].elements.filter((element) => element.id !== "title-1");
assert.equal(applyVisualOverrides(removedBase, overrides, protectedIds).orphanCount, 1);
assert.deepEqual(applyVisualOverrides(refreshed, null, protectedIds).document, refreshed);

console.log("视觉覆盖测试通过：数据重编译保留人工几何和横版标签偏移，界面后备的生成及读取阶段拒绝绑定事实改写、删除和复制，报告元信息受保护，孤儿覆盖可见。");

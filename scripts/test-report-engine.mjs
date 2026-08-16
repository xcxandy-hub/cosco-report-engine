import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReportEngine } from "./report-engine-loader.mjs";

const engine = await loadReportEngine();
const independentPackage = (await import(new URL("../report-packages/finance-brief/report-package.mjs", import.meta.url).href)).default;
const reportPackage = JSON.parse(await readFile(new URL("./fixtures/bound-finance-report-package.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("./fixtures/bound-finance-redacted-data.json", import.meta.url), "utf8"));
const projectRoot = fileURLToPath(new URL("../", import.meta.url));

const copy = (value) => structuredClone(value);
const codes = (result) => result.issues.map((issue) => issue.code);
const errorIssues = (result) => result.issues.filter((issue) => issue.severity === "error");

function compileWithoutThrow(candidatePackage, data = fixture) {
  let result;
  assert.doesNotThrow(() => {
    result = engine.compileReportPackage(candidatePackage, data);
  });
  assert.ok(result && Array.isArray(result.issues), "compileReportPackage must return structured issues");
  return result;
}

function packageElement(candidatePackage, id) {
  return candidatePackage.pages.flatMap((page) => page.elements).find((element) => element.id === id);
}

test("finance package compiles with stable page and element ids", () => {
  const first = engine.compileReportPackage(independentPackage, {});
  const second = engine.compileReportPackage(independentPackage, {});
  assert.equal(first.issues.filter((issue) => issue.severity === "error").length, 0);
  assert.deepEqual(first.document.pages.map((page) => page.id), second.document.pages.map((page) => page.id));
  assert.deepEqual(first.document.pages.flatMap((page) => page.elements.map((element) => element.id)), second.document.pages.flatMap((page) => page.elements.map((element) => element.id)));
  assert.equal(first.document.pages.length, 10);
  assert.equal(first.document.updatedAt, independentPackage.documentUpdatedAt);
  assert.deepEqual(first.document, second.document);
});

test("independent packages have no centralized fields, formulas, rules, or bindings", () => {
  assert.equal(independentPackage.authoringMode, "independent");
  assert.equal(independentPackage.fields, undefined);
  assert.equal(independentPackage.dataSchemaVersion, undefined);
  assert.equal(independentPackage.derived, undefined);
  assert.equal(independentPackage.rules, undefined);
  assert.equal(independentPackage.inputSections, undefined);
  const elements = independentPackage.pages.flatMap((page) => page.elements);
  assert.ok(elements.some((element) => element.type === "chart" && element.chart));
  assert.ok(elements.some((element) => element.type === "table" && element.table));
  assert.equal(elements.some((element) => element.contentTemplate || element.chartBinding || element.tableBinding), false);

  const invalid = copy(independentPackage);
  invalid.fields = { "shared.value": { label: "集中值", type: "number" } };
  invalid.dataSchemaVersion = "1.0.0";
  invalid.derived = { "shared.double": { expression: { op: "multiply", args: [{ ref: "shared.value" }, { value: 2 }] } } };
  invalid.rules = [{ id: "cross-check", severity: "error", assert: { op: "eq", args: [{ value: 1 }, { value: 1 }] }, message: "不应出现" }];
  packageElement(invalid, "overview-chart").chartBinding = { categories: { value: ["一月"] }, series: [{ name: "集中序列", values: { value: [1] } }] };
  const invalidCodes = codes(compileWithoutThrow(invalid, {}));
  assert.ok(invalidCodes.includes("independent-fields"));
  assert.ok(invalidCodes.includes("independent-data-schema"));
  assert.ok(invalidCodes.includes("independent-derived"));
  assert.ok(invalidCodes.includes("independent-rules"));
  assert.ok(invalidCodes.includes("independent-binding"));
});

test("editing one independent chart does not mutate any other chart", () => {
  const document = engine.compileReportPackage(independentPackage, {}).document;
  const charts = document.pages.flatMap((page) => page.elements).filter((element) => element.type === "chart");
  assert.ok(charts.length > 1);
  const untouched = copy(charts[1].chart);
  charts[0].chart.categories[0] = "仅修改图一";
  charts[0].chart.series[0].values[0] = 987654;
  assert.deepEqual(charts[1].chart, untouched);
});

test("direct charts reject duplicate category and series stable ids", () => {
  const duplicate = copy(independentPackage);
  const chart = packageElement(duplicate, "overview-chart").chart;
  chart.categoryIds[1] = chart.categoryIds[0];
  chart.series[1].id = chart.series[0].id;
  const resultCodes = codes(compileWithoutThrow(duplicate, {}));
  assert.ok(resultCodes.includes("chart-category-id-duplicate"));
  assert.ok(resultCodes.includes("chart-series-id-duplicate"));
});

test("report packages require a stable document timestamp", () => {
  const missing = copy(reportPackage);
  delete missing.documentUpdatedAt;
  assert.ok(errorIssues(compileWithoutThrow(missing)).some((issue) => issue.code === "document-updated-at"));
});

test("declarative data migrations preserve local values across package revisions", () => {
  const migratedPackage = copy(reportPackage);
  migratedPackage.dataSchemaVersion = "2.0.0";
  migratedPackage.dataMigrations = [{
    from: "1.0.0",
    to: "2.0.0",
    rename: { "report.sourceLegacy": "report.source" },
    defaults: { "report.author": "迁移默认编制人" }
  }];
  const oldData = copy(fixture);
  oldData.report.sourceLegacy = "历史财务台账";
  delete oldData.report.source;
  delete oldData.report.author;
  const migration = engine.migrateReportData(migratedPackage, "1.0.0", oldData);
  assert.equal(migration.issues.length, 0);
  assert.equal(migration.migrated, true);
  assert.equal(engine.getPathValue(migration.data, "report.source"), "历史财务台账");
  assert.equal(engine.getPathValue(migration.data, "report.sourceLegacy"), undefined);
  assert.equal(engine.getPathValue(migration.data, "report.author"), "迁移默认编制人");
});

test("missing required and dirty numeric values fail closed", () => {
  const missing = copy(fixture);
  delete missing.report.period;
  assert.ok(codes(engine.compileReportPackage(reportPackage, missing)).includes("required"));
  const dirty = copy(fixture);
  dirty.metrics.revenue.monthly[2] = "188x";
  const dirtyCodes = codes(engine.compileReportPackage(reportPackage, dirty));
  assert.ok(dirtyCodes.includes("type"));
  assert.ok(dirtyCodes.includes("chart-binding"));
});

test("zero and negative comparison bases do not manufacture growth rates", () => {
  const zero = copy(fixture);
  zero.metrics.revenue.priorCurrent = 0;
  const zeroResult = engine.compileReportPackage(reportPackage, zero);
  assert.equal(zeroResult.resolvedData.metrics.revenue.yoy, null);
  assert.match(zeroResult.document.pages[1].elements.find((element) => element.id === "revenue-kpi-note").content, /待填/);
  const negative = copy(fixture);
  negative.metrics.profit.priorCurrent = -10;
  assert.equal(engine.compileReportPackage(reportPackage, negative).resolvedData.metrics.profit.yoy, null);
});

test("zero denominator invalidates a bound series", () => {
  const data = copy(fixture);
  data.metrics.volume.monthly[3] = 0;
  const result = engine.compileReportPackage(reportPackage, data);
  assert.equal(result.resolvedData.metrics.unitRevenue.monthly[3], null);
  assert.ok(codes(result).includes("chart-binding"));
});

test("source data cannot override derived paths", () => {
  const data = copy(fixture);
  data.metrics.revenue.current = -12345;
  data.metrics.revenue.yoy = 999;
  const result = engine.compileReportPackage(reportPackage, data);
  const expectedYoy = ((216 - 190) / 190) * 100;
  assert.equal(result.resolvedData.metrics.revenue.current, 216);
  assert.ok(Math.abs(result.resolvedData.metrics.revenue.yoy - expectedYoy) < 1e-12);
  const note = result.document.pages.flatMap((page) => page.elements).find((element) => element.id === "revenue-kpi-note");
  assert.match(note.content, /\+13\.7%/);
  assert.doesNotMatch(note.content, /999/);
});

test("unknown text bindings are structured errors", () => {
  const unknownBinding = copy(reportPackage);
  const element = packageElement(unknownBinding, "overview-lead");
  element.contentTemplate = "{{commentary.overveiw}}";
  const result = compileWithoutThrow(unknownBinding);
  assert.ok(errorIssues(result).some((issue) =>
    issue.code === "text-binding-ref" && issue.path?.endsWith(".contentTemplate")
  ));
});

test("missing content and master image assets are rejected", () => {
  const missingAssets = copy(reportPackage);
  const page = missingAssets.pages[0];
  page.masterProps = { ...(page.masterProps || {}), imageAssetId: "missing-master-asset" };
  page.elements.push({
    id: "missing-content-image",
    type: "image",
    name: "缺失内容图片",
    x: 31,
    y: 150,
    w: 60,
    h: 40,
    assetId: "missing-content-asset",
    style: {}
  });
  const result = compileWithoutThrow(missingAssets);
  const assetIssues = errorIssues(result).filter((issue) => /asset|image/i.test(issue.code));
  const touches = (issue, ...needles) => needles.some((needle) =>
    issue.locator === needle || issue.path?.includes(needle) || issue.message.includes(needle)
  );
  const contentIssue = assetIssues.find((issue) => touches(issue, "missing-content-image", "missing-content-asset"));
  const masterIssue = assetIssues.find((issue) => touches(issue, page.id, "masterProps.imageAssetId", "missing-master-asset"));
  assert.ok(contentIssue, "missing content image asset must produce an asset/image error");
  assert.ok(masterIssue, "missing master image asset must produce an asset/image error");
  assert.notEqual(contentIssue, masterIssue, "content and master image references must be checked independently");
});

test("valid embedded PNG assets compile for content and master images", () => {
  const withAsset = copy(reportPackage);
  const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6rj4AAAAASUVORK5CYII=";
  const asset = {
    id: "valid-png-asset",
    kind: "image",
    mime: "image/png",
    width: 1,
    height: 1,
    byteSize: Buffer.from(pngBase64, "base64").byteLength,
    sourceName: "pixel.png"
  };
  withAsset.assets = [asset];
  withAsset.assetData = { [asset.id]: `data:${asset.mime};base64,${pngBase64}` };
  const page = withAsset.pages[0];
  page.masterProps = { ...(page.masterProps || {}), imageAssetId: asset.id };
  page.elements.push({
    id: "valid-content-image",
    type: "image",
    name: "有效内容图片",
    x: 31,
    y: 150,
    w: 60,
    h: 40,
    assetId: asset.id,
    style: {}
  });
  const result = compileWithoutThrow(withAsset);
  assert.equal(errorIssues(result).length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(result.document.assets)), [asset]);
  assert.equal(result.document.pages[0].masterProps.imageAssetId, asset.id);
  assert.equal(result.document.pages[0].elements.find((element) => element.id === "valid-content-image").assetId, asset.id);
});

test("embedded image assets reject spoofed signatures and non-canonical base64", () => {
  const spoofed = copy(reportPackage);
  const payload = Buffer.from("NOT_A_PNG").toString("base64");
  spoofed.assets = [{ id: "spoofed-png", kind: "image", mime: "image/png", width: 1, height: 1, byteSize: Buffer.from(payload, "base64").byteLength }];
  spoofed.assetData = { "spoofed-png": `data:image/png;base64,${payload}` };
  assert.ok(errorIssues(compileWithoutThrow(spoofed)).some((issue) => issue.code === "asset-signature"));

  const malformed = copy(spoofed);
  malformed.assetData["spoofed-png"] = "data:image/png;base64,Zh==";
  assert.ok(errorIssues(compileWithoutThrow(malformed)).some((issue) => issue.code === "asset-data"));
});

test("invalid orientation returns a structured issue instead of throwing", () => {
  const invalidOrientation = copy(reportPackage);
  invalidOrientation.pages[1].orientation = "square";
  const result = compileWithoutThrow(invalidOrientation);
  assert.ok(errorIssues(result).some((issue) => issue.code === "orientation" && issue.path === invalidOrientation.pages[1].id));
});

test("malformed chart binding expressions return structured issues", () => {
  const malformedChart = copy(reportPackage);
  const chart = packageElement(malformedChart, "overview-chart");
  chart.chartBinding.categories = { op: "eval", args: [] };
  const chartResult = compileWithoutThrow(malformedChart);
  assert.ok(errorIssues(chartResult).some((issue) =>
    issue.code === "derived-expression" && issue.path?.endsWith(".chartBinding.categories")
  ));
});

test("malformed table binding expressions return structured issues", () => {
  const malformedTable = copy(reportPackage);
  const table = packageElement(malformedTable, "revenue-table");
  table.tableBinding.rows = { op: "eval", args: [] };
  const tableResult = compileWithoutThrow(malformedTable);
  assert.ok(errorIssues(tableResult).some((issue) =>
    issue.code === "derived-expression" && issue.path?.endsWith(".tableBinding.rows")
  ));
});

test("direct element data and text content are schema validated", () => {
  const malformed = copy(reportPackage);
  const chart = packageElement(malformed, "overview-chart");
  delete chart.chartBinding;
  chart.chart = { categories: ["一月"], series: "not-an-array" };
  const table = packageElement(malformed, "revenue-table");
  delete table.tableBinding;
  table.table = { headers: ["列"], rows: "not-an-array" };
  const text = packageElement(malformed, "overview-lead");
  text.content = { unsafe: true };
  const result = compileWithoutThrow(malformed);
  assert.ok(errorIssues(result).some((issue) => issue.code === "chart-series"));
  assert.ok(errorIssues(result).some((issue) => issue.code === "table-rows"));
  assert.ok(errorIssues(result).some((issue) => issue.code === "text-content"));
  assert.equal(result.document.pages.length, 0);
});

test("expression options cannot create non-finite values", () => {
  const invalid = copy(reportPackage);
  invalid.derived["metrics.cashflow.current"].expression = { op: "round", args: [{ value: 1.23 }], digits: 999 };
  const result = compileWithoutThrow(invalid);
  assert.ok(errorIssues(result).some((issue) => issue.code === "derived-expression-digits"));
  assert.equal(result.document.pages.length, 0);
});

test("unknown package properties and undeclared asset data fail closed", () => {
  const privatePackage = copy(reportPackage);
  privatePackage.privateNote = "MUST-NOT-BE-EMBEDDED";
  privatePackage.assetData = { undeclared: "data:image/png;base64,UFJJVkFURQ==" };
  const result = compileWithoutThrow(privatePackage);
  assert.ok(errorIssues(result).some((issue) => issue.code === "package-property"));
  assert.ok(errorIssues(result).some((issue) => issue.code === "unused-asset-data"));
  assert.equal(result.document.pages.length, 0);
});

test("formula cycles are reported without executing arbitrary code", () => {
  const cyclic = copy(reportPackage);
  cyclic.derived = {
    ...cyclic.derived,
    "cycle.a": { expression: { ref: "cycle.b" } },
    "cycle.b": { expression: { ref: "cycle.a" } }
  };
  assert.ok(codes(engine.compileReportPackage(cyclic, fixture)).includes("derived-cycle"));
  const unknown = copy(reportPackage);
  unknown.derived = { "bad.value": { expression: { op: "eval", args: [{ value: "globalThis" }] } } };
  assert.ok(codes(engine.compileReportPackage(unknown, fixture)).includes("derived-expression"));
});

test("duplicate ids and invalid geometry are structural errors", () => {
  const duplicate = copy(reportPackage);
  duplicate.pages[1].id = duplicate.pages[0].id;
  duplicate.pages[1].elements[0].id = duplicate.pages[0].elements[0].id;
  duplicate.pages[1].elements[1].x = 999;
  duplicate.pages[1].elements[2].w = Number.NaN;
  const resultCodes = codes(engine.compileReportPackage(duplicate, fixture));
  assert.ok(resultCodes.includes("duplicate-page"));
  assert.ok(resultCodes.includes("duplicate-element"));
  assert.ok(resultCodes.includes("out-of-page"));
  assert.ok(resultCodes.includes("geometry"));
});

test("reconciliation failure includes its stable locator", () => {
  const data = copy(fixture);
  data.revenueTypes.current[0] += 1;
  const issue = engine.compileReportPackage(reportPackage, data).issues.find((item) => item.code === "rule:revenue-structure");
  assert.equal(issue?.locator, "revenue-table");
});

test("finance revenue table is derived from canonical labels and values", () => {
  const data = copy(fixture);
  data.revenueTypes.current = [167, 27, 13, 9];
  data.revenueTypes.rows = [["运费收入", "177.0", "81.9%"], ["滞期费收入", "17.0", "7.9%"], ["船租收入", "13.0", "6.0%"], ["舱租收入", "9.0", "4.2%"]];
  const result = compileWithoutThrow(reportPackage, data);
  assert.equal(errorIssues(result).length, 0);
  const table = result.document.pages.flatMap((page) => page.elements).find((element) => element.id === "revenue-table");
  const total = data.revenueTypes.current.reduce((sum, value) => sum + value, 0);
  const expectedRows = data.revenueTypes.labels.map((label, index) => [
    label,
    data.revenueTypes.current[index].toFixed(1),
    `${((data.revenueTypes.current[index] / total) * 100).toFixed(1)}%`
  ]);
  const actualRows = JSON.parse(JSON.stringify(table.table.rows));
  assert.deepEqual(actualRows, expectedRows);
  assert.notDeepEqual(actualRows, data.revenueTypes.rows);
});

test("malformed packages return structured issues instead of throwing", () => {
  const missingTopLevel = copy(reportPackage);
  delete missingTopLevel.meta;
  delete missingTopLevel.pages;
  const topLevelResult = compileWithoutThrow(missingTopLevel);
  assert.ok(errorIssues(topLevelResult).some((issue) => issue.code === "meta"));
  assert.ok(errorIssues(topLevelResult).some((issue) => issue.code === "pages"));
  assert.equal(topLevelResult.document.pages.length, 0);

  const missingElements = copy(reportPackage);
  delete missingElements.pages[0].elements;
  const elementsResult = compileWithoutThrow(missingElements);
  assert.ok(errorIssues(elementsResult).some((issue) => issue.code === "elements" && issue.path === missingElements.pages[0].id));
});

test("prototype-pollution paths are rejected as structured issues", () => {
  const polluted = copy(reportPackage);
  polluted.fields["__proto__.polluted"] = { label: "非法", type: "text" };
  const result = engine.compileReportPackage(polluted, fixture);
  assert.ok(codes(result).includes("field-path"));
  assert.equal({}.polluted, undefined);
});

test("preview replaces every sensitive source value", () => {
  const secret = copy(fixture);
  Object.entries(reportPackage.fields).forEach(([path, definition], index) => {
    if (!definition.sensitive) return;
    const value = definition.type === "number" ? 987654 + index
      : definition.type === "number[]" ? [987654 + index, 987655 + index]
        : definition.type === "table" ? [[`SECRET-${index}`, "987654"]]
          : definition.type === "boolean" ? true
            : definition.type === "string[]" ? [`SECRET-${index}`]
              : `SECRET-${index}`;
    engine.setPathValue(secret, path, value);
  });
  const preview = engine.createPreviewData(reportPackage, secret);
  const serialized = JSON.stringify(preview);
  for (const [path, definition] of Object.entries(reportPackage.fields)) {
    if (!definition.sensitive) continue;
    const original = engine.getPathValue(secret, path);
    assert.notDeepEqual(engine.getPathValue(preview, path), original, path);
    if (typeof original === "string" && original.startsWith("SECRET-")) assert.equal(serialized.includes(original), false, path);
  }
  assert.equal(serialized.includes("SECRET-"), false);
  assert.equal(serialized.includes("987654"), false);
});

test("redacted preview compiles into a complete historical table", () => {
  const preview = engine.createPreviewData(reportPackage, fixture);
  const result = compileWithoutThrow(reportPackage, preview);
  assert.equal(errorIssues(result).length, 0);
  const table = result.document.pages.flatMap((page) => page.elements).find((element) => element.id === "history-table");
  assert.deepEqual(table.table.headers, ["指标", "2023", "2024", "2025", "2026同期"]);
  assert.equal(table.table.rows.length, 5);
  assert.ok(table.table.rows.every((row) => row.length === table.table.headers.length));
  assert.equal(table.table.rows[3][4], "10157");
});

test("preview CLI rejects a generated preview that cannot compile", async () => {
  const directory = await mkdtemp(join(tmpdir(), "report-engine-preview-"));
  try {
    const invalidPreviewPackage = copy(reportPackage);
    delete invalidPreviewPackage.fields["history.priorRows"].preview;
    const packagePath = join(directory, "package.json");
    const dataPath = join(directory, "data.json");
    const outputPath = join(directory, "preview.json");
    await writeFile(packagePath, JSON.stringify(invalidPreviewPackage));
    await writeFile(dataPath, JSON.stringify(fixture));
    const result = spawnSync(process.execPath, ["scripts/report-engine-cli.mjs", "preview", packagePath, dataPath, outputPath], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /table-binding|脱敏预览无法完整编译/);
    await assert.rejects(readFile(outputPath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("preview data excludes undeclared fields at every depth", () => {
  const source = copy(fixture);
  source.undeclaredSecret = "TOP-SECRET-987";
  source.report.undeclaredSecret = "NESTED-SECRET-654";
  const preview = engine.createPreviewData(reportPackage, source);
  const serialized = JSON.stringify(preview);
  assert.equal(engine.getPathValue(preview, "undeclaredSecret"), undefined);
  assert.equal(engine.getPathValue(preview, "report.undeclaredSecret"), undefined);
  assert.equal(serialized.includes("TOP-SECRET-987"), false);
  assert.equal(serialized.includes("NESTED-SECRET-654"), false);
  assert.equal(engine.getPathValue(preview, "report.organization"), fixture.report.organization);
});

test("theme URLs and remote resources are rejected", () => {
  const unsafeTheme = copy(reportPackage);
  unsafeTheme.theme.primary = "url(https://example.invalid/private-leak)";
  unsafeTheme.theme.chartPalette[0] = "https://example.invalid/palette.css";
  unsafeTheme.theme.fontSlots.body = "url(https://example.invalid/private-font.woff2)";
  const result = compileWithoutThrow(unsafeTheme);
  assert.ok(errorIssues(result).some((issue) => issue.code === "theme-color" && issue.path === "theme.primary"));
  assert.ok(errorIssues(result).some((issue) => issue.code === "theme-palette" && issue.path === "theme.chartPalette"));
  assert.ok(errorIssues(result).some((issue) => issue.code === "theme-font" && issue.path === "theme.fontSlots"));
});

test("element styles reject font sizes outside the model whitelist", () => {
  const invalidStyle = copy(reportPackage);
  const element = packageElement(invalidStyle, "overview-title");
  element.style.fontSize = 999;
  const result = compileWithoutThrow(invalidStyle);
  assert.ok(errorIssues(result).some((issue) =>
    /font|style/i.test(issue.code)
    && (issue.locator === element.id || issue.path?.endsWith("style.fontSize"))
  ));
});

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const failures = [];
const requireCondition = (condition, message) => {
  if (!condition) failures.push(message);
};

const [
  versionText,
  packageText,
  manifestText,
  model,
  templates,
  app,
  readme,
  architecture,
  featureBaseline,
  contract,
  onlineResearch,
  reportStudy,
  reportEngine,
  financePackage,
  reportEngineTest,
  cellGridTest,
  dynamicPagesTest,
  engineCli,
  printPdf,
  inspectPdf,
  runInspectPdf,
  engineWorkflow,
  createReportPrompt,
  githubResearch,
  legacyParity,
  visualOverrides,
  visualOverrideTest,
  assetStore,
  assetStoreTest,
  reportEngineArchitecture,
  skillLearnings,
  pageTemplates,
  brandAssets,
  templateTest,
  brandScript,
  layoutStudy,
  coverNotice
] = await Promise.all([
  read("VERSION"),
  read("package.json"),
  read("release/v1.8.0.json"),
  read("src/model.ts"),
  read("src/templates.ts"),
  read("src/App.tsx"),
  read("README.md"),
  read("docs/architecture.md"),
  read("docs/feature-baseline-v1.8.0.md"),
  read("docs/contracts-v1.8.0.md"),
  read("docs/online-editor-research-v1.4.md"),
  read("docs/institutional-report-design-study-v1.4.md"),
  read("src/report-engine.ts"),
  read("report-packages/finance-brief/report-package.json"),
  read("scripts/test-report-engine.mjs"),
  read("scripts/test-cell-grid.mjs"),
  read("scripts/test-dynamic-pages.mjs"),
  read("scripts/report-engine-cli.mjs"),
  read("scripts/print-pdf.mjs"),
  read("scripts/inspect-pdf.py"),
  read("scripts/run-inspect-pdf.mjs"),
  read(".agents/skills/cosco-report/references/report-engine-workflow.md"),
  read(".agents/skills/cosco-report/references/prompt-create-report.md"),
  read("docs/github-skill-research.md"),
  read("docs/legacy-finance-parity-v1.5.0.md"),
  read("src/visual-overrides.ts"),
  read("scripts/test-visual-overrides.mjs"),
  read("src/asset-store.ts"),
  read("scripts/test-asset-store.mjs"),
  read("docs/report-engine-architecture.md"),
  read("docs/skill-learnings.md"),
  read("src/page-templates.ts"),
  read("src/brand-assets.ts"),
  read("scripts/test-page-templates.mjs"),
  read("scripts/generate-brand-assets.mjs"),
  read("docs/institutional-layout-study-v1.8.0.md"),
  read("src/assets/brand/covers/NOTICE.md")
]);

const [
  mainSkill,
  modifyReportPrompt,
  modifyCorePrompt,
  thirdPartyNotices,
  securityPolicy,
  licenseText,
  offlineCheck,
  viteConfig,
  templateVisualQa,
  templateVisualInspectionText
] = await Promise.all([
  read(".agents/skills/cosco-report/SKILL.md"),
  read(".agents/skills/cosco-report/references/prompt-modify-specialized-report.md"),
  read(".agents/skills/cosco-report/references/prompt-modify-core-engine.md"),
  read("docs/third-party-methodology-notices.md"),
  read("SECURITY.md"),
  read("LICENSE"),
  read("scripts/check-offline.mjs"),
  read("vite.config.ts"),
  read("scripts/template-visual-qa.mjs"),
  read("artifacts/template-visual-qa/inspection.json")
]);

const version = versionText.trim();
const packageJson = JSON.parse(packageText);
const manifest = JSON.parse(manifestText);
const financePackageObject = JSON.parse(financePackage);
const financeElements = financePackageObject.pages.flatMap((page) => page.elements);
const templateVisualInspection = JSON.parse(templateVisualInspectionText);

requireCondition(version === "1.8.0", `VERSION 应为 1.8.0，实际为 ${version}`);
requireCondition(packageJson.version === version, "package.json.version 与 VERSION 不一致");
requireCondition(manifest.applicationVersion === version, "发布清单应用版本与 VERSION 不一致");
requireCondition(manifest.documentSchemaVersion === "1.5", "发布清单 schema 应为 1.5");
requireCondition(manifest.reportEngineVersion === "0.1", "发布清单内核版本应为 0.1");
requireCondition(manifest.status === "release-candidate", "发布清单状态应为 release-candidate");
requireCondition(/version:\s*"1\.5";/.test(model), "ReportDocument 类型没有锁定为 1.5");
requireCondition(/document\.version\s*=\s*"1\.5"/.test(model), "迁移出口没有写入 1.5");
requireCondition(/\["1\.0",\s*"1\.1",\s*"1\.2",\s*"1\.3",\s*"1\.4",\s*"1\.5"\]/.test(model), "迁移入口没有明确接受 1.0-1.5");
requireCondition((templates.match(/version:\s*"1\.5"/g) || []).length >= 2, "默认模板没有全部写入 schema 1.5");

const elementType = model.match(/export type ElementType\s*=\s*([^;]+);/)?.[1] || "";
for (const type of ["text", "box", "divider", "image", "chart", "table"]) {
  requireCondition(elementType.includes(`"${type}"`), `基础元素联合类型缺少 ${type}`);
}
for (const legacyType of ["title", "kpi", "quote", "source", "line-chart", "bar-chart", "combo-chart", "donut-chart"]) {
  requireCondition(!elementType.includes(`"${legacyType}"`), `1.8 基础元素联合类型仍包含旧类型 ${legacyType}`);
}
requireCondition(model.includes("export type SemanticRole") && model.includes('semanticRole?: SemanticRole'), "文本语义角色模型缺失");
requireCondition(model.includes("groupId?: string") && model.includes("presetSlot?: string"), "组合元数据缺失");
requireCondition(model.includes("chartKind?: ChartKind"), "统一图表类型字段缺失");
requireCondition(model.includes("function expandLegacyElement"), "旧元素原子化迁移缺失");
requireCondition(templates.includes("function makePreset") && templates.includes('category: "basic"') && templates.includes('category: "composition"'), "组件库没有区分基础元素与组合模块");
requireCondition(templates.includes('StarterKey = "professional" | "finance" | "publication" | "blank"'), "研究出版模板入口缺失");
requireCondition(templates.includes('id: "editorial-neutral"') && templates.includes('id: "maritime-publication"'), "研究主题缺失");

requireCondition(app.includes("function NativeTextEditor"), "页内原生文本编辑器缺失");
requireCondition(app.includes("expandSelectionToGroups") && app.includes("const ungroupSelection"), "组合选择或拆组命令缺失");
requireCondition(app.includes("const lockSelection") && app.includes("const hideSelection"), "组合锁定或隐藏命令缺失");
requireCondition(app.includes('element.semanticRole === "source"'), "来源检查没有使用语义角色");
requireCondition(app.includes('element.chartKind === "combo"'), "统一图表类型没有接入渲染或属性面板");
requireCondition(app.includes('addEventListener("wheel", onWheel, { passive: false })'), "Ctrl/Cmd 滚轮缩放监听缺失");
requireCondition(app.includes("const alignSelection") && app.includes("const distributeSelection"), "显式对齐或分布命令缺失");
requireCondition(app.includes('<Section title="页面背景图"'), "页面背景检查器缺失");

const forbiddenEditorApis = ["contentEditable", "contenteditable", "execCommand", "getSelection"];
for (const api of forbiddenEditorApis) requireCondition(!app.includes(api), `src/App.tsx 出现禁用编辑 API：${api}`);

requireCondition(readme.includes("ReportDocument 1.5") && readme.includes("1.8.0") && readme.includes("5 套封面") && readme.includes("3 套页眉页脚"), "README 没有声明当前 v1.8.0、schema 或模板库");
requireCondition(/\["ReportDocument 1\.5"\]/.test(architecture), "架构数据流没有声明 ReportDocument 1.5");
requireCondition(featureBaseline.includes("应用版本：`1.8.0`") && featureBaseline.includes("共 5 套") && featureBaseline.includes("共 3 套") && featureBaseline.includes("v1.7.0 的 independent"), "特性基线没有固化 v1.8 模板或 v1.7 兼容边界");
requireCondition(contract.includes("工程格式：`ReportDocument 1.5`"), "契约文档 schema 不正确");
requireCondition(contract.includes('authoringMode: "independent" | "bound"') && contract.includes("不建立跨组件引用、派生或勾稽"), "契约没有明确 independent/bound 模式或组件独立边界");
requireCondition(contract.includes("选中图表或表格后") && contract.includes("保存只修改当前元素") && contract.includes("不设置固定最大页数"), "契约没有固化组件旁编辑、隔离保存或动态页数");
requireCondition(contract.includes("智能体新建报告包一律使用 `independent`") && engineWorkflow.includes("智能体新建报告包一律选择"), "Skill 或契约没有禁止智能体新建 bound 报告");
for (const vendor of ["Canva", "Adobe Express", "Piktochart", "Visme"]) requireCondition(onlineResearch.includes(vendor), `在线调研缺少 ${vendor}`);
for (const sample of ["25e0a7ad-3af6-4869-83c9-3841cc15f094.pdf", "JPMorganOutlook2026PromiseandPressure.pdf", "ceo28-survey-transport-logistics-industry.pdf", "gr-shipping-trends-survey-report-noexp.pdf", "mi-guide-to-the-markets-us.pdf", "rmt2025_en.pdf", "transportation-logistics-services-sector-update.pdf"]) {
  requireCondition(reportStudy.includes(sample), `研报逐项学习缺少 ${sample}`);
}
for (const institution of ["Maersk Annual Report 2025", "Goldman Sachs Annual Report 2025", "COSCO SHIPPING International Annual Report 2024", "McKinsey Technology Trends Outlook 2025"]) requireCondition(layoutStudy.includes(institution), `v1.8 机构版式研究缺少 ${institution}`);

for (const id of ["cinematic-fullbleed", "editorial-monogram", "institutional-rail", "split-image-panel", "publication-window"]) requireCondition(pageTemplates.includes(`\"${id}\"`), `封面模板缺少 ${id}`);
for (const id of ["minimal-rule", "brand-rail", "editorial-corner"]) requireCondition(pageTemplates.includes(`\"${id}\"`), `页眉页脚模板缺少 ${id}`);
requireCondition(pageTemplates.includes("page.elements.filter((item) => !isPageChrome(item))") && pageTemplates.includes("page.orientation"), "模板没有保护正文或按页面方向生成");
requireCondition(pageTemplates.includes("coverTemplateRequiredAssetIds") && pageTemplates.includes("page.masterProps?.imageAssetId") && pageTemplates.includes("footerMode === \"confidentiality-last\"") && pageTemplates.includes("syncPageDecorationElements"), "模板没有保留母版图片、限制实际资产或同步制度元素");
requireCondition(app.includes('type LeftTab = "pages" | "components" | "templates"') && app.includes("applyCoverLayout") && app.includes("applyChromeLayout"), "编辑器缺少模板栏或应用动作");
requireCondition(templateTest.includes('for (const orientation of ["portrait", "landscape"])') && templateTest.includes("模板元素不可直接编辑") && templateTest.includes("删除了正文") && templateTest.includes("误把 Logo 当成封面图") && templateTest.includes("未遵守密级仅末页") && templateTest.includes("安装了未使用的模板预览图或 Logo") && templateTest.includes("删除末页后新末页没有恢复密级") && templateTest.includes("章节变化后模板页眉没有同步"), "模板测试没有覆盖横竖版、可编辑性、正文保护、母版图片、资产最小化或制度元素生命周期");
requireCondition(brandAssets.includes("?inline") && brandAssets.includes("logoColor") && brandAssets.includes("logoWhite") && brandAssets.includes("logoLockup"), "内置品牌资源或单文件内联缺失");
requireCondition(brandScript.includes("metadata.hasAlpha") && brandScript.includes("cornerAlpha") && brandScript.includes("EXPECTED") && brandScript.includes("与固化尺寸、字节数或 SHA-256 不一致"), "品牌资源脚本没有验证透明 PNG 或固化尺寸、字节数和哈希");
requireCondition(coverNotice.includes("Public domain") && coverNotice.includes("CC0 1.0") && coverNotice.includes("Wikimedia Commons"), "封面起始图缺少可再分发来源说明");
requireCondition(packageJson.scripts["qa:templates"] === "node scripts/template-visual-qa.mjs" && packageJson.scripts["verify:release"].includes("qa:templates") && manifest.requiredChecks?.includes("qa:templates"), "发布门禁没有包含全模板视觉矩阵");
requireCondition(templateVisualQa.includes("COVER_TEMPLATES") && templateVisualQa.includes("CHROME_TEMPLATES") && templateVisualQa.includes("template-matrix.pdf") && templateVisualQa.includes("--expected-document"), "模板视觉矩阵没有覆盖全部模板或真实 PDF 逐页检查");
requireCondition(templateVisualInspection.pages === 16 && !templateVisualInspection.errors?.length && !templateVisualInspection.warnings?.length && templateVisualInspection.pageSizes?.every((page) => page.a4Matched && page.expectedOrientation === page.actualOrientation), "模板视觉矩阵检查结果不是 16 页零错误零警告的横竖 A4");

requireCondition(packageJson.scripts["check:offline"].includes("--require-csp") && viteConfig.includes("offline-content-security-policy") && viteConfig.includes("connect-src 'none'") && viteConfig.includes("modulePreload: { polyfill: false }"), "通用构建缺少严格 CSP 或仍注入 fetch 模块预加载代码");
for (const api of ["fetch", "XMLHttpRequest", "WebSocket", "sendBeacon", "EventSource"]) requireCondition(offlineCheck.includes(api), `离线检查没有拒绝运行时网络 API：${api}`);
requireCondition(mainSkill.includes("16 页全模板真实打印矩阵") && mainSkill.includes("connect-src 'none'") && securityPolicy.includes("local-first"), "Skill 或安全文档没有固化模板矩阵与本地隐私边界");
requireCondition(createReportPrompt.includes("图表序列必须给有限数值") && createReportPrompt.includes("文字和表格文本可用星号"), "新建提示词的脱敏占位与图表数值验证器冲突");
requireCondition(modifyReportPrompt.includes("先读取并锁定现有 `authoringMode`") && modifyReportPrompt.includes("不得在修改中偷换模式") && modifyReportPrompt.includes("fields / derived / rules / bindings"), "修改特化报告提示词没有区分 independent 与 bound");
requireCondition(modifyCorePrompt.includes("内核") && thirdPartyNotices.includes("排除于 MIT 许可范围") && licenseText.includes("They are not") && licenseText.includes("licensed under the MIT License"), "核心修改提示词、第三方说明或商标资产许可证边界缺失");

requireCondition(reportEngine.includes('REPORT_ENGINE_VERSION = "0.1"'), "报告内核版本缺失");
requireCondition(reportEngine.includes("function validateBindingTemplate") && reportEngine.includes("function selectDeclaredData"), "报告内核绑定或声明字段边界缺失");
requireCondition(reportEngine.includes("document: emptyDocument(packageObject)") && reportEngine.includes("assets: cloneValue(reportPackage.assets || [])"), "报告内核 fail-closed 或资产编译缺失");
requireCondition(reportEngine.includes("function validateDirectChart") && reportEngine.includes("function validateDirectTable") && reportEngine.includes("documentUpdatedAt"), "报告内核静态数据 schema 或可复现时间边界缺失");
requireCondition(reportEngine.includes("export function migrateReportData") && reportEngine.includes("dataMigrations"), "报告内核声明式数据迁移缺失");
requireCondition(!/\beval\s*\(|\bFunction\s*\(/.test(reportEngine), "报告内核出现任意代码执行 API");
requireCondition(reportEngine.includes('const authoringMode = reportPackage.authoringMode || "bound"') && reportEngine.includes('code: "independent-fields"') && reportEngine.includes('code: "independent-binding"'), "报告内核没有兼容旧 bound 默认值或拒绝 independent 集中字段/绑定");
requireCondition(financePackageObject.authoringMode === "independent" && financePackageObject.pages.length > 0, "财务参考包不是有效的 independent 模板");
for (const key of ["dataSchemaVersion", "fields", "derived", "rules", "inputSections", "dataMigrations"]) {
  requireCondition(!Object.hasOwn(financePackageObject, key), `independent 财务参考包不应声明 ${key}`);
}
requireCondition(financeElements.filter((element) => element.type === "chart" && element.chart).length >= 2, "independent 财务参考包缺少多个直接数据图表");
requireCondition(financeElements.some((element) => element.type === "table" && element.table), "independent 财务参考包缺少直接数据表格");
requireCondition(!financeElements.some((element) => element.contentTemplate || element.chartBinding || element.tableBinding), "independent 财务参考包仍包含绑定");
requireCondition(financePackageObject.assets?.length >= 3 && financeElements.some((element) => element.presetId === "cover-template:cinematic-fullbleed") && financePackageObject.pages.slice(1).every((page) => page.elements.some((element) => element.presetId === "chrome-template:brand-rail")), "财务参考包没有固化品牌封面、图片或内容页模板");
requireCondition(reportEngine.includes('element.presetId?.startsWith("chrome-template:")') && reportEngine.includes("return []"), "显式页眉页脚模板仍会叠加默认 decorations");
requireCondition(reportEngineTest.includes("editing one independent chart does not mutate any other chart") && reportEngineTest.includes("independent-fields") && reportEngineTest.includes("bound-finance-report-package.json"), "内核测试没有同时覆盖独立图表隔离和旧 bound 兼容");
requireCondition(cellGridTest.includes("第一次撤销没有回到第一次应用") && cellGridTest.includes("Excel 区域粘贴失败") && cellGridTest.includes("系列重排没有携带稳定 ID") && cellGridTest.includes("图 A 修改污染图 B"), "单元格浏览器测试未覆盖逐次撤销、Excel 粘贴、稳定 ID 重排或组件隔离");
requireCondition(app.includes("suppliedProject={{ document: compiledDocument, assetData: runtimeAssetData }}") && app.includes("浏览器存储不可用，本次内容不会自动保存"), "特化运行时资产或存储失败路径缺失");
requireCondition(app.includes("validateDocument(compiledDocument, [], { allowTextOnlyMasters: true })") && app.includes('code: "print-quality"'), "特化运行时未复用打印质量检查或未分级为提示");
requireCondition(app.includes("function IndependentReportRuntime") && app.includes('format: "report-engine-independent-v1"') && app.includes('mode: "independent"'), "独立模板完整文档运行时缺失");
requireCondition(app.includes('return `local-report-document:${reportPackage.id}`') && app.includes('return `report-package:${reportPackage.id}:independent`'), "独立模板文档或资产没有按报告包命名空间隔离");
requireCondition(app.includes('? <IndependentReportRuntime bootstrap={bootstrap} />') && app.includes("onProjectChange(document, assetData)") && app.includes("自动保存失败"), "独立模板没有直接进入编辑器或完整文档保存失败路径缺失");
requireCondition(app.includes("selectedDataElements.length === 1") && app.includes("onEditChartData") && app.includes("onEditTableData") && app.includes("function TableDataDialog"), "组件旁图表/表格数据编辑入口缺失");
requireCondition(app.includes("function CellGridEditor") && app.includes("parseClipboardGrid") && app.includes("打开单元格编辑器"), "图表/表格单元格编辑器或 Excel 区域粘贴入口缺失");
requireCondition(app.includes("parseStrictChartNumber") && app.includes("MAX_GRID_CELLS") && app.includes("数据网格不是完整矩形") && app.includes("aria-live=\"polite\""), "单元格编辑器缺少数值、容量、矩形或可访问性校验");
requireCondition(app.includes("pruneChartLabelOffsets") && app.includes("columnLimit={element.chartKind === \"donut\" ? 2") && app.includes('embeddedRef.current?.protectedElementIds.has(id)'), "单元格编辑没有清理标签孤儿、限制环形图或提交时保护 bound 事实");
requireCondition(engineWorkflow.includes("按任务书预建行、列、表头、类目和系列") && createReportPrompt.includes("每个数据组件都要逐项填写"), "Skill 没有要求智能体按提示词预建单元格结构");
requireCondition(app.includes('event.key.toLowerCase() === "p"') && app.includes('addEventListener("beforeprint"') && app.includes("setPrintDocument(document)") && app.includes("preparedPrintRef.current"), "直接浏览器打印没有同步当前文档或没有保护正式打印副本");
requireCondition(engineCli.includes("createPreviewData(reportPackage, data)") && engineCli.includes("previewResult") && engineCli.includes("Content-Security-Policy") && engineCli.includes("checkOfflineHtml"), "特化构建脱敏复编译、CSP 或最终离线检查缺失");
requireCondition(engineCli.includes("--trusted-code") && engineCli.includes("trustedPackageRoot"), "CLI 未显式隔离可信 .mjs 作者源码");
requireCondition(printPdf.includes("documentUpdatedAt") && printPdf.includes("/CreationDate"), "PDF 打印器未固定报告包时间元数据");
requireCondition(engineWorkflow.includes("真实数据不得写入报告包、命令日志、智能体上下文或版本库") && engineWorkflow.includes(".agents/skills/cosco-report/scripts/report-engine.mjs") && engineWorkflow.includes('authoringMode: "independent"') && engineWorkflow.includes("组件旁必须有“编辑数据”"), "项目 Skill 未固化本地隐私、独立模板或组件旁编辑流程");
requireCondition(packageJson.scripts["verify:release"].includes("engine:pdf") && packageJson.scripts["verify:release"].includes("test:pdf-determinism") && packageJson.scripts["verify:release"].includes("engine:inspect-pdf"), "发布门禁未包含 PDF 生成、可复现性与检查");
requireCondition(packageJson.scripts["engine:inspect-pdf"].includes("scripts/run-inspect-pdf.mjs"), "PDF 检查没有通过依赖探测 runner 启动");
requireCondition(runInspectPdf.includes("codex-primary-runtime") && runInspectPdf.includes("import pdfplumber; from PIL import Image"), "PDF 检查 runner 没有探测 Codex 运行时、pdfplumber 或 Pillow");
requireCondition(inspectPdf.includes('"expectedOrientation"') && inspectPdf.includes('"actualOrientation"') && inspectPdf.includes("matches_a4"), "PDF 检查没有逐页核对编译方向与 A4 纸张");
requireCondition(packageJson.scripts["verify:release"].includes("test:assets") && packageJson.scripts["verify:release"].includes("test:overrides"), "发布门禁未包含资产与视觉覆盖测试");
requireCondition(manifest.requiredChecks?.includes("engine:compile") && packageJson.scripts["verify:release"].includes("engine:compile"), "发布清单或发布门禁缺少报告文档编译步骤");
requireCondition(manifest.requiredChecks?.includes("test:dynamic-pages") && packageJson.scripts["verify:release"].includes("test:dynamic-pages"), "发布清单或发布门禁缺少动态页数 PDF 测试");
requireCondition(manifest.requiredChecks?.includes("test:cell-grid") && packageJson.scripts["verify:release"].includes("test:cell-grid"), "发布清单或发布门禁缺少单元格浏览器测试");
requireCondition(manifest.requiredChecks?.includes("test:templates") && packageJson.scripts["verify:release"].includes("test:templates"), "发布清单或发布门禁缺少模板测试");
requireCondition(manifest.requiredChecks?.includes("check:brand-assets") && packageJson.scripts["verify:release"].includes("check:brand-assets"), "发布清单或发布门禁缺少品牌资源检查");
requireCondition(manifest.templateLibrary?.coverTemplates === 5 && manifest.templateLibrary?.chromeTemplates === 3 && manifest.brandAssets?.transparentPngLogos === 3, "发布清单模板或品牌资源数量不正确");
requireCondition(dynamicPagesTest.includes("length: 20") && dynamicPagesTest.includes('index % 2 === 0 ? "portrait" : "landscape"') && dynamicPagesTest.includes("run-inspect-pdf.mjs") && dynamicPagesTest.includes("a4Matched"), "动态页数测试没有覆盖 20 页、混合方向、真实 PDF 或逐页 A4 检查");
for (const source of ["agentskills/agentskills", "pdfme/pdfme", "garrytan/gstack", "daymade/claude-code-skills", "microsoft/playwright", "pagedjs/pagedjs", "vivliostyle/vivliostyle.js"]) requireCondition(githubResearch.includes(source), `GitHub 调研缺少 ${source}`);
for (const gap of ["期间滚动", "多口径快照", "单位存储", "风险快照", "外汇日序列", "页面启停"]) requireCondition(legacyParity.includes(gap), `旧版承接矩阵缺少 ${gap}`);

requireCondition(visualOverrides.includes('format: "cosco-report-visual-overrides"') && visualOverrides.includes("packageId: string") && visualOverrides.includes("packageVersion: string"), "视觉覆盖缺少固定格式或报告包身份");
for (const field of ["content", "runs", "chart", "table"]) {
  requireCondition(visualOverrides.includes(`delete patch.${field}`), `受保护视觉覆盖没有剥离事实字段 ${field}`);
}
requireCondition(!visualOverrides.includes('Pick<ReportDocument, "meta"') && visualOverrides.includes("protectedElementIds: ReadonlySet<string>") && visualOverrideTest.includes("FORGED-CONTENT") && visualOverrideTest.includes("FORGED-META"), "视觉覆盖读取阶段或报告元信息事实保护缺失");
requireCondition(app.includes("readOnlyData={embedded?.protectedElementIds.has(selectedElement.id)") && app.includes("readOnlyMeta={boundPrecisionMode}"), "bound 特化精修侧栏没有把绑定事实与报告元信息设为只读，或误锁 independent 元信息");
requireCondition(app.includes("绑定元素不能删除") && app.includes("绑定模式精修不复制文字、图表或表格") && visualOverrides.includes("sanitizeAddedVisualElement"), "bound 特化精修没有阻止受保护元素删除或旧事实复制");
requireCondition(visualOverrides.includes("runtimePatch<ReportPage>") && visualOverrides.includes("runtimePatch<ReportElement>") && visualOverrides.includes("Array.isArray(override.elementOrder)"), "视觉覆盖应用阶段没有运行时限制页面、元素 patch 或图层顺序");
requireCondition(visualOverrides.includes("orphanCount += 1") && app.includes('code: "orphan-override"'), "孤儿视觉覆盖没有计数或显式告警");
requireCondition(visualOverrideTest.includes("createVisualOverrides") && visualOverrideTest.includes('new Set(["chart-1"])'), "视觉覆盖测试没有传入受保护元素集合");
requireCondition(visualOverrideTest.includes("[10, 20]") && visualOverrideTest.includes("orphanCount, 1"), "视觉覆盖测试没有验证数据刷新或孤儿覆盖");
requireCondition(visualOverrideTest.includes('{ removed: true }') && visualOverrideTest.includes('id = "chart-copy"'), "视觉覆盖测试没有对抗受保护元素删除或事实副本");
requireCondition(visualOverrideTest.includes("pagePatchAttack") && visualOverrideTest.includes('id: "forged-id"'), "视觉覆盖测试没有对抗页面级 elements 或元素身份伪造");
requireCondition(visualOverrideTest.includes("old-fact-image") && visualOverrideTest.includes("blank-table"), "视觉覆盖测试没有对抗新增对象的类型混淆或空事实元素");

requireCondition(model.includes('Partial<Record<Orientation, Record<string, ChartLabelOffset>>>'), "图表标签偏移没有按页面方向分支存储");
requireCondition(app.includes("offsets[activePage.orientation] = byOrientation") && visualOverrideTest.includes("offsets.landscape") && visualOverrideTest.includes("offsets.portrait"), "横竖版图表标签偏移没有独立写入或测试");
requireCondition(app.includes("const resetData = () =>") && app.includes("const resetVisual = () =>") && app.includes("localStorage.removeItem(runtimeVisualStorageKey(reportPackage))"), "数据与视觉重置没有独立实现");
requireCondition(app.includes("beginMasterCropEdit") && app.includes("elementId: MASTER_CROP_ELEMENT_ID") && app.includes("page.masterProps = { ...page.masterProps, crop: clone(session.draft) }"), "母版图片没有接入直接非破坏裁切");
requireCondition(app.includes("当前页面已有内容，不能直接套用另一方向坐标"), "非空页面方向切换没有拒绝保护");
requireCondition((app.match(/setRightOpen\(true\);\s*if \(compactLayout\) setLeftOpen\(false\);/g) || []).length >= 6, "窄屏打开属性栏时没有统一收起页面栏");

requireCondition(assetStore.includes('new Set(["image/png", "image/jpeg", "image/webp"])'), "本地资产 MIME 白名单缺失");
requireCondition(assetStore.includes("decodeStrictBase64") && assetStore.includes("hasValidImageSignature") && assetStore.includes("await createAssetBlob(asset.data || asset.blob!, asset.mime)"), "本地资产严格 base64、签名或旧记录重校验缺失");
requireCondition(!/\bfetch\s*\(/.test(assetStore), "资产存储层不得通过 fetch 解码或访问资源");
requireCondition(assetStoreTest.includes("fetchCalls, 0") && assetStoreTest.includes("revalidates legacy IndexedDB records"), "资产测试没有验证无 fetch 或历史记录重校验");
requireCondition(app.includes("createAssetBlob(data, asset.mime)") && !/fetch\(data\)/.test(app), "编辑器图片解码没有统一通过受校验的本地资产路径");
requireCondition(model.includes("validateImportedAssetData(data, mime)") && model.includes("工程包含未声明的图片数据"), "工程导入没有拒绝远程、伪造或未声明图片数据");
requireCondition(model.includes("validateImportedTheme(source.theme as ThemeTokens)"), "工程导入没有验证主题颜色、色板与字体注入");
requireCondition(model.includes("requireAssetData?: boolean") && model.includes("MAX_IMPORTED_ASSET_TOTAL_BYTES") && model.includes("可移植工程缺少图片资产数据"), "可移植工程导入没有要求完整图片或限制 base64 总量");
requireCondition(app.includes("function unzipProjectArchive") && app.includes("MAX_PROJECT_ARCHIVE_ENTRIES") && app.includes("MAX_PROJECT_UNCOMPRESSED_BYTES"), "ZIP 工程导入没有限制条目、压缩包或解压总量");
requireCondition(app.includes("sanitizeImportedProjectAssets(imported, keepOriginalImages)") && app.includes("readImageAsset(file, keepOriginal, remainingPixels)") && app.includes("scaleImageCrop(page.masterProps.crop") && app.includes("putAssetsAtomically(sanitized.document.assets"), "工程导入没有按像素预算重编码、换算裁切、重映射或原子写入图片");
requireCondition(model.includes("MAX_IMPORTED_ASSET_COUNT") && model.includes("MAX_IMPORTED_IMAGE_TOTAL_PIXELS") && assetStore.includes("inspectImageDimensions") && app.includes("file.size > MAX_IMPORTED_ASSET_BYTES"), "图片导入没有在完整解码前限制文件、数量或像素规模");
requireCondition(assetStore.includes("export async function putAssetsAtomically") && assetStore.includes("export async function clearAssetNamespace") && app.includes("clearAssetNamespace(independentAssetNamespace(reportPackage))"), "图片资产缺少原子批量写入或恢复模板命名空间清理");
requireCondition(model.includes("[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48]") && reportEngine.includes("new Set([8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48])"), "文本字号白名单没有覆盖实用正文与标题档位");
requireCondition(reportEngine.includes("hasValidImageSignature") && reportEngine.includes('code: "asset-signature"') && !reportEngine.includes('"image/gif"'), "报告包图片签名门禁缺失或仍允许 GIF");
requireCondition(assetStore.includes("return namespace ? [namespace, id] : id") && app.includes("assetNamespace: runtimeAssetNamespace(reportPackage)"), "特化报告 IndexedDB 资产没有按报告包命名空间隔离");
requireCondition(assetStoreTest.includes("isolates specialized report assets by package namespace") && reportEngine.includes("decodeStrictImageDataUrl"), "资产命名空间或报告包严格图片测试缺失");
requireCondition(assetStoreTest.includes("portable project imports are complete, bounded, sanitized and atomically stored"), "资产测试没有固化完整、限额、去元数据和原子导入边界");

requireCondition(manifest.engineLimits?.maximumPages === null, "发布清单不得设置固定最大页数");
requireCondition(manifest.authoringModes?.newReports === "independent" && manifest.authoringModes?.legacyCompatibility === "bound", "发布清单没有锁定新报告 independent 与旧 bound 兼容边界");
requireCondition(manifest.referencePdf?.pageCountSource === "artifacts/finance-brief/document.json" && manifest.referencePdf?.pageCountScope === "finance-brief-reference-only" && !("pages" in (manifest.referencePdf || {})), "财务参考 PDF 页数必须来自本轮编译文档，不能硬编码");
requireCondition(reportEngine.includes("!reportPackage.pages.length") && !/\b(maximumPages|maxPages)\b/.test(reportEngine), "报告内核应只要求至少一页，不得设置固定最大页数");
requireCondition(reportEngineArchitecture.includes("ReportDocument 1.5") && reportEngineArchitecture.includes("independent") && reportEngineArchitecture.includes("视觉覆盖"), "报告内核架构没有同时固化 independent 完整文档与 bound 视觉覆盖流程");
requireCondition(skillLearnings.includes("v1.8.0 可编辑模板学习") && skillLearnings.includes("v1.7.0 独立模板学习") && skillLearnings.includes("每个图表/表格可以是自己的事实源") && skillLearnings.includes("v1.6.0 内核迭代学习"), "Skill 学习文档没有固化 v1.8 模板、v1.7 独立组件或 v1.6 bound 经验");
requireCondition(packageJson.scripts["engine:inspect-pdf"].includes("--expected-document artifacts/finance-brief/document.json") && packageJson.scripts["verify:release"].includes("engine:compile"), "PDF 页数门禁仍依赖固定页数或发布前未编译报告文档");

async function verifyArtifact(entry, byteSize, sha256, label) {
  if (sha256 === "__GENERATED_AFTER_BUILD__" || !byteSize) {
    failures.push(`发布清单尚未写入 ${label} 的最终字节数和 SHA-256`);
    return;
  }
  try {
    const artifactUrl = new URL(entry, root);
    const [artifact, artifactStat] = await Promise.all([readFile(artifactUrl), stat(artifactUrl)]);
    const hash = createHash("sha256").update(artifact).digest("hex");
    requireCondition(artifactStat.size === byteSize, `${label}字节数漂移：清单 ${byteSize}，实际 ${artifactStat.size}`);
    requireCondition(hash === sha256, `${label} SHA-256 漂移：清单 ${sha256}，实际 ${hash}`);
  } catch (error) {
    failures.push(`无法读取${label} ${entry}：${error instanceof Error ? error.message : String(error)}`);
  }
}

await verifyArtifact(manifest.entry, manifest.byteSize, manifest.sha256, "主构建产物");
await verifyArtifact(manifest.referenceGenerator?.entry, manifest.referenceGenerator?.byteSize, manifest.referenceGenerator?.sha256, "财务特化 HTML");
await verifyArtifact(manifest.referencePdf?.entry, manifest.referencePdf?.byteSize, manifest.referencePdf?.sha256, "财务参考 PDF");

if (failures.length) {
  console.error("v1.8.0 契约检查失败：");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`v1.8.0 契约检查通过：应用 ${version}，schema ${manifest.documentSchemaVersion}，内核 ${manifest.reportEngineVersion}。`);

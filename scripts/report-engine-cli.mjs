import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadReportEngine } from "./report-engine-loader.mjs";
import { checkOfflineHtml } from "./check-offline.mjs";

const {
  compileReportPackage,
  createPreviewData
} = await loadReportEngine();

const usage = `用法：
  node scripts/report-engine-cli.mjs [--trusted-code] validate <report-package.mjs|json> <data.json>
  node scripts/report-engine-cli.mjs [--trusted-code] compile <report-package.mjs|json> <data.json> <document.json>
  node scripts/report-engine-cli.mjs [--trusted-code] preview <report-package.mjs|json> <data.json> <preview-data.json>
  node scripts/report-engine-cli.mjs [--trusted-code] build <report-package.mjs|json> <data.json> <base.html> <output.html>

JSON 报告包是默认安全入口；只有可信且位于 report-packages/ 内的 .mjs 作者源码才可使用 --trusted-code。`;

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const trustedPackageRoot = resolve(projectRoot, "report-packages");

async function loadJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function loadPackage(path, { trustedCode = false } = {}) {
  const absolute = resolve(path);
  const extension = extname(absolute).toLowerCase();
  if (extension === ".json") return loadJson(absolute);
  if (extension !== ".mjs") throw new Error("报告包只接受 .json，或显式授权的 .mjs 作者源码");
  if (!trustedCode) throw new Error("拒绝执行 .mjs 报告包；确认它是可信本地源码后使用 --trusted-code");
  const relativePath = relative(trustedPackageRoot, absolute);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) throw new Error("可信 .mjs 报告包必须位于项目 report-packages/ 目录内");
  console.error(`提示：正在执行可信报告包源码 ${relativePath}`);
  const module = await import(`${pathToFileURL(absolute).href}?t=${Date.now()}`);
  return module.default || module.reportPackage;
}

async function writeOutput(path, content) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, content);
  return absolute;
}

function printIssues(issues) {
  issues.forEach((issue) => {
    const target = issue.locator || issue.path;
    console.error(`${issue.severity === "error" ? "错误" : "警告"} [${issue.code}]${target ? ` ${target}` : ""}：${issue.message}`);
  });
}

function serializeForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

function injectBootstrap(html, reportPackage, data) {
  const pattern = /window\.__REPORT_ENGINE_BOOTSTRAP__\s*=\s*null\s*;?/;
  if (!pattern.test(html)) throw new Error("基础 HTML 缺少 report-engine bootstrap 标记；请先运行 npm run build");
  const payload = serializeForScript({ reportPackage, data });
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
  const withCsp = html.includes("Content-Security-Policy") ? html : html.replace(/(<meta\s+name=["']referrer["'][^>]*>)/i, `$1${csp}`);
  if (!withCsp.includes("Content-Security-Policy")) throw new Error("无法向特化 HTML 注入内容安全策略");
  return withCsp.replace(pattern, `window.__REPORT_ENGINE_BOOTSTRAP__=${payload};`);
}

const rawArgs = process.argv.slice(2);
const trustedCode = rawArgs.includes("--trusted-code");
const [command, packagePath, dataPath, firstOutput, secondOutput] = rawArgs.filter((arg) => arg !== "--trusted-code");
if (!command || !packagePath || !dataPath) {
  console.error(usage);
  process.exit(2);
}

const reportPackage = await loadPackage(packagePath, { trustedCode });
const data = await loadJson(dataPath);
const result = compileReportPackage(reportPackage, data);
const issues = result.issues;
printIssues(issues);
if (issues.some((issue) => issue.severity === "error")) process.exit(1);

const previewData = command === "preview" || command === "build" ? createPreviewData(reportPackage, data) : null;
if (previewData) {
  const previewResult = compileReportPackage(reportPackage, previewData);
  printIssues(previewResult.issues);
  if (previewResult.issues.some((issue) => issue.severity === "error")) {
    console.error("脱敏预览无法完整编译，已拒绝生成产物");
    process.exit(1);
  }
}

if (command === "preview") {
  if (!firstOutput || !previewData) throw new Error(usage);
  await writeOutput(firstOutput, `${JSON.stringify(previewData, null, 2)}\n`);
  console.log(`已生成脱敏预览数据：${resolve(firstOutput)}`);
} else if (command === "validate") {
  const mode = reportPackage.authoringMode === "independent" ? "独立组件数据" : `${Object.keys(reportPackage.fields || {}).length} 个集中字段`;
  console.log(`报告包校验通过：${reportPackage.id}，${reportPackage.pages.length} 页，${mode}`);
} else if (command === "compile") {
  if (!firstOutput) throw new Error(usage);
  await writeOutput(firstOutput, `${JSON.stringify(result.document, null, 2)}\n`);
  console.log(`已编译 ReportDocument：${resolve(firstOutput)}`);
} else if (command === "build") {
  if (!firstOutput || !secondOutput || !previewData) throw new Error(usage);
  const html = await readFile(resolve(firstOutput), "utf8");
  const specializedHtml = injectBootstrap(html, reportPackage, previewData);
  checkOfflineHtml(specializedHtml, { requireCsp: true });
  await writeOutput(secondOutput, specializedHtml);
  console.log(`已构建特化单 HTML：${resolve(secondOutput)}`);
} else {
  console.error(usage);
  process.exit(2);
}

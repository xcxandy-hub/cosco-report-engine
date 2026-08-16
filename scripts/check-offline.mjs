import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkOfflineHtml(html, { requireCsp = false } = {}) {
  const htmlExternal = [...html.matchAll(/(?:src|href|srcset)=["'](https?:\/\/[^"']+)/gi)].map((match) => match[1]);
  const cssExternal = [...html.matchAll(/url\(\s*["']?(https?:\/\/[^)'"\s]+)/gi)].map((match) => match[1]);
  const external = [...new Set([...htmlExternal, ...cssExternal])];
  if (external.length) throw new Error(`发现外部资源：${external.join(", ")}`);
  const networkApis = [
    [/\bfetch\s*\(/, "fetch"],
    [/\bXMLHttpRequest\b/, "XMLHttpRequest"],
    [/\bWebSocket\b/, "WebSocket"],
    [/\bsendBeacon\s*\(/, "sendBeacon"],
    [/\bEventSource\b/, "EventSource"]
  ].filter(([pattern]) => pattern.test(html)).map(([, label]) => label);
  if (networkApis.length) throw new Error(`构建产物包含运行时网络 API：${networkApis.join(", ")}`);
  if (!html.includes("echarts") || !html.includes("通用本地报告生成器")) throw new Error("构建产物缺少关键内联内容");
  if (requireCsp) {
    const policy = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1]
      || html.match(/<meta\s+http-equiv='Content-Security-Policy'\s+content='([^']+)'/i)?.[1]
      || "";
    for (const directive of ["default-src 'none'", "connect-src 'none'", "object-src 'none'", "base-uri 'none'"]) {
      if (!policy.includes(directive)) throw new Error(`特化 HTML 缺少 CSP 指令：${directive}`);
    }
  }
  return { byteSize: Buffer.byteLength(html), external };
}

export async function checkOfflineFile(filePath, { scanSource = false, requireCsp = false } = {}) {
  const html = await readFile(filePath, "utf8");
  const result = checkOfflineHtml(html, { requireCsp });
  if (scanSource) {
    const sourceFiles = (await readdir("src", { recursive: true })).filter((name) => /\.(?:ts|tsx|css)$/.test(name));
    const sourceExternal = [];
    const sourceNetworkApis = [];
    for (const name of sourceFiles) {
      const source = await readFile(`src/${name}`, "utf8");
      for (const match of source.matchAll(/https?:\/\/[^\s"' )]+/gi)) sourceExternal.push(`src/${name}: ${match[0]}`);
      for (const [pattern, label] of [[/\bfetch\s*\(/, "fetch"], [/\bXMLHttpRequest\b/, "XMLHttpRequest"], [/\bWebSocket\b/, "WebSocket"], [/\bsendBeacon\s*\(/, "sendBeacon"], [/\bEventSource\b/, "EventSource"]]) {
        if (pattern.test(source)) sourceNetworkApis.push(`src/${name}: ${label}`);
      }
    }
    if (sourceExternal.length) throw new Error(`源码包含外部 URL：${sourceExternal.join(", ")}`);
    if (sourceNetworkApis.length) throw new Error(`源码包含运行时网络 API：${sourceNetworkApis.join(", ")}`);
  }
  return result;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const filePath = resolve(process.argv[2] || "dist/index.html");
  const requireCsp = process.argv.includes("--require-csp");
  try {
    const result = await checkOfflineFile(filePath, { scanSource: true, requireCsp });
    console.log(`离线检查通过：${Math.round(result.byteSize / 1024)} KB，0 个外部资源。`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

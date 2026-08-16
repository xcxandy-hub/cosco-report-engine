import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [, , input = "dist/index.html", output = "artifacts/report-cdp.pdf"] = process.argv;
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.unref();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    server.close(() => resolvePort(port));
  });
});

const waitFor = async (predicate, timeout = 10000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch { /* Chrome may not have opened its debug port yet. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome CDP 连接超时");
};

const waitForProcessExit = (child, timeout) => new Promise((resolveExit) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    resolveExit(true);
    return;
  }
  const onExit = () => {
    clearTimeout(timer);
    resolveExit(true);
  };
  const timer = setTimeout(() => {
    child.off("exit", onExit);
    resolveExit(false);
  }, timeout);
  child.once("exit", onExit);
});

const stopChrome = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForProcessExit(child, 2000)) return;
  child.kill("SIGKILL");
  await waitForProcessExit(child, 2000);
};

const port = await freePort();
if (!port) throw new Error("无法分配 Chrome 调试端口");
const userDataDir = await mkdtemp(join(tmpdir(), "local-report-studio-cdp-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  `file://${resolve(input)}`
], { stdio: "ignore" });
let socket;

try {
  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json`);
    const tabs = await response.json();
    return tabs.find((tab) => tab.type === "page");
  });

  socket = new WebSocket(target.webSocketDebuggerUrl);
  let messageId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const settle = pending.get(message.id);
    if (settle) {
      pending.delete(message.id);
      settle(message);
    }
  });

  const send = (method, params = {}) => new Promise((resolveResult, reject) => {
    const id = ++messageId;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolveResult(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });

  await new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const readiness = await send("Runtime.evaluate", {
    expression: `new Promise((resolve, reject) => {
      const started = Date.now();
      const poll = () => {
        const bootstrap = window.__REPORT_ENGINE_BOOTSTRAP__;
        if (!bootstrap) {
          if (Date.now() - started > 1600) {
            resolve({ mode: "editor" });
            return;
          }
          setTimeout(poll, 80);
          return;
        }
        const status = window.__REPORT_ENGINE_STATUS__;
        if (status?.errors?.length) {
          reject(new Error("报告运行态校验失败：" + status.errors.join(", ")));
          return;
        }
        const pages = document.querySelectorAll(".print-stage .print-page").length;
        const emptyCharts = [...document.querySelectorAll(".print-stage .chart-root")].filter((node) => !node.querySelector("svg")).length;
        if (status?.ready && pages === status.pageCount && emptyCharts === 0) {
          resolve({ mode: "report-engine", pages, documentUpdatedAt: bootstrap.reportPackage.documentUpdatedAt });
          return;
        }
        if (Date.now() - started > 15000) {
          reject(new Error("报告渲染就绪超时"));
          return;
        }
        setTimeout(poll, 80);
      };
      poll();
    })`,
    awaitPromise: true,
    returnByValue: true
  });
  if (readiness.exceptionDetails) throw new Error(readiness.exceptionDetails.exception?.description || readiness.exceptionDetails.text || "报告渲染准备失败");
  const result = await send("Page.printToPDF", {
    printBackground: true,
    displayHeaderFooter: false,
    preferCSSPageSize: true
  });
  let pdf = Buffer.from(result.data, "base64");
  const readyValue = readiness.result?.value;
  if (readyValue?.mode === "report-engine" && typeof readyValue.documentUpdatedAt === "string") {
    const match = readyValue.documentUpdatedAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!match) throw new Error("报告包 documentUpdatedAt 无法转换为 PDF 日期");
    const stablePdfDate = `D:${match.slice(1).join("")}+00'00'`;
    const source = pdf.toString("latin1");
    const normalized = source.replace(/D:\d{14}\+00'00'/g, stablePdfDate);
    if (normalized.length !== source.length || !normalized.includes(`/CreationDate (${stablePdfDate})`)) throw new Error("PDF 稳定时间写入失败");
    pdf = Buffer.from(normalized, "latin1");
  }
  await writeFile(output, pdf);
  console.log(`已输出 ${output}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  await stopChrome(chrome);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

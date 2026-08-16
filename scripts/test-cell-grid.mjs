import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const htmlPath = resolve("artifacts/finance-brief/finance-brief-generator.html");

const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.unref();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolvePort(typeof address === "object" && address ? address.port : 0));
  });
});

const waitFor = async (predicate, timeout = 15000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch { /* Chrome may still be starting. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 80));
  }
  throw new Error("单元格浏览器测试连接超时");
};

const stopChrome = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise((resolveExit) => {
    const timer = setTimeout(() => { child.kill("SIGKILL"); resolveExit(); }, 1800);
    child.once("exit", () => { clearTimeout(timer); resolveExit(); });
  });
};

const port = await freePort();
if (!port) throw new Error("无法分配 Chrome 调试端口");
const userDataDir = await mkdtemp(join(tmpdir(), "local-report-studio-cell-grid-"));
const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  `file://${htmlPath}`
], { stdio: "ignore" });

let socket;
try {
  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json`);
    const tabs = await response.json();
    return tabs.find((tab) => tab.type === "page");
  });
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let messageId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const settle = pending.get(message.id);
    if (settle) { pending.delete(message.id); settle(message); }
  });
  const send = (method, params = {}) => new Promise((resolveResult, reject) => {
    const id = ++messageId;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolveResult(message.result));
    socket.send(JSON.stringify({ id, method, params }));
  });

  await send("Runtime.enable");
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "浏览器断言执行失败");
    return result.result.value;
  };

  const desktop = await evaluate(`new Promise((resolve, reject) => {
    const wait = (predicate, label, timeout = 8000) => new Promise((done, fail) => {
      const started = Date.now();
      const poll = () => {
        const value = predicate();
        if (value) done(value);
        else if (Date.now() - started > timeout) fail(new Error("等待超时：" + label));
        else setTimeout(poll, 40);
      };
      poll();
    });
    const button = (root, label) => [...root.querySelectorAll("button")].find((item) => item.textContent.trim() === label || item.getAttribute("aria-label") === label);
    const tick = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const setInput = (input, value) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const openPage = async (name) => {
      const pageButton = [...document.querySelectorAll(".page-thumb-row")].find((item) => item.textContent.includes(name));
      if (!pageButton) throw new Error("找不到页面：" + name);
      pageButton.click();
      await new Promise((done) => requestAnimationFrame(done));
    };
    const selectElement = async (id) => {
      const element = await wait(() => document.querySelector('[data-element-id="' + id + '"]'), id);
      element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: element.getBoundingClientRect().left + 4, clientY: element.getBoundingClientRect().top + 4 }));
      element.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await wait(() => document.querySelector(".floating-object-toolbar"), "对象工具条");
    };
    const openGrid = async (id) => {
      await selectElement(id);
      button(document.querySelector(".floating-object-toolbar"), "编辑数据").click();
      return wait(() => document.querySelector(".chart-data-dialog"), "单元格编辑器");
    };
    const gridValues = (dialog) => [...dialog.querySelectorAll(".cell-grid-input")].map((input) => input.value);
    const gridCell = (dialog, row, column) => dialog.querySelector('.cell-grid-input[data-row="' + row + '"][data-column="' + column + '"]');
    const paste = (input, value) => {
      const data = new DataTransfer();
      data.setData("text/plain", value);
      input.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: data }));
    };
    (async () => {
      await wait(() => window.__REPORT_ENGINE_STATUS__?.ready, "报告就绪", 15000);
      await openPage("业绩综述");
      let dialog = await openGrid("overview-chart");
      const baseline = gridValues(dialog);
      if (dialog.querySelector("textarea")) throw new Error("仍存在原始文本数据框");
      if (dialog.querySelectorAll("tbody tr").length !== 7 || dialog.querySelectorAll("thead .cell-grid-input").length !== 4) throw new Error("初始单元格结构错误");

      button(dialog, "新增行").click();
      await tick();
      button(dialog, "新增列").click();
      await tick();
      if (dialog.querySelectorAll("tbody tr").length !== 8 || dialog.querySelectorAll("thead .cell-grid-input").length !== 5) throw new Error("新增行列失败");
      gridCell(dialog, 8, 0).focus();
      button(dialog, "删除行").click();
      await tick();
      gridCell(dialog, 0, 4).focus();
      button(dialog, "删除列").click();
      await tick();

      setInput(gridCell(dialog, 1, 1), "not-a-number");
      await tick();
      if (gridCell(dialog, 1, 1).getAttribute("aria-invalid") !== "true" || !button(dialog, "应用数据").disabled) throw new Error("非法数值未阻止应用");
      button(dialog, "取消").click();
      await tick();
      dialog = await openGrid("overview-chart");
      if (JSON.stringify(gridValues(dialog)) !== JSON.stringify(baseline)) throw new Error("取消修改仍写入文档");

      paste(gridCell(dialog, 1, 1), "901\\t902\\n903\\t904");
      await tick();
      if ([gridCell(dialog, 1, 1).value, gridCell(dialog, 1, 2).value, gridCell(dialog, 2, 1).value, gridCell(dialog, 2, 2).value].join(",") !== "901,902,903,904") throw new Error("Excel 区域粘贴失败");
      button(dialog, "应用数据").click();
      await tick();

      dialog = await openGrid("overview-chart");
      if (gridCell(dialog, 1, 1).value !== "901") throw new Error("第一次应用未写入");
      setInput(gridCell(dialog, 1, 1), "777");
      await tick();
      button(dialog, "应用数据").click();
      await tick();
      button(document, "撤销").click();
      await tick();
      dialog = await openGrid("overview-chart");
      if (gridCell(dialog, 1, 1).value !== "901") throw new Error("第一次撤销没有回到第一次应用");
      button(dialog, "取消").click();
      await tick();
      button(document, "撤销").click();
      await tick();
      dialog = await openGrid("overview-chart");
      if (gridCell(dialog, 1, 1).value !== "180") throw new Error("第二次撤销没有回到模板值");

      const originalRows = [...dialog.querySelectorAll("tbody tr")].map((row) => ({ name: row.querySelector('[data-column="0"]').value, key: row.querySelector('[data-column="0"]').dataset.rowKey }));
      const originalColumns = [...dialog.querySelectorAll("thead .cell-grid-input")].slice(1).map((input) => ({ name: input.value, key: input.dataset.columnKey }));
      const matrix = [
        [...dialog.querySelectorAll("thead .cell-grid-input")].map((input) => input.value),
        ...[...dialog.querySelectorAll("tbody tr")].map((row) => [...row.querySelectorAll(".cell-grid-input")].map((input) => input.value))
      ];
      const reordered = [matrix[0][0], ...matrix[0].slice(1).reverse()].join("\\t") + "\\n" + matrix.slice(1).reverse().map((row) => [row[0], ...row.slice(1).reverse()].join("\\t")).join("\\n");
      paste(gridCell(dialog, 0, 0), reordered);
      await tick();
      const rowKeyByName = new Map(originalRows.map((item) => [item.name, item.key]));
      const columnKeyByName = new Map(originalColumns.map((item) => [item.name, item.key]));
      if ([...dialog.querySelectorAll("tbody tr")].some((row) => row.querySelector('[data-column="0"]').dataset.rowKey !== rowKeyByName.get(row.querySelector('[data-column="0"]').value))) throw new Error("类目重排没有携带稳定 ID");
      if ([...dialog.querySelectorAll("thead .cell-grid-input")].slice(1).some((input) => input.dataset.columnKey !== columnKeyByName.get(input.value))) throw new Error("系列重排没有携带稳定 ID");
      button(dialog, "取消").click();
      await tick();

      await openPage("经营影响因素");
      const chartB = await openGrid("drivers-volume");
      if (gridCell(chartB, 1, 1).value !== "183") throw new Error("图 A 修改污染图 B");
      button(chartB, "取消").click();
      await tick();

      await openPage("收入结构");
      const tableDialog = await openGrid("revenue-table");
      if (tableDialog.dataset.gridKind === "chart" || !tableDialog.querySelector('[data-grid-kind="table"]')) throw new Error("表格未使用独立单元格编辑器");
      const tableBefore = gridValues(tableDialog);
      setInput(gridCell(tableDialog, 1, 1), "本地表格测试");
      await tick();
      button(tableDialog, "取消").click();
      await tick();
      const tableAgain = await openGrid("revenue-table");
      if (JSON.stringify(gridValues(tableAgain)) !== JSON.stringify(tableBefore)) throw new Error("表格取消仍写入文档");
      resolve({ baselineCells: baseline.length, excelPaste: true, undoSteps: 2, isolation: true, stableReorder: true, tableCancel: true });
    })().catch(reject);
  })`);

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
  const mobile = await evaluate(`(() => {
    const dialog = document.querySelector(".chart-data-dialog");
    const grid = dialog.querySelector(".cell-grid-scroll");
    const rect = dialog.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, documentScrollWidth: document.documentElement.scrollWidth, gridClientWidth: grid.clientWidth, gridScrollWidth: grid.scrollWidth };
  })()`);
  assert.equal(mobile.viewportWidth, 390);
  assert.equal(mobile.documentScrollWidth, 390);
  assert.ok(mobile.left >= 0 && mobile.right <= mobile.viewportWidth && mobile.top >= 0 && mobile.bottom <= mobile.viewportHeight);
  assert.ok(mobile.gridScrollWidth >= mobile.gridClientWidth);
  console.log("单元格浏览器测试通过：", JSON.stringify({ ...desktop, mobile }));
} finally {
  if (socket?.readyState === WebSocket.OPEN) socket.close();
  await stopChrome(chrome);
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

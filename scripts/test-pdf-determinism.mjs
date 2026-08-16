import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [, , input = "artifacts/finance-brief/finance-brief-generator.html"] = process.argv;
const temporaryDirectory = await mkdtemp(join(tmpdir(), "local-report-studio-pdf-determinism-"));
const first = join(temporaryDirectory, "first.pdf");
const second = join(temporaryDirectory, "second.pdf");

function runPrint(output) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ["scripts/print-pdf.mjs", resolve(input), output], {
      cwd: resolve("."),
      stdio: "inherit"
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => code === 0 ? resolveRun() : rejectRun(new Error(`PDF 打印退出码 ${code}`)));
  });
}

try {
  await runPrint(first);
  await runPrint(second);
  const [firstPdf, secondPdf] = await Promise.all([readFile(first), readFile(second)]);
  if (!firstPdf.equals(secondPdf)) throw new Error("同一 HTML 连续打印的 PDF 字节不一致");
  const hash = createHash("sha256").update(firstPdf).digest("hex");
  console.log(`PDF 可复现性通过：${firstPdf.byteLength} bytes，SHA-256 ${hash}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const bundledRoot = join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies");
const candidates = [...new Set([
  process.env.CODEX_PYTHON,
  join(bundledRoot, "python", "bin", "python3"),
  "python3"
].filter(Boolean))];

const python = candidates.find((candidate) => {
  const probe = spawnSync(candidate, ["-c", "import pdfplumber; from PIL import Image"], { stdio: "ignore" });
  return probe.status === 0;
});

if (!python) {
  console.error("PDF 检查缺少 Python 依赖。请使用 Codex 工作区运行时，或执行：python3 -m pip install pdfplumber pillow");
  process.exit(1);
}

const binaryPaths = [join(bundledRoot, "bin", "override"), join(bundledRoot, "bin", "fallback")];
const result = spawnSync(python, [fileURLToPath(new URL("./inspect-pdf.py", import.meta.url)), ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, PATH: [...binaryPaths, process.env.PATH || ""].join(delimiter) }
});

if (result.error) {
  console.error(`无法运行 PDF 检查：${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);

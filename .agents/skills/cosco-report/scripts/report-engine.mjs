#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const engineMarker = "scripts/report-engine-cli.mjs";
const ancestors = (start) => {
  const paths = [];
  let current = resolve(start);
  const root = parse(current).root;
  while (true) {
    paths.push(current);
    if (current === root) break;
    current = dirname(current);
  }
  return paths;
};
const candidates = [
  process.env.COSCO_REPORT_ENGINE_ROOT,
  resolve(scriptDirectory, "../../../.."),
  ...ancestors(process.cwd())
].filter(Boolean);
const projectRoot = candidates.find((candidate) => existsSync(resolve(candidate, engineMarker)));
if (!projectRoot) {
  console.error("未找到 COSCO Report Engine。请克隆 https://github.com/xcxandy-hub/cosco-report-engine，在仓库目录中运行，或设置 COSCO_REPORT_ENGINE_ROOT。");
  process.exit(1);
}
const cli = resolve(projectRoot, "scripts/report-engine-cli.mjs");
const args = process.argv.slice(2);

if (!args.length) {
  console.error("用法：report-engine.mjs [--trusted-code] <validate|preview|compile|build> <报告包> <数据> [输出...]");
  process.exit(2);
}

const result = spawnSync(process.execPath, [cli, ...args], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);

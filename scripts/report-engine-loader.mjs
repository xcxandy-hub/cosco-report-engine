import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";

let cachedEngine;

export async function loadReportEngine() {
  if (cachedEngine) return cachedEngine;
  const root = new URL("../", import.meta.url);
  const engineSource = await readFile(new URL("src/report-engine.ts", root), "utf8");
  const compiledEngine = ts.transpileModule(engineSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const engineExports = {};
  vm.runInNewContext(compiledEngine, {
    exports: engineExports,
    module: { exports: engineExports },
    structuredClone,
    atob,
    btoa,
    Intl,
    console
  });
  cachedEngine = engineExports;
  return cachedEngine;
}

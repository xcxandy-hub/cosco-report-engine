import vm from "node:vm";
import { readFile } from "node:fs/promises";
import ts from "typescript";

async function compileModule(url, require) {
  const source = await readFile(url, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exportsObject = {};
  vm.runInNewContext(compiled, {
    exports: exportsObject,
    module: { exports: exportsObject },
    require,
    structuredClone,
    console
  });
  return exportsObject;
}

let cached;

export async function loadVisualOverrides() {
  if (cached) return cached;
  const root = new URL("../", import.meta.url);
  const model = await compileModule(new URL("src/model.ts", root), () => { throw new Error("model.ts 不应加载外部模块"); });
  cached = await compileModule(new URL("src/visual-overrides.ts", root), (id) => {
    if (id === "./model") return model;
    throw new Error(`不允许的测试模块：${id}`);
  });
  return cached;
}

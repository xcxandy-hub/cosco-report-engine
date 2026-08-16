import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const [source, appSource, modelSource] = await Promise.all([
  readFile(new URL("../src/asset-store.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/App.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/model.ts", import.meta.url), "utf8")
]);
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`;
const { assetStorageKey, createAssetBlob, inspectImageDimensions } = await import(moduleUrl);

const asDataUrl = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
const png = Buffer.from("89504e470d0a1a0a", "hex");
const jpeg = Buffer.from("ffd8ffe00000ffd9", "hex");
const webp = Buffer.from("524946460c000000574542505650382000000000", "hex");

const pngHeader = (width, height) => {
  const bytes = Buffer.alloc(24);
  png.copy(bytes, 0);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
};
const jpegHeader = (width, height) => {
  const bytes = Buffer.alloc(17);
  Buffer.from("ffd8ffc0000b08", "hex").copy(bytes, 0);
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  bytes[11] = 3;
  bytes[15] = 0xff;
  bytes[16] = 0xd9;
  return bytes;
};
const webpHeader = (width, height) => {
  const bytes = Buffer.alloc(30);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write("VP8X", 12, "ascii");
  bytes.writeUInt32LE(10, 16);
  bytes.writeUIntLE(width - 1, 24, 3);
  bytes.writeUIntLE(height - 1, 27, 3);
  return bytes;
};

test("accepts canonical local PNG, JPEG and WebP data URLs without fetch", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error("fetch must not be used"); };
  try {
    for (const [mime, bytes] of [["image/png", png], ["image/jpeg", jpeg], ["image/webp", webp]]) {
      const blob = await createAssetBlob(asDataUrl(mime, bytes), mime);
      assert.equal(blob.type, mime);
      assert.equal(blob.size, bytes.length);
    }
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("accepts matching local image Blobs", async () => {
  for (const [mime, bytes] of [["image/png", png], ["image/jpeg", jpeg], ["image/webp", webp]]) {
    const sourceBlob = new Blob([bytes], { type: mime });
    assert.equal(await createAssetBlob(sourceBlob, mime), sourceBlob);
  }
});

test("reads PNG, JPEG and WebP dimensions before full browser decoding", async () => {
  const fixtures = [
    ["image/png", pngHeader(8000, 4000), { width: 8000, height: 4000 }],
    ["image/jpeg", jpegHeader(6000, 3000), { width: 6000, height: 3000 }],
    ["image/webp", webpHeader(4096, 2048), { width: 4096, height: 2048 }]
  ];
  for (const [mime, bytes, expected] of fixtures) {
    assert.deepEqual(await inspectImageDimensions(new Blob([bytes], { type: mime }), mime), expected);
  }
});

test("rejects URLs, SVG, unsupported MIME and malformed base64", async () => {
  const rejected = [
    ["https://example.invalid/image.png", "image/png"],
    ["blob:https://example.invalid/id", "image/png"],
    ["data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "image/svg+xml"],
    ["data:image/gif;base64,R0lGODlh", "image/gif"],
    ["data:text/plain;base64,SGVsbG8=", "image/png"],
    ["data:image/png;base64,%%%%", "image/png"],
    ["data:image/png;base64,Zh==", "image/png"]
  ];
  for (const [value, mime] of rejected) await assert.rejects(() => createAssetBlob(value, mime));
});

test("rejects MIME mismatches and files with spoofed signatures", async () => {
  await assert.rejects(() => createAssetBlob(asDataUrl("image/png", png), "image/jpeg"), /MIME/);
  await assert.rejects(() => createAssetBlob(asDataUrl("image/png", jpeg), "image/png"), /MIME|损坏/);
  await assert.rejects(() => createAssetBlob(new Blob([png], { type: "image/png" }), "image/webp"), /MIME/);
  await assert.rejects(() => createAssetBlob(new Blob([Buffer.from("not an image")], { type: "image/png" }), "image/png"), /MIME|损坏/);
  await assert.rejects(() => createAssetBlob(new Blob([Buffer.from("<svg/>")], { type: "image/svg+xml" }), "image/svg+xml"));
});

test("revalidates legacy IndexedDB records before returning image sources", () => {
  assert.match(source, /blob\s*=\s*await createAssetBlob\(asset\.data \|\| asset\.blob!, asset\.mime\)/);
  assert.doesNotMatch(source, /if \(asset\.data\) return \[asset\.id, asset\.data\]/);
});

test("routes editor image decoding through the validated local asset path", () => {
  assert.match(appSource, /createAssetBlob\(data, asset\.mime\)/);
  assert.doesNotMatch(appSource, /fetch\(data\)/);
  assert.match(modelSource, /validateImportedAssetData\(data, mime\)/);
  assert.match(modelSource, /工程包含未声明的图片数据/);
});

test("isolates specialized report assets by package namespace", () => {
  assert.equal(assetStorageKey("cover-image"), "cover-image");
  assert.deepEqual(assetStorageKey("cover-image", "report-package:finance"), ["report-package:finance", "cover-image"]);
  assert.notDeepEqual(assetStorageKey("cover-image", "report-package:finance"), assetStorageKey("cover-image", "report-package:investor"));
  assert.match(appSource, /assetNamespace:\s*runtimeAssetNamespace\(reportPackage\)/);
  assert.match(appSource, /getAssets\(compiledDocument\.assets\.map\(\(asset\) => asset\.id\), runtimeAssetNamespace\(reportPackage\)\)/);
});

test("portable project imports are complete, bounded, sanitized and atomically stored", () => {
  assert.match(modelSource, /requireAssetData/);
  assert.match(modelSource, /可移植工程缺少图片资产数据/);
  assert.match(modelSource, /MAX_IMPORTED_ASSET_TOTAL_BYTES/);
  assert.match(modelSource, /MAX_IMPORTED_ASSET_COUNT/);
  assert.match(modelSource, /MAX_IMPORTED_IMAGE_TOTAL_PIXELS/);
  assert.match(appSource, /function unzipProjectArchive/);
  assert.match(appSource, /MAX_PROJECT_ARCHIVE_ENTRIES/);
  assert.match(appSource, /sanitizeImportedProjectAssets\(imported, keepOriginalImages\)/);
  assert.match(appSource, /readImageAsset\(file, keepOriginal, remainingPixels\)/);
  assert.ok(appSource.indexOf("inspectImageDimensions(file, file.type)") < appSource.indexOf('createImageBitmap(file, { imageOrientation: "from-image" })'));
  assert.ok(appSource.indexOf("file.size > MAX_IMPORTED_ASSET_BYTES") < appSource.indexOf("inspectImageDimensions(file, file.type)"));
  assert.doesNotMatch(appSource, /accept="image\/\*"/);
  assert.match(appSource, /scaleImageCrop\(page\.masterProps\.crop/);
  assert.match(appSource, /scaleImageCrop\(element\.crop/);
  assert.match(appSource, /putAssetsAtomically\(sanitized\.document\.assets/);
  assert.match(source, /export async function putAssetsAtomically/);
  assert.match(source, /database\.transaction\(STORE_NAME, "readwrite"\)/);
  assert.match(source, /export async function clearAssetNamespace/);
});

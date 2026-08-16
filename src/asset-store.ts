const DB_NAME = "local-report-studio-assets-v1";
const STORE_NAME = "blobs";
const ALLOWED_ASSET_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

interface StoredAsset {
  id: IDBValidKey;
  blob?: Blob;
  /** 兼容最早的开发构建，读取后会在下一次写入升级为 Blob。 */
  data?: string;
  mime: string;
  updatedAt: number;
}

export interface AssetWrite {
  id: string;
  data: string | Blob;
  mime: string;
}

export function assetStorageKey(id: string, namespace?: string): IDBValidKey {
  return namespace ? [namespace, id] : id;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("当前浏览器不支持 IndexedDB"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地图片存储"));
  });
}

function hasBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function hasValidImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") {
    return bytes.length >= 8 && hasBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 4
      && hasBytes(bytes, 0, [0xff, 0xd8, 0xff])
      && hasBytes(bytes, bytes.length - 2, [0xff, 0xd9]);
  }
  if (mime === "image/webp") {
    if (bytes.length < 20 || !hasBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) || !hasBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return false;
    const declaredSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const chunkType = String.fromCharCode(...bytes.slice(12, 16));
    return declaredSize === bytes.length - 8 && ["VP8 ", "VP8L", "VP8X"].includes(chunkType);
  }
  return false;
}

function decodeStrictBase64(payload: string) {
  if (!payload || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) {
    throw new Error("图片 data URL 的 base64 数据无效");
  }
  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw new Error("图片 data URL 的 base64 数据无效");
  }
  if (btoa(binary) !== payload) throw new Error("图片 data URL 的 base64 数据不是规范编码");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function requireAllowedMime(mime: string) {
  if (!ALLOWED_ASSET_MIMES.has(mime)) {
    throw new Error("图片资产只支持 image/png、image/jpeg 或 image/webp");
  }
}

function readUint24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parseImageDimensions(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") {
    if (bytes.length < 24 || String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") throw new Error("PNG 图片缺少有效 IHDR 尺寸头");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (offset + 3 < bytes.length) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.length) break;
      const marker = bytes[offset++];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (marker === 0xd9 || marker === 0xda || offset + 1 >= bytes.length) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      if (startOfFrame.has(marker) && length >= 7) {
        return {
          height: (bytes[offset + 3] << 8) | bytes[offset + 4],
          width: (bytes[offset + 5] << 8) | bytes[offset + 6]
        };
      }
      offset += length;
    }
    throw new Error("JPEG 图片缺少有效尺寸头");
  }
  if (mime === "image/webp") {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X" && bytes.length >= 30) {
      return { width: readUint24LE(bytes, 24) + 1, height: readUint24LE(bytes, 27) + 1 };
    }
    if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10)
      };
    }
    if (chunk === "VP8 " && bytes.length >= 30 && hasBytes(bytes, 23, [0x9d, 0x01, 0x2a])) {
      return {
        width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
        height: (bytes[28] | (bytes[29] << 8)) & 0x3fff
      };
    }
    throw new Error("WebP 图片缺少有效尺寸头");
  }
  throw new Error("图片资产只支持 image/png、image/jpeg 或 image/webp");
}

export async function inspectImageDimensions(data: Blob, declaredMime: string) {
  requireAllowedMime(declaredMime);
  if (data.type && data.type !== declaredMime) throw new Error("图片 Blob 的 MIME 与资产声明不一致");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (!hasValidImageSignature(bytes, declaredMime)) throw new Error("图片内容与声明的 MIME 不匹配或文件已损坏");
  const dimensions = parseImageDimensions(bytes, declaredMime);
  if (!Number.isSafeInteger(dimensions.width) || !Number.isSafeInteger(dimensions.height) || dimensions.width < 1 || dimensions.height < 1) {
    throw new Error("图片像素尺寸无效");
  }
  return dimensions;
}

export async function createAssetBlob(data: string | Blob, declaredMime: string) {
  requireAllowedMime(declaredMime);
  let blob: Blob;
  let bytes: Uint8Array;
  if (typeof data === "string") {
    const match = data.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) throw new Error("图片资产必须是受支持的本地 base64 data URL");
    const [, embeddedMime, payload] = match;
    if (embeddedMime !== declaredMime) throw new Error("图片 data URL 的 MIME 与资产声明不一致");
    bytes = decodeStrictBase64(payload);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    blob = new Blob([buffer], { type: embeddedMime });
  } else {
    requireAllowedMime(data.type);
    if (data.type !== declaredMime) throw new Error("图片 Blob 的 MIME 与资产声明不一致");
    blob = data;
    bytes = new Uint8Array(await data.arrayBuffer());
  }
  if (!hasValidImageSignature(bytes, declaredMime)) throw new Error("图片内容与声明的 MIME 不匹配或文件已损坏");
  return blob;
}

export async function putAsset(id: string, data: string | Blob, mime: string, namespace?: string) {
  const blob = await createAssetBlob(data, mime);
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ id: assetStorageKey(id, namespace), blob, mime, updatedAt: Date.now() } satisfies StoredAsset);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("图片写入失败"));
  });
  database.close();
}

export async function putAssetsAtomically(assets: AssetWrite[], namespace?: string) {
  if (!assets.length) return;
  const prepared = await Promise.all(assets.map(async (asset) => ({
    ...asset,
    blob: await createAssetBlob(asset.data, asset.mime)
  })));
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      prepared.forEach((asset) => store.put({
        id: assetStorageKey(asset.id, namespace),
        blob: asset.blob,
        mime: asset.mime,
        updatedAt: Date.now()
      } satisfies StoredAsset));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("图片批量写入失败"));
      transaction.onabort = () => reject(transaction.error || new Error("图片批量写入已回滚"));
    });
  } finally {
    database.close();
  }
}

export async function getAssets(ids: string[], namespace?: string): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const database = await openDatabase();
  const records = await new Promise<Array<{ requestedId: string; asset: StoredAsset }>>((resolve, reject) => {
    const values: Array<{ requestedId: string; asset: StoredAsset }> = [];
    const transaction = database.transaction(STORE_NAME, "readonly");
    ids.forEach((id) => {
      const request = transaction.objectStore(STORE_NAME).get(assetStorageKey(id, namespace));
      request.onsuccess = () => {
        const asset = request.result as StoredAsset | undefined;
        if (asset) values.push({ requestedId: id, asset });
      };
    });
    transaction.oncomplete = () => resolve(values);
    transaction.onerror = () => reject(transaction.error || new Error("图片读取失败"));
  });
  database.close();
  const entries = await Promise.all(records.map(async ({ requestedId, asset }) => {
    if (!asset.data && !asset.blob) return [asset.id, ""] as const;
    let blob: Blob;
    try {
      blob = await createAssetBlob(asset.data || asset.blob!, asset.mime);
    } catch {
      return [asset.id, ""] as const;
    }
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error || new Error("图片解码失败"));
      reader.readAsDataURL(blob);
    });
    return [requestedId, data] as const;
  }));
  return Object.fromEntries(entries.filter((entry) => Boolean(entry[1])));
}

export async function getAssetByteSizes(ids: string[], namespace?: string): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const database = await openDatabase();
  const records = await new Promise<Array<{ requestedId: string; asset: StoredAsset }>>((resolve, reject) => {
    const values: Array<{ requestedId: string; asset: StoredAsset }> = [];
    const transaction = database.transaction(STORE_NAME, "readonly");
    ids.forEach((id) => {
      const request = transaction.objectStore(STORE_NAME).get(assetStorageKey(id, namespace));
      request.onsuccess = () => {
        const asset = request.result as StoredAsset | undefined;
        if (asset) values.push({ requestedId: id, asset });
      };
    });
    transaction.oncomplete = () => resolve(values);
    transaction.onerror = () => reject(transaction.error || new Error("图片读取失败"));
  });
  database.close();
  return Object.fromEntries(records.map(({ requestedId, asset }) => {
    if (asset.blob) return [requestedId, asset.blob.size];
    const payload = asset.data?.split(",")[1] || "";
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return [requestedId, Math.max(0, Math.floor(payload.length * 0.75) - padding)];
  }));
}

export async function removeAssets(ids: string[], namespace?: string) {
  if (!ids.length) return;
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    ids.forEach((id) => transaction.objectStore(STORE_NAME).delete(assetStorageKey(id, namespace)));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("图片删除失败"));
  });
  database.close();
}

export async function clearAssetNamespace(namespace: string) {
  if (!namespace) throw new Error("清理图片资产时缺少命名空间");
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const request = transaction.objectStore(STORE_NAME).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const key = cursor.key;
        if (Array.isArray(key) && key[0] === namespace) cursor.delete();
        cursor.continue();
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("图片命名空间清理失败"));
      transaction.onabort = () => reject(transaction.error || new Error("图片命名空间清理已回滚"));
    });
  } finally {
    database.close();
  }
}

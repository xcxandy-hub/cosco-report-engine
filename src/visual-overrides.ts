import { clone, ReportAsset, ReportDocument, ReportElement, ReportPage } from "./model";

export const VISUAL_OVERRIDE_SCHEMA_VERSION = "1" as const;

const ELEMENT_PATCH_KEYS = [
  "name", "x", "y", "w", "h", "z", "locked", "hidden", "content", "runs", "assetId", "crop",
  "imageStyle", "chartKind", "chart", "chartLabels", "table", "style"
] as const;

const PAGE_PATCH_KEYS = ["name", "section", "masterProps"] as const;
const ELEMENT_TYPES = new Set(["text", "box", "divider", "image", "chart", "table"]);
const ADDED_VISUAL_TYPES = new Set(["box", "divider", "image"]);

type ElementPatchKey = (typeof ELEMENT_PATCH_KEYS)[number];
type ElementPatch = Partial<Pick<ReportElement, ElementPatchKey>>;

interface ElementVisualOverride {
  patch?: ElementPatch;
  added?: ReportElement;
  removed?: true;
}

interface PageVisualOverride {
  patch?: Partial<Pick<ReportPage, "name" | "section" | "masterProps">>;
  elementOrder?: string[];
  elements?: Record<string, ElementVisualOverride>;
}

export interface VisualOverrideSet {
  format: "cosco-report-visual-overrides";
  schemaVersion: typeof VISUAL_OVERRIDE_SCHEMA_VERSION;
  packageId: string;
  packageVersion: string;
  updatedAt: string;
  document?: Partial<Pick<ReportDocument, "theme" | "pageSetup">>;
  assets?: Record<string, ReportAsset | null>;
  pages?: Record<string, PageVisualOverride>;
}

export interface VisualOverrideResult {
  document: ReportDocument;
  orphanCount: number;
}

const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function isAddedVisualElement(value: unknown, expectedId: string): value is ReportElement {
  if (!isRecord(value) || value.id !== expectedId || typeof value.type !== "string" || !ELEMENT_TYPES.has(value.type)) return false;
  return typeof value.name === "string"
    && [value.x, value.y, value.w, value.h, value.z].every((number) => typeof number === "number" && Number.isFinite(number))
    && isRecord(value.style);
}

function runtimePatch<T extends object>(source: unknown, keys: readonly (keyof T)[]) {
  if (!isRecord(source)) return undefined;
  const patch: Partial<T> = {};
  keys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(source, key)) patch[key] = clone(source[key as string]) as T[typeof key];
  });
  return Object.keys(patch).length ? patch : undefined;
}

function sanitizeAddedVisualElement(element: ReportElement) {
  if (!ADDED_VISUAL_TYPES.has(element.type)) return null;
  const sanitized = clone(element);
  delete sanitized.content;
  delete sanitized.runs;
  delete sanitized.chart;
  delete sanitized.table;
  return sanitized;
}

function definedPatch<T extends object>(base: T, edited: T, keys: readonly (keyof T)[]) {
  const patch: Partial<T> = {};
  keys.forEach((key) => {
    if (!equal(base[key], edited[key])) patch[key] = clone(edited[key]);
  });
  return Object.keys(patch).length ? patch : undefined;
}

export function createVisualOverrides(
  base: ReportDocument,
  edited: ReportDocument,
  identity: { packageId: string; packageVersion: string },
  protectedElementIds: ReadonlySet<string> = new Set()
): VisualOverrideSet {
  const result: VisualOverrideSet = {
    format: "cosco-report-visual-overrides",
    schemaVersion: VISUAL_OVERRIDE_SCHEMA_VERSION,
    packageId: identity.packageId,
    packageVersion: identity.packageVersion,
    updatedAt: new Date().toISOString()
  };
  const documentPatch = definedPatch(base, edited, ["theme", "pageSetup"]);
  if (documentPatch) result.document = documentPatch;

  const baseAssets = new Map(base.assets.map((asset) => [asset.id, asset]));
  const editedAssets = new Map(edited.assets.map((asset) => [asset.id, asset]));
  const assets: Record<string, ReportAsset | null> = {};
  new Set([...baseAssets.keys(), ...editedAssets.keys()]).forEach((id) => {
    const before = baseAssets.get(id);
    const after = editedAssets.get(id);
    if (!after) assets[id] = null;
    else if (!before || !equal(before, after)) assets[id] = clone(after);
  });
  if (Object.keys(assets).length) result.assets = assets;

  const basePages = new Map(base.pages.map((page) => [page.id, page]));
  const pageOverrides: Record<string, PageVisualOverride> = {};
  edited.pages.forEach((page) => {
    const before = basePages.get(page.id);
    if (!before) return;
    const pageOverride: PageVisualOverride = {};
    const pagePatch = definedPatch(before, page, PAGE_PATCH_KEYS);
    if (pagePatch) pageOverride.patch = pagePatch;
    const beforeIds = before.elements.slice().sort((left, right) => left.z - right.z).map((element) => element.id);
    const afterIds = page.elements.slice().sort((left, right) => left.z - right.z).map((element) => element.id);
    if (!equal(beforeIds, afterIds)) pageOverride.elementOrder = afterIds;
    const beforeElements = new Map(before.elements.map((element) => [element.id, element]));
    const afterElements = new Map(page.elements.map((element) => [element.id, element]));
    const elementOverrides: Record<string, ElementVisualOverride> = {};
    new Set([...beforeElements.keys(), ...afterElements.keys()]).forEach((id) => {
      const beforeElement = beforeElements.get(id);
      const afterElement = afterElements.get(id);
      if (!afterElement) {
        if (protectedElementIds.has(id)) return;
        elementOverrides[id] = { removed: true };
        return;
      }
      if (!beforeElement) {
        const added = sanitizeAddedVisualElement(afterElement);
        if (added) elementOverrides[id] = { added };
        return;
      }
      const patch = definedPatch(beforeElement, afterElement, ELEMENT_PATCH_KEYS);
      if (patch && protectedElementIds.has(id)) {
        delete patch.content;
        delete patch.runs;
        delete patch.chart;
        delete patch.table;
      }
      if (patch && Object.keys(patch).length) elementOverrides[id] = { patch };
    });
    if (Object.keys(elementOverrides).length) pageOverride.elements = elementOverrides;
    if (Object.keys(pageOverride).length) pageOverrides[page.id] = pageOverride;
  });
  if (Object.keys(pageOverrides).length) result.pages = pageOverrides;
  return result;
}

export function applyVisualOverrides(
  base: ReportDocument,
  overrides: VisualOverrideSet | null | undefined,
  protectedElementIds: ReadonlySet<string> = new Set()
): VisualOverrideResult {
  const document = clone(base);
  if (!overrides || overrides.format !== "cosco-report-visual-overrides" || overrides.schemaVersion !== VISUAL_OVERRIDE_SCHEMA_VERSION) {
    return { document, orphanCount: 0 };
  }
  if (overrides.document?.theme) document.theme = clone(overrides.document.theme);
  if (overrides.document?.pageSetup) document.pageSetup = clone(overrides.document.pageSetup);

  if (overrides.assets) {
    const assets = new Map(document.assets.map((asset) => [asset.id, asset]));
    Object.entries(overrides.assets).forEach(([id, asset]) => asset ? assets.set(id, clone(asset)) : assets.delete(id));
    document.assets = [...assets.values()];
  }

  let orphanCount = 0;
  Object.entries(isRecord(overrides.pages) ? overrides.pages : {}).forEach(([pageId, override]) => {
    if (!isRecord(override)) {
      orphanCount += 1;
      return;
    }
    const page = document.pages.find((item) => item.id === pageId);
    if (!page) {
      orphanCount += 1;
      return;
    }
    const pagePatch = runtimePatch<ReportPage>(override.patch, PAGE_PATCH_KEYS);
    if (pagePatch) Object.assign(page, pagePatch);
    const elements = new Map(page.elements.map((element) => [element.id, element]));
    Object.entries(isRecord(override.elements) ? override.elements : {}).forEach(([elementId, elementOverride]) => {
      if (!isRecord(elementOverride)) {
        orphanCount += 1;
        return;
      }
      const element = elements.get(elementId);
      if (isAddedVisualElement(elementOverride.added, elementId)) {
        const added = sanitizeAddedVisualElement(elementOverride.added);
        if (!element && added) elements.set(elementId, added);
        return;
      }
      if (!element) {
        orphanCount += 1;
        return;
      }
      if (elementOverride.removed) {
        if (protectedElementIds.has(elementId)) return;
        elements.delete(elementId);
        return;
      }
      if (elementOverride.patch) {
        const patch = runtimePatch<ReportElement>(elementOverride.patch, ELEMENT_PATCH_KEYS);
        if (!patch) return;
        if (protectedElementIds.has(elementId)) {
          delete patch.content;
          delete patch.runs;
          delete patch.chart;
          delete patch.table;
        }
        Object.assign(element, patch);
      }
    });
    const ordered: ReportElement[] = [];
    const requestedOrder = Array.isArray(override.elementOrder) && override.elementOrder.every((id) => typeof id === "string")
      ? [...new Set(override.elementOrder)]
      : page.elements.map((element) => element.id);
    requestedOrder.forEach((id) => {
      const element = elements.get(id);
      if (element) {
        ordered.push(element);
        elements.delete(id);
      }
    });
    page.elements = [...ordered, ...elements.values()].map((element, index) => ({ ...element, z: index + 1 }));
  });
  document.updatedAt = overrides.updatedAt || document.updatedAt;
  return { document, orphanCount };
}

export function visualOverrideCount(overrides: VisualOverrideSet | null | undefined) {
  if (!overrides) return 0;
  return Object.values(overrides.pages || {}).reduce((sum, page) => sum + Object.keys(page.elements || {}).length + (page.patch ? 1 : 0), 0)
    + Object.keys(overrides.assets || {}).length
    + (overrides.document?.theme || overrides.document?.pageSetup ? 1 : 0);
}

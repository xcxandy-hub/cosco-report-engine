export type Orientation = "portrait" | "landscape";
export type MasterType = "cover" | "section" | "standard" | "data" | "blank" | "backcover";
export type ElementType = "text" | "box" | "divider" | "image" | "chart" | "table";
export type ChartKind = "line" | "bar" | "combo" | "donut";
export type ChartLabelMode = "auto" | "all" | "sparse" | "key" | "off";
export type SemanticRole =
  | "title"
  | "body"
  | "caption"
  | "source"
  | "kpi-label"
  | "kpi-value"
  | "kpi-unit"
  | "kpi-note"
  | "quote-mark"
  | "quote-body"
  | "quote-attribution";

export interface ThemeTokens {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  paper: string;
  surface: string;
  line: string;
  positive: string;
  negative: string;
  chartPalette: string[];
  fontFamily: string;
  fontSlots: {
    display: string;
    body: string;
    numeric: string;
  };
}

export type ThemeColorToken =
  | "primary"
  | "secondary"
  | "accent"
  | "text"
  | "muted"
  | "paper"
  | "surface"
  | "line"
  | "positive"
  | "negative"
  | "white"
  | "transparent";

export const FONT_SIZE_STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48] as const;
export type FontSizeStep = (typeof FONT_SIZE_STEPS)[number];

export interface TextRun {
  text: string;
  marks?: Array<"bold" | "accentRed" | "accentGreen">;
}

export interface ReportAsset {
  id: string;
  kind: "image";
  mime: string;
  width: number;
  height: number;
  byteSize: number;
  hash?: string;
  sourceName?: string;
  optimized?: boolean;
  originalRetained?: boolean;
}

export interface ImageCrop {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface ImageStyle {
  overlayKind: "none" | "solid" | "linear" | "duotone";
  overlayColor: ThemeColorToken;
  overlayColor2: ThemeColorToken;
  overlayAngle: 0 | 45 | 90 | 135;
  blendMode: "multiply" | "overlay" | "soft-light";
  strength: number;
  grade: "none" | "deep-sea" | "film" | "black-gold" | "documentary-fade";
  vignette: "none" | "light" | "heavy";
}

export const DEFAULT_IMAGE_STYLE: ImageStyle = {
  overlayKind: "none",
  overlayColor: "primary",
  overlayColor2: "transparent",
  overlayAngle: 0,
  blendMode: "multiply",
  strength: 0.5,
  grade: "none",
  vignette: "none"
};

export interface ChartSeries {
  /** Stable within a report-package lineage so visual label overrides survive data refreshes. */
  id?: string;
  name: string;
  values: number[];
  kind?: "bar" | "line";
  axis?: "left" | "right";
  unit?: string;
}

export interface ChartData {
  categories: string[];
  /** Stable keys parallel to categories. Values are generated when omitted. */
  categoryIds?: string[];
  series: ChartSeries[];
}

export interface ChartLabelOffset {
  /** Millimetres relative to the chart renderer's automatic label position. */
  dx: number;
  dy: number;
  hidden?: boolean;
}

export interface ChartLabelSettings {
  mode: ChartLabelMode;
  sparseEvery: number;
  offsets?: Partial<Record<Orientation, Record<string, ChartLabelOffset>>>;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface ElementStyle {
  /** The value is normalized to FONT_SIZE_STEPS when persisted. */
  fontSize?: number;
  fontSlot?: "display" | "body" | "numeric";
  fontWeight?: number;
  color?: ThemeColorToken;
  background?: ThemeColorToken;
  borderColor?: ThemeColorToken;
  borderWidth?: number;
  radius?: number;
  align?: "left" | "center" | "right";
  verticalAlign?: "start" | "center" | "end";
  padding?: number;
  opacity?: number;
  lineHeight?: number;
  showLabel?: boolean;
  showLegend?: boolean;
}

export interface ReportElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  semanticRole?: SemanticRole;
  groupId?: string;
  groupName?: string;
  presetId?: string;
  presetSlot?: string;
  role?:
    | "header-left"
    | "header-right"
    | "header-rule"
    | "footer-left"
    | "footer-page-number"
    | "footer-rule"
    | "backcover-organization"
    | "backcover-disclaimer"
    | "backcover-contact"
    | "backcover-confidentiality";
  locked?: boolean;
  hidden?: boolean;
  content?: string;
  runs?: TextRun[];
  value?: string;
  unit?: string;
  note?: string;
  assetId?: string;
  crop?: ImageCrop;
  imageStyle?: ImageStyle;
  /** @deprecated 仅供旧工程迁移使用，1.4 文档不会写入。 */
  image?: string;
  chartKind?: ChartKind;
  chart?: ChartData;
  chartLabels?: ChartLabelSettings;
  table?: TableData;
  style: ElementStyle;
}

export interface ReportPage {
  id: string;
  name: string;
  section: string;
  master: MasterType;
  orientation: Orientation;
  masterProps?: {
    imageAssetId?: string;
    focal?: { x: number; y: number };
    crop?: ImageCrop;
    overlay?: "brand" | "darken" | "none";
    overlayStrength?: number;
    imageStyle?: ImageStyle;
    disclaimer?: string;
    contact?: string;
  };
  elements: ReportElement[];
}

export interface ReportDocument {
  version: "1.5";
  meta: {
    title: string;
    organization: string;
    period: string;
    author: string;
    confidentiality: string;
  };
  theme: ThemeTokens;
  pageSetup: {
    grid: number;
    margin: number;
    snap: boolean;
    showGrid: boolean;
    footerMode?: "all" | "confidentiality-last";
    printDpi?: 96 | 150 | 300;
  };
  usedFontSlots: Array<"display" | "body" | "numeric">;
  assets: ReportAsset[];
  pages: ReportPage[];
  updatedAt: string;
}

export interface NormalizedProject {
  document: ReportDocument;
  assetData: Record<string, string>;
}

export const PAGE_MM: Record<Orientation, { width: number; height: number }> = {
  portrait: { width: 210, height: 297 },
  landscape: { width: 297, height: 210 }
};

export const MM_TO_PX = 96 / 25.4;

export const uid = (prefix = "id") =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const clone = <T,>(value: T): T => structuredClone(value);

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export function scaleImageCrop(
  crop: ImageCrop,
  source: Pick<ReportAsset, "width" | "height">,
  target: Pick<ReportAsset, "width" | "height">
): ImageCrop {
  const sourceWidth = Math.max(1, Number(source.width) || 1);
  const sourceHeight = Math.max(1, Number(source.height) || 1);
  const targetWidth = Math.max(1, Number(target.width) || 1);
  const targetHeight = Math.max(1, Number(target.height) || 1);
  const sx = clamp((Number(crop.sx) || 0) * targetWidth / sourceWidth, 0, Math.max(0, targetWidth - 1));
  const sy = clamp((Number(crop.sy) || 0) * targetHeight / sourceHeight, 0, Math.max(0, targetHeight - 1));
  return {
    sx: round(sx, 4),
    sy: round(sy, 4),
    sw: round(clamp((Number(crop.sw) || sourceWidth) * targetWidth / sourceWidth, 1, targetWidth - sx), 4),
    sh: round(clamp((Number(crop.sh) || sourceHeight) * targetHeight / sourceHeight, 1, targetHeight - sy), 4)
  };
}

export const elementLabel: Record<ElementType, string> = {
  text: "正文",
  box: "色块",
  chart: "图表",
  table: "数据表",
  image: "图片",
  divider: "分隔线"
};

function pageDecoration(
  role: NonNullable<ReportElement["role"]>,
  type: "text" | "divider",
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  style: ElementStyle,
  z: number
): ReportElement {
  return {
    id: uid("element"),
    role,
    type,
    name,
    x,
    y,
    w,
    h,
    z,
    content,
    runs: type === "text" ? [{ text: content }] : undefined,
    style
  };
}

export function createPageDecorations(
  page: Pick<ReportPage, "master" | "orientation" | "section" | "masterProps">,
  meta: ReportDocument["meta"],
  pageNumber: number,
  totalPages: number,
  footerMode: ReportDocument["pageSetup"]["footerMode"] = "all"
): ReportElement[] {
  const size = PAGE_MM[page.orientation];
  const margin = 18;
  const innerWidth = size.width - margin * 2;
  const mutedText: ElementStyle = {
    fontSize: 8,
    fontSlot: "body",
    color: "muted",
    background: "transparent",
    lineHeight: 1.2,
    padding: 0
  };

  if (["standard", "data", "section"].includes(page.master)) {
    const confidentiality = footerMode === "confidentiality-last" && pageNumber !== totalPages
      ? ""
      : meta.confidentiality;
    return [
      pageDecoration("header-left", "text", "页眉机构", margin, 7, innerWidth * 0.46, 4.5, meta.organization || meta.title, { ...mutedText, align: "left" }, 1),
      pageDecoration("header-right", "text", "页眉章节", margin + innerWidth * 0.54, 7, innerWidth * 0.46, 4.5, page.section, { ...mutedText, align: "right" }, 2),
      pageDecoration("header-rule", "divider", "页眉线", margin, 13, innerWidth, 0.25, "", { background: "line", opacity: 1 }, 3),
      pageDecoration("footer-rule", "divider", "页脚线", margin, size.height - 9, innerWidth, 0.25, "", { background: "line", opacity: 1 }, 4),
      pageDecoration("footer-left", "text", "页脚密级", margin, size.height - 7, innerWidth * 0.72, 4, confidentiality, { ...mutedText, align: "left" }, 5),
      pageDecoration("footer-page-number", "text", "页码", margin + innerWidth * 0.82, size.height - 7, innerWidth * 0.18, 4, String(pageNumber).padStart(2, "0"), { ...mutedText, fontSlot: "numeric", align: "right" }, 6)
    ];
  }

  if (page.master === "backcover") {
    const props = page.masterProps || {};
    return [
      pageDecoration("backcover-organization", "text", "尾页机构", 24, size.height - 62, size.width - 48, 9, meta.organization || meta.title, { fontSize: 14, fontSlot: "display", fontWeight: 700, color: "text", background: "transparent", align: "center", lineHeight: 1.2 }, 1),
      pageDecoration("backcover-disclaimer", "text", "免责声明", 30, size.height - 49, size.width - 60, 16, props.disclaimer || "本报告仅供内部讨论使用，不构成投资、审计或法律意见。", { fontSize: 8, fontSlot: "body", color: "text", background: "transparent", align: "center", lineHeight: 1.5 }, 2),
      pageDecoration("backcover-contact", "text", "联系方式", 30, size.height - 28, size.width - 60, 7, props.contact || [meta.author, meta.period].filter(Boolean).join(" · "), { fontSize: 10, fontSlot: "body", color: "text", background: "transparent", align: "center", lineHeight: 1.2 }, 3),
      pageDecoration("backcover-confidentiality", "text", "尾页密级", 30, size.height - 17, size.width - 60, 5, meta.confidentiality, { fontSize: 8, fontSlot: "body", color: "muted", background: "transparent", align: "center", lineHeight: 1.2 }, 4)
    ];
  }

  return [];
}

const legacyColorMap: Record<string, ThemeColorToken> = {
  "var(--report-primary)": "primary",
  "var(--report-secondary)": "secondary",
  "var(--report-accent)": "accent",
  "var(--report-text)": "text",
  "var(--report-muted)": "muted",
  "var(--report-paper)": "paper",
  "var(--report-surface)": "surface",
  "var(--report-line)": "line",
  "var(--report-positive)": "positive",
  "var(--report-negative)": "negative",
  "#ffffff": "white",
  "transparent": "transparent"
};

function nearestFontSize(value: unknown): FontSizeStep {
  const number = Number(value);
  if (!Number.isFinite(number)) return 10;
  return FONT_SIZE_STEPS.reduce((best, candidate) =>
    Math.abs(candidate - number) < Math.abs(best - number) ? candidate : best, 10 as FontSizeStep);
}

function normalizeColor(value: unknown, fallback: ThemeColorToken): ThemeColorToken {
  if (typeof value !== "string") return fallback;
  if (value in legacyColorMap) return legacyColorMap[value];
  if (["primary", "secondary", "accent", "text", "muted", "paper", "surface", "line", "positive", "negative", "white", "transparent"].includes(value)) {
    return value as ThemeColorToken;
  }
  return fallback;
}

function normalizeRuns(element: ReportElement) {
  if (Array.isArray(element.runs)) {
    element.runs = element.runs.filter((run) => run && typeof run.text === "string").map((run) => ({
      text: run.text,
      marks: run.marks?.filter((mark) => ["bold", "accentRed", "accentGreen"].includes(mark))
    }));
  } else if (typeof element.content === "string") {
    element.runs = [{ text: element.content }];
  }
  if (element.runs) element.content = element.runs.map((run) => run.text).join("");
}

function normalizeImageStyle(value: Partial<ImageStyle> | undefined, fallback?: Partial<ImageStyle>): ImageStyle {
  const source = { ...DEFAULT_IMAGE_STYLE, ...fallback, ...value };
  const angles = [0, 45, 90, 135] as const;
  const blendModes = ["multiply", "overlay", "soft-light"] as const;
  const grades = ["none", "deep-sea", "film", "black-gold", "documentary-fade"] as const;
  const vignettes = ["none", "light", "heavy"] as const;
  const overlayKinds = ["none", "solid", "linear", "duotone"] as const;
  return {
    overlayKind: overlayKinds.includes(source.overlayKind as typeof overlayKinds[number]) ? source.overlayKind as ImageStyle["overlayKind"] : "none",
    overlayColor: normalizeColor(source.overlayColor, "primary"),
    overlayColor2: normalizeColor(source.overlayColor2, "transparent"),
    overlayAngle: angles.includes(Number(source.overlayAngle) as typeof angles[number]) ? Number(source.overlayAngle) as ImageStyle["overlayAngle"] : 0,
    blendMode: blendModes.includes(source.blendMode as typeof blendModes[number]) ? source.blendMode as ImageStyle["blendMode"] : "multiply",
    strength: Math.max(0, Math.min(1, Number(source.strength) || 0)),
    grade: grades.includes(source.grade as typeof grades[number]) ? source.grade as ImageStyle["grade"] : "none",
    vignette: vignettes.includes(source.vignette as typeof vignettes[number]) ? source.vignette as ImageStyle["vignette"] : "none"
  };
}

function stableKeyPart(value: string, fallback: string) {
  const normalized = value.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeChartData(chart: ChartData | undefined) {
  if (!chart || !Array.isArray(chart.categories) || !Array.isArray(chart.series)) return;
  const categoryCounts = new Map<string, number>();
  const suppliedCategoryIds = Array.isArray(chart.categoryIds) && chart.categoryIds.length === chart.categories.length
    ? chart.categoryIds
    : [];
  chart.categoryIds = chart.categories.map((category, index) => {
    const supplied = suppliedCategoryIds[index];
    if (typeof supplied === "string" && supplied.trim()) return supplied.trim();
    const base = stableKeyPart(String(category), `point-${index + 1}`);
    const occurrence = (categoryCounts.get(base) || 0) + 1;
    categoryCounts.set(base, occurrence);
    return occurrence === 1 ? base : `${base}-${occurrence}`;
  });
  const seriesCounts = new Map<string, number>();
  chart.series.forEach((series, index) => {
    if (typeof series.id === "string" && series.id.trim()) {
      series.id = series.id.trim();
      return;
    }
    const base = stableKeyPart(String(series.name || ""), `series-${index + 1}`);
    const occurrence = (seriesCounts.get(base) || 0) + 1;
    seriesCounts.set(base, occurrence);
    series.id = occurrence === 1 ? base : `${base}-${occurrence}`;
  });
}

function normalizeChartLabels(value: ChartLabelSettings | undefined, showLabel?: boolean): ChartLabelSettings {
  const modes: ChartLabelMode[] = ["auto", "all", "sparse", "key", "off"];
  const mode = modes.includes(value?.mode as ChartLabelMode) ? value!.mode : showLabel === false ? "off" : "auto";
  const sparseEvery = Math.max(2, Math.min(12, Math.round(Number(value?.sparseEvery) || 2)));
  const offsets: ChartLabelSettings["offsets"] = {};
  (["portrait", "landscape"] as Orientation[]).forEach((orientation) => {
    const source = value?.offsets?.[orientation];
    if (!source || typeof source !== "object") return;
    const safe = Object.fromEntries(Object.entries(source).flatMap(([key, offset]) => {
      const dx = Number(offset?.dx);
      const dy = Number(offset?.dy);
      if (!key || !Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 100 || Math.abs(dy) > 100) return [];
      return [[key, { dx: round(dx), dy: round(dy), hidden: offset.hidden === true || undefined }]];
    }));
    if (Object.keys(safe).length) offsets[orientation] = safe;
  });
  return { mode, sparseEvery, offsets: Object.keys(offsets).length ? offsets : undefined };
}

const IMPORTED_ASSET_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const MAX_IMPORTED_ASSET_BYTES = 50 * 1024 * 1024;
const MAX_IMPORTED_ASSET_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_IMPORTED_ASSET_COUNT = 256;
export const MAX_IMPORTED_IMAGE_PIXELS = 64 * 1024 * 1024;
export const MAX_IMPORTED_IMAGE_TOTAL_PIXELS = 256 * 1024 * 1024;

function hasImportedBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function hasImportedImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") {
    return bytes.length >= 8 && hasImportedBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mime === "image/jpeg") {
    return bytes.length >= 4
      && hasImportedBytes(bytes, 0, [0xff, 0xd8, 0xff])
      && hasImportedBytes(bytes, bytes.length - 2, [0xff, 0xd9]);
  }
  if (mime === "image/webp") {
    if (bytes.length < 20 || !hasImportedBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) || !hasImportedBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return false;
    const declaredSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const chunkType = String.fromCharCode(...bytes.slice(12, 16));
    return declaredSize === bytes.length - 8 && ["VP8 ", "VP8L", "VP8X"].includes(chunkType);
  }
  return false;
}

function validateImportedAssetData(value: unknown, declaredMime: string) {
  if (!IMPORTED_ASSET_MIMES.has(declaredMime)) {
    throw new Error("工程图片资产只支持 image/png、image/jpeg 或 image/webp");
  }
  if (typeof value !== "string") throw new Error("工程图片资产必须是本地 base64 data URL");
  const match = value.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error("工程图片资产必须是受支持的本地 base64 data URL");
  const [, embeddedMime, payload] = match;
  if (embeddedMime !== declaredMime) throw new Error("工程图片 data URL 的 MIME 与资产声明不一致");
  if (!payload || payload.length % 4 !== 0) throw new Error("工程图片 data URL 的 base64 数据无效");
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const estimatedBytes = payload.length / 4 * 3 - padding;
  if (estimatedBytes > MAX_IMPORTED_ASSET_BYTES) throw new Error("单张工程图片超过 50 MB 导入上限");
  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw new Error("工程图片 data URL 的 base64 数据无效");
  }
  if (btoa(binary) !== payload) throw new Error("工程图片 data URL 的 base64 数据不是规范编码");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (!hasImportedImageSignature(bytes, declaredMime)) {
    throw new Error("工程图片内容与声明的 MIME 不匹配或文件已损坏");
  }
  return bytes.byteLength;
}

function validateImportedTheme(theme: ThemeTokens) {
  const colorKeys = ["primary", "secondary", "accent", "text", "muted", "paper", "surface", "line", "positive", "negative"] as const;
  colorKeys.forEach((key) => {
    if (!/^#[0-9a-f]{6}$/i.test(theme[key] || "")) throw new Error(`工程主题颜色 ${key} 必须是 6 位十六进制色值`);
  });
  if (!Array.isArray(theme.chartPalette) || !theme.chartPalette.length || theme.chartPalette.some((color) => !/^#[0-9a-f]{6}$/i.test(color))) {
    throw new Error("工程主题色板必须是非空的 6 位十六进制色值数组");
  }
  const fonts = [theme.fontFamily, theme.fontSlots?.display, theme.fontSlots?.body, theme.fontSlots?.numeric];
  if (fonts.some((font) => typeof font !== "string" || /url\s*\(|https?:|javascript:|[<>]/i.test(font))) {
    throw new Error("工程主题字体包含不允许的 URL 或标记");
  }
}

type LegacyElement = Omit<ReportElement, "type"> & { type: string };

const legacyChartKinds: Record<string, ChartKind> = {
  "line-chart": "line",
  "bar-chart": "bar",
  "combo-chart": "combo",
  "donut-chart": "donut"
};

function withoutLegacyFields(element: LegacyElement): ReportElement {
  const next = element as unknown as ReportElement;
  delete next.value;
  delete next.unit;
  delete next.note;
  return next;
}

function expandLegacyElement(element: LegacyElement, reserveId: (candidate: string) => string): ReportElement[] {
  const type = element.type;
  if (["text", "box", "divider", "image", "chart"].includes(type)) {
    const atom = withoutLegacyFields({ ...element, type } as LegacyElement);
    if (atom.type === "text" && !atom.semanticRole && !atom.role) atom.semanticRole = "body";
    return [atom];
  }

  if (type === "title" || type === "source") {
    const atom = withoutLegacyFields({
      ...element,
      type: "text",
      semanticRole: type,
      style: {
        ...element.style,
        fontSlot: element.style?.fontSlot || (type === "title" ? "display" : "body"),
        color: element.style?.color || (type === "source" ? "muted" : "text")
      }
    } as LegacyElement);
    return [atom];
  }

  const groupId = element.groupId || `group-${element.id}`;
  const groupName = element.groupName || element.name;
  const group = (slot: string) => ({
    groupId,
    groupName,
    presetId: element.presetId || `legacy-${type}`,
    presetSlot: slot
  });
  const baseZ = Number(element.z) || 1;
  const padding = Math.max(2, Math.min(6, Number(element.style?.padding) || 4));
  const textContent = typeof element.content === "string" ? element.content : "";

  if (type === "kpi") {
    const innerWidth = Math.max(8, element.w - padding * 2);
    const valueWidth = Math.max(8, innerWidth * 0.72);
    const valueTop = element.y + padding + 6;
    const valueHeight = Math.max(8, element.h - padding * 2 - 12);
    const box: ReportElement = {
      id: reserveId(`${element.id}-box`), type: "box", name: `${groupName} 背景`,
      x: element.x, y: element.y, w: element.w, h: element.h, z: baseZ,
      ...group("background"),
      style: {
        background: element.style?.background || "white",
        borderColor: element.style?.borderColor || "line",
        borderWidth: element.style?.borderWidth ?? 0.3,
        radius: element.style?.radius ?? 1.5,
        opacity: element.style?.opacity ?? 1
      }
    };
    const label: ReportElement = {
      id: reserveId(`${element.id}-label`), type: "text", name: `${groupName} 标签`,
      x: element.x + padding, y: element.y + padding, w: innerWidth, h: 5, z: baseZ + 1,
      ...group("label"), semanticRole: "kpi-label", content: textContent, runs: [{ text: textContent }],
      style: { fontSize: 8, fontSlot: "body", color: "muted", background: "transparent", lineHeight: 1.2 }
    };
    const value = String(element.value ?? "128.6");
    const number: ReportElement = {
      id: element.id, type: "text", name: `${groupName} 数值`,
      x: element.x + padding, y: valueTop, w: valueWidth, h: valueHeight, z: baseZ + 2,
      ...group("value"), semanticRole: "kpi-value", content: value, runs: [{ text: value }],
      style: { fontSize: 28, fontSlot: "numeric", fontWeight: 700, color: "text", background: "transparent", lineHeight: 1.2 }
    };
    const unit = String(element.unit ?? "");
    const unitText: ReportElement = {
      id: reserveId(`${element.id}-unit`), type: "text", name: `${groupName} 单位`,
      x: element.x + padding + valueWidth, y: valueTop + Math.max(0, valueHeight - 6), w: Math.max(4, innerWidth - valueWidth), h: 6, z: baseZ + 3,
      ...group("unit"), semanticRole: "kpi-unit", content: unit, runs: [{ text: unit }],
      style: { fontSize: 8, fontSlot: "body", color: "muted", background: "transparent", lineHeight: 1.2 }
    };
    const note = String(element.note ?? "");
    const noteText: ReportElement = {
      id: reserveId(`${element.id}-note`), type: "text", name: `${groupName} 变化`,
      x: element.x + padding, y: element.y + element.h - padding - 5, w: innerWidth, h: 5, z: baseZ + 4,
      ...group("note"), semanticRole: "kpi-note", content: note, runs: [{ text: note }],
      style: { fontSize: 8, fontSlot: "body", fontWeight: 600, color: note.includes("-") ? "negative" : "positive", background: "transparent", lineHeight: 1.2 }
    };
    return [box, label, number, unitText, noteText];
  }

  if (type === "quote") {
    const bodyX = element.x + padding + 6;
    const bodyWidth = Math.max(8, element.w - padding * 2 - 6);
    const attribution = String(element.note ?? "");
    return [
      {
        id: reserveId(`${element.id}-box`), type: "box", name: `${groupName} 背景`,
        x: element.x, y: element.y, w: element.w, h: element.h, z: baseZ,
        ...group("background"),
        style: {
          background: element.style?.background || "secondary",
          borderColor: element.style?.borderColor || "transparent",
          borderWidth: element.style?.borderWidth || 0,
          radius: element.style?.radius ?? 1.5,
          opacity: element.style?.opacity ?? 1
        }
      },
      {
        id: reserveId(`${element.id}-mark`), type: "text", name: `${groupName} 引号`,
        x: element.x + padding, y: element.y + padding - 2, w: 8, h: 10, z: baseZ + 1,
        ...group("mark"), semanticRole: "quote-mark", content: "“", runs: [{ text: "“" }],
        style: { fontSize: 28, fontSlot: "display", color: "primary", background: "transparent", lineHeight: 1.2 }
      },
      {
        id: element.id, type: "text", name: `${groupName} 正文`,
        x: bodyX, y: element.y + padding, w: bodyWidth, h: Math.max(8, element.h - padding * 2 - 7), z: baseZ + 2,
        ...group("body"), semanticRole: "quote-body", content: textContent, runs: element.runs || [{ text: textContent }],
        style: { ...element.style, background: "transparent", borderWidth: 0, padding: 0, radius: 0 }
      },
      {
        id: reserveId(`${element.id}-attribution`), type: "text", name: `${groupName} 署名`,
        x: bodyX, y: element.y + element.h - padding - 5, w: bodyWidth, h: 5, z: baseZ + 3,
        ...group("attribution"), semanticRole: "quote-attribution", content: attribution, runs: [{ text: attribution }],
        style: { fontSize: 8, fontSlot: "body", color: "muted", background: "transparent", lineHeight: 1.2 }
      }
    ];
  }

  if (legacyChartKinds[type]) {
    const captionHeight = Math.min(7, Math.max(5, element.h * 0.12));
    const chart: ReportElement = withoutLegacyFields({
      ...element,
      type: "chart",
      name: element.name,
      y: element.y + captionHeight,
      h: Math.max(8, element.h - captionHeight),
      z: baseZ + 1,
      chartKind: legacyChartKinds[type],
      content: undefined,
      runs: undefined,
      ...group("chart")
    } as LegacyElement);
    const caption: ReportElement = {
      id: reserveId(`${element.id}-caption`), type: "text", name: `${groupName} 标题`,
      x: element.x, y: element.y, w: element.w, h: captionHeight, z: baseZ,
      ...group("caption"), semanticRole: "caption", content: textContent, runs: [{ text: textContent }],
      style: { fontSize: 10, fontSlot: "body", fontWeight: 650, color: "text", background: "transparent", lineHeight: 1.2 }
    };
    return [caption, chart];
  }

  if (type === "table") {
    const captionHeight = Math.min(7, Math.max(5, element.h * 0.12));
    const table = withoutLegacyFields({
      ...element,
      type: "table",
      y: element.y + captionHeight,
      h: Math.max(8, element.h - captionHeight),
      z: baseZ + 1,
      content: undefined,
      runs: undefined,
      ...group("table")
    } as LegacyElement);
    const caption: ReportElement = {
      id: reserveId(`${element.id}-caption`), type: "text", name: `${groupName} 标题`,
      x: element.x, y: element.y, w: element.w, h: captionHeight, z: baseZ,
      ...group("caption"), semanticRole: "caption", content: textContent, runs: [{ text: textContent }],
      style: { fontSize: 10, fontSlot: "body", fontWeight: 650, color: "text", background: "transparent", lineHeight: 1.2 }
    };
    return [caption, table];
  }
  throw new Error(`工程包含不支持的元素类型：${type}`);
}

export interface NormalizeProjectOptions {
  requireAssetData?: boolean;
}

export function normalizeProject(input: unknown, options: NormalizeProjectOptions = {}): NormalizedProject {
  if (!input || typeof input !== "object") throw new Error("工程文件不是有效对象");
  const source = structuredClone(input) as Partial<ReportDocument> & { assetData?: Record<string, string>; assets?: Array<ReportAsset & { data?: string }> };
  const sourceVersion = String(source.version);
  if (!Array.isArray(source.pages) || !["1.0", "1.1", "1.2", "1.3", "1.4", "1.5"].includes(sourceVersion)) {
    throw new Error("仅支持版本 1.0、1.1、1.2、1.3、1.4 或 1.5 的报告工程文件");
  }
  if (!source.theme || !source.pageSetup || !source.meta) {
    throw new Error("工程文件缺少主题、页面或报告信息");
  }
  source.theme.fontSlots ||= {
    display: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    body: source.theme.fontFamily || '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    numeric: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif'
  };
  validateImportedTheme(source.theme as ThemeTokens);
  const rawAssetData = source.assetData && typeof source.assetData === "object" && !Array.isArray(source.assetData)
    ? source.assetData
    : {};
  const assetData: Record<string, string> = {};
  const rawAssets = ((source as unknown as { assets?: Array<ReportAsset & { data?: string }> }).assets || []);
  if (rawAssets.length > MAX_IMPORTED_ASSET_COUNT) throw new Error(`工程图片资产超过 ${MAX_IMPORTED_ASSET_COUNT} 张导入上限`);
  const rawAssetIds = new Set<string>();
  let importedAssetBytes = 0;
  let importedDeclaredPixels = 0;
  const assets: ReportAsset[] = rawAssets.filter((asset) => asset && asset.id).map((asset) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(asset.id)) throw new Error(`工程图片资产 ID 无效：${asset.id}`);
    if (rawAssetIds.has(asset.id)) throw new Error(`工程包含重复的图片资产 ID：${asset.id}`);
    rawAssetIds.add(asset.id);
    const mime = String(asset.mime || "");
    if (!IMPORTED_ASSET_MIMES.has(mime)) throw new Error(`图片资产 ${asset.id} 的 MIME 不受支持`);
    const portableData = rawAssetData[asset.id];
    if (asset.data && portableData && asset.data !== portableData) throw new Error(`图片资产 ${asset.id} 存在冲突的数据副本`);
    const data = asset.data || portableData;
    if (options.requireAssetData && !data) throw new Error(`可移植工程缺少图片资产数据：${asset.id}`);
    const verifiedByteSize = data ? validateImportedAssetData(data, mime) : 0;
    if (data) {
      importedAssetBytes += verifiedByteSize;
      if (importedAssetBytes > MAX_IMPORTED_ASSET_TOTAL_BYTES) throw new Error("工程图片资产总量超过 50 MB 导入上限");
      assetData[asset.id] = data;
    }
    const { data: _data, ...metadata } = asset;
    const width = Math.max(1, Math.round(Number(metadata.width) || 1));
    const height = Math.max(1, Math.round(Number(metadata.height) || 1));
    const pixels = width * height;
    if (!Number.isSafeInteger(pixels) || pixels > MAX_IMPORTED_IMAGE_PIXELS) throw new Error(`工程图片 ${asset.id} 的像素尺寸超过单图上限`);
    importedDeclaredPixels += pixels;
    if (importedDeclaredPixels > MAX_IMPORTED_IMAGE_TOTAL_PIXELS) throw new Error("工程图片声明的总像素超过导入上限");
    return {
      ...metadata,
      kind: "image",
      mime,
      width,
      height,
      byteSize: verifiedByteSize || Number(metadata.byteSize) || 0
    } as ReportAsset;
  });
  const declaredAssetIds = new Set(assets.map((asset) => asset.id));
  const undeclaredAssetDataId = Object.keys(rawAssetData).find((id) => !declaredAssetIds.has(id));
  if (undeclaredAssetDataId) throw new Error(`工程包含未声明的图片数据：${undeclaredAssetDataId}`);
  const ids = new Set<string>();
  const reserveId = (candidate: string | undefined, prefix = "element") => {
    let next = candidate || uid(prefix);
    while (ids.has(next)) next = uid(prefix);
    ids.add(next);
    return next;
  };
  source.pages.forEach((page, pageIndex) => {
    page.id = reserveId(page.id, "page");
    if (!Array.isArray(page.elements)) page.elements = [];
    const previousMasterProps = page.masterProps || {};
    page.masterProps = {
      ...previousMasterProps,
      focal: { x: page.masterProps?.focal?.x ?? 50, y: page.masterProps?.focal?.y ?? 50 },
      overlay: page.masterProps?.overlay || "brand",
      overlayStrength: page.masterProps?.overlayStrength ?? 0.72,
      disclaimer: page.masterProps?.disclaimer || "本报告仅供内部讨论使用，不构成投资、审计或法律意见。",
      contact: page.masterProps?.contact || ""
    };
    page.masterProps.imageStyle = normalizeImageStyle(page.masterProps.imageStyle, {
      overlayKind: page.masterProps.overlay === "none" ? "none" : page.masterProps.overlay === "darken" ? "solid" : "linear",
      overlayColor: "primary",
      overlayColor2: page.masterProps.overlay === "brand" ? "transparent" : "primary",
      strength: page.masterProps.overlayStrength ?? 0.72
    });
    if (page.masterProps.crop) {
      const asset = assets.find((item) => item.id === page.masterProps?.imageAssetId);
      page.masterProps.crop = {
        sx: Math.max(0, Number(page.masterProps.crop.sx) || 0),
        sy: Math.max(0, Number(page.masterProps.crop.sy) || 0),
        sw: Math.max(1, Math.min(asset?.width || 1, Number(page.masterProps.crop.sw) || asset?.width || 1)),
        sh: Math.max(1, Math.min(asset?.height || 1, Number(page.masterProps.crop.sh) || asset?.height || 1))
      };
    }
    if (["1.0", "1.1", "1.2"].includes(sourceVersion) && !page.elements.some((element) => element.role)) {
      const decorations = createPageDecorations(
        page,
        source.meta as ReportDocument["meta"],
        pageIndex + 1,
        source.pages!.length,
        source.pageSetup!.footerMode
      );
      page.elements.forEach((element) => { element.z = (Number(element.z) || 0) + decorations.length; });
      page.elements.unshift(...decorations);
    }

    const rawElements = (page.elements as unknown as LegacyElement[])
      .slice()
      .sort((a, b) => (Number(a.z) || 0) - (Number(b.z) || 0));
    rawElements.forEach((element, index) => {
      element.id = reserveId(element.id, "element");
      element.z = Number.isFinite(element.z) ? Number(element.z) : index + 1;
      element.style = element.style || {};
    });
    const atomicElements = ["1.4", "1.5"].includes(sourceVersion)
      ? rawElements.map((element) => {
          if (!["text", "box", "divider", "image", "chart", "table"].includes(element.type)) {
            throw new Error(`${sourceVersion} 工程包含不支持的元素类型：${element.type}`);
          }
          return withoutLegacyFields(element);
        })
      : rawElements.flatMap((element) => expandLegacyElement(element, (candidate) => reserveId(candidate, "element")));

    page.elements = atomicElements
      .sort((a, b) => (Number(a.z) || 0) - (Number(b.z) || 0))
      .map((element, index) => ({ ...element, z: index + 1 }));
    page.elements.forEach((element) => {
      element.style.fontSize = nearestFontSize(element.style.fontSize);
      element.style.color = normalizeColor(element.style.color, "text");
      element.style.background = normalizeColor(element.style.background, "transparent");
      element.style.borderColor = normalizeColor(element.style.borderColor, "transparent");
      if (element.type === "text") normalizeRuns(element);
      else {
        delete element.runs;
        if (["box", "divider", "chart", "table"].includes(element.type)) delete element.content;
      }
      if (element.type === "chart") {
        element.chartKind = (["line", "bar", "combo", "donut"] as ChartKind[]).includes(element.chartKind as ChartKind)
          ? element.chartKind
          : "line";
        normalizeChartData(element.chart);
        element.chartLabels = normalizeChartLabels(element.chartLabels, element.style.showLabel);
      }
      if (element.image && !element.assetId) {
        const mime = element.image.match(/^data:([^;,]+)/)?.[1] || "";
        const byteSize = validateImportedAssetData(element.image, mime);
        importedAssetBytes += byteSize;
        if (importedAssetBytes > MAX_IMPORTED_ASSET_TOTAL_BYTES) throw new Error("工程图片资产总量超过 50 MB 导入上限");
        const assetId = uid("asset");
        assetData[assetId] = element.image;
        if (assets.length >= MAX_IMPORTED_ASSET_COUNT) throw new Error(`工程图片资产超过 ${MAX_IMPORTED_ASSET_COUNT} 张导入上限`);
        assets.push({ id: assetId, kind: "image", mime, width: 1, height: 1, byteSize });
        importedDeclaredPixels += 1;
        element.assetId = assetId;
        delete element.image;
      }
      if (element.type === "image") {
        const asset = assets.find((item) => item.id === element.assetId);
        element.crop = {
          sx: Math.max(0, Number(element.crop?.sx) || 0),
          sy: Math.max(0, Number(element.crop?.sy) || 0),
          sw: Math.max(1, Math.min(asset?.width || 1, Number(element.crop?.sw) || asset?.width || 1)),
          sh: Math.max(1, Math.min(asset?.height || 1, Number(element.crop?.sh) || asset?.height || 1))
        };
        element.imageStyle = normalizeImageStyle(element.imageStyle);
      }
    });
  });
  const document = source as ReportDocument;
  document.version = "1.5";
  document.pageSetup.printDpi = [96, 150, 300].includes(Number(document.pageSetup.printDpi)) ? document.pageSetup.printDpi : 300;
  document.assets = assets.filter((asset, index, list) => list.findIndex((item) => item.id === asset.id) === index);
  if (options.requireAssetData) {
    const missingAsset = document.assets.find((asset) => !assetData[asset.id]);
    if (missingAsset) throw new Error(`可移植工程缺少图片资产数据：${missingAsset.id}`);
  }
  document.usedFontSlots = Array.from(new Set(document.pages.flatMap((page) => page.elements.map((element) =>
    element.style.fontSlot || (element.semanticRole === "kpi-value" ? "numeric" : ["title", "quote-mark"].includes(element.semanticRole || "") ? "display" : "body")
  )))) as ReportDocument["usedFontSlots"];
  delete (document as ReportDocument & { assetData?: Record<string, string> }).assetData;
  return { document, assetData };
}

export function normalizeDocument(input: unknown): ReportDocument {
  return normalizeProject(input).document;
}

import type {
  ChartData,
  ChartKind,
  ChartLabelSettings,
  ElementStyle,
  ImageCrop,
  ImageStyle,
  MasterType,
  Orientation,
  ReportDocument,
  ReportElement,
  ReportAsset,
  ReportPage,
  SemanticRole,
  TableData,
  ThemeTokens
} from "./model";

export const REPORT_ENGINE_VERSION = "0.1" as const;

export type ReportValue = string | number | boolean | null | ReportValue[] | { [key: string]: ReportValue };
export type ReportData = Record<string, ReportValue>;

export interface EngineIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
  locator?: string;
}

export interface FieldDefinition {
  label: string;
  type: "text" | "number" | "boolean" | "string[]" | "number[]" | "table";
  required?: boolean;
  sensitive?: boolean;
  unit?: string;
  decimals?: number;
  allowNegative?: boolean;
  placeholder?: string;
  preview?: ReportValue;
}

export type Expression =
  | string
  | number
  | boolean
  | null
  | { ref: string }
  | { value: ReportValue }
  | { op: string; args: Expression[]; digits?: number; scale?: number };

export interface DerivedDefinition {
  expression: Expression;
  label?: string;
}

export interface RuleDefinition {
  id: string;
  severity: "error" | "warning";
  assert: Expression;
  message: string;
  locator?: string;
}

export interface BoundChartDefinition {
  categories: Expression;
  series: Array<{
    id?: string;
    name: string;
    values: Expression;
    kind?: "bar" | "line";
    axis?: "left" | "right";
    unit?: string;
  }>;
}

export interface BoundTableDefinition {
  headers: Expression;
  rows?: Expression;
  columns?: Array<{
    values: Expression;
    format?: "number" | "integer" | "accounting" | "percent";
    digits?: number;
    suffix?: string;
  }>;
}

export interface EngineElementDefinition {
  id: string;
  type: "text" | "box" | "divider" | "image" | "chart" | "table";
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z?: number;
  semanticRole?: SemanticRole;
  groupId?: string;
  groupName?: string;
  presetId?: string;
  presetSlot?: string;
  role?: ReportElement["role"];
  locked?: boolean;
  hidden?: boolean;
  content?: string;
  contentTemplate?: string;
  assetId?: string;
  crop?: ImageCrop;
  imageStyle?: ImageStyle;
  chartKind?: ChartKind;
  chart?: ChartData;
  chartBinding?: BoundChartDefinition;
  chartLabels?: ChartLabelSettings;
  table?: TableData;
  tableBinding?: BoundTableDefinition;
  style?: ElementStyle;
}

export interface EnginePageDefinition {
  id: string;
  name: string;
  section: string;
  master: MasterType;
  orientation: Orientation;
  masterProps?: ReportPage["masterProps"];
  elements: EngineElementDefinition[];
}

export interface DataMigrationDefinition {
  from: string;
  to: string;
  rename?: Record<string, string>;
  remove?: string[];
  defaults?: Record<string, ReportValue>;
}

export interface ReportPackageDefinition {
  engineVersion: typeof REPORT_ENGINE_VERSION;
  authoringMode?: "bound" | "independent";
  id: string;
  version: string;
  documentUpdatedAt: string;
  dataSchemaVersion?: string;
  name: string;
  description?: string;
  meta: {
    title: string;
    organization: string;
    period: string;
    author: string;
    confidentiality: string;
  };
  theme: ThemeTokens;
  pageSetup?: Partial<ReportDocument["pageSetup"]>;
  fields?: Record<string, FieldDefinition>;
  derived?: Record<string, DerivedDefinition>;
  rules?: RuleDefinition[];
  dataMigrations?: DataMigrationDefinition[];
  inputSections?: Array<{
    id: string;
    title: string;
    fields: string[];
  }>;
  assets?: ReportAsset[];
  assetData?: Record<string, string>;
  pages: EnginePageDefinition[];
}

export interface CompilationResult {
  document: ReportDocument;
  resolvedData: ReportData;
  issues: EngineIssue[];
}

const FORBIDDEN_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const ELEMENT_TYPES = new Set(["text", "box", "divider", "image", "chart", "table"]);
const COLOR_TOKENS = new Set(["primary", "secondary", "accent", "text", "muted", "paper", "surface", "line", "positive", "negative", "white", "transparent"]);
const FONT_SIZE_STEPS = new Set([8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48]);
const MASTER_TYPES = new Set(["cover", "section", "standard", "data", "blank", "backcover"]);
const OPERATIONS = new Set(["sum", "subtract", "multiply", "divide", "pctChange", "ppChange", "round", "abs", "negate", "coalesce", "last", "seriesSum", "arraySum", "seriesSubtract", "seriesDivide", "seriesShare", "array", "appendColumns", "eq", "approxEq", "gt", "gte", "lt", "lte", "and", "or", "not", "present"]);
const FORMATTERS = new Set(["number", "signed", "percent", "signedPercent", "pp", "integer"]);
const TABLE_FORMATS = new Set(["number", "integer", "accounting", "percent"]);
const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const SAFE_THEME = {
  id: "safe-theme",
  name: "Safe theme",
  primary: "#174f78",
  secondary: "#dce9f1",
  accent: "#c44838",
  text: "#20262b",
  muted: "#6a747b",
  paper: "#ffffff",
  surface: "#f2f5f6",
  line: "#d6dadd",
  positive: "#267052",
  negative: "#b43a42",
  chartPalette: ["#174f78", "#4f89aa", "#c44838"],
  fontFamily: "Arial, sans-serif",
  fontSlots: { display: "Arial, sans-serif", body: "Arial, sans-serif", numeric: "Arial, sans-serif" }
} as ThemeTokens;
const PAGE_SIZE: Record<Orientation, { width: number; height: number }> = {
  portrait: { width: 210, height: 297 },
  landscape: { width: 297, height: 210 }
};

function hasImageBytes(bytes: Uint8Array, offset: number, expected: number[]) {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function hasValidImageSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/png") return bytes.length >= 8 && hasImageBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (mime === "image/jpeg") {
    return bytes.length >= 4 && hasImageBytes(bytes, 0, [0xff, 0xd8, 0xff]) && hasImageBytes(bytes, bytes.length - 2, [0xff, 0xd9]);
  }
  if (mime === "image/webp") {
    if (bytes.length < 20 || !hasImageBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) || !hasImageBytes(bytes, 8, [0x57, 0x45, 0x42, 0x50])) return false;
    const declaredSize = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const chunkType = String.fromCharCode(...bytes.slice(12, 16));
    return declaredSize === bytes.length - 8 && ["VP8 ", "VP8L", "VP8X"].includes(chunkType);
  }
  return false;
}

function decodeStrictImageDataUrl(source: string, mime: string) {
  const match = source.match(/^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[1] !== mime) throw new Error("图片资产必须是 MIME 匹配的本地 base64 data URL");
  const payload = match[2];
  if (!payload || payload.length % 4 !== 0) throw new Error("图片资产 base64 数据无效");
  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw new Error("图片资产 base64 数据无效");
  }
  if (btoa(binary) !== payload) throw new Error("图片资产 base64 数据不是规范编码");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function splitPath(path: string) {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length || parts.some((part) => FORBIDDEN_PATH_SEGMENTS.has(part))) {
    throw new Error(`非法字段路径：${path}`);
  }
  return parts;
}

function safeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function validateAllowedKeys(value: unknown, allowed: ReadonlySet<string>, path: string, code = "unknown-property"): EngineIssue[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => !allowed.has(key)).map((key) => ({
    severity: "error" as const,
    code,
    path: `${path}.${key}`,
    message: `不允许的属性：${path}.${key}`
  }));
}

function isFiniteReportValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isFiniteReportValue);
  if (value && typeof value === "object") return Object.values(value).every(isFiniteReportValue);
  return false;
}

function validateExpression(expression: Expression, knownPaths: Set<string>, path: string): EngineIssue[] {
  if (expression === null || typeof expression === "string" || typeof expression === "boolean") return [];
  if (typeof expression === "number") return Number.isFinite(expression) ? [] : [{ severity: "error", code: "derived-expression-number", path, message: "表达式包含非有限数值" }];
  if (!expression || typeof expression !== "object" || Array.isArray(expression)) return [{ severity: "error", code: "derived-expression", path, message: "表达式结构无效" }];
  if ("ref" in expression) {
    const issues = validateAllowedKeys(expression, new Set(["ref"]), path);
    try {
      splitPath(expression.ref);
    } catch (error) {
      issues.push({ severity: "error", code: "expression-ref", path, message: error instanceof Error ? error.message : String(error) });
      return issues;
    }
    if (!knownPaths.has(expression.ref)) issues.push({ severity: "error", code: "expression-ref", path, message: `表达式引用了未声明字段：${expression.ref}` });
    return issues;
  }
  if ("value" in expression) {
    const issues = validateAllowedKeys(expression, new Set(["value"]), path);
    if (!isFiniteReportValue(expression.value)) issues.push({ severity: "error", code: "derived-expression-value", path, message: "表达式常量包含无效或非有限值" });
    return issues;
  }
  if (!("op" in expression) || !OPERATIONS.has(expression.op) || !Array.isArray(expression.args)) {
    return [{ severity: "error", code: "derived-expression", path, message: `不支持或无效的表达式操作：${"op" in expression ? expression.op : "(缺失)"}` }];
  }
  const issues = validateAllowedKeys(expression, new Set(["op", "args", "digits", "scale"]), path);
  const exactArgs: Partial<Record<string, number>> = {
    subtract: 2, divide: 2, pctChange: 2, ppChange: 2, round: 1, abs: 1, negate: 1,
    last: 1, arraySum: 1, seriesSubtract: 2, seriesDivide: 2, seriesShare: 1, appendColumns: 2,
    eq: 2, gt: 2, gte: 2, lt: 2, lte: 2, not: 1, present: 1
  };
  const expected = exactArgs[expression.op];
  if (expected !== undefined && expression.args.length !== expected) issues.push({ severity: "error", code: "derived-expression-args", path, message: `操作 ${expression.op} 必须包含 ${expected} 个参数` });
  if (expression.op === "approxEq" && ![2, 3].includes(expression.args.length)) issues.push({ severity: "error", code: "derived-expression-args", path, message: "操作 approxEq 必须包含 2 或 3 个参数" });
  if (["seriesSum", "coalesce", "and", "or"].includes(expression.op) && expression.args.length === 0) issues.push({ severity: "error", code: "derived-expression-args", path, message: `操作 ${expression.op} 至少需要 1 个参数` });
  if (expression.digits !== undefined && (expression.op !== "round" || !Number.isInteger(expression.digits) || expression.digits < 0 || expression.digits > 6)) {
    issues.push({ severity: "error", code: "derived-expression-digits", path, message: "digits 只允许用于 round，且必须是 0 到 6 的整数" });
  }
  if (expression.scale !== undefined && (!new Set(["divide", "seriesDivide", "seriesShare"]).has(expression.op) || !Number.isFinite(expression.scale) || expression.scale <= 0 || expression.scale > 1_000_000)) {
    issues.push({ severity: "error", code: "derived-expression-scale", path, message: "scale 只允许用于除法或占比操作，且必须是 0 到 1000000 之间的有限正数" });
  }
  issues.push(...expression.args.flatMap((item, index) => validateExpression(item, knownPaths, `${path}.args.${index}`)));
  return issues;
}

function validateBindingTemplate(template: unknown, knownPaths: Set<string>, path: string): EngineIssue[] {
  if (typeof template !== "string") return [{ severity: "error", code: "text-binding", path, message: "绑定模板必须是字符串" }];
  const issues: EngineIssue[] = [];
  const tokenPattern = /\{\{\s*([a-zA-Z0-9_.-]+)(?:\|([a-zA-Z]+(?::\d+)?))?\s*\}\}/g;
  const stripped = template.replace(tokenPattern, (_match, fieldPath: string, format?: string) => {
    try {
      splitPath(fieldPath);
      if (!knownPaths.has(fieldPath)) issues.push({ severity: "error", code: "text-binding-ref", path, message: `绑定模板引用了未声明字段：${fieldPath}` });
    } catch (error) {
      issues.push({ severity: "error", code: "text-binding-ref", path, message: error instanceof Error ? error.message : String(error) });
    }
    if (format) {
      const [kind, digits] = format.split(":");
      if (!FORMATTERS.has(kind) || (digits !== undefined && (!/^\d+$/.test(digits) || Number(digits) > 6))) {
        issues.push({ severity: "error", code: "text-binding-format", path, message: `绑定模板使用了无效格式化器：${format}` });
      }
    }
    return "";
  });
  if (/\{\{|\}\}/.test(stripped)) issues.push({ severity: "error", code: "text-binding-syntax", path, message: "绑定模板包含无法解析的占位符" });
  return issues;
}

function validateTheme(theme: ThemeTokens | undefined): EngineIssue[] {
  if (!theme || typeof theme !== "object") return [{ severity: "error", code: "theme", message: "报告包缺少主题" }];
  const issues: EngineIssue[] = validateAllowedKeys(theme, new Set([
    "id", "name", "primary", "secondary", "accent", "text", "muted", "paper", "surface", "line", "positive", "negative", "chartPalette", "fontFamily", "fontSlots"
  ]), "theme", "theme-property");
  issues.push(...validateAllowedKeys(theme.fontSlots, new Set(["display", "body", "numeric"]), "theme.fontSlots", "theme-font-property"));
  const colorKeys = ["primary", "secondary", "accent", "text", "muted", "paper", "surface", "line", "positive", "negative"] as const;
  colorKeys.forEach((key) => {
    if (!/^#[0-9a-f]{6}$/i.test(theme[key] || "")) issues.push({ severity: "error", code: "theme-color", path: `theme.${key}`, message: `主题颜色 ${key} 必须是 6 位十六进制色值` });
  });
  if (!Array.isArray(theme.chartPalette) || !theme.chartPalette.length || theme.chartPalette.some((color) => !/^#[0-9a-f]{6}$/i.test(color))) {
    issues.push({ severity: "error", code: "theme-palette", path: "theme.chartPalette", message: "图表色板必须是非空的十六进制色值数组" });
  }
  const fonts = [theme.fontFamily, theme.fontSlots?.display, theme.fontSlots?.body, theme.fontSlots?.numeric];
  if (fonts.some((font) => typeof font !== "string" || /url\s*\(|https?:|javascript:|[<>]/i.test(font))) {
    issues.push({ severity: "error", code: "theme-font", path: "theme.fontSlots", message: "主题字体包含不允许的 URL 或标记" });
  }
  return issues;
}

function emptyDocument(reportPackage: Partial<ReportPackageDefinition>): ReportDocument {
  return {
    version: "1.5",
    meta: {
      title: safeText(reportPackage.meta?.title, "Invalid report package"),
      organization: safeText(reportPackage.meta?.organization),
      period: safeText(reportPackage.meta?.period),
      author: safeText(reportPackage.meta?.author),
      confidentiality: safeText(reportPackage.meta?.confidentiality)
    },
    theme: cloneValue(SAFE_THEME),
    pageSetup: { grid: 5, margin: 18, snap: true, showGrid: false, footerMode: "all", printDpi: 300 },
    usedFontSlots: ["display", "body", "numeric"],
    assets: [],
    pages: [],
    updatedAt: typeof reportPackage.documentUpdatedAt === "string" ? reportPackage.documentUpdatedAt : "1970-01-01T00:00:00.000Z"
  };
}

export function getPathValue(source: unknown, path: string): unknown {
  return splitPath(path).reduce<unknown>((value, key) => {
    if (value === null || value === undefined || typeof value !== "object") return undefined;
    return Object.prototype.hasOwnProperty.call(value, key)
      ? (value as Record<string, unknown>)[key]
      : undefined;
  }, source);
}

export function setPathValue(source: ReportData, path: string, value: ReportValue) {
  const parts = splitPath(path);
  const last = parts.pop()!;
  let cursor: Record<string, ReportValue> = source;
  parts.forEach((part) => {
    const current = cursor[part];
    if (!current || Array.isArray(current) || typeof current !== "object") cursor[part] = {};
    cursor = cursor[part] as Record<string, ReportValue>;
  });
  cursor[last] = value;
  return source;
}

const finiteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const numericArray = (value: unknown): value is number[] => Array.isArray(value) && value.every(finiteNumber);

function validateDirectChart(chart: unknown, path: string, locator?: string): EngineIssue[] {
  if (!chart || typeof chart !== "object" || Array.isArray(chart)) return [{ severity: "error", code: "chart-schema", path, locator, message: "图表数据必须是对象" }];
  const candidate = chart as Partial<ChartData>;
  const issues = validateAllowedKeys(candidate, new Set(["categories", "categoryIds", "series"]), path, "chart-property");
  if (!Array.isArray(candidate.categories) || !candidate.categories.every((item) => typeof item === "string")) {
    issues.push({ severity: "error", code: "chart-categories", path, locator, message: "图表类目必须是字符串数组" });
  }
  if (candidate.categoryIds !== undefined && (!Array.isArray(candidate.categoryIds) || candidate.categoryIds.length !== candidate.categories?.length || candidate.categoryIds.some((item) => typeof item !== "string" || !item))) {
    issues.push({ severity: "error", code: "chart-category-ids", path, locator, message: "图表稳定类目 ID 必须与类目等长且非空" });
  }
  if (!Array.isArray(candidate.series) || !candidate.series.length) {
    issues.push({ severity: "error", code: "chart-series", path, locator, message: "图表至少需要一个有效序列" });
    return issues;
  }
  candidate.series.forEach((series, index) => {
    const seriesPath = `${path}.series.${index}`;
    issues.push(...validateAllowedKeys(series, new Set(["id", "name", "values", "kind", "axis", "unit"]), seriesPath, "chart-series-property"));
    if (!series || typeof series !== "object" || typeof series.name !== "string" || !numericArray(series.values)) {
      issues.push({ severity: "error", code: "chart-series", path: seriesPath, locator, message: `图表第 ${index + 1} 个序列结构无效` });
      return;
    }
    if (Array.isArray(candidate.categories) && series.values.length !== candidate.categories.length) issues.push({ severity: "error", code: "chart-length", path: seriesPath, locator, message: `图表第 ${index + 1} 个序列长度与类目不一致` });
    if (series.kind !== undefined && !["bar", "line"].includes(series.kind)) issues.push({ severity: "error", code: "chart-series-kind", path: seriesPath, locator, message: "图表序列 kind 无效" });
    if (series.axis !== undefined && !["left", "right"].includes(series.axis)) issues.push({ severity: "error", code: "chart-series-axis", path: seriesPath, locator, message: "图表序列 axis 无效" });
    if (series.unit !== undefined && typeof series.unit !== "string") issues.push({ severity: "error", code: "chart-series-unit", path: seriesPath, locator, message: "图表序列 unit 必须是字符串" });
    if (series.id !== undefined && (typeof series.id !== "string" || !series.id)) issues.push({ severity: "error", code: "chart-series-id", path: seriesPath, locator, message: "图表序列稳定 ID 必须是非空字符串" });
  });
  return issues;
}

function stableChartKey(value: string, fallback: string) {
  const normalized = value.normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function withStableChartIds(chart: ChartData): ChartData {
  const next = cloneValue(chart);
  const categoryCounts = new Map<string, number>();
  if (!Array.isArray(next.categoryIds) || next.categoryIds.length !== next.categories.length) {
    next.categoryIds = next.categories.map((category, index) => {
      const base = stableChartKey(category, `point-${index + 1}`);
      const occurrence = (categoryCounts.get(base) || 0) + 1;
      categoryCounts.set(base, occurrence);
      return occurrence === 1 ? base : `${base}-${occurrence}`;
    });
  }
  const seriesCounts = new Map<string, number>();
  next.series.forEach((series, index) => {
    if (series.id) return;
    const base = stableChartKey(series.name, `series-${index + 1}`);
    const occurrence = (seriesCounts.get(base) || 0) + 1;
    seriesCounts.set(base, occurrence);
    series.id = occurrence === 1 ? base : `${base}-${occurrence}`;
  });
  return next;
}

function validateImageStyle(value: unknown, path: string, locator?: string): EngineIssue[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [{ severity: "error", code: "image-style", path, locator, message: "图片样式必须是对象" }];
  const style = value as Partial<ImageStyle>;
  const issues = validateAllowedKeys(style, new Set(["overlayKind", "overlayColor", "overlayColor2", "overlayAngle", "blendMode", "strength", "grade", "vignette"]), path, "image-style-property");
  if (style.overlayKind !== undefined && !["none", "solid", "linear", "duotone"].includes(style.overlayKind)) issues.push({ severity: "error", code: "image-overlay-kind", path, locator, message: "图片叠色类型无效" });
  for (const key of ["overlayColor", "overlayColor2"] as const) if (style[key] !== undefined && !COLOR_TOKENS.has(String(style[key]))) issues.push({ severity: "error", code: "image-overlay-color", path, locator, message: "图片叠色使用了非法颜色 token" });
  if (style.overlayAngle !== undefined && ![0, 45, 90, 135].includes(style.overlayAngle)) issues.push({ severity: "error", code: "image-overlay-angle", path, locator, message: "图片叠色角度无效" });
  if (style.blendMode !== undefined && !["multiply", "overlay", "soft-light"].includes(style.blendMode)) issues.push({ severity: "error", code: "image-blend", path, locator, message: "图片混合模式无效" });
  if (style.strength !== undefined && (!finiteNumber(style.strength) || style.strength < 0 || style.strength > 1)) issues.push({ severity: "error", code: "image-strength", path, locator, message: "图片蒙版强度必须在 0 到 1 之间" });
  if (style.grade !== undefined && !["none", "deep-sea", "film", "black-gold", "documentary-fade"].includes(style.grade)) issues.push({ severity: "error", code: "image-grade", path, locator, message: "图片调色预设无效" });
  if (style.vignette !== undefined && !["none", "light", "heavy"].includes(style.vignette)) issues.push({ severity: "error", code: "image-vignette", path, locator, message: "图片暗角预设无效" });
  return issues;
}

function validateCrop(value: unknown, path: string, locator?: string): EngineIssue[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [{ severity: "error", code: "image-crop", path, locator, message: "图片裁切必须是对象" }];
  const crop = value as Record<string, unknown>;
  const issues = validateAllowedKeys(crop, new Set(["sx", "sy", "sw", "sh"]), path, "image-crop-property");
  if (![crop.sx, crop.sy, crop.sw, crop.sh].every(finiteNumber) || Number(crop.sx) < 0 || Number(crop.sy) < 0 || Number(crop.sw) <= 0 || Number(crop.sh) <= 0) issues.push({ severity: "error", code: "image-crop", path, locator, message: "图片裁切几何值无效" });
  return issues;
}

function validateChartLabels(value: unknown, path: string, locator?: string): EngineIssue[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [{ severity: "error", code: "chart-labels", path, locator, message: "图表标签设置必须是对象" }];
  const settings = value as Record<string, unknown>;
  const issues = validateAllowedKeys(settings, new Set(["mode", "sparseEvery", "offsets"]), path, "chart-label-property");
  if (!["auto", "all", "sparse", "key", "off"].includes(String(settings.mode))) issues.push({ severity: "error", code: "chart-label-mode", path, locator, message: "图表标签疏密模式无效" });
  if (!Number.isInteger(settings.sparseEvery) || Number(settings.sparseEvery) < 2 || Number(settings.sparseEvery) > 12) issues.push({ severity: "error", code: "chart-label-sparse", path, locator, message: "稀疏标签步长必须为 2 到 12 的整数" });
  if (settings.offsets !== undefined) {
    if (!settings.offsets || typeof settings.offsets !== "object" || Array.isArray(settings.offsets)) issues.push({ severity: "error", code: "chart-label-offsets", path, locator, message: "图表标签偏移必须是按方向分组的对象" });
    else Object.entries(settings.offsets as Record<string, unknown>).forEach(([orientation, entries]) => {
      if (!["portrait", "landscape"].includes(orientation) || !entries || typeof entries !== "object" || Array.isArray(entries)) {
        issues.push({ severity: "error", code: "chart-label-orientation", path, locator, message: "图表标签偏移方向无效" });
        return;
      }
      Object.entries(entries as Record<string, unknown>).forEach(([key, offset]) => {
        if (!key || !offset || typeof offset !== "object" || Array.isArray(offset)) {
          issues.push({ severity: "error", code: "chart-label-offset", path, locator, message: "单个图表标签偏移无效" });
          return;
        }
        const candidate = offset as Record<string, unknown>;
        issues.push(...validateAllowedKeys(candidate, new Set(["dx", "dy", "hidden"]), `${path}.offsets.${orientation}.${key}`, "chart-label-offset-property"));
        if (![candidate.dx, candidate.dy].every(finiteNumber) || Math.abs(Number(candidate.dx)) > 100 || Math.abs(Number(candidate.dy)) > 100 || (candidate.hidden !== undefined && typeof candidate.hidden !== "boolean")) issues.push({ severity: "error", code: "chart-label-offset", path, locator, message: "图表标签毫米偏移或显隐值无效" });
      });
    });
  }
  return issues;
}

function validateDirectTable(table: unknown, path: string, locator?: string): EngineIssue[] {
  if (!table || typeof table !== "object" || Array.isArray(table)) return [{ severity: "error", code: "table-schema", path, locator, message: "表格数据必须是对象" }];
  const candidate = table as Partial<TableData>;
  const issues = validateAllowedKeys(candidate, new Set(["headers", "rows"]), path, "table-property");
  if (!Array.isArray(candidate.headers) || !candidate.headers.length || !candidate.headers.every((item) => typeof item === "string")) {
    issues.push({ severity: "error", code: "table-headers", path, locator, message: "表格表头必须是非空字符串数组" });
  }
  if (!Array.isArray(candidate.rows) || !candidate.rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "string"))) {
    issues.push({ severity: "error", code: "table-rows", path, locator, message: "表格行必须是字符串二维数组" });
  } else if (Array.isArray(candidate.headers) && candidate.rows.some((row) => row.length !== candidate.headers!.length)) {
    issues.push({ severity: "error", code: "table-length", path, locator, message: "表格行列数与表头不一致" });
  }
  return issues;
}

function cloneValue<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value)) as T;
    } catch {
      return value;
    }
  }
}

function evaluateOperation(operation: string, args: unknown[], expression: Extract<Expression, { op: string }>): unknown {
  const numbers = () => args.every(finiteNumber) ? args as number[] : null;
  switch (operation) {
    case "sum": {
      const values = numbers();
      return values ? values.reduce((sum, value) => sum + value, 0) : null;
    }
    case "subtract":
      return args.length === 2 && finiteNumber(args[0]) && finiteNumber(args[1]) ? args[0] - args[1] : null;
    case "multiply": {
      const values = numbers();
      return values ? values.reduce((product, value) => product * value, 1) : null;
    }
    case "divide":
      return args.length === 2 && finiteNumber(args[0]) && finiteNumber(args[1]) && args[1] !== 0
        ? (args[0] / args[1]) * (expression.scale ?? 1)
        : null;
    case "pctChange":
      return args.length === 2 && finiteNumber(args[0]) && finiteNumber(args[1]) && args[1] > 0
        ? ((args[0] - args[1]) / Math.abs(args[1])) * 100
        : null;
    case "ppChange":
      return args.length === 2 && finiteNumber(args[0]) && finiteNumber(args[1]) ? args[0] - args[1] : null;
    case "round":
      return args.length === 1 && finiteNumber(args[0])
        ? Math.round(args[0] * 10 ** (expression.digits ?? 0)) / 10 ** (expression.digits ?? 0)
        : null;
    case "abs":
      return args.length === 1 && finiteNumber(args[0]) ? Math.abs(args[0]) : null;
    case "negate":
      return args.length === 1 && finiteNumber(args[0]) ? -args[0] : null;
    case "coalesce":
      return args.find((value) => value !== null && value !== undefined) ?? null;
    case "last":
      return args.length === 1 && Array.isArray(args[0]) && args[0].length ? args[0][args[0].length - 1] : null;
    case "seriesSum": {
      if (!args.length || !args.every(numericArray)) return null;
      const length = (args[0] as number[]).length;
      if (!(args as number[][]).every((series) => series.length === length)) return null;
      return Array.from({ length }, (_, index) => (args as number[][]).reduce((sum, series) => sum + series[index], 0));
    }
    case "arraySum":
      return args.length === 1 && numericArray(args[0]) ? args[0].reduce((sum, value) => sum + value, 0) : null;
    case "seriesSubtract": {
      const left = args[0];
      const right = args[1];
      if (args.length !== 2 || !numericArray(left) || !numericArray(right) || left.length !== right.length) return null;
      return left.map((value, index) => value - right[index]);
    }
    case "seriesDivide": {
      const numerator = args[0];
      const denominator = args[1];
      if (args.length !== 2 || !numericArray(numerator) || !numericArray(denominator) || numerator.length !== denominator.length) return null;
      return numerator.map((value, index) => denominator[index] === 0 ? null : (value / denominator[index]) * (expression.scale ?? 1));
    }
    case "seriesShare": {
      if (args.length !== 1 || !numericArray(args[0])) return null;
      const total = args[0].reduce((sum, value) => sum + value, 0);
      return total === 0 ? null : args[0].map((value) => (value / total) * (expression.scale ?? 100));
    }
    case "array":
      return args;
    case "appendColumns": {
      const rows = args[0];
      const values = args[1];
      if (args.length !== 2 || !Array.isArray(rows) || !Array.isArray(values) || rows.length !== values.length || !rows.every((row) => Array.isArray(row))) return null;
      return rows.map((row, index) => [...row, values[index]]);
    }
    case "eq":
      return args.length === 2 && args[0] === args[1];
    case "approxEq":
      return args.length >= 2 && finiteNumber(args[0]) && finiteNumber(args[1]) && Math.abs(args[0] - args[1]) <= (finiteNumber(args[2]) ? args[2] : 0.000001);
    case "gt":
      return args.length === 2 && finiteNumber(args[0]) && finiteNumber(args[1]) && args[0] > args[1];
    case "gte":
      return args.length === 2 && finiteNumber(args[0]) && finiteNumber(args[1]) && args[0] >= args[1];
    case "lt":
      return args.length === 2 && finiteNumber(args[0]) && finiteNumber(args[1]) && args[0] < args[1];
    case "lte":
      return args.length === 2 && finiteNumber(args[0]) && finiteNumber(args[1]) && args[0] <= args[1];
    case "and":
      return args.every((value) => value === true);
    case "or":
      return args.some((value) => value === true);
    case "not":
      return args.length === 1 ? args[0] !== true : false;
    case "present":
      return args.length === 1 && args[0] !== null && args[0] !== undefined && args[0] !== "";
    default:
      throw new Error(`不支持的表达式操作：${operation}`);
  }
}

function createResolver(reportPackage: ReportPackageDefinition, data: ReportData, issues: EngineIssue[]) {
  const cache = new Map<string, unknown>();
  const resolving = new Set<string>();

  const resolve = (path: string): unknown => {
    if (cache.has(path)) return cache.get(path);
    const derived = reportPackage.derived?.[path];
    if (!derived) return getPathValue(data, path);
    if (resolving.has(path)) {
      issues.push({ severity: "error", code: "derived-cycle", path, message: `派生字段存在循环依赖：${path}` });
      return null;
    }
    resolving.add(path);
    let value: unknown = null;
    try {
      value = evaluateExpression(derived.expression, resolve);
      if (!isFiniteReportValue(value)) {
        issues.push({ severity: "error", code: "derived-result", path, message: `派生字段产生了无效或非有限值：${path}` });
        value = null;
      }
    } catch (error) {
      issues.push({ severity: "error", code: "derived-expression", path, message: error instanceof Error ? error.message : String(error) });
    } finally {
      resolving.delete(path);
    }
    cache.set(path, value);
    return value;
  };
  return { resolve, cache };
}

export function evaluateExpression(expression: Expression, resolve: (path: string) => unknown): unknown {
  if (expression === null || typeof expression === "string" || typeof expression === "number" || typeof expression === "boolean") return expression;
  if ("ref" in expression) return resolve(expression.ref);
  if ("value" in expression) return cloneValue(expression.value);
  return evaluateOperation(expression.op, expression.args.map((item) => evaluateExpression(item, resolve)), expression);
}

function validateFieldValue(path: string, definition: FieldDefinition, value: unknown): EngineIssue[] {
  const issues: EngineIssue[] = [];
  const missing = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  if (missing) {
    if (definition.required) issues.push({ severity: "error", code: "required", path, message: `必填字段「${definition.label}」缺失` });
    return issues;
  }
  const valid = definition.type === "text" ? typeof value === "string"
    : definition.type === "number" ? finiteNumber(value)
      : definition.type === "boolean" ? typeof value === "boolean"
        : definition.type === "string[]" ? Array.isArray(value) && value.every((item) => typeof item === "string")
          : definition.type === "number[]" ? numericArray(value)
            : definition.type === "table" ? Array.isArray(value) && value.every((row) => Array.isArray(row))
              : false;
  if (!valid) issues.push({ severity: "error", code: "type", path, message: `字段「${definition.label}」类型应为 ${definition.type}` });
  if (definition.type === "number" && finiteNumber(value) && definition.allowNegative === false && value < 0) {
    issues.push({ severity: "error", code: "negative", path, message: `字段「${definition.label}」不允许负数` });
  }
  if (definition.type === "number[]" && numericArray(value) && definition.allowNegative === false && value.some((item) => item < 0)) {
    issues.push({ severity: "error", code: "negative", path, message: `字段「${definition.label}」不允许负数` });
  }
  return issues;
}

export function validateReportPackage(reportPackage: ReportPackageDefinition): EngineIssue[] {
  const issues: EngineIssue[] = [];
  if (!reportPackage || typeof reportPackage !== "object") return [{ severity: "error", code: "package", message: "报告包不是对象" }];
  issues.push(...validateAllowedKeys(reportPackage, new Set([
    "engineVersion", "authoringMode", "id", "version", "documentUpdatedAt", "dataSchemaVersion", "name", "description", "meta", "theme", "pageSetup",
    "fields", "derived", "rules", "dataMigrations", "inputSections", "assets", "assetData", "pages"
  ]), "reportPackage", "package-property"));
  if (reportPackage.engineVersion !== REPORT_ENGINE_VERSION) issues.push({ severity: "error", code: "engine-version", message: `报告包引擎版本应为 ${REPORT_ENGINE_VERSION}` });
  const authoringMode = reportPackage.authoringMode || "bound";
  if (!["bound", "independent"].includes(authoringMode)) issues.push({ severity: "error", code: "authoring-mode", path: "authoringMode", message: "报告包 authoringMode 只允许 bound 或 independent" });
  if (!/^[a-z0-9][a-z0-9-]*$/.test(reportPackage.id || "")) issues.push({ severity: "error", code: "package-id", message: "报告包 id 只能使用小写字母、数字和连字符" });
  if (!/^\d+\.\d+\.\d+$/.test(reportPackage.version || "")) issues.push({ severity: "error", code: "package-version", message: "报告包 version 应使用 x.y.z 格式" });
  if (typeof reportPackage.documentUpdatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(reportPackage.documentUpdatedAt) || !Number.isFinite(Date.parse(reportPackage.documentUpdatedAt))) {
    issues.push({ severity: "error", code: "document-updated-at", path: "documentUpdatedAt", message: "报告包 documentUpdatedAt 必须是 UTC ISO 时间" });
  }
  if (authoringMode === "bound" && (typeof reportPackage.dataSchemaVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(reportPackage.dataSchemaVersion))) issues.push({ severity: "error", code: "data-schema-version", path: "dataSchemaVersion", message: "绑定模式报告包 dataSchemaVersion 应使用 x.y.z 格式" });
  if (authoringMode === "independent" && Object.hasOwn(reportPackage, "dataSchemaVersion")) issues.push({ severity: "error", code: "independent-data-schema", path: "dataSchemaVersion", message: "独立模式不使用集中数据版本" });
  issues.push(...validateTheme(reportPackage.theme));
  if (reportPackage.pageSetup !== undefined) {
    issues.push(...validateAllowedKeys(reportPackage.pageSetup, new Set(["grid", "margin", "snap", "showGrid", "footerMode", "printDpi"]), "pageSetup", "page-setup-property"));
    const setup = reportPackage.pageSetup;
    if (setup.grid !== undefined && (!finiteNumber(setup.grid) || setup.grid <= 0)) issues.push({ severity: "error", code: "page-setup-grid", path: "pageSetup.grid", message: "pageSetup.grid 必须是有限正数" });
    if (setup.margin !== undefined && (!finiteNumber(setup.margin) || setup.margin < 0)) issues.push({ severity: "error", code: "page-setup-margin", path: "pageSetup.margin", message: "pageSetup.margin 必须是有限非负数" });
    if (setup.snap !== undefined && typeof setup.snap !== "boolean") issues.push({ severity: "error", code: "page-setup-snap", path: "pageSetup.snap", message: "pageSetup.snap 必须是布尔值" });
    if (setup.showGrid !== undefined && typeof setup.showGrid !== "boolean") issues.push({ severity: "error", code: "page-setup-show-grid", path: "pageSetup.showGrid", message: "pageSetup.showGrid 必须是布尔值" });
    if (setup.footerMode !== undefined && !["all", "confidentiality-last"].includes(setup.footerMode)) issues.push({ severity: "error", code: "page-setup-footer", path: "pageSetup.footerMode", message: "pageSetup.footerMode 无效" });
    if (setup.printDpi !== undefined && ![96, 150, 300].includes(setup.printDpi)) issues.push({ severity: "error", code: "page-setup-dpi", path: "pageSetup.printDpi", message: "pageSetup.printDpi 只允许 96、150 或 300" });
  }
  const fields = reportPackage.fields && typeof reportPackage.fields === "object" && !Array.isArray(reportPackage.fields) ? reportPackage.fields : {};
  const derived = reportPackage.derived && typeof reportPackage.derived === "object" && !Array.isArray(reportPackage.derived) ? reportPackage.derived : {};
  if (authoringMode === "bound" && !Object.keys(fields).length) issues.push({ severity: "error", code: "fields", message: "绑定模式报告包缺少字段定义" });
  if (authoringMode === "independent" && Object.hasOwn(reportPackage, "fields")) issues.push({ severity: "error", code: "independent-fields", path: "fields", message: "独立模式不允许集中字段；数据必须直接保存在各图表或表格中" });
  if (authoringMode === "independent" && reportPackage.derived !== undefined) issues.push({ severity: "error", code: "independent-derived", path: "derived", message: "独立模式不允许派生公式或跨组件关系" });
  if (authoringMode === "independent" && reportPackage.rules !== undefined) issues.push({ severity: "error", code: "independent-rules", path: "rules", message: "独立模式不允许勾稽规则" });
  if (authoringMode === "independent" && reportPackage.inputSections !== undefined) issues.push({ severity: "error", code: "independent-input-sections", path: "inputSections", message: "独立模式不允许集中录入分区" });
  if (authoringMode === "independent" && reportPackage.dataMigrations !== undefined) issues.push({ severity: "error", code: "independent-data-migrations", path: "dataMigrations", message: "独立模式不使用集中数据迁移" });
  const knownPaths = new Set([...Object.keys(fields), ...Object.keys(derived)]);
  Object.entries(fields).forEach(([path, definition]) => {
    try {
      splitPath(path);
    } catch (error) {
      issues.push({ severity: "error", code: "field-path", path, message: error instanceof Error ? error.message : String(error) });
    }
    if (!definition || typeof definition !== "object" || !definition.label || !["text", "number", "boolean", "string[]", "number[]", "table"].includes(definition.type)) {
      issues.push({ severity: "error", code: "field-definition", path, message: `字段定义无效：${path}` });
    } else {
      issues.push(...validateAllowedKeys(definition, new Set(["label", "type", "required", "sensitive", "unit", "decimals", "allowNegative", "placeholder", "preview"]), `fields.${path}`, "field-property"));
      if (definition.preview !== undefined && !isFiniteReportValue(definition.preview)) issues.push({ severity: "error", code: "field-preview", path, message: `字段「${definition.label}」的 preview 含无效或非有限值` });
    }
  });
  Object.keys(derived).forEach((path) => {
    try {
      splitPath(path);
    } catch (error) {
      issues.push({ severity: "error", code: "derived-path", path, message: error instanceof Error ? error.message : String(error) });
    }
    if (fields[path]) issues.push({ severity: "error", code: "derived-field-collision", path, message: `字段不能同时声明为输入和派生值：${path}` });
    const definition = derived[path];
    if (definition) {
      issues.push(...validateAllowedKeys(definition, new Set(["expression", "label"]), `derived.${path}`, "derived-property"));
      issues.push(...validateExpression(definition.expression, knownPaths, `derived.${path}`));
    }
  });
  if (reportPackage.dataMigrations !== undefined && !Array.isArray(reportPackage.dataMigrations)) issues.push({ severity: "error", code: "data-migrations", message: "dataMigrations 必须是数组" });
  const migrations = Array.isArray(reportPackage.dataMigrations) ? reportPackage.dataMigrations : [];
  migrations.forEach((migration, index) => {
    const path = `dataMigrations.${index}`;
    if (!migration || typeof migration !== "object") {
      issues.push({ severity: "error", code: "data-migration", path, message: "数据迁移定义无效" });
      return;
    }
    issues.push(...validateAllowedKeys(migration, new Set(["from", "to", "rename", "remove", "defaults"]), path, "data-migration-property"));
    if (!/^\d+\.\d+\.\d+$/.test(migration.from || "") || !/^\d+\.\d+\.\d+$/.test(migration.to || "") || migration.from === migration.to) issues.push({ severity: "error", code: "data-migration-version", path, message: "迁移 from/to 必须是不同的 x.y.z 版本" });
    Object.entries(migration.rename || {}).forEach(([from, to]) => {
      try { splitPath(from); splitPath(to); } catch (error) { issues.push({ severity: "error", code: "data-migration-path", path, message: error instanceof Error ? error.message : String(error) }); }
    });
    (migration.remove || []).forEach((removePath) => { try { splitPath(removePath); } catch (error) { issues.push({ severity: "error", code: "data-migration-path", path, message: error instanceof Error ? error.message : String(error) }); } });
    Object.entries(migration.defaults || {}).forEach(([defaultPath, value]) => {
      try { splitPath(defaultPath); } catch (error) { issues.push({ severity: "error", code: "data-migration-path", path, message: error instanceof Error ? error.message : String(error) }); }
      if (!isFiniteReportValue(value)) issues.push({ severity: "error", code: "data-migration-value", path, message: "迁移默认值包含无效或非有限值" });
    });
  });
  if (!reportPackage.meta || typeof reportPackage.meta !== "object") {
    issues.push({ severity: "error", code: "meta", message: "报告包缺少 meta" });
  } else {
    issues.push(...validateAllowedKeys(reportPackage.meta, new Set(["title", "organization", "period", "author", "confidentiality"]), "meta", "meta-property"));
    Object.entries(reportPackage.meta).forEach(([key, template]) => issues.push(...validateBindingTemplate(template, knownPaths, `meta.${key}`)));
  }
  const assetIds = new Set<string>();
  if (reportPackage.assets !== undefined && !Array.isArray(reportPackage.assets)) issues.push({ severity: "error", code: "assets", message: "assets 必须是数组" });
  const assets = Array.isArray(reportPackage.assets) ? reportPackage.assets : [];
  assets.forEach((asset, index) => {
    const path = `assets.${index}`;
    issues.push(...validateAllowedKeys(asset, new Set(["id", "kind", "mime", "width", "height", "byteSize", "hash", "sourceName", "optimized", "originalRetained"]), path, "asset-property"));
    if (!asset?.id || assetIds.has(asset.id)) issues.push({ severity: "error", code: "asset-id", path, message: `图片资产 id 缺失或重复：${asset?.id || "(空)"}` });
    if (asset?.id) assetIds.add(asset.id);
    if (asset?.kind !== "image" || !ALLOWED_IMAGE_MIMES.has(asset.mime) || ![asset.width, asset.height, asset.byteSize].every(finiteNumber) || asset.width <= 0 || asset.height <= 0 || asset.byteSize < 0) {
      issues.push({ severity: "error", code: "asset-meta", path, message: `图片资产元数据无效：${asset?.id || "(空)"}` });
    }
    const source = reportPackage.assetData?.[asset?.id];
    if (typeof source !== "string") {
      issues.push({ severity: "error", code: "asset-data", path, message: `图片资产缺少匹配 MIME 的内嵌 data URL：${asset?.id || "(空)"}` });
    } else {
      try {
        const bytes = decodeStrictImageDataUrl(source, asset?.mime || "");
        if (bytes.byteLength !== asset.byteSize) issues.push({ severity: "error", code: "asset-byte-size", path, message: `图片资产字节数与元数据不一致：${asset?.id || "(空)"}` });
        if (!hasValidImageSignature(bytes, asset?.mime || "")) issues.push({ severity: "error", code: "asset-signature", path, message: `图片资产签名与 MIME 不匹配或文件已损坏：${asset?.id || "(空)"}` });
      } catch (error) {
        issues.push({ severity: "error", code: "asset-data", path, message: `${error instanceof Error ? error.message : String(error)}：${asset?.id || "(空)"}` });
      }
    }
  });
  Object.keys(reportPackage.assetData || {}).forEach((id) => {
    if (!assetIds.has(id)) issues.push({ severity: "error", code: "unused-asset-data", path: `assetData.${id}`, message: `存在未声明的图片数据：${id}` });
  });
  const pageIds = new Set<string>();
  const elementIds = new Set<string>();
  if (!Array.isArray(reportPackage.pages) || !reportPackage.pages.length) issues.push({ severity: "error", code: "pages", message: "报告包至少需要一页" });
  const pages = Array.isArray(reportPackage.pages) ? reportPackage.pages : [];
  pages.forEach((page, pageIndex) => {
    if (!page || typeof page !== "object") {
      issues.push({ severity: "error", code: "page", path: `pages.${pageIndex}`, message: "页面定义无效" });
      return;
    }
    issues.push(...validateAllowedKeys(page, new Set(["id", "name", "section", "master", "orientation", "masterProps", "elements"]), `pages.${pageIndex}`, "page-property"));
    if (!page.id || !/^[a-z0-9][a-z0-9-]*$/.test(page.id)) issues.push({ severity: "error", code: "page-id", path: `pages.${pageIndex}`, message: `页面 id 无效：${page.id || "(空)"}` });
    if (pageIds.has(page.id)) issues.push({ severity: "error", code: "duplicate-page", path: `pages.${pageIndex}`, message: `页面 id 重复：${page.id}` });
    pageIds.add(page.id);
    const size = PAGE_SIZE[page.orientation];
    if (!size) issues.push({ severity: "error", code: "orientation", path: page.id, message: `页面方向无效：${page.orientation}` });
    if (!MASTER_TYPES.has(page.master)) issues.push({ severity: "error", code: "master", path: page.id, message: `页面母版无效：${page.master}` });
    if (!Array.isArray(page.elements)) issues.push({ severity: "error", code: "elements", path: page.id, message: `页面「${page.name}」缺少元素数组` });
    if (page.masterProps) issues.push(...validateAllowedKeys(page.masterProps, new Set(["imageAssetId", "focal", "crop", "overlay", "overlayStrength", "imageStyle", "disclaimer", "contact"]), `${page.id}.masterProps`, "master-property"));
    if (page.masterProps?.imageAssetId && !assetIds.has(page.masterProps.imageAssetId)) issues.push({ severity: "error", code: "master-asset", path: page.id, message: `页面母版引用了不存在的图片资产：${page.masterProps.imageAssetId}` });
    if (page.masterProps?.crop) issues.push(...validateCrop(page.masterProps.crop, `${page.id}.masterProps.crop`, page.id));
    if (page.masterProps?.imageStyle) issues.push(...validateImageStyle(page.masterProps.imageStyle, `${page.id}.masterProps.imageStyle`, page.id));
    const elements = Array.isArray(page.elements) ? page.elements : [];
    elements.forEach((element, elementIndex) => {
      const path = `pages.${pageIndex}.elements.${elementIndex}`;
      if (!element || typeof element !== "object") {
        issues.push({ severity: "error", code: "element", path, message: "元素定义无效" });
        return;
      }
      issues.push(...validateAllowedKeys(element, new Set([
        "id", "type", "name", "x", "y", "w", "h", "z", "semanticRole", "groupId", "groupName", "presetId", "presetSlot",
        "role", "locked", "hidden", "content", "contentTemplate", "assetId", "crop", "imageStyle", "chartKind", "chart", "chartBinding", "chartLabels", "table", "tableBinding", "style"
      ]), path, "element-property"));
      if (!element.id || !/^[a-z0-9][a-z0-9-]*$/.test(element.id)) issues.push({ severity: "error", code: "element-id", path, message: `元素 id 无效：${element.id || "(空)"}` });
      if (elementIds.has(element.id)) issues.push({ severity: "error", code: "duplicate-element", path, message: `元素 id 重复：${element.id}` });
      elementIds.add(element.id);
      if (!ELEMENT_TYPES.has(element.type)) issues.push({ severity: "error", code: "element-type", path, message: `不支持的元素类型：${element.type}` });
      if (![element.x, element.y, element.w, element.h].every(finiteNumber) || element.w <= 0 || element.h <= 0) issues.push({ severity: "error", code: "geometry", path, message: `元素「${element.name}」几何值无效` });
      if (size && (element.x < 0 || element.y < 0 || element.x + element.w > size.width || element.y + element.h > size.height)) issues.push({ severity: "error", code: "out-of-page", path, locator: element.id, message: `元素「${element.name}」超出页面` });
      if (element.type === "text" && element.content === undefined && element.contentTemplate === undefined) issues.push({ severity: "warning", code: "empty-text", path, locator: element.id, message: `文字元素「${element.name}」没有内容` });
      if (element.type === "text" && element.content !== undefined && typeof element.content !== "string") issues.push({ severity: "error", code: "text-content", path: `${path}.content`, locator: element.id, message: `文字元素「${element.name}」的 content 必须是字符串` });
      if (element.type === "chart" && !element.chart && !element.chartBinding) issues.push({ severity: "error", code: "chart-data", path, locator: element.id, message: `图表「${element.name}」没有数据定义` });
      if (element.type === "table" && !element.table && !element.tableBinding) issues.push({ severity: "error", code: "table-data", path, locator: element.id, message: `表格「${element.name}」没有数据定义` });
      if (element.type === "chart" && element.chartKind !== undefined && !["line", "bar", "combo", "donut"].includes(element.chartKind)) issues.push({ severity: "error", code: "chart-kind", path: `${path}.chartKind`, locator: element.id, message: `图表「${element.name}」类型无效` });
      if (element.type === "chart" && element.chart) issues.push(...validateDirectChart(element.chart, `${path}.chart`, element.id));
      if (element.type === "chart" && element.chartLabels) issues.push(...validateChartLabels(element.chartLabels, `${path}.chartLabels`, element.id));
      if (element.type === "table" && element.table) issues.push(...validateDirectTable(element.table, `${path}.table`, element.id));
      if (element.type === "image" && (!element.assetId || !assetIds.has(element.assetId))) issues.push({ severity: "error", code: "image-asset", path, locator: element.id, message: `图片「${element.name}」引用了不存在的资产` });
      if (element.type === "image" && element.crop) issues.push(...validateCrop(element.crop, `${path}.crop`, element.id));
      if (element.type === "image" && element.imageStyle) issues.push(...validateImageStyle(element.imageStyle, `${path}.imageStyle`, element.id));
      if (element.type === "text" && element.contentTemplate !== undefined) issues.push(...validateBindingTemplate(element.contentTemplate, knownPaths, `${path}.contentTemplate`));
      if (authoringMode === "independent" && (element.contentTemplate !== undefined || element.chartBinding !== undefined || element.tableBinding !== undefined)) {
        issues.push({ severity: "error", code: "independent-binding", path, locator: element.id, message: `独立模式元素「${element.name}」不能声明字段绑定` });
      }
      const style = element.style || {};
      issues.push(...validateAllowedKeys(style, new Set([
        "fontSize", "fontSlot", "fontWeight", "color", "background", "borderColor", "borderWidth", "radius", "align", "verticalAlign", "padding", "opacity", "lineHeight", "showLabel", "showLegend"
      ]), `${path}.style`, "style-property"));
      for (const key of ["color", "background", "borderColor"] as const) {
        if (style[key] !== undefined && !COLOR_TOKENS.has(String(style[key]))) issues.push({ severity: "error", code: "style-color", path: `${path}.style.${key}`, locator: element.id, message: `元素「${element.name}」使用了非法颜色 token` });
      }
      if (style.fontSize !== undefined && !FONT_SIZE_STEPS.has(style.fontSize)) issues.push({ severity: "error", code: "style-font-size", path: `${path}.style.fontSize`, locator: element.id, message: `元素「${element.name}」字号不在白名单中` });
      if (style.fontSlot !== undefined && !["display", "body", "numeric"].includes(style.fontSlot)) issues.push({ severity: "error", code: "style-font-slot", path: `${path}.style.fontSlot`, locator: element.id, message: `元素「${element.name}」字体槽无效` });
      if (style.align !== undefined && !["left", "center", "right"].includes(style.align)) issues.push({ severity: "error", code: "style-align", path: `${path}.style.align`, locator: element.id, message: `元素「${element.name}」水平对齐无效` });
      if (style.verticalAlign !== undefined && !["start", "center", "end"].includes(style.verticalAlign)) issues.push({ severity: "error", code: "style-vertical-align", path: `${path}.style.verticalAlign`, locator: element.id, message: `元素「${element.name}」垂直对齐无效` });
      if (style.lineHeight !== undefined && ![1.2, 1.35, 1.5].includes(style.lineHeight)) issues.push({ severity: "error", code: "style-line-height", path: `${path}.style.lineHeight`, locator: element.id, message: `元素「${element.name}」行高不在白名单中` });
      if (style.opacity !== undefined && (!finiteNumber(style.opacity) || style.opacity < 0 || style.opacity > 1)) issues.push({ severity: "error", code: "style-opacity", path: `${path}.style.opacity`, locator: element.id, message: `元素「${element.name}」透明度必须在 0 到 1 之间` });
      for (const key of ["showLabel", "showLegend"] as const) if (style[key] !== undefined && typeof style[key] !== "boolean") issues.push({ severity: "error", code: "style-boolean", path: `${path}.style.${key}`, locator: element.id, message: `元素「${element.name}」的 ${key} 必须是布尔值` });
      for (const [key, value] of Object.entries(style)) {
        if (typeof value === "number" && !Number.isFinite(value)) issues.push({ severity: "error", code: "style-number", path: `${path}.style.${key}`, locator: element.id, message: `元素「${element.name}」样式数值无效` });
      }
      if (element.chartBinding) {
        issues.push(...validateAllowedKeys(element.chartBinding, new Set(["categories", "series"]), `${path}.chartBinding`, "chart-binding-property"));
        issues.push(...validateExpression(element.chartBinding.categories, knownPaths, `${path}.chartBinding.categories`));
        if (!Array.isArray(element.chartBinding.series) || !element.chartBinding.series.length) issues.push({ severity: "error", code: "chart-binding-series", path, locator: element.id, message: `图表「${element.name}」缺少序列` });
        if (Array.isArray(element.chartBinding.series)) element.chartBinding.series.forEach((series, seriesIndex) => {
          const seriesPath = `${path}.chartBinding.series.${seriesIndex}`;
          issues.push(...validateAllowedKeys(series, new Set(["id", "name", "values", "kind", "axis", "unit"]), seriesPath, "chart-binding-series-property"));
          if (!series || typeof series.name !== "string" || !series.name) issues.push({ severity: "error", code: "chart-binding-series", path: seriesPath, locator: element.id, message: `图表「${element.name}」序列名称无效` });
          if (series.kind !== undefined && !["bar", "line"].includes(series.kind)) issues.push({ severity: "error", code: "chart-binding-kind", path: seriesPath, locator: element.id, message: `图表「${element.name}」序列 kind 无效` });
          if (series.axis !== undefined && !["left", "right"].includes(series.axis)) issues.push({ severity: "error", code: "chart-binding-axis", path: seriesPath, locator: element.id, message: `图表「${element.name}」序列 axis 无效` });
          issues.push(...validateExpression(series.values, knownPaths, `${seriesPath}.values`));
        });
      }
      if (element.tableBinding) {
        issues.push(...validateAllowedKeys(element.tableBinding, new Set(["headers", "rows", "columns"]), `${path}.tableBinding`, "table-binding-property"));
        issues.push(...validateExpression(element.tableBinding.headers, knownPaths, `${path}.tableBinding.headers`));
        const hasRows = element.tableBinding.rows !== undefined;
        const hasColumns = Array.isArray(element.tableBinding.columns) && element.tableBinding.columns.length > 0;
        if (hasRows === hasColumns) issues.push({ severity: "error", code: "table-binding-shape", path, locator: element.id, message: `表格「${element.name}」必须且只能声明 rows 或 columns` });
        if (element.tableBinding.rows) issues.push(...validateExpression(element.tableBinding.rows, knownPaths, `${path}.tableBinding.rows`));
        if (Array.isArray(element.tableBinding.columns)) element.tableBinding.columns.forEach((column, columnIndex) => {
          issues.push(...validateAllowedKeys(column, new Set(["values", "format", "digits", "suffix"]), `${path}.tableBinding.columns.${columnIndex}`, "table-binding-column-property"));
          issues.push(...validateExpression(column.values, knownPaths, `${path}.tableBinding.columns.${columnIndex}.values`));
          if (column.format && !TABLE_FORMATS.has(column.format)) issues.push({ severity: "error", code: "table-binding-format", path: `${path}.tableBinding.columns.${columnIndex}`, locator: element.id, message: `表格「${element.name}」使用了无效列格式` });
          if (column.digits !== undefined && (!Number.isInteger(column.digits) || column.digits < 0 || column.digits > 6)) issues.push({ severity: "error", code: "table-binding-digits", path: `${path}.tableBinding.columns.${columnIndex}`, locator: element.id, message: `表格「${element.name}」列小数位无效` });
          if (column.suffix && /[<>]/.test(column.suffix)) issues.push({ severity: "error", code: "table-binding-suffix", path: `${path}.tableBinding.columns.${columnIndex}`, locator: element.id, message: `表格「${element.name}」列后缀包含非法标记` });
        });
      }
    });
  });
  const ruleIds = new Set<string>();
  if (reportPackage.rules !== undefined && !Array.isArray(reportPackage.rules)) issues.push({ severity: "error", code: "rules", message: "rules 必须是数组" });
  const rules = Array.isArray(reportPackage.rules) ? reportPackage.rules : [];
  rules.forEach((rule, index) => {
    if (!rule || typeof rule !== "object" || !rule.id || !["error", "warning"].includes(rule.severity) || typeof rule.message !== "string") {
      issues.push({ severity: "error", code: "rule", path: `rules.${index}`, message: "校验规则定义无效" });
      return;
    }
    issues.push(...validateAllowedKeys(rule, new Set(["id", "severity", "assert", "message", "locator"]), `rules.${index}`, "rule-property"));
    if (ruleIds.has(rule.id)) issues.push({ severity: "error", code: "duplicate-rule", path: rule.id, message: `校验规则 id 重复：${rule.id}` });
    ruleIds.add(rule.id);
    issues.push(...validateExpression(rule.assert, knownPaths, `rules.${rule.id}`));
  });
  const sectionIds = new Set<string>();
  const sectionFields = new Set<string>();
  if (reportPackage.inputSections !== undefined && !Array.isArray(reportPackage.inputSections)) issues.push({ severity: "error", code: "input-sections", message: "inputSections 必须是数组" });
  const inputSections = Array.isArray(reportPackage.inputSections) ? reportPackage.inputSections : [];
  inputSections.forEach((section, sectionIndex) => {
    if (!section || typeof section !== "object") {
      issues.push({ severity: "error", code: "input-section", path: `inputSections.${sectionIndex}`, message: "录入分区定义无效" });
      return;
    }
    issues.push(...validateAllowedKeys(section, new Set(["id", "title", "fields"]), `inputSections.${sectionIndex}`, "input-section-property"));
    if (!section.id || sectionIds.has(section.id)) issues.push({ severity: "error", code: "input-section-id", path: `inputSections.${sectionIndex}`, message: `录入分区 id 缺失或重复：${section.id || "(空)"}` });
    sectionIds.add(section.id);
    if (!Array.isArray(section.fields)) {
      issues.push({ severity: "error", code: "input-section-fields", path: `inputSections.${sectionIndex}`, message: "录入分区缺少 fields 数组" });
      return;
    }
    section.fields.forEach((path) => {
      if (!fields[path]) issues.push({ severity: "error", code: "input-section-field", path, message: `录入分区引用了未声明字段：${path}` });
      if (sectionFields.has(path)) issues.push({ severity: "error", code: "input-section-duplicate", path, message: `字段被多个录入分区重复引用：${path}` });
      sectionFields.add(path);
    });
  });
  return issues;
}

export function validateReportData(reportPackage: ReportPackageDefinition, data: ReportData) {
  return Object.entries(reportPackage.fields || {}).flatMap(([path, definition]) => {
    try {
      return validateFieldValue(path, definition, getPathValue(data, path));
    } catch (error) {
      return [{ severity: "error", code: "field-path", path, message: error instanceof Error ? error.message : String(error) } satisfies EngineIssue];
    }
  });
}

function formatBoundValue(value: unknown, format: string | undefined, definition?: FieldDefinition) {
  if (value === undefined || value === null || value === "") return definition?.placeholder || "待填";
  if (!format) return Array.isArray(value) ? value.join("、") : String(value);
  const [kind, digitsText] = format.split(":");
  const digits = digitsText === undefined ? definition?.decimals ?? 1 : Number(digitsText);
  if (!FORMATTERS.has(kind)) throw new Error(`未知格式化器：${kind}`);
  if (!finiteNumber(value)) return definition?.placeholder || "待填";
  const number = kind === "integer" ? Math.round(value).toLocaleString("zh-CN") : value.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (kind === "signed") return `${value > 0 ? "+" : ""}${number}`;
  if (kind === "percent") return `${number}%`;
  if (kind === "signedPercent") return `${value > 0 ? "+" : ""}${number}%`;
  if (kind === "pp") return `${value > 0 ? "+" : ""}${number}个百分点`;
  return number;
}

export function renderBindingTemplate(template: string, reportPackage: ReportPackageDefinition, resolve: (path: string) => unknown) {
  const knownPaths = new Set([...Object.keys(reportPackage.fields || {}), ...Object.keys(reportPackage.derived || {})]);
  const validationIssues = validateBindingTemplate(template, knownPaths, "binding");
  if (validationIssues.length) throw new Error(validationIssues.map((issue) => issue.message).join("；"));
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)(?:\|([a-zA-Z]+(?::\d+)?))?\s*\}\}/g, (_match, path: string, format?: string) => {
    return formatBoundValue(resolve(path), format, reportPackage.fields?.[path]);
  });
}

function formatTableValue(value: unknown, column: NonNullable<BoundTableDefinition["columns"]>[number]) {
  if (value === undefined || value === null || value === "") return "";
  if (!column.format) return String(value);
  if (!finiteNumber(value)) throw new Error("格式化列包含非数字值");
  const digits = column.format === "integer" ? 0 : column.digits ?? 1;
  const absolute = Math.abs(value).toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const formatted = column.format === "accounting" && value < 0 ? `(${absolute})`
    : `${value < 0 ? "-" : ""}${absolute}${column.format === "percent" ? "%" : ""}`;
  return `${formatted}${column.suffix || ""}`;
}

function stableDecoration(page: EnginePageDefinition, role: NonNullable<ReportElement["role"]>, type: "text" | "divider", name: string, x: number, y: number, w: number, h: number, content: string, style: ElementStyle, z: number): ReportElement {
  return { id: `${page.id}--${role}`, role, type, name, x, y, w, h, z, content, runs: type === "text" ? [{ text: content }] : undefined, style };
}

function pageDecorations(reportPackage: ReportPackageDefinition, page: EnginePageDefinition, meta: ReportDocument["meta"], pageNumber: number, totalPages: number): ReportElement[] {
  const size = PAGE_SIZE[page.orientation];
  const margin = reportPackage.pageSetup?.margin ?? 18;
  const innerWidth = size.width - margin * 2;
  const muted: ElementStyle = { fontSize: 8, fontSlot: "body", color: "muted", background: "transparent", lineHeight: 1.2, padding: 0 };
  if (["standard", "data", "section"].includes(page.master)) {
    const confidentiality = reportPackage.pageSetup?.footerMode === "confidentiality-last" && pageNumber !== totalPages ? "" : meta.confidentiality;
    return [
      stableDecoration(page, "header-left", "text", "页眉机构", margin, 7, innerWidth * 0.46, 4.5, meta.organization || meta.title, { ...muted, align: "left" }, 1),
      stableDecoration(page, "header-right", "text", "页眉章节", margin + innerWidth * 0.54, 7, innerWidth * 0.46, 4.5, page.section, { ...muted, align: "right" }, 2),
      stableDecoration(page, "header-rule", "divider", "页眉线", margin, 13, innerWidth, 0.25, "", { background: "line" }, 3),
      stableDecoration(page, "footer-rule", "divider", "页脚线", margin, size.height - 9, innerWidth, 0.25, "", { background: "line" }, 4),
      stableDecoration(page, "footer-left", "text", "页脚密级", margin, size.height - 7, innerWidth * 0.72, 4, confidentiality, { ...muted, align: "left" }, 5),
      stableDecoration(page, "footer-page-number", "text", "页码", margin + innerWidth * 0.82, size.height - 7, innerWidth * 0.18, 4, String(pageNumber).padStart(2, "0"), { ...muted, fontSlot: "numeric", align: "right" }, 6)
    ];
  }
  return [];
}

function compileElement(definition: EngineElementDefinition, reportPackage: ReportPackageDefinition, resolve: (path: string) => unknown, z: number, issues: EngineIssue[]): ReportElement {
  const element: ReportElement = {
    id: definition.id,
    type: definition.type,
    name: definition.name,
    x: definition.x,
    y: definition.y,
    w: definition.w,
    h: definition.h,
    z: definition.z ?? z,
    semanticRole: definition.semanticRole,
    groupId: definition.groupId,
    groupName: definition.groupName,
    presetId: definition.presetId,
    presetSlot: definition.presetSlot,
    role: definition.role,
    locked: definition.locked,
    hidden: definition.hidden,
    assetId: definition.assetId,
    crop: cloneValue(definition.crop),
    imageStyle: cloneValue(definition.imageStyle),
    chartKind: definition.chartKind,
    chartLabels: cloneValue(definition.chartLabels),
    style: cloneValue(definition.style || {})
  };
  if (definition.type === "text") {
    try {
      element.content = definition.contentTemplate
        ? renderBindingTemplate(definition.contentTemplate, reportPackage, resolve)
        : definition.content || "";
    } catch (error) {
      issues.push({ severity: "error", code: "text-binding", locator: definition.id, message: error instanceof Error ? error.message : String(error) });
      element.content = definition.content || "待填";
    }
    element.runs = [{ text: element.content }];
  }
  if (definition.type === "chart") {
    if (definition.chartBinding) {
      try {
        const categories = evaluateExpression(definition.chartBinding.categories, resolve);
        const series = definition.chartBinding.series.map((item) => ({ ...item, values: evaluateExpression(item.values, resolve) }));
        if (!Array.isArray(categories) || !categories.every((item) => typeof item === "string") || series.some((item) => !numericArray(item.values) || item.values.length !== categories.length)) {
          throw new Error(`图表「${definition.name}」绑定结果无效或序列长度不一致`);
        }
        element.chart = withStableChartIds({ categories, series: series as ChartData["series"] });
      } catch (error) {
        issues.push({ severity: "error", code: "chart-binding", locator: definition.id, message: error instanceof Error ? error.message : String(error) });
        element.chart = { categories: [], series: [] };
      }
    } else element.chart = withStableChartIds(cloneValue(definition.chart || { categories: [], series: [] }));
  }
  if (definition.type === "table") {
    if (definition.tableBinding) {
      try {
        const headers = evaluateExpression(definition.tableBinding.headers, resolve);
        if (!Array.isArray(headers) || !headers.every((item) => typeof item === "string")) throw new Error(`表格「${definition.name}」表头绑定结果无效`);
        let rows: unknown[][];
        if (definition.tableBinding.rows !== undefined) {
          const boundRows = evaluateExpression(definition.tableBinding.rows, resolve);
          if (!Array.isArray(boundRows) || !boundRows.every((row) => Array.isArray(row))) throw new Error(`表格「${definition.name}」行绑定结果无效`);
          rows = boundRows;
        } else {
          const columns = definition.tableBinding.columns || [];
          const values = columns.map((column) => evaluateExpression(column.values, resolve));
          if (!values.length || values.some((column) => !Array.isArray(column))) throw new Error(`表格「${definition.name}」列绑定结果无效`);
          const rowCount = (values[0] as unknown[]).length;
          if (headers.length !== columns.length || values.some((column) => (column as unknown[]).length !== rowCount)) throw new Error(`表格「${definition.name}」列数或列长度不一致`);
          rows = Array.from({ length: rowCount }, (_, rowIndex) => columns.map((column, columnIndex) => formatTableValue((values[columnIndex] as unknown[])[rowIndex], column)));
        }
        if (rows.some((row) => row.length !== headers.length)) throw new Error(`表格「${definition.name}」行列数与表头不一致`);
        element.table = { headers, rows: rows.map((row) => row.map((cell) => String(cell ?? ""))) };
      } catch (error) {
        issues.push({ severity: "error", code: "table-binding", locator: definition.id, message: error instanceof Error ? error.message : String(error) });
        element.table = { headers: [], rows: [] };
      }
    } else element.table = cloneValue(definition.table || { headers: [], rows: [] });
  }
  return element;
}

function selectDeclaredData(reportPackage: Partial<ReportPackageDefinition>, sourceData: ReportData = {}) {
  const selected: ReportData = {};
  const fields = reportPackage.fields && typeof reportPackage.fields === "object" && !Array.isArray(reportPackage.fields) ? reportPackage.fields : {};
  Object.keys(fields).forEach((path) => {
    try {
      const value = getPathValue(sourceData, path);
      if (value !== undefined) setPathValue(selected, path, cloneValue(value as ReportValue));
    } catch {
      // Package validation reports invalid paths; undeclared or invalid input is not copied.
    }
  });
  return selected;
}

function deletePathValue(source: ReportData, path: string) {
  const parts = splitPath(path);
  const last = parts.pop();
  if (!last) return;
  let cursor: unknown = source;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) delete (cursor as Record<string, unknown>)[last];
}

export function migrateReportData(reportPackage: ReportPackageDefinition, sourceVersion: string | undefined, sourceData: ReportData = {}) {
  const issues: EngineIssue[] = [];
  const targetVersion = reportPackage.dataSchemaVersion;
  if (sourceVersion === targetVersion) return { data: selectDeclaredData(reportPackage, sourceData), issues, migrated: false };
  if (!sourceVersion || !/^\d+\.\d+\.\d+$/.test(sourceVersion)) {
    return { data: selectDeclaredData(reportPackage), issues: [{ severity: "error", code: "data-migration-version", message: "数据文件缺少有效 dataSchemaVersion" }], migrated: false };
  }
  const data = cloneValue(sourceData);
  let current = sourceVersion;
  const visited = new Set<string>();
  while (current !== targetVersion) {
    if (visited.has(current)) {
      issues.push({ severity: "error", code: "data-migration-cycle", message: `数据迁移存在循环：${current}` });
      break;
    }
    visited.add(current);
    const migration = (reportPackage.dataMigrations || []).find((item) => item.from === current);
    if (!migration) {
      issues.push({ severity: "error", code: "data-migration-missing", message: `没有从 ${current} 到 ${targetVersion} 的数据迁移路径` });
      break;
    }
    try {
      Object.entries(migration.rename || {}).forEach(([from, to]) => {
        const value = getPathValue(data, from);
        if (value !== undefined) {
          setPathValue(data, to, cloneValue(value as ReportValue));
          deletePathValue(data, from);
        }
      });
      (migration.remove || []).forEach((path) => deletePathValue(data, path));
      Object.entries(migration.defaults || {}).forEach(([path, value]) => {
        if (getPathValue(data, path) === undefined) setPathValue(data, path, cloneValue(value));
      });
      current = migration.to;
    } catch (error) {
      issues.push({ severity: "error", code: "data-migration", message: error instanceof Error ? error.message : String(error) });
      break;
    }
  }
  if (current !== targetVersion) issues.push({ severity: "error", code: "data-migration-incomplete", message: `数据迁移未到达目标版本 ${targetVersion}` });
  return { data: issues.some((issue) => issue.severity === "error") ? selectDeclaredData(reportPackage) : selectDeclaredData(reportPackage, data), issues, migrated: current === targetVersion && sourceVersion !== targetVersion };
}

export function compileReportPackage(reportPackage: ReportPackageDefinition, sourceData: ReportData = {}): CompilationResult {
  let packageIssues: EngineIssue[];
  try {
    packageIssues = validateReportPackage(reportPackage);
  } catch (error) {
    packageIssues = [{ severity: "error", code: "package-validation", message: error instanceof Error ? error.message : String(error) }];
  }
  const packageObject = reportPackage && typeof reportPackage === "object" ? reportPackage : {} as ReportPackageDefinition;
  const data = selectDeclaredData(packageObject, sourceData && typeof sourceData === "object" ? sourceData : {});
  if (packageIssues.some((issue) => issue.severity === "error")) {
    return { document: emptyDocument(packageObject), resolvedData: data, issues: packageIssues };
  }
  const issues = [...packageIssues, ...validateReportData(reportPackage, sourceData)];
  const resolver = createResolver(reportPackage, data, issues);
  Object.keys(reportPackage.derived || {}).forEach((path) => {
    const value = resolver.resolve(path);
    try {
      setPathValue(data, path, value as ReportValue);
    } catch (error) {
      issues.push({ severity: "error", code: "derived-path", path, message: error instanceof Error ? error.message : String(error) });
    }
  });
  reportPackage.rules?.forEach((rule) => {
    try {
      const passed = evaluateExpression(rule.assert, resolver.resolve);
      if (passed !== true) issues.push({ severity: rule.severity, code: `rule:${rule.id}`, locator: rule.locator, message: rule.message });
    } catch (error) {
      issues.push({ severity: "error", code: `rule:${rule.id}`, locator: rule.locator, message: error instanceof Error ? error.message : String(error) });
    }
  });
  let meta: ReportDocument["meta"];
  try {
    meta = Object.fromEntries(Object.entries(reportPackage.meta).map(([key, value]) => [key, renderBindingTemplate(value, reportPackage, resolver.resolve)])) as unknown as ReportDocument["meta"];
  } catch (error) {
    issues.push({ severity: "error", code: "meta-binding", message: error instanceof Error ? error.message : String(error) });
    meta = emptyDocument(reportPackage).meta;
  }
  const pages = reportPackage.pages.map<ReportPage>((page, pageIndex) => {
    const decorations = pageDecorations(reportPackage, page, meta, pageIndex + 1, reportPackage.pages.length);
    const content = page.elements.map((element, index) => compileElement(element, reportPackage, resolver.resolve, decorations.length + index + 1, issues));
    return { id: page.id, name: page.name, section: page.section, master: page.master, orientation: page.orientation, masterProps: cloneValue(page.masterProps), elements: [...decorations, ...content] };
  });
  const document: ReportDocument = {
    version: "1.5",
    meta,
    theme: cloneValue(reportPackage.theme),
    pageSetup: {
      grid: reportPackage.pageSetup?.grid ?? 5,
      margin: reportPackage.pageSetup?.margin ?? 18,
      snap: reportPackage.pageSetup?.snap ?? true,
      showGrid: reportPackage.pageSetup?.showGrid ?? false,
      footerMode: reportPackage.pageSetup?.footerMode ?? "all",
      printDpi: reportPackage.pageSetup?.printDpi ?? 300
    },
    usedFontSlots: ["display", "body", "numeric"],
    assets: cloneValue(reportPackage.assets || []),
    pages,
    updatedAt: reportPackage.documentUpdatedAt
  };
  return { document, resolvedData: data, issues };
}

export function createPreviewData(reportPackage: ReportPackageDefinition, sourceData: ReportData = {}) {
  const preview: ReportData = {};
  Object.entries(reportPackage.fields || {}).forEach(([path, definition]) => {
    const sourceValue = getPathValue(sourceData, path);
    const fallback: ReportValue = definition.type === "number" ? 88.8
      : definition.type === "number[]" ? [72, 76, 79, 83, 86, 91]
        : definition.type === "string[]" ? ["一月", "二月", "三月", "四月", "五月", "六月"]
          : definition.type === "table" ? [["示例", "待填"]]
            : definition.type === "boolean" ? false
              : "****";
    if (definition.sensitive) setPathValue(preview, path, cloneValue(definition.preview ?? fallback));
    else if (sourceValue !== undefined) setPathValue(preview, path, cloneValue(sourceValue as ReportValue));
    else if (definition.preview !== undefined) setPathValue(preview, path, cloneValue(definition.preview));
  });
  return preview;
}

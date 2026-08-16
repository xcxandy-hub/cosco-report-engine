import {
  ChangeEvent,
  ClipboardEvent as ReactClipboardEvent,
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { flushSync } from "react-dom";
import * as echarts from "echarts";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  AlertTriangle,
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  BarChart3,
  Bold,
  ChartNoAxesColumn,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  ChevronUp,
  CircleGauge,
  Copy,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  FilePlus2,
  FileText,
  FileImage,
  Grid3X3,
  Image as ImageIcon,
  Layers3,
  LayoutTemplate,
  LineChart,
  Lock,
  Menu,
  Minus,
  MousePointer2,
  Palette,
  Pencil,
  PanelLeftClose,
  PanelRightClose,
  PieChart,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Square,
  Table2,
  Text,
  TextQuote,
  Trash2,
  Type,
  Undo2,
  Ungroup,
  Unlock,
  Upload,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import {
  ChartData,
  ChartLabelMode,
  clone,
  DEFAULT_IMAGE_STYLE,
  ElementType,
  FONT_SIZE_STEPS,
  ImageCrop,
  ImageStyle,
  MasterType,
  MAX_IMPORTED_ASSET_BYTES,
  MAX_IMPORTED_IMAGE_PIXELS,
  MAX_IMPORTED_IMAGE_TOTAL_PIXELS,
  normalizeProject,
  Orientation,
  PAGE_MM,
  ReportAsset,
  ReportDocument,
  ReportElement,
  ReportPage,
  TableData,
  round,
  scaleImageCrop,
  TextRun,
  uid
} from "./model";
import { clearAssetNamespace, createAssetBlob, getAssetByteSizes, getAssets, inspectImageDimensions, putAsset, putAssetsAtomically, removeAssets } from "./asset-store";
import {
  COMPONENT_PRESETS,
  createPage,
  createStarterReport,
  makeElement,
  makePreset,
  StarterKey,
  THEMES
} from "./templates";
import {
  compileReportPackage,
  EngineIssue,
  FieldDefinition,
  getPathValue,
  migrateReportData,
  ReportData,
  ReportPackageDefinition,
  ReportValue,
  setPathValue
} from "./report-engine";
import {
  applyVisualOverrides,
  createVisualOverrides,
  VisualOverrideSet,
  visualOverrideCount
} from "./visual-overrides";

interface ReportEngineBootstrap {
  reportPackage: ReportPackageDefinition;
  data: ReportData;
}

declare global {
  interface Window {
    __REPORT_ENGINE_BOOTSTRAP__?: ReportEngineBootstrap | null;
    __REPORT_ENGINE_STATUS__?: {
      ready: boolean;
      packageId: string;
      pageCount: number;
      errors: string[];
    };
  }
}

const STORAGE_KEY = "local-report-studio:document:v1";
const MAX_PROJECT_ARCHIVE_BYTES = 64 * 1024 * 1024;
const MAX_PROJECT_JSON_BYTES = 80 * 1024 * 1024;
const MAX_PROJECT_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_PROJECT_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_PROJECT_ARCHIVE_ENTRIES = 512;
const MAX_GRID_ROWS = 300;
const MAX_GRID_COLUMNS = 50;
const MAX_GRID_CELLS = 5000;
const MAX_GRID_CELL_CHARS = 10000;
const MAX_GRID_TOTAL_CHARS = 1024 * 1024;
const MAX_CHART_ABS_VALUE = 1e15;
const ICON_STROKE = 1.75;
const BASE_PX_PER_MM = 3.05;
const chartInstances = new Set<echarts.ECharts>();
const MASTER_CROP_ELEMENT_ID = "__page-master-image__";
const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type ResizeDirection = (typeof HANDLES)[number];
type LeftTab = "pages" | "components";
type InspectorTab = "page" | "data" | "style" | "layers" | "document";
type AlignCommand = "left" | "center" | "right" | "top" | "middle" | "bottom";
type DistributeCommand = "horizontal" | "vertical";

const iconForType: Record<ElementType, typeof Type> = {
  text: Text,
  box: Square,
  chart: BarChart3,
  table: Table2,
  image: ImageIcon,
  divider: Minus
};

const iconForPreset = {
  text: Text,
  box: Square,
  divider: Minus,
  image: ImageIcon,
  chart: BarChart3,
  table: Table2,
  title: Type,
  source: FileText,
  kpi: CircleGauge,
  quote: TextQuote
};

function selectionUnitIds(page: ReportPage, elementId: string) {
  const element = page.elements.find((item) => item.id === elementId);
  if (!element?.groupId) return [elementId];
  return page.elements.filter((item) => item.groupId === element.groupId).map((item) => item.id);
}

function expandSelectionToGroups(page: ReportPage, ids: Iterable<string>) {
  const expanded = new Set(ids);
  const groupIds = new Set(page.elements.filter((element) => expanded.has(element.id) && element.groupId).map((element) => element.groupId));
  page.elements.forEach((element) => {
    if (element.groupId && groupIds.has(element.groupId)) expanded.add(element.id);
  });
  return expanded;
}

function loadInitialProject(): { document: ReportDocument; assetData: Record<string, string> } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeProject(JSON.parse(saved));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return { document: createStarterReport("professional"), assetData: {} };
}

function syncPageNumberElements(report: ReportDocument) {
  report.pages.forEach((page, index) => {
    page.elements.forEach((element) => {
      if (element.role !== "footer-page-number") return;
      const value = String(index + 1).padStart(2, "0");
      element.content = value;
      element.runs = [{ text: value }];
    });
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("图片编码失败"));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片压缩失败")), mime, quality);
  });
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function readImageAsset(
  file: File,
  keepOriginal = false,
  pixelBudget = MAX_IMPORTED_IMAGE_PIXELS
): Promise<{ asset: ReportAsset; data: string; blob: Blob; originalWidth: number; originalHeight: number }> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("图片只支持 PNG、JPEG 或 WebP 位图");
  if (file.size > MAX_IMPORTED_ASSET_BYTES) throw new Error("单张图片超过 50 MB 导入上限");
  const dimensions = await inspectImageDimensions(file, file.type);
  const encodedPixels = dimensions.width * dimensions.height;
  if (!Number.isSafeInteger(encodedPixels) || encodedPixels > MAX_IMPORTED_IMAGE_PIXELS) throw new Error("单张图片像素超过 64 MP 导入上限");
  if (encodedPixels > pixelBudget) throw new Error("工程图片总像素超过 256 MP 导入上限");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const decodedPixels = originalWidth * originalHeight;
  if (!Number.isSafeInteger(decodedPixels) || decodedPixels > MAX_IMPORTED_IMAGE_PIXELS || decodedPixels > pixelBudget) {
    bitmap.close();
    throw new Error(decodedPixels > pixelBudget ? "工程图片总像素超过 256 MP 导入上限" : "单张图片像素超过 64 MP 导入上限");
  }
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = keepOriginal || longest <= 4096 ? 1 : 4096 / longest;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = window.document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("浏览器无法创建图片处理画布");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const sampleCanvas = window.document.createElement("canvas");
  sampleCanvas.width = Math.min(64, width);
  sampleCanvas.height = Math.min(64, height);
  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  sampleContext?.drawImage(canvas, 0, 0, sampleCanvas.width, sampleCanvas.height);
  const pixels = sampleContext?.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
  let transparent = false;
  if (pixels) {
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] < 250) { transparent = true; break; }
    }
  }
  const graphic = transparent || file.type === "image/png";
  const mime = graphic ? "image/png" : "image/jpeg";
  const blob = await canvasToBlob(canvas, mime, mime === "image/jpeg" ? 0.85 : undefined);
  const data = await blobToDataUrl(blob);
  return {
    asset: {
      id: uid("asset"),
      kind: "image",
      mime,
      width,
      height,
      byteSize: blob.size,
      hash: await sha256(blob),
      sourceName: file.name,
      optimized: scale < 1 || blob.size < file.size,
      originalRetained: keepOriginal
    },
    data,
    blob,
    originalWidth,
    originalHeight
  };
}

async function sanitizeImportedProjectAssets(
  project: { document: ReportDocument; assetData: Record<string, string> },
  keepOriginal: boolean
) {
  const document = clone(project.document);
  const assetData: Record<string, string> = {};
  const idMap = new Map<string, string>();
  const assetMap = new Map<string, { source: ReportAsset; target: ReportAsset }>();
  const assets: ReportAsset[] = [];
  let remainingPixels = MAX_IMPORTED_IMAGE_TOTAL_PIXELS;

  for (const asset of document.assets) {
    const source = project.assetData[asset.id];
    if (!source) throw new Error(`可移植工程缺少图片资产数据：${asset.id}`);
    const sourceBlob = await createAssetBlob(source, asset.mime);
    const file = new File([sourceBlob], asset.sourceName || `${asset.id}.${assetExtension(asset.mime)}`, { type: asset.mime });
    const sanitized = await readImageAsset(file, keepOriginal, remainingPixels);
    remainingPixels -= sanitized.originalWidth * sanitized.originalHeight;
    const nextId = uid("asset");
    idMap.set(asset.id, nextId);
    sanitized.asset.id = nextId;
    sanitized.asset.sourceName = asset.sourceName || sanitized.asset.sourceName;
    assets.push(sanitized.asset);
    assetMap.set(asset.id, { source: asset, target: sanitized.asset });
    assetData[nextId] = sanitized.data;
  }

  const remapAssetId = (id: string | undefined, context: string) => {
    if (!id) return undefined;
    const next = idMap.get(id);
    if (!next) throw new Error(`${context}引用了未声明的图片资产：${id}`);
    return next;
  };
  document.assets = assets;
  document.pages.forEach((page) => {
    const sourceMasterId = page.masterProps?.imageAssetId;
    if (sourceMasterId) page.masterProps!.imageAssetId = remapAssetId(sourceMasterId, `页面「${page.name}」`);
    const masterAssets = sourceMasterId ? assetMap.get(sourceMasterId) : undefined;
    if (page.masterProps?.crop && masterAssets) {
      page.masterProps.crop = scaleImageCrop(page.masterProps.crop, masterAssets.source, masterAssets.target);
    }
    page.elements.forEach((element) => {
      if (!element.assetId) return;
      const sourceAssetId = element.assetId;
      element.assetId = remapAssetId(sourceAssetId, `元素「${element.name}」`);
      const mappedAssets = assetMap.get(sourceAssetId);
      if (element.crop && mappedAssets) {
        element.crop = scaleImageCrop(element.crop, mappedAssets.source, mappedAssets.target);
      }
    });
  });
  return { document, assetData };
}

interface ImageSizeReport {
  before: number;
  after: number;
  items: Array<{ name: string; before: number; after: number }>;
}

function coverCrop(asset: ReportAsset, width: number, height: number, focal = { x: 50, y: 50 }): ImageCrop {
  const frameRatio = width / height;
  const assetRatio = asset.width / asset.height;
  if (assetRatio > frameRatio) {
    const sw = asset.height * frameRatio;
    return { sx: (asset.width - sw) * focal.x / 100, sy: 0, sw, sh: asset.height };
  }
  const sh = asset.width / frameRatio;
  return { sx: 0, sy: (asset.height - sh) * focal.y / 100, sw: asset.width, sh };
}

async function preparePrintProject(report: ReportDocument, sourceData: Record<string, string>, dpi: 96 | 150 | 300) {
  const next = clone(report);
  next.assets = [];
  const outputData: Record<string, string> = {};
  const stats: ImageSizeReport = { before: 0, after: 0, items: [] };

  const processUsage = async (assetId: string, usageId: string, widthMm: number, heightMm: number, crop?: ImageCrop) => {
    const asset = report.assets.find((item) => item.id === assetId);
    const data = sourceData[assetId];
    if (!asset || !data) return null;
    const blob = await createAssetBlob(data, asset.mime);
    const bitmap = await createImageBitmap(blob);
    const visible = crop || { sx: 0, sy: 0, sw: asset.width, sh: asset.height };
    const marginX = crop ? visible.sw * 0.05 : 0;
    const marginY = crop ? visible.sh * 0.05 : 0;
    const region = {
      sx: Math.max(0, visible.sx - marginX),
      sy: Math.max(0, visible.sy - marginY),
      sw: Math.min(asset.width, visible.sx + visible.sw + marginX) - Math.max(0, visible.sx - marginX),
      sh: Math.min(asset.height, visible.sy + visible.sh + marginY) - Math.max(0, visible.sy - marginY)
    };
    const requiredWidth = Math.max(1, Math.ceil(widthMm / 25.4 * dpi));
    const requiredHeight = Math.max(1, Math.ceil(heightMm / 25.4 * dpi));
    const scale = Math.min(1, Math.max(requiredWidth / visible.sw, requiredHeight / visible.sh));
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(region.sw * scale));
    canvas.height = Math.max(1, Math.ceil(region.sh * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, region.sx, region.sy, region.sw, region.sh, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const mime = asset.mime === "image/png" ? "image/png" : "image/jpeg";
    const optimizedBlob = await canvasToBlob(canvas, mime, mime === "image/jpeg" ? 0.85 : undefined);
    const printAsset: ReportAsset = {
      ...asset,
      id: usageId,
      width: canvas.width,
      height: canvas.height,
      byteSize: optimizedBlob.size,
      optimized: true
    };
    const printCrop = crop ? {
      sx: (visible.sx - region.sx) * scale,
      sy: (visible.sy - region.sy) * scale,
      sw: visible.sw * scale,
      sh: visible.sh * scale
    } : undefined;
    next.assets.push(printAsset);
    outputData[usageId] = await blobToDataUrl(optimizedBlob);
    stats.before += asset.byteSize || blob.size;
    stats.after += optimizedBlob.size;
    stats.items.push({ name: asset.sourceName || asset.id, before: asset.byteSize || blob.size, after: optimizedBlob.size });
    return { printAsset, printCrop };
  };

  for (const page of next.pages) {
    const originalPage = report.pages.find((item) => item.id === page.id)!;
    const masterAssetId = originalPage.masterProps?.imageAssetId;
    if (masterAssetId) {
      const size = PAGE_MM[page.orientation];
      const height = page.master === "section" ? 70 : size.height;
      const asset = report.assets.find((item) => item.id === masterAssetId);
      const crop = asset ? coverCrop(asset, size.width, height, originalPage.masterProps?.focal) : undefined;
      const processed = await processUsage(masterAssetId, `print-master-${page.id}`, size.width, height, crop);
      if (processed && page.masterProps) {
        page.masterProps.imageAssetId = processed.printAsset.id;
        page.masterProps.focal = { x: 50, y: 50 };
      }
    }
    for (const element of page.elements) {
      if (element.type !== "image" || !element.assetId) continue;
      const originalElement = originalPage.elements.find((item) => item.id === element.id)!;
      const processed = await processUsage(element.assetId, `print-image-${element.id}`, element.w, element.h, originalElement.crop);
      if (processed) {
        element.assetId = processed.printAsset.id;
        element.crop = processed.printCrop || { sx: 0, sy: 0, sw: processed.printAsset.width, sh: processed.printAsset.height };
      }
    }
  }
  stats.items.sort((a, b) => b.before - a.before);
  return { document: next, assetData: outputData, report: stats };
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  downloadBlob(name, blob);
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToBytes(value: string) {
  const base64 = value.split(",")[1] || "";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return `data:${mime};base64,${window.btoa(binary)}`;
}

function assetExtension(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function unzipProjectArchive(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_PROJECT_ARCHIVE_BYTES) throw new Error("ZIP 工程超过 64 MB 导入上限");
  let entryCount = 0;
  let uncompressedBytes = 0;
  const names = new Set<string>();
  const entries = unzipSync(bytes, {
    filter: (entry) => {
      entryCount += 1;
      if (entryCount > MAX_PROJECT_ARCHIVE_ENTRIES) throw new Error(`ZIP 工程条目超过 ${MAX_PROJECT_ARCHIVE_ENTRIES} 个上限`);
      if (!entry.name || entry.name.startsWith("/") || entry.name.includes("\\") || entry.name.includes("\0") || entry.name.split("/").some((part) => part === "..")) {
        throw new Error(`ZIP 工程包含不安全路径：${entry.name || "(空)"}`);
      }
      if (names.has(entry.name)) throw new Error(`ZIP 工程包含重复条目：${entry.name}`);
      names.add(entry.name);
      if (!Number.isSafeInteger(entry.originalSize) || entry.originalSize < 0) throw new Error(`ZIP 条目大小无效：${entry.name}`);
      uncompressedBytes += entry.originalSize;
      if (entry.originalSize > MAX_PROJECT_UNCOMPRESSED_BYTES || uncompressedBytes > MAX_PROJECT_UNCOMPRESSED_BYTES) {
        throw new Error("ZIP 工程解压后超过 64 MB 导入上限");
      }
      return true;
    }
  });
  const actualBytes = Object.values(entries).reduce((sum, entry) => sum + entry.byteLength, 0);
  if (actualBytes > MAX_PROJECT_UNCOMPRESSED_BYTES) throw new Error("ZIP 工程实际解压数据超过 64 MB 导入上限");
  return entries;
}

function cleanFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名报告";
}

type CellGridKind = "chart" | "table";

interface CellGridDraft {
  cells: string[][];
  rowKeys: string[];
  columnKeys: string[];
}

interface CellGridValidation {
  cellErrors: Map<string, string>;
  message: string;
  valid: boolean;
}

const gridCellKey = (row: number, column: number) => `${row}:${column}`;

function stableGridKey(candidate: string | undefined, prefix: string, used: Set<string>) {
  const key = candidate && !used.has(candidate) ? candidate : `${prefix}-${uid()}`;
  used.add(key);
  return key;
}

function chartToCellGrid(chart: ChartData): CellGridDraft {
  const usedRows = new Set<string>(["header"]);
  const usedColumns = new Set<string>(["category"]);
  const cells = [
    ["类目", ...chart.series.map((series) => series.name)],
    ...chart.categories.map((category, index) => [category, ...chart.series.map((series) => String(series.values[index] ?? ""))])
  ];
  return {
    cells,
    rowKeys: ["header", ...chart.categories.map((_, index) => stableGridKey(chart.categoryIds?.[index], "point", usedRows))],
    columnKeys: ["category", ...chart.series.map((series) => stableGridKey(series.id, "series", usedColumns))]
  };
}

function tableToCellGrid(table: TableData): CellGridDraft {
  return {
    cells: [table.headers, ...table.rows].map((row) => row.map(String)),
    rowKeys: ["header", ...table.rows.map(() => `row-${uid()}`)],
    columnKeys: table.headers.map(() => `column-${uid()}`)
  };
}

function cellGridValidation(kind: CellGridKind, draft: CellGridDraft): CellGridValidation {
  const errors = new Map<string, string>();
  const rows = draft.cells.length;
  const columns = Math.max(0, ...draft.cells.map((row) => row.length));
  const totalCharacters = draft.cells.reduce((total, row) => total + row.reduce((sum, cell) => sum + cell.length, 0), 0);
  if (rows > MAX_GRID_ROWS || columns > MAX_GRID_COLUMNS || rows * columns > MAX_GRID_CELLS || totalCharacters > MAX_GRID_TOTAL_CHARS || draft.cells.some((row) => row.some((cell) => cell.length > MAX_GRID_CELL_CHARS))) {
    return { cellErrors: errors, message: `数据超过 ${MAX_GRID_ROWS - 1} 行、${MAX_GRID_COLUMNS} 列或 ${MAX_GRID_CELLS} 格安全上限`, valid: false };
  }
  if (rows < 2) return { cellErrors: errors, message: "至少保留一行表头和一行数据", valid: false };
  if (columns < (kind === "chart" ? 2 : 1)) return { cellErrors: errors, message: kind === "chart" ? "图表至少需要一个类目列和一个数据系列" : "表格至少需要一列", valid: false };
  if (draft.cells.some((row) => row.length !== columns)) return { cellErrors: errors, message: "数据网格不是完整矩形，请重新粘贴连续的 Excel 区域", valid: false };
  if (draft.rowKeys.length !== rows || draft.columnKeys.length !== columns || new Set(draft.rowKeys).size !== draft.rowKeys.length || new Set(draft.columnKeys).size !== draft.columnKeys.length) {
    return { cellErrors: errors, message: "数据网格的稳定行列标识重复或缺失", valid: false };
  }
  draft.cells[0].forEach((value, column) => {
    if (!value.trim()) errors.set(gridCellKey(0, column), kind === "chart" && column === 0 ? "请填写类目列名称" : "请填写列名称");
  });
  if (kind === "chart") {
    draft.cells.slice(1).forEach((row, rowOffset) => {
      const rowIndex = rowOffset + 1;
      if (!row[0].trim()) errors.set(gridCellKey(rowIndex, 0), "请填写类目名称");
      row.slice(1).forEach((value, columnOffset) => {
        const columnIndex = columnOffset + 1;
        const raw = value.trim();
        if (!raw) errors.set(gridCellKey(rowIndex, columnIndex), "请填写数值，零请明确输入 0");
        else {
          const parsed = parseStrictChartNumber(raw);
          if (parsed === null) errors.set(gridCellKey(rowIndex, columnIndex), `“${raw.slice(0, 36)}${raw.length > 36 ? "…" : ""}”不是有效的有限十进制数`);
        }
      });
    });
  }
  const firstError = errors.values().next().value as string | undefined;
  return {
    cellErrors: errors,
    message: firstError ? `${errors.size} 个单元格需要修改：${firstError}` : `已识别 ${columns} 列、${rows - 1} 行数据`,
    valid: errors.size === 0
  };
}

function parseStrictChartNumber(value: string) {
  const raw = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && Math.abs(parsed) <= MAX_CHART_ABS_VALUE ? parsed : null;
}

function parseClipboardGrid(value: string): { cells?: string[][]; error?: string } {
  if (value.length > MAX_GRID_TOTAL_CHARS) return { error: "剪贴板内容超过 1 MB，已拒绝粘贴" };
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;
  let parseError = "";
  const pushCell = () => {
    if (cell.length > MAX_GRID_CELL_CHARS) { parseError = `单个单元格不能超过 ${MAX_GRID_CELL_CHARS} 个字符`; return; }
    if (row.length >= MAX_GRID_COLUMNS) { parseError = `粘贴区域不能超过 ${MAX_GRID_COLUMNS} 列`; return; }
    row.push(cell);
    cell = "";
    afterQuote = false;
  };
  const pushRow = () => {
    pushCell();
    if (parseError) return;
    if (rows.length >= MAX_GRID_ROWS) { parseError = `粘贴区域不能超过 ${MAX_GRID_ROWS} 行`; return; }
    rows.push(row);
    row = [];
  };
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quoted) {
      if (char === '"' && value[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else cell += char;
      if (cell.length > MAX_GRID_CELL_CHARS) return { error: `单个单元格不能超过 ${MAX_GRID_CELL_CHARS} 个字符` };
      continue;
    }
    if (char === '"' && !cell) { quoted = true; continue; }
    if (afterQuote && !["\t", "\r", "\n"].includes(char)) return { error: "Excel 引号单元格格式不完整，未执行粘贴" };
    if (char === "\t") { pushCell(); if (parseError) return { error: parseError }; continue; }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && value[index + 1] === "\n") index += 1;
      pushRow();
      if (parseError) return { error: parseError };
      continue;
    }
    cell += char;
    if (cell.length > MAX_GRID_CELL_CHARS) return { error: `单个单元格不能超过 ${MAX_GRID_CELL_CHARS} 个字符` };
  }
  if (quoted) return { error: "Excel 引号单元格没有闭合，未执行粘贴" };
  if (cell || row.length || !rows.length) { pushRow(); if (parseError) return { error: parseError }; }
  if (rows.length > 1 && rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === "") rows.pop();
  const width = rows[0]?.length || 0;
  if (!width || rows.some((item) => item.length !== width)) return { error: "粘贴区域的每一行列数不同，未执行粘贴" };
  if (rows.some((item) => item.some((itemCell) => /[\t\r\n]/.test(itemCell)))) return { error: "单个 Excel 单元格内含换行或制表符，当前报告表格不支持，未执行粘贴" };
  if (rows.some((item) => item.some((itemCell) => itemCell.length > MAX_GRID_CELL_CHARS))) return { error: `单个单元格不能超过 ${MAX_GRID_CELL_CHARS} 个字符` };
  return { cells: rows };
}

function reconcilePastedStableKeys(kind: CellGridKind, before: CellGridDraft, next: CellGridDraft, startRow: number, startColumn: number, blockRows: number, blockColumns: number) {
  if (kind !== "chart") return;
  const uniqueNameMap = (names: string[], keys: string[]) => {
    const counts = new Map<string, number>();
    names.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
    return new Map(names.flatMap((name, index) => counts.get(name) === 1 ? [[name, keys[index]]] : []));
  };
  if (startColumn === 0 && startRow < next.cells.length && startRow + blockRows > 1) {
    const beforeNames = before.cells.slice(1).map((row) => row[0]);
    const nextNames = next.cells.slice(1).map((row) => row[0]);
    const beforeByName = uniqueNameMap(beforeNames, before.rowKeys.slice(1));
    const isPureReorder = beforeNames.length === nextNames.length && new Set(beforeNames).size === beforeNames.length && new Set(nextNames).size === nextNames.length && nextNames.every((name) => beforeByName.has(name));
    if (isPureReorder) next.rowKeys = ["header", ...nextNames.map((name) => beforeByName.get(name)!)];
    else {
      const firstAffected = Math.max(1, startRow);
      const lastAffected = Math.min(next.cells.length, startRow + blockRows);
      for (let rowIndex = firstAffected; rowIndex < lastAffected; rowIndex += 1) {
        if (before.cells[rowIndex] && before.cells[rowIndex][0] !== next.cells[rowIndex][0]) next.rowKeys[rowIndex] = `point-${uid()}`;
      }
    }
  }
  if (startRow === 0 && startColumn < next.cells[0].length && startColumn + blockColumns > 1) {
    const beforeNames = before.cells[0].slice(1);
    const nextNames = next.cells[0].slice(1);
    const beforeByName = uniqueNameMap(beforeNames, before.columnKeys.slice(1));
    const isPureReorder = beforeNames.length === nextNames.length && new Set(beforeNames).size === beforeNames.length && new Set(nextNames).size === nextNames.length && nextNames.every((name) => beforeByName.has(name));
    if (isPureReorder) next.columnKeys = ["category", ...nextNames.map((name) => beforeByName.get(name)!)];
    else {
      const firstAffected = Math.max(1, startColumn);
      const lastAffected = Math.min(next.cells[0].length, startColumn + blockColumns);
      for (let columnIndex = firstAffected; columnIndex < lastAffected; columnIndex += 1) {
        if (before.cells[0][columnIndex] !== next.cells[0][columnIndex]) next.columnKeys[columnIndex] = `series-${uid()}`;
      }
    }
  }
}

function chartFromCellGrid(draft: CellGridDraft, previous: ChartData, chartKind?: ReportElement["chartKind"]): ChartData {
  const categories = draft.cells.slice(1).map((row) => row[0].trim());
  const series = draft.cells[0].slice(1).map((name, seriesIndex, names) => {
    const id = draft.columnKeys[seriesIndex + 1] || `series-${uid()}`;
    const before = previous.series.find((item) => item.id === id);
    const defaultComboKind = seriesIndex === names.length - 1 ? "line" : "bar";
    return {
      id,
      name: name.trim(),
      values: draft.cells.slice(1).map((row) => parseStrictChartNumber(row[seriesIndex + 1])!),
      kind: before?.kind || (chartKind === "combo" ? defaultComboKind : undefined),
      axis: before?.axis || (chartKind === "combo" ? (defaultComboKind === "line" ? "right" : "left") : undefined),
      unit: before?.unit || ""
    };
  });
  return { categories, categoryIds: draft.rowKeys.slice(1), series };
}

function tableFromCellGrid(draft: CellGridDraft): TableData {
  return {
    headers: draft.cells[0].map((cell) => cell.trim()),
    rows: draft.cells.slice(1).map((row) => row.map((cell) => cell.trim()))
  };
}

function pruneChartLabelOffsets(element: ReportElement, chart: ChartData) {
  if (!element.chartLabels?.offsets) return;
  const validKeys = new Set(chart.series.flatMap((series) => chart.categoryIds!.map((pointId) => chartPointKey(series.id!, pointId))));
  const offsets = clone(element.chartLabels.offsets);
  (["portrait", "landscape"] as const).forEach((orientation) => {
    const byOrientation = offsets[orientation];
    if (!byOrientation) return;
    Object.keys(byOrientation).forEach((key) => { if (!validKeys.has(key)) delete byOrientation[key]; });
    if (!Object.keys(byOrientation).length) delete offsets[orientation];
  });
  element.chartLabels.offsets = offsets;
}

function resolveThemeColor(theme: ReportDocument["theme"], token: string | undefined, fallback: "text" | "paper" | "line" = "text") {
  const colors: Record<string, string> = {
    primary: theme.primary, secondary: theme.secondary, accent: theme.accent, text: theme.text,
    muted: theme.muted, paper: theme.paper, surface: theme.surface, line: theme.line,
    positive: theme.positive, negative: theme.negative
  };
  if (!token) return colors[fallback];
  if (token === "white") return "#ffffff";
  if (token === "transparent") return "transparent";
  return colors[token] || colors[fallback];
}

function elementRuns(element: ReportElement) {
  return element.runs?.length ? element.runs : [{ text: element.content || "" }];
}

type TextEditField =
  | "content"
  | `header:${number}`
  | `cell:${number}:${number}`;

interface TextEditSession {
  pageId: string;
  elementId?: string;
  field: TextEditField;
  value: string;
  originalValue: string;
  runs: TextRun[];
  originalRuns: TextRun[];
  multiline: boolean;
  selectionStart: number;
  selectionEnd: number;
}

type CropAspect = "free" | "current" | "1:1" | "4:3" | "16:9" | "3:1" | "a4";

interface CropEditSession {
  pageId: string;
  elementId: string;
  original: ImageCrop;
  draft: ImageCrop;
  aspect: CropAspect;
}

const DEBUG_TEXT_OVERLAY = new URLSearchParams(window.location.search).get("DEBUG_TEXT_OVERLAY") === "1";

function mergeAdjacentRuns(runs: TextRun[]) {
  return runs.reduce<TextRun[]>((merged, run) => {
    if (!run.text) return merged;
    const marks = [...new Set(run.marks || [])].sort() as NonNullable<TextRun["marks"]>;
    const previous = merged.at(-1);
    if (previous && JSON.stringify([...(previous.marks || [])].sort()) === JSON.stringify(marks)) {
      previous.text += run.text;
    } else {
      merged.push({ text: run.text, marks: marks.length ? marks : undefined });
    }
    return merged;
  }, []);
}

function sliceRuns(runs: TextRun[], start: number, end: number) {
  const result: TextRun[] = [];
  let offset = 0;
  runs.forEach((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;
    const from = Math.max(runStart, start);
    const to = Math.min(runEnd, end);
    if (from < to) result.push({ text: run.text.slice(from - runStart, to - runStart), marks: run.marks ? [...run.marks] : undefined });
  });
  return result;
}

function marksAtOffset(runs: TextRun[], offset: number) {
  let cursor = 0;
  for (const run of runs) {
    const next = cursor + run.text.length;
    if (offset >= cursor && offset < next) return run.marks ? [...run.marks] : undefined;
    cursor = next;
  }
  return runs.at(-1)?.marks ? [...runs.at(-1)!.marks!] : undefined;
}

function replaceRunsText(runs: TextRun[], nextText: string) {
  const currentText = runs.map((run) => run.text).join("");
  if (currentText === nextText) return runs;
  let prefix = 0;
  while (prefix < currentText.length && prefix < nextText.length && currentText[prefix] === nextText[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < currentText.length - prefix &&
    suffix < nextText.length - prefix &&
    currentText[currentText.length - suffix - 1] === nextText[nextText.length - suffix - 1]
  ) suffix += 1;
  const removedEnd = currentText.length - suffix;
  const inserted = nextText.slice(prefix, nextText.length - suffix);
  const inheritedMarks = marksAtOffset(runs, prefix > 0 ? prefix - 1 : prefix);
  return mergeAdjacentRuns([
    ...sliceRuns(runs, 0, prefix),
    ...(inserted ? [{ text: inserted, marks: inheritedMarks }] : []),
    ...sliceRuns(runs, removedEnd, currentText.length)
  ]);
}

function elementFieldValue(element: ReportElement, field: TextEditField) {
  if (field === "content") return element.content || "";
  if (field.startsWith("header:")) return element.table?.headers[Number(field.split(":")[1])] || "";
  const [, row, cell] = field.split(":").map(Number);
  return element.table?.rows[row]?.[cell] || "";
}

function writeElementField(element: ReportElement, field: TextEditField, value: string, runs: TextRun[]) {
  if (field === "content") {
    element.content = value;
    element.runs = mergeAdjacentRuns(runs);
  } else if (field.startsWith("header:") && element.table) {
    element.table.headers[Number(field.split(":")[1])] = value;
  } else if (field.startsWith("cell:") && element.table) {
    const [, row, cell] = field.split(":").map(Number);
    if (element.table.rows[row]) element.table.rows[row][cell] = value;
  }
}

function syncUsedFontSlots(report: ReportDocument) {
  report.usedFontSlots = Array.from(new Set(report.pages.flatMap((page) => page.elements.map((element) =>
    element.style.fontSlot || (element.semanticRole === "kpi-value" ? "numeric" : ["title", "quote-mark"].includes(element.semanticRole || "") ? "display" : "body")
  )))) as ReportDocument["usedFontSlots"];
}

function renderRuns(runs: TextRun[], keyPrefix = "run") {
  return runs.map((run, index) => {
    const marks = run.marks || [];
    return <span key={`${keyPrefix}-${index}`} className={marks.map((mark) => `mark-${mark}`).join(" ")}>{run.text}</span>;
  });
}

function RunsView({ element }: { element: ReportElement }) {
  return <>{renderRuns(elementRuns(element), element.id)}</>;
}

function ImageVisual({ source, asset, crop, focal, frame, imageStyle, theme, className = "" }: {
  source: string;
  asset?: ReportAsset;
  crop?: ImageCrop;
  focal?: { x: number; y: number };
  frame?: { width: number; height: number };
  imageStyle?: ImageStyle;
  theme: ReportDocument["theme"];
  className?: string;
}) {
  const style = imageStyle || DEFAULT_IMAGE_STYLE;
  const first = resolveThemeColor(theme, style.overlayColor, "text");
  const second = resolveThemeColor(theme, style.overlayColor2, "paper");
  const overlayBackground = style.overlayKind === "solid"
    ? first
    : style.overlayKind === "linear" || style.overlayKind === "duotone"
      ? `linear-gradient(${style.overlayAngle}deg, ${first}, ${second})`
      : "transparent";
  let imagePosition: CSSProperties;
  if (crop && asset && frame) {
    const scale = Math.max(frame.width / crop.sw, frame.height / crop.sh);
    const renderedCropWidth = crop.sw * scale;
    const renderedCropHeight = crop.sh * scale;
    imagePosition = {
      width: `${asset.width * scale / frame.width * 100}%`,
      height: `${asset.height * scale / frame.height * 100}%`,
      left: `${((frame.width - renderedCropWidth) / 2 - crop.sx * scale) / frame.width * 100}%`,
      top: `${((frame.height - renderedCropHeight) / 2 - crop.sy * scale) / frame.height * 100}%`
    };
  } else if (crop && asset) {
    imagePosition = {
      width: `${asset.width / crop.sw * 100}%`,
      height: `${asset.height / crop.sh * 100}%`,
      left: `${-crop.sx / crop.sw * 100}%`,
      top: `${-crop.sy / crop.sh * 100}%`
    };
  } else imagePosition = {
    width: "100%",
    height: "100%",
    left: 0,
    top: 0,
    objectFit: "cover",
    objectPosition: `${focal?.x ?? 50}% ${focal?.y ?? 50}%`
  };
  return (
    <span className={`image-visual grade-${style.grade} ${className}`}>
      <img className="image-visual-source" src={source} alt="" style={imagePosition} />
      {style.overlayKind !== "none" && <span className="image-visual-overlay" style={{ background: overlayBackground, opacity: style.strength, mixBlendMode: style.blendMode }} />}
      {style.vignette !== "none" && <span className={`image-visual-vignette ${style.vignette}`} />}
    </span>
  );
}

function constrainCrop(crop: ImageCrop, asset: ReportAsset) {
  const sw = Math.max(16, Math.min(asset.width, crop.sw));
  const sh = Math.max(16, Math.min(asset.height, crop.sh));
  return {
    sx: Math.max(0, Math.min(asset.width - sw, crop.sx)),
    sy: Math.max(0, Math.min(asset.height - sh, crop.sy)),
    sw,
    sh
  };
}

function cropFromFocal(asset: ReportAsset, frame: { width: number; height: number }, focal: { x: number; y: number }) {
  const frameRatio = frame.width / frame.height;
  const assetRatio = asset.width / asset.height;
  const sw = assetRatio > frameRatio ? asset.height * frameRatio : asset.width;
  const sh = assetRatio > frameRatio ? asset.height : asset.width / frameRatio;
  return constrainCrop({ sx: (asset.width - sw) * focal.x / 100, sy: (asset.height - sh) * focal.y / 100, sw, sh }, asset);
}

function cropRatio(aspect: CropAspect, current: ImageCrop) {
  if (aspect === "current") return current.sw / current.sh;
  if (aspect === "1:1") return 1;
  if (aspect === "4:3") return 4 / 3;
  if (aspect === "16:9") return 16 / 9;
  if (aspect === "3:1") return 3;
  if (aspect === "a4") return 210 / 297;
  return null;
}

function cropWithAspect(current: ImageCrop, aspect: CropAspect, asset: ReportAsset) {
  const ratio = cropRatio(aspect, current);
  if (!ratio) return current;
  const centerX = current.sx + current.sw / 2;
  const centerY = current.sy + current.sh / 2;
  let sw = current.sw;
  let sh = sw / ratio;
  if (sh > asset.height) { sh = asset.height; sw = sh * ratio; }
  if (sw > asset.width) { sw = asset.width; sh = sw / ratio; }
  return constrainCrop({ sx: centerX - sw / 2, sy: centerY - sh / 2, sw, sh }, asset);
}

function ImageCropEditor({ source, asset, session, frame, imageStyle, theme, onChange, onFinish }: {
  source: string;
  asset: ReportAsset;
  session: CropEditSession;
  frame: { width: number; height: number };
  imageStyle?: ImageStyle;
  theme: ReportDocument["theme"];
  onChange: (crop: ImageCrop, aspect?: CropAspect) => void;
  onFinish: (mode: "commit" | "cancel") => void;
}) {
  const startGesture = (event: ReactPointerEvent<HTMLElement>, handle?: ResizeDirection) => {
    if ((event.target as HTMLElement).closest("button,select")) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const origin = clone(session.draft);
    const ratio = cropRatio(session.aspect, origin);
    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / rect.width * origin.sw;
      const dy = (moveEvent.clientY - startY) / rect.height * origin.sh;
      if (!handle) {
        onChange(constrainCrop({ ...origin, sx: origin.sx - dx, sy: origin.sy - dy }, asset));
        return;
      }
      let { sx, sy, sw, sh } = origin;
      if (handle.includes("e")) sw += dx;
      if (handle.includes("s")) sh += dy;
      if (handle.includes("w")) { sx += dx; sw -= dx; }
      if (handle.includes("n")) { sy += dy; sh -= dy; }
      if (ratio && !moveEvent.shiftKey) {
        if (handle === "e" || handle === "w") {
          const centerY = origin.sy + origin.sh / 2;
          sh = sw / ratio;
          sy = centerY - sh / 2;
        } else {
          const centerX = origin.sx + origin.sw / 2;
          sw = sh * ratio;
          sx = centerX - sw / 2;
        }
      }
      onChange(constrainCrop({ sx, sy, sw, sh }, asset));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };
  const zoomAtPointer = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = session.draft;
    const scale = event.deltaY < 0 ? 0.9 : 1.1;
    const nextSw = Math.max(16, Math.min(asset.width, origin.sw * scale));
    const nextSh = Math.max(16, Math.min(asset.height, origin.sh * scale));
    const anchorX = origin.sx + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * origin.sw;
    const anchorY = origin.sy + Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) * origin.sh;
    const ratioX = (anchorX - origin.sx) / origin.sw;
    const ratioY = (anchorY - origin.sy) / origin.sh;
    onChange(constrainCrop({ sx: anchorX - nextSw * ratioX, sy: anchorY - nextSh * ratioY, sw: nextSw, sh: nextSh }, asset));
  };
  return <div className="crop-editor" onWheel={zoomAtPointer} onPointerDown={(event) => startGesture(event)} onDoubleClick={(event) => { event.stopPropagation(); onFinish("commit"); }}>
    <img className="crop-full-image" src={source} alt="裁切范围参考" />
    <ImageVisual source={source} asset={asset} crop={session.draft} frame={frame} imageStyle={imageStyle} theme={theme} className="crop-result" />
    {HANDLES.map((handle) => <span key={handle} className={`crop-handle crop-${handle}`} onPointerDown={(event) => startGesture(event, handle)} />)}
    <div className="crop-toolbar" onDoubleClick={(event) => event.stopPropagation()}>
      <span className="crop-hint">滚轮缩放 · 拖动取景</span>
      <select aria-label="裁切比例" value={session.aspect} onChange={(event) => {
        const aspect = event.target.value as CropAspect;
        onChange(cropWithAspect(session.draft, aspect, asset), aspect);
      }}><option value="free">自由</option><option value="current">当前框</option><option value="1:1">1:1</option><option value="4:3">4:3</option><option value="16:9">16:9</option><option value="3:1">3:1 横幅</option><option value="a4">A4 整页</option></select>
      <button type="button" onClick={() => onFinish("cancel")}>取消</button>
      <button type="button" className="primary" onClick={() => onFinish("commit")}>完成</button>
    </div>
  </div>;
}

type TextEditFinishMode = "commit" | "cancel" | "next";

function NativeTextEditor({
  session,
  onInput,
  onSelection,
  onFinish
}: {
  session: TextEditSession;
  onInput: (value: string, selectionStart: number, selectionEnd: number) => void;
  onSelection: (selectionStart: number, selectionEnd: number) => void;
  onFinish: (mode: TextEditFinishMode) => void;
}) {
  const controlRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const pendingBlurRef = useRef(false);
  const usesRunsMirror = session.field === "content" && session.runs.some((run) => Boolean(run.marks?.length));

  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;
    control.focus();
    control.setSelectionRange(session.selectionStart, session.selectionEnd);
  }, [session.elementId, session.field, session.pageId]);

  const syncScroll = () => {
    if (!controlRef.current || !mirrorRef.current) return;
    mirrorRef.current.scrollTop = controlRef.current.scrollTop;
    mirrorRef.current.scrollLeft = controlRef.current.scrollLeft;
  };
  const publish = (control: HTMLInputElement | HTMLTextAreaElement) => {
    onInput(control.value, control.selectionStart || 0, control.selectionEnd || 0);
    syncScroll();
  };
  const publishSelection = (control: HTMLInputElement | HTMLTextAreaElement) => {
    onSelection(control.selectionStart || 0, control.selectionEnd || 0);
  };
  const shared = {
    ref: (node: HTMLInputElement | HTMLTextAreaElement | null) => { controlRef.current = node; },
    defaultValue: session.value,
    className: "text-edit-metrics text-edit-control",
    spellCheck: false,
    "aria-label": "页内文本编辑",
    onInput: (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!composingRef.current) publish(event.currentTarget);
    },
    onSelect: (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => publishSelection(event.currentTarget),
    onScroll: syncScroll,
    onCompositionStart: () => { composingRef.current = true; },
    onCompositionEnd: (event: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composingRef.current = false;
      publish(event.currentTarget);
      if (pendingBlurRef.current) {
        pendingBlurRef.current = false;
        queueMicrotask(() => onFinish("commit"));
      }
    },
    onPaste: (event: React.ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.preventDefault();
      const control = event.currentTarget;
      const plain = event.clipboardData.getData("text/plain");
      const value = session.multiline ? plain.replace(/\r\n?/g, "\n") : plain.replace(/\s+/g, " ");
      control.setRangeText(value, control.selectionStart || 0, control.selectionEnd || 0, "end");
      publish(control);
    },
    onBlur: () => {
      if (composingRef.current) pendingBlurRef.current = true;
      else onFinish("commit");
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        onFinish("cancel");
      } else if (event.key === "Tab") {
        event.preventDefault();
        onFinish("next");
      } else if (event.key === "Enter" && (!session.multiline || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onFinish("commit");
      }
    }
  } as const;

  return (
    <span
      className={`text-edit-host ${session.multiline ? "multiline" : "singleline"} ${usesRunsMirror ? "uses-runs-mirror" : "plain-native-edit"} ${DEBUG_TEXT_OVERLAY ? "debug-text-overlay" : ""}`}
      style={session.multiline ? undefined : { width: `${Math.max(2, session.value.length + 1)}ch`, maxWidth: "100%" }}
    >
      {usesRunsMirror && <span ref={mirrorRef} className="text-edit-metrics text-edit-mirror" aria-hidden="true">
        {renderRuns(session.runs, `editing-${session.elementId || session.field}`)}
      </span>}
      {session.multiline
        ? <textarea {...shared} />
        : <input {...shared} type="text" />}
    </span>
  );
}

function toggleRunMark(runs: TextRun[], start: number, end: number, mark: NonNullable<TextRun["marks"]>[number]) {
  const length = runs.reduce((sum, run) => sum + run.text.length, 0);
  const from = Math.max(0, Math.min(length, start));
  const to = Math.max(from, Math.min(length, end > start ? end : length));
  const affected = runs.filter((run, index) => {
    const runStart = runs.slice(0, index).reduce((sum, item) => sum + item.text.length, 0);
    return runStart < to && runStart + run.text.length > from;
  });
  const shouldRemove = affected.length > 0 && affected.every((run) => run.marks?.includes(mark));
  const result: TextRun[] = [];
  let offset = 0;
  runs.forEach((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    offset = runEnd;
    const overlapStart = Math.max(runStart, from);
    const overlapEnd = Math.min(runEnd, to);
    const push = (text: string, marks = run.marks) => { if (text) result.push({ text, marks: marks?.length ? [...marks] : undefined }); };
    if (overlapStart >= overlapEnd) {
      push(run.text);
      return;
    }
    push(run.text.slice(0, overlapStart - runStart));
    const marks = new Set(run.marks || []);
    if (shouldRemove) marks.delete(mark); else marks.add(mark);
    push(run.text.slice(overlapStart - runStart, overlapEnd - runStart), [...marks]);
    push(run.text.slice(overlapEnd - runStart));
  });
  return result.reduce<TextRun[]>((merged, run) => {
    const previous = merged.at(-1);
    const sameMarks = JSON.stringify(previous?.marks || []) === JSON.stringify(run.marks || []);
    if (previous && sameMarks) previous.text += run.text; else merged.push(run);
    return merged;
  }, []);
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(value);
}

interface ChartPointSelection {
  elementId: string;
  seriesId: string;
  pointId: string;
  seriesName: string;
  categoryName: string;
}

function chartPointKey(seriesId: string, pointId: string) {
  return `${seriesId}::${pointId}`;
}

function chartLabelIsVisible(element: ReportElement, seriesIndex: number, dataIndex: number) {
  const chart = element.chart;
  const series = chart?.series[seriesIndex];
  if (!chart || !series || element.style.showLabel === false || element.chartLabels?.mode === "off") return false;
  const mode = element.chartLabels?.mode || "auto";
  if (mode === "all" || mode === "auto") return true;
  const finite = series.values.map((value, index) => Number.isFinite(value) ? index : -1).filter((index) => index >= 0);
  if (!finite.length) return false;
  const first = finite[0];
  const last = finite[finite.length - 1];
  const minimum = finite.reduce((best, index) => series.values[index] < series.values[best] ? index : best, first);
  const maximum = finite.reduce((best, index) => series.values[index] > series.values[best] ? index : best, first);
  if (mode === "key") return [first, last, minimum, maximum].includes(dataIndex);
  const every = element.chartLabels?.sparseEvery || 2;
  return dataIndex === first || dataIndex === last || dataIndex === minimum || dataIndex === maximum || dataIndex % every === 0;
}

async function prepareChartsForPrint() {
  chartInstances.forEach((instance) => {
    instance.setOption({ animation: false }, { lazyUpdate: false });
    instance.resize({ animation: { duration: 0 } });
  });
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
}

function EChart({
  element,
  document,
  printing,
  orientation,
  pxPerMm,
  selectedLabel,
  onSelectLabel,
  onMoveLabel
}: {
  element: ReportElement;
  document: ReportDocument;
  printing: boolean;
  orientation: Orientation;
  pxPerMm: number;
  selectedLabel?: ChartPointSelection | null;
  onSelectLabel?: (selection: ChartPointSelection) => void;
  onMoveLabel?: (selection: ChartPointSelection, dxMm: number, dyMm: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = element.chart;

  useEffect(() => {
    if (!ref.current || !chart) return;
    const instance = echarts.init(ref.current, undefined, { renderer: "svg" });
    chartInstances.add(instance);
    const palette = document.theme.chartPalette;
    const base: echarts.EChartsOption = {
      animation: false,
      color: palette,
      textStyle: { fontFamily: document.theme.fontFamily, color: document.theme.text },
      legend: element.style.showLegend === false ? undefined : {
        top: 0,
        right: 2,
        itemWidth: 8,
        itemHeight: 5,
        textStyle: { fontSize: printing ? 6.5 : 8.5, color: document.theme.muted }
      },
      tooltip: printing ? undefined : { trigger: "axis", confine: true },
      grid: { left: 8, right: 9, top: 18, bottom: 14, containLabel: true }
    };
    const labelLayout = (params: { seriesIndex?: number; dataIndex?: number }) => {
      const seriesIndex = Number(params.seriesIndex);
      const dataIndex = Number(params.dataIndex);
      const series = chart.series[seriesIndex];
      const seriesId = series?.id || `series-${seriesIndex + 1}`;
      const pointId = chart.categoryIds?.[dataIndex] || `point-${dataIndex + 1}`;
      const offset = element.chartLabels?.offsets?.[orientation]?.[chartPointKey(seriesId, pointId)];
      const selected = !printing && selectedLabel?.elementId === element.id && selectedLabel.seriesId === seriesId && selectedLabel.pointId === pointId;
      return {
        dx: (offset?.dx || 0) * pxPerMm,
        dy: (offset?.dy || 0) * pxPerMm,
        draggable: Boolean(selected),
        hideOverlap: element.chartLabels?.mode === "auto"
      };
    };
    let option: echarts.EChartsOption;
    if (element.chartKind === "donut") {
      option = {
        ...base,
        tooltip: printing ? undefined : { trigger: "item", formatter: "{b}<br/>{c} ({d}%)" },
        series: [
          {
            name: chart.series[0]?.name,
            type: "pie",
            radius: ["40%", "62%"],
            center: ["50%", "58%"],
            avoidLabelOverlap: true,
            itemStyle: { borderColor: document.theme.paper, borderWidth: 2 },
            labelLayout,
            label: element.style.showLabel === false || element.chartLabels?.mode === "off" ? { show: false } : {
              show: true,
              formatter: (params: { dataIndex: number; name: string; percent?: number }) => chartLabelIsVisible(element, 0, params.dataIndex) ? `${params.name}\n${formatNumber(params.percent ?? 0)}%` : "",
              fontSize: printing ? 6.5 : 8.5,
              lineHeight: printing ? 8.5 : 11,
              alignTo: "edge",
              edgeDistance: printing ? 4 : 6,
              bleedMargin: 2,
              overflow: "break",
              color: document.theme.muted
            },
            labelLine: { length: printing ? 5 : 7, length2: printing ? 4 : 6 },
            data: chart.categories.map((name, index) => ({ id: chart.categoryIds?.[index], name, value: chart.series[0]?.values[index] ?? 0 }))
          }
        ]
      };
    } else {
      const isBar = element.chartKind === "bar";
      const isCombo = element.chartKind === "combo";
      const axisText = { fontSize: printing ? 6.5 : 8.5, color: document.theme.muted };
      const leftUnit = chart.series.find((series) => (series.axis || "left") === "left")?.unit || "";
      const rightUnit = chart.series.find((series) => series.axis === "right")?.unit || "";
      option = {
        ...base,
        xAxis: {
          type: "category",
          data: chart.categories,
          axisLine: { lineStyle: { color: document.theme.line } },
          axisTick: { show: false },
          axisLabel: { fontSize: printing ? 6.5 : 8.5, color: document.theme.muted }
        },
        yAxis: isCombo ? [
          {
            type: "value",
            position: "left",
            name: leftUnit,
            nameTextStyle: axisText,
            splitLine: { lineStyle: { color: document.theme.line, opacity: 0.55 } },
            axisLabel: axisText
          },
          {
            type: "value",
            position: "right",
            name: rightUnit,
            nameTextStyle: axisText,
            splitLine: { show: false },
            axisLine: { show: true, lineStyle: { color: document.theme.line } },
            axisLabel: axisText
          }
        ] : {
          type: "value",
          splitLine: { lineStyle: { color: document.theme.line, opacity: 0.55 } },
          axisLabel: axisText
        },
        series: chart.series.map((series, seriesIndex) => {
          const kind = isCombo ? (series.kind || (seriesIndex === chart.series.length - 1 ? "line" : "bar")) : isBar ? "bar" : "line";
          const seriesIsBar = kind === "bar";
          return {
            id: series.id,
            name: series.name,
            type: kind,
            yAxisIndex: isCombo && series.axis === "right" ? 1 : 0,
            data: series.values,
            barMaxWidth: 24,
            symbolSize: 5,
            smooth: !seriesIsBar,
            lineStyle: { width: 2.2 },
            itemStyle: { color: palette[seriesIndex % palette.length] },
            labelLayout,
            label: element.style.showLabel === false || element.chartLabels?.mode === "off" ? { show: false } : {
              show: true,
              position: "top",
              formatter: (params: { dataIndex: number; value: number }) => {
                return chartLabelIsVisible(element, seriesIndex, params.dataIndex) ? formatNumber(params.value) : "";
              },
              fontSize: printing ? 6.5 : 8,
              color: palette[seriesIndex % palette.length]
            }
          };
        }) as echarts.SeriesOption[]
      };
    }
    instance.setOption(option);
    const selectLabel = (params: { componentType?: string; seriesIndex?: number; dataIndex?: number }) => {
      if (printing || params.componentType !== "series" || params.seriesIndex === undefined || params.dataIndex === undefined) return;
      const series = chart.series[params.seriesIndex];
      if (!series) return;
      const pointId = chart.categoryIds?.[params.dataIndex] || `point-${params.dataIndex + 1}`;
      onSelectLabel?.({
        elementId: element.id,
        seriesId: series.id || `series-${params.seriesIndex + 1}`,
        pointId,
        seriesName: series.name,
        categoryName: chart.categories[params.dataIndex] || `第 ${params.dataIndex + 1} 项`
      });
    };
    instance.on("click", selectLabel);
    let dragStart: { x: number; y: number } | null = null;
    const zr = instance.getZr();
    const onDragStart = (event: { target?: { x?: number; y?: number } }) => {
      if (!selectedLabel || selectedLabel.elementId !== element.id) return;
      dragStart = { x: Number(event.target?.x) || 0, y: Number(event.target?.y) || 0 };
    };
    const onDragEnd = (event: { target?: { x?: number; y?: number } }) => {
      if (!dragStart || !selectedLabel || selectedLabel.elementId !== element.id) return;
      const dxMm = ((Number(event.target?.x) || 0) - dragStart.x) / pxPerMm;
      const dyMm = ((Number(event.target?.y) || 0) - dragStart.y) / pxPerMm;
      dragStart = null;
      if (Math.abs(dxMm) > 0.01 || Math.abs(dyMm) > 0.01) onMoveLabel?.(selectedLabel, dxMm, dyMm);
    };
    zr.on("dragstart", onDragStart);
    zr.on("dragend", onDragEnd);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      instance.off("click", selectLabel);
      zr.off("dragstart", onDragStart);
      zr.off("dragend", onDragEnd);
      chartInstances.delete(instance);
      instance.dispose();
    };
  }, [chart, document.theme, element, onMoveLabel, onSelectLabel, orientation, printing, pxPerMm, selectedLabel]);

  return <div className="chart-root" ref={ref} />;
}

function MasterChrome({ document, page, assetData, printing, pxPerMm, cropEdit, onCropChange, onCropFinish, onDoubleClick }: {
  document: ReportDocument;
  page: ReportPage;
  assetData: Record<string, string>;
  printing: boolean;
  pxPerMm: number;
  cropEdit?: CropEditSession | null;
  onCropChange?: (crop: ImageCrop, aspect?: CropAspect) => void;
  onCropFinish?: (mode: "commit" | "cancel") => void;
  onDoubleClick?: () => void;
}) {
  const props = page.masterProps || {};
  const image = props.imageAssetId ? assetData[props.imageAssetId] : undefined;
  const focal = props.focal || { x: 50, y: 50 };
  const unit = (value: number) => printing ? `${value}mm` : `${value * pxPerMm}px`;
  const slotStyle = page.master === "section" ? { height: unit(70) } : { inset: 0 };
  const asset = document.assets.find((item) => item.id === props.imageAssetId);
  const frame = { width: PAGE_MM[page.orientation].width, height: page.master === "section" ? 70 : PAGE_MM[page.orientation].height };
  return (
    <div className={`master-chrome master-${page.master}`} aria-hidden={printing}>
      {image && <div className={`master-image-slot ${cropEdit?.elementId === MASTER_CROP_ELEMENT_ID ? "crop-editing" : ""}`} style={slotStyle} onDoubleClick={(event) => { if (!printing) { event.stopPropagation(); onDoubleClick?.(); } }}>
        {asset && cropEdit?.elementId === MASTER_CROP_ELEMENT_ID
          ? <ImageCropEditor source={image} asset={asset} session={cropEdit} frame={frame} imageStyle={props.imageStyle} theme={document.theme} onChange={onCropChange!} onFinish={onCropFinish!} />
          : <ImageVisual source={image} asset={asset} crop={props.crop} focal={focal} frame={frame} imageStyle={props.imageStyle} theme={document.theme} className="master-image-visual" />}
      </div>}
    </div>
  );
}

function ElementBody({
  element,
  document,
  orientation,
  pxPerMm,
  printing,
  textEdit,
  onTextInput,
  onTextSelection,
  onTextFinish,
  cropEdit,
  onCropChange,
  onCropFinish,
  selectedChartLabel,
  onSelectChartLabel,
  onMoveChartLabel,
  assetData
}: {
  element: ReportElement;
  document: ReportDocument;
  orientation: Orientation;
  pxPerMm: number;
  printing: boolean;
  textEdit?: TextEditSession | null;
  onTextInput?: (value: string, start: number, end: number) => void;
  onTextSelection?: (start: number, end: number) => void;
  onTextFinish?: (mode: TextEditFinishMode) => void;
  cropEdit?: CropEditSession | null;
  onCropChange?: (crop: ImageCrop, aspect?: CropAspect) => void;
  onCropFinish?: (mode: "commit" | "cancel") => void;
  selectedChartLabel?: ChartPointSelection | null;
  onSelectChartLabel?: (selection: ChartPointSelection) => void;
  onMoveChartLabel?: (selection: ChartPointSelection, dxMm: number, dyMm: number) => void;
  assetData: Record<string, string>;
}) {
  const field = (name: TextEditField, value: React.ReactNode, multiline: boolean) => (
    !printing && textEdit?.field === name
      ? <NativeTextEditor session={textEdit} onInput={onTextInput!} onSelection={onTextSelection!} onFinish={onTextFinish!} />
      : value
  );
  if (element.type === "chart") {
    return <EChart element={element} document={document} orientation={orientation} pxPerMm={pxPerMm} printing={printing} selectedLabel={selectedChartLabel} onSelectLabel={onSelectChartLabel} onMoveLabel={onMoveChartLabel} />;
  }
  if (element.type === "table" && element.table) {
    return (
      <div className="report-table-wrap">
        <table className="report-table">
          <thead><tr>{element.table.headers.map((header, index) => <th data-edit-field={`header:${index}`} key={`${header}-${index}`}>{field(`header:${index}`, header, false)}</th>)}</tr></thead>
          <tbody>
            {element.table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>{row.map((cell, cellIndex) => <td data-edit-field={`cell:${rowIndex}:${cellIndex}`} key={cellIndex}>{field(`cell:${rowIndex}:${cellIndex}`, cell, false)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (element.type === "image") {
    const image = element.assetId ? assetData[element.assetId] : element.image;
    const asset = document.assets.find((item) => item.id === element.assetId);
    if (image && asset && cropEdit?.elementId === element.id) return <ImageCropEditor source={image} asset={asset} session={cropEdit} frame={{ width: element.w, height: element.h }} imageStyle={element.imageStyle} theme={document.theme} onChange={onCropChange!} onFinish={onCropFinish!} />;
    return image ? <ImageVisual source={image} asset={asset} crop={element.crop} frame={{ width: element.w, height: element.h }} imageStyle={element.imageStyle} theme={document.theme} className="report-image" /> : (
      <div className="image-placeholder"><ImageIcon size={22} strokeWidth={1.4} /><span>{element.content}</span></div>
    );
  }
  if (element.type === "divider" || element.type === "box") return null;
  return <div className="text-body" data-edit-field="content">{field("content", <RunsView element={element} />, true)}</div>;
}

interface ReportPageViewProps {
  document: ReportDocument;
  page: ReportPage;
  assetData: Record<string, string>;
  printing?: boolean;
  pxPerMm?: number;
  selectedIds?: Set<string>;
  textEdit?: TextEditSession | null;
  cropEdit?: CropEditSession | null;
  onElementPointerDown?: (event: ReactPointerEvent, id: string) => void;
  onResizePointerDown?: (event: ReactPointerEvent, id: string, direction: ResizeDirection) => void;
  onElementDoubleClick?: (id: string, field: string) => void;
  onTextInput?: (value: string, start: number, end: number) => void;
  onTextSelection?: (start: number, end: number) => void;
  onTextFinish?: (mode: TextEditFinishMode) => void;
  onCropChange?: (crop: ImageCrop, aspect?: CropAspect) => void;
  onCropFinish?: (mode: "commit" | "cancel") => void;
  onMasterImageDoubleClick?: () => void;
  onFormatElement?: (id: string, recipe: (element: ReportElement) => void) => void;
  onToggleRunMark?: (id: string, mark: NonNullable<TextRun["marks"]>[number]) => void;
  selectedChartLabel?: ChartPointSelection | null;
  onSelectChartLabel?: (selection: ChartPointSelection) => void;
  onMoveChartLabel?: (selection: ChartPointSelection, dxMm: number, dyMm: number) => void;
  onEditChartData?: (id: string) => void;
  onEditTableData?: (id: string) => void;
  onSetChartLabelMode?: (id: string, mode: ChartLabelMode) => void;
  onResetSelectedChartLabel?: (id: string) => void;
  onResetChartLabels?: (id: string) => void;
  isElementProtected?: (id: string) => boolean;
  preventFactualDuplicates?: boolean;
  onDuplicateElement?: (id: string) => void;
  onToggleElementLock?: (id: string) => void;
  onToggleElementHidden?: (id: string) => void;
  onDeleteElement?: (id: string) => void;
  onCanvasPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  guides?: { x: number[]; y: number[] };
  selectionBox?: { x: number; y: number; w: number; h: number } | null;
}

function ReportPageView({
  document,
  page,
  assetData,
  printing = false,
  pxPerMm = BASE_PX_PER_MM,
  selectedIds = new Set(),
  textEdit,
  cropEdit,
  onElementPointerDown,
  onResizePointerDown,
  onElementDoubleClick,
  onTextInput,
  onTextSelection,
  onTextFinish,
  onCropChange,
  onCropFinish,
  onMasterImageDoubleClick,
  onFormatElement,
  onToggleRunMark,
  selectedChartLabel,
  onSelectChartLabel,
  onMoveChartLabel,
  onEditChartData,
  onEditTableData,
  onSetChartLabelMode,
  onResetSelectedChartLabel,
  onResetChartLabels,
  isElementProtected,
  preventFactualDuplicates = false,
  onDuplicateElement,
  onToggleElementLock,
  onToggleElementHidden,
  onDeleteElement,
  onCanvasPointerDown,
  canvasRef,
  guides = { x: [], y: [] },
  selectionBox
}: ReportPageViewProps) {
  const size = PAGE_MM[page.orientation];
  const themeVars = {
    "--report-primary": document.theme.primary,
    "--report-secondary": document.theme.secondary,
    "--report-accent": document.theme.accent,
    "--report-text": document.theme.text,
    "--report-muted": document.theme.muted,
    "--report-paper": document.theme.paper,
    "--report-surface": document.theme.surface,
    "--report-line": document.theme.line,
    "--report-positive": document.theme.positive,
    "--report-negative": document.theme.negative,
    "--report-font": document.theme.fontFamily,
    width: printing ? `${size.width}mm` : `${size.width * pxPerMm}px`,
    height: printing ? `${size.height}mm` : `${size.height * pxPerMm}px`
  } as CSSProperties;

  const positionStyle = (element: ReportElement): CSSProperties => {
    const unit = (value: number) => printing ? `${value}mm` : `${value * pxPerMm}px`;
    const fontSize = element.style.fontSize || 10;
    return {
      left: unit(element.x),
      top: unit(element.y),
      width: unit(element.w),
      height: unit(element.h),
      zIndex: element.z,
      color: resolveThemeColor(document.theme, element.style.color),
      background: element.style.background ? resolveThemeColor(document.theme, element.style.background, "paper") : "transparent",
      borderColor: element.style.borderColor ? resolveThemeColor(document.theme, element.style.borderColor, "line") : "transparent",
      borderWidth: element.style.borderWidth ? unit(element.style.borderWidth) : 0,
      borderStyle: element.style.borderWidth ? "solid" : undefined,
      borderRadius: unit(element.style.radius || 0),
      padding: unit(element.style.padding || 0),
      opacity: element.style.opacity ?? 1,
      fontSize: printing ? `${fontSize}pt` : `${fontSize * 0.3528 * pxPerMm}px`,
      fontWeight: element.style.fontWeight,
      fontFamily: document.theme.fontSlots[element.style.fontSlot || (element.semanticRole === "kpi-value" ? "numeric" : ["title", "quote-mark"].includes(element.semanticRole || "") ? "display" : "body")],
      lineHeight: element.style.lineHeight,
      textAlign: element.style.align,
      alignItems: element.style.verticalAlign === "center" ? "center" : element.style.verticalAlign === "end" ? "flex-end" : "flex-start",
      display: element.hidden ? "none" : "flex"
    };
  };

  return (
    <div
      ref={canvasRef}
      className={`report-page ${page.orientation} master-${page.master} ${page.masterProps?.imageAssetId && assetData[page.masterProps.imageAssetId] ? "has-master-image" : ""} ${printing ? "print-page" : "editor-page"} ${document.pageSetup.showGrid && !printing ? "show-grid" : ""}`}
      style={{ ...themeVars, "--editor-grid": `${document.pageSetup.grid * pxPerMm}px` } as CSSProperties}
      onPointerDown={onCanvasPointerDown}
      data-page-id={page.id}
    >
      <MasterChrome document={document} page={page} assetData={assetData} printing={printing} pxPerMm={pxPerMm} cropEdit={cropEdit?.elementId === MASTER_CROP_ELEMENT_ID ? cropEdit : null} onCropChange={onCropChange} onCropFinish={onCropFinish} onDoubleClick={onMasterImageDoubleClick} />
      {!printing && guides.x.map((x) => <div className="snap-guide vertical" style={{ left: x * pxPerMm }} key={`x-${x}`} />)}
      {!printing && guides.y.map((y) => <div className="snap-guide horizontal" style={{ top: y * pxPerMm }} key={`y-${y}`} />)}
      {page.elements.slice().sort((a, b) => a.z - b.z).map((element) => {
        const selected = selectedIds.has(element.id);
        return (
          <div
            className={`report-element type-${element.type} ${element.semanticRole ? `semantic-${element.semanticRole}` : ""} ${element.groupId ? "grouped" : ""} ${element.role ? `role-${element.role}` : ""} ${selected ? "selected" : ""} ${element.locked ? "locked" : ""} ${cropEdit?.elementId === element.id ? "crop-editing" : ""}`}
            style={positionStyle(element)}
            key={element.id}
            data-element-id={element.id}
            data-element-role={element.role}
            data-group-id={element.groupId}
            onPointerDown={(event) => {
              const target = event.target as Element;
              if (element.type === "chart" && target.tagName.toLowerCase() === "text" && target.closest(".chart-root")) {
                event.stopPropagation();
                return;
              }
              onElementPointerDown?.(event, element.id);
            }}
            onDoubleClick={(event) => onElementDoubleClick?.(element.id, (event.target as HTMLElement).closest<HTMLElement>("[data-edit-field]")?.dataset.editField || "content")}
          >
            <ElementBody
              element={element}
              document={document}
              orientation={page.orientation}
              pxPerMm={printing ? 96 / 25.4 : pxPerMm}
              printing={printing}
              textEdit={textEdit?.elementId === element.id ? textEdit : null}
              onTextInput={onTextInput}
              onTextSelection={onTextSelection}
              onTextFinish={onTextFinish}
              cropEdit={cropEdit?.elementId === element.id ? cropEdit : null}
              onCropChange={onCropChange}
              onCropFinish={onCropFinish}
              selectedChartLabel={selectedChartLabel?.elementId === element.id ? selectedChartLabel : null}
              onSelectChartLabel={onSelectChartLabel}
              onMoveChartLabel={onMoveChartLabel}
              assetData={assetData}
            />
            {!printing && selected && selectedIds.size === 1 && !element.locked && cropEdit?.elementId !== element.id && HANDLES.map((direction) => (
              <span
                className={`resize-handle handle-${direction}`}
                key={direction}
                onPointerDown={(event) => onResizePointerDown?.(event, element.id, direction)}
              />
            ))}
            {!printing && element.locked && selected && <span className="lock-indicator"><Lock size={10} /></span>}
          </div>
        );
      })}
      {!printing && selectedIds.size >= 1 && (() => {
        const selected = page.elements.filter((item) => selectedIds.has(item.id));
        const selectedDataElements = selected.filter((item) => item.type === "chart" || item.type === "table");
        const element = selected.length === 1 ? selected[0] : selectedDataElements.length === 1 ? selectedDataElements[0] : null;
        if (!element) return null;
        if (element.type === "text" && selected.length === 1) return <TextToolbar element={element} page={page} theme={document.theme} pxPerMm={pxPerMm} onUpdate={(recipe) => onFormatElement?.(element.id, recipe)} onToggleMark={(mark) => onToggleRunMark?.(element.id, mark)} />;
        const elementProtected = isElementProtected?.(element.id) || false;
        const duplicateProtected = elementProtected || (preventFactualDuplicates && ["text", "chart", "table"].includes(element.type));
        return <ObjectToolbar
          element={element}
          page={page}
          pxPerMm={pxPerMm}
          selectedChartLabel={selectedChartLabel?.elementId === element.id ? selectedChartLabel : null}
          chartDataProtected={elementProtected}
          duplicateProtected={duplicateProtected}
          deleteProtected={elementProtected}
          onEditChartData={() => onEditChartData?.(element.id)}
          onEditTableData={() => onEditTableData?.(element.id)}
          onSetChartLabelMode={(mode) => onSetChartLabelMode?.(element.id, mode)}
          onResetSelectedChartLabel={() => onResetSelectedChartLabel?.(element.id)}
          onResetChartLabels={() => onResetChartLabels?.(element.id)}
          onDuplicate={() => onDuplicateElement?.(element.id)}
          onToggleLock={() => onToggleElementLock?.(element.id)}
          onToggleHidden={() => onToggleElementHidden?.(element.id)}
          onDelete={() => onDeleteElement?.(element.id)}
        />;
      })()}
      {!printing && selectionBox && (
        <div className="selection-box" style={{
          left: selectionBox.x * pxPerMm,
          top: selectionBox.y * pxPerMm,
          width: selectionBox.w * pxPerMm,
          height: selectionBox.h * pxPerMm
        }} />
      )}
    </div>
  );
}

type RuntimeDraftValue = string | boolean;

function runtimeStorageKey(reportPackage: ReportPackageDefinition) {
  return `local-report-runtime:${reportPackage.id}`;
}

function legacyRuntimeStorageKey(reportPackage: ReportPackageDefinition) {
  return `local-report-runtime:${reportPackage.id}:${reportPackage.version}`;
}

function runtimeVisualStorageKey(reportPackage: ReportPackageDefinition) {
  return `local-report-visual:${reportPackage.id}`;
}

function runtimeAssetNamespace(reportPackage: ReportPackageDefinition) {
  return `report-package:${reportPackage.id}`;
}

function loadRuntimeVisualOverrides(reportPackage: ReportPackageDefinition) {
  try {
    const raw = localStorage.getItem(runtimeVisualStorageKey(reportPackage));
    if (!raw) return { overrides: null as VisualOverrideSet | null, warning: "" };
    const parsed = JSON.parse(raw) as VisualOverrideSet;
    if (parsed.format !== "cosco-report-visual-overrides" || parsed.schemaVersion !== "1" || parsed.packageId !== reportPackage.id) {
      return { overrides: null as VisualOverrideSet | null, warning: "视觉精修存档与当前报告包不匹配，已忽略" };
    }
    return { overrides: parsed, warning: parsed.packageVersion === reportPackage.version ? "" : "报告包版本已变化，已按稳定元素 ID 重放视觉精修" };
  } catch {
    return { overrides: null as VisualOverrideSet | null, warning: "视觉精修存档无法读取，已忽略" };
  }
}

function protectedReportElementIds(reportPackage: ReportPackageDefinition, document?: ReportDocument) {
  const ids = new Set<string>();
  reportPackage.pages.forEach((page) => page.elements.forEach((element) => {
    if (element.contentTemplate || element.chartBinding || element.tableBinding) ids.add(element.id);
  }));
  document?.pages.forEach((page) => page.elements.forEach((element) => {
    if (element.role) ids.add(element.id);
  }));
  return ids;
}

function sameVisualOverridePayload(left: VisualOverrideSet | null, right: VisualOverrideSet | null) {
  if (!left || !right) return left === right;
  return JSON.stringify({ ...left, updatedAt: "" }) === JSON.stringify({ ...right, updatedAt: "" });
}

function fieldValueToDraft(value: unknown, definition: FieldDefinition): RuntimeDraftValue {
  if (definition.type === "boolean") return value === true;
  if (definition.type === "table" && Array.isArray(value)) {
    return value.map((row) => Array.isArray(row) ? row.map((cell) => String(cell ?? "")).join("\t") : "").join("\n");
  }
  if ((definition.type === "number[]" || definition.type === "string[]") && Array.isArray(value)) return value.join("\t");
  return value === null || value === undefined ? "" : String(value);
}

function fieldDraftToValue(value: RuntimeDraftValue, definition: FieldDefinition): ReportValue {
  if (definition.type === "boolean") return value === true;
  const text = String(value);
  if (definition.type === "text") return text;
  if (definition.type === "number") {
    if (!text.trim()) return null;
    const number = Number(text.trim());
    return Number.isFinite(number) ? number : text;
  }
  if (definition.type === "string[]") return text.split(/[\t\n,，]+/).map((item) => item.trim()).filter(Boolean);
  if (definition.type === "number[]") {
    return text.split(/[\t\n,，]+/).map((item) => item.trim()).filter(Boolean).map((item) => {
      const number = Number(item);
      return Number.isFinite(number) ? number : item;
    });
  }
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.split("\t").map((cell) => cell.trim()));
}

function createRuntimeDrafts(reportPackage: ReportPackageDefinition, data: ReportData) {
  return Object.fromEntries(Object.entries(reportPackage.fields || {}).map(([path, definition]) => [path, fieldValueToDraft(getPathValue(data, path), definition)])) as Record<string, RuntimeDraftValue>;
}

function createRuntimeData(reportPackage: ReportPackageDefinition, baseData: ReportData, drafts: Record<string, RuntimeDraftValue>) {
  const data: ReportData = {};
  Object.entries(reportPackage.fields || {}).forEach(([path, definition]) => {
    const baseValue = fieldValueToDraft(getPathValue(baseData, path), definition);
    setPathValue(data, path, fieldDraftToValue(drafts[path] ?? baseValue, definition));
  });
  return data;
}

function loadRuntimeData(bootstrap: ReportEngineBootstrap) {
  try {
    const saved = localStorage.getItem(runtimeStorageKey(bootstrap.reportPackage)) || localStorage.getItem(legacyRuntimeStorageKey(bootstrap.reportPackage));
    if (!saved) return { data: bootstrap.data, warning: "" };
    const payload = JSON.parse(saved) as { packageId?: string; packageVersion?: string; dataSchemaVersion?: string; data?: ReportData };
    if (payload.packageId !== bootstrap.reportPackage.id || !payload.data) return { data: bootstrap.data, warning: "" };
    const sourceVersion = payload.dataSchemaVersion || (payload.packageVersion === bootstrap.reportPackage.version ? bootstrap.reportPackage.dataSchemaVersion : undefined);
    const migration = migrateReportData(bootstrap.reportPackage, sourceVersion, payload.data);
    if (migration.issues.some((issue) => issue.severity === "error")) return { data: bootstrap.data, warning: "本地数据版本无法迁移，请导入匹配当前报告包的数据文件" };
    return { data: migration.data, warning: migration.migrated ? "已按当前数据版本迁移本地数据" : "" };
  } catch {
    return { data: bootstrap.data, warning: "浏览器存储不可用，本次内容不会自动保存" };
  }
  return { data: bootstrap.data, warning: "" };
}

function runtimeTypeLabel(definition: FieldDefinition) {
  if (definition.type === "number") return "数值";
  if (definition.type === "number[]") return "数值序列，可用制表符、逗号或换行分隔";
  if (definition.type === "string[]") return "文本序列，可用制表符、逗号或换行分隔";
  if (definition.type === "table") return "表格，每行一条，列之间使用制表符";
  if (definition.type === "boolean") return "是或否";
  return "文本";
}

function independentDocumentStorageKey(reportPackage: ReportPackageDefinition) {
  return `local-report-document:${reportPackage.id}`;
}

function independentAssetNamespace(reportPackage: ReportPackageDefinition) {
  return `report-package:${reportPackage.id}:independent`;
}

function loadIndependentProject(reportPackage: ReportPackageDefinition, baseline: ReportDocument) {
  try {
    const saved = localStorage.getItem(independentDocumentStorageKey(reportPackage));
    if (!saved) return { document: baseline, warning: "" };
    const payload = JSON.parse(saved) as { format?: string; packageId?: string; packageVersion?: string; document?: ReportDocument };
    if (payload.format !== "report-engine-independent-v1" || payload.packageId !== reportPackage.id || !payload.document) {
      return { document: baseline, warning: "本地模板存档与当前生成器不匹配，已载入智能体模板" };
    }
    const normalized = normalizeProject(payload.document).document;
    return {
      document: normalized,
      warning: payload.packageVersion === reportPackage.version ? "" : "生成器模板版本已变化，已保留本机编辑结果；可点“恢复智能体模板”载入新版"
    };
  } catch {
    return { document: baseline, warning: "本地模板存档无法读取，已载入智能体模板" };
  }
}

function IndependentReportRuntime({ bootstrap }: { bootstrap: ReportEngineBootstrap }) {
  const { reportPackage } = bootstrap;
  const compilation = useMemo(() => compileReportPackage(reportPackage, {}), [reportPackage]);
  const errors = compilation.issues.filter((issue) => issue.severity === "error");
  const [revision, setRevision] = useState(0);
  const initial = useMemo(() => loadIndependentProject(reportPackage, compilation.document), [compilation.document, reportPackage, revision]);

  useEffect(() => {
    if (!errors.length) return;
    window.__REPORT_ENGINE_STATUS__ = { ready: false, packageId: reportPackage.id, pageCount: 0, errors: errors.map((issue) => issue.message) };
  }, [errors, reportPackage.id]);

  if (errors.length) {
    return <div className="runtime-empty">独立模板校验失败：{errors.map((issue) => issue.message).join("；")}</div>;
  }

  const persistDocument = (document: ReportDocument) => {
    localStorage.setItem(independentDocumentStorageKey(reportPackage), JSON.stringify({
      format: "report-engine-independent-v1",
      packageId: reportPackage.id,
      packageVersion: reportPackage.version,
      document
    }));
    window.__REPORT_ENGINE_STATUS__ = { ready: false, packageId: reportPackage.id, pageCount: document.pages.length, errors: [] };
    void (async () => {
      await window.document.fonts?.ready;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      await prepareChartsForPrint();
      window.__REPORT_ENGINE_STATUS__ = { ready: true, packageId: reportPackage.id, pageCount: document.pages.length, errors: [] };
    })();
  };

  const resetTemplate = async () => {
    if (!window.confirm("将清除本机对这个生成器模板的全部编辑，并恢复智能体生成的初版。是否继续？")) return;
    try {
      if ("indexedDB" in window) await clearAssetNamespace(independentAssetNamespace(reportPackage));
      localStorage.removeItem(independentDocumentStorageKey(reportPackage));
      setRevision((value) => value + 1);
    } catch (error) {
      window.alert(`恢复模板失败：${error instanceof Error ? error.message : "无法清理本机图片资产"}`);
    }
  };

  return <EditorApp
    key={`${reportPackage.id}:${revision}`}
    suppliedProject={{ document: initial.document, assetData: reportPackage.assetData || {} }}
    embedded={{
      title: reportPackage.name,
      mode: "independent",
      protectedElementIds: new Set(),
      assetNamespace: independentAssetNamespace(reportPackage),
      onProjectChange: persistDocument,
      onResetVisual: resetTemplate,
      resetLabel: "恢复智能体模板",
      initialWarning: initial.warning
    }}
  />;
}

function SpecializedReportRuntime({ bootstrap }: { bootstrap: ReportEngineBootstrap }) {
  const { reportPackage } = bootstrap;
  const initialRuntime = useMemo(() => loadRuntimeData(bootstrap), [bootstrap]);
  const initialVisual = useMemo(() => loadRuntimeVisualOverrides(reportPackage), [reportPackage]);
  const [drafts, setDrafts] = useState(() => createRuntimeDrafts(reportPackage, initialRuntime.data));
  const [visualOverrides, setVisualOverrides] = useState<VisualOverrideSet | null>(initialVisual.overrides);
  const [runtimeAssetData, setRuntimeAssetData] = useState<Record<string, string>>(reportPackage.assetData || {});
  const [precisionMode, setPrecisionMode] = useState(false);
  const [activePageId, setActivePageId] = useState(reportPackage.pages[0]?.id || "");
  const [notice, setNotice] = useState(initialVisual.warning || "数据与视觉精修仅保存在当前浏览器");
  const [storageWarning, setStorageWarning] = useState(initialRuntime.warning || initialVisual.warning);
  const importRef = useRef<HTMLInputElement>(null);
  const runtimeData = useMemo(() => createRuntimeData(reportPackage, bootstrap.data, drafts), [bootstrap.data, drafts, reportPackage]);
  const compilationState = useMemo(() => {
    try {
      return { result: compileReportPackage(reportPackage, runtimeData), fault: null as EngineIssue | null };
    } catch (error) {
      return {
        result: null,
        fault: { severity: "error", code: "runtime", message: error instanceof Error ? error.message : String(error) } as EngineIssue
      };
    }
  }, [reportPackage, runtimeData]);
  const issues = compilationState.result?.issues || (compilationState.fault ? [compilationState.fault] : []);
  const errors = issues.filter((issue) => issue.severity === "error");
  const baselineDocument = compilationState.result?.document;
  const protectedElementIds = useMemo(() => protectedReportElementIds(reportPackage, baselineDocument), [baselineDocument, reportPackage]);
  const overrideApplication = useMemo(
    () => baselineDocument ? applyVisualOverrides(baselineDocument, visualOverrides, protectedElementIds) : null,
    [baselineDocument, protectedElementIds, visualOverrides]
  );
  const compiledDocument = overrideApplication?.document;
  const qualityIssues = useMemo<EngineIssue[]>(() => {
    if (!compiledDocument || errors.length) return [];
    return validateDocument(compiledDocument, [], { allowTextOnlyMasters: true }).map((message) => ({
      severity: "warning",
      code: "print-quality",
      message
    }));
  }, [compiledDocument, errors.length]);
  const overrideIssues: EngineIssue[] = overrideApplication?.orphanCount ? [{ severity: "warning", code: "orphan-override", message: `${overrideApplication.orphanCount} 项旧视觉精修找不到目标，已安全忽略` }] : [];
  const displayedIssues = [...issues, ...qualityIssues, ...overrideIssues];
  const activePage = compiledDocument?.pages.find((page) => page.id === activePageId) || compiledDocument?.pages[0];

  useEffect(() => {
    if (!compiledDocument) return;
    let cancelled = false;
    void getAssets(compiledDocument.assets.map((asset) => asset.id), runtimeAssetNamespace(reportPackage)).then((stored) => {
      if (!cancelled) setRuntimeAssetData((current) => ({ ...reportPackage.assetData, ...current, ...stored }));
    }).catch(() => setStorageWarning("本地图片资产读取失败，请重新进入布局精修并检查图片"));
    return () => { cancelled = true; };
  }, [compiledDocument?.assets.map((asset) => asset.id).join("|"), reportPackage.assetData]);

  useEffect(() => {
    try {
      localStorage.setItem(runtimeStorageKey(reportPackage), JSON.stringify({
        format: "report-engine-data-v1",
        packageId: reportPackage.id,
        packageVersion: reportPackage.version,
        dataSchemaVersion: reportPackage.dataSchemaVersion,
        data: runtimeData
      }));
      setStorageWarning("");
    } catch {
      setStorageWarning("浏览器存储不可用，本次内容不会自动保存");
    }
  }, [reportPackage, runtimeData]);

  useEffect(() => {
    try {
      if (visualOverrides) localStorage.setItem(runtimeVisualStorageKey(reportPackage), JSON.stringify(visualOverrides));
      else localStorage.removeItem(runtimeVisualStorageKey(reportPackage));
    } catch {
      setStorageWarning("浏览器存储不可用，视觉精修不会在刷新后保留");
    }
  }, [reportPackage, visualOverrides]);

  useEffect(() => {
    let cancelled = false;
    window.__REPORT_ENGINE_STATUS__ = {
      ready: false,
      packageId: reportPackage.id,
      pageCount: compiledDocument?.pages.length || 0,
      errors: errors.map((issue) => issue.code)
    };
    if (!compiledDocument || errors.length) return () => { cancelled = true; };
    void (async () => {
      await window.document.fonts?.ready;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      await prepareChartsForPrint();
      if (!cancelled) window.__REPORT_ENGINE_STATUS__ = { ready: true, packageId: reportPackage.id, pageCount: compiledDocument.pages.length, errors: [] };
    })();
    return () => { cancelled = true; };
  }, [compiledDocument, errors.length, reportPackage.id]);

  const updateDraft = (path: string, value: RuntimeDraftValue) => {
    setDrafts((current) => ({ ...current, [path]: value }));
    setNotice("已在本机自动保存");
  };

  const resetData = () => {
    if (!window.confirm("将清除当前浏览器内已录入的数据，并恢复脱敏示例。是否继续？")) return;
    try {
      localStorage.removeItem(runtimeStorageKey(reportPackage));
      localStorage.removeItem(legacyRuntimeStorageKey(reportPackage));
    } catch {
      setStorageWarning("浏览器存储不可用，本次内容不会自动保存");
    }
    setDrafts(createRuntimeDrafts(reportPackage, bootstrap.data));
    setNotice("已恢复脱敏示例");
  };

  const savePrecisionDocument = (edited: ReportDocument, nextAssetData: Record<string, string>) => {
    if (!baselineDocument) return;
    const next = createVisualOverrides(baselineDocument, edited, { packageId: reportPackage.id, packageVersion: reportPackage.version }, protectedElementIds);
    const meaningful = visualOverrideCount(next) ? next : null;
    setVisualOverrides((current) => sameVisualOverridePayload(current, meaningful) ? current : meaningful);
    setRuntimeAssetData((current) => ({ ...current, ...nextAssetData }));
  };

  const resetVisual = () => {
    if (!window.confirm("将恢复智能体生成的作者布局。已录入的数据不会被清除。是否继续？")) return;
    setVisualOverrides(null);
    setPrecisionMode(false);
    setNotice("已恢复作者布局，数据保持不变");
  };

  const exportData = () => {
    const payload = JSON.stringify({ format: "report-engine-data-v1", packageId: reportPackage.id, packageVersion: reportPackage.version, dataSchemaVersion: reportPackage.dataSchemaVersion, data: runtimeData }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `${reportPackage.id}-data.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("本机数据文件已导出");
  };

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as { format?: string; packageId?: string; packageVersion?: string; dataSchemaVersion?: string; data?: ReportData };
      if (payload.format !== "report-engine-data-v1" || payload.packageId !== reportPackage.id || !payload.packageVersion || !payload.data) {
        throw new Error("数据文件与当前报告包不匹配");
      }
      const sourceVersion = payload.dataSchemaVersion || (payload.packageVersion === reportPackage.version ? reportPackage.dataSchemaVersion : undefined);
      const migration = migrateReportData(reportPackage, sourceVersion, payload.data);
      if (migration.issues.some((issue) => issue.severity === "error")) throw new Error("数据文件版本无法迁移");
      setDrafts(createRuntimeDrafts(reportPackage, migration.data));
      setNotice(migration.migrated ? "本机数据文件已迁移并载入" : "本机数据文件已载入");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "数据文件读取失败");
    }
  };

  const printReport = async () => {
    if (!compiledDocument || errors.length) {
      setNotice("请先修正全部错误，再生成 PDF");
      return;
    }
    await window.document.fonts?.ready;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    await prepareChartsForPrint();
    window.print();
  };

  const locateIssue = (issue: EngineIssue) => {
    if (!compiledDocument || !issue.locator) return;
    const page = compiledDocument.pages.find((item) => item.id === issue.locator || item.elements.some((element) => element.id === issue.locator));
    if (page) setActivePageId(page.id);
  };

  const inputSections = reportPackage.inputSections?.length ? reportPackage.inputSections : [{ id: "data", title: "报告数据", fields: Object.keys(reportPackage.fields || {}) }];

  if (precisionMode && baselineDocument && compiledDocument) {
    return <EditorApp
      suppliedProject={{ document: compiledDocument, assetData: runtimeAssetData }}
      embedded={{
        title: `${reportPackage.name} · 布局精修`,
        protectedElementIds,
        assetNamespace: runtimeAssetNamespace(reportPackage),
        onProjectChange: savePrecisionDocument,
        onExit: (edited, nextAssetData) => {
          savePrecisionDocument(edited, nextAssetData);
          setPrecisionMode(false);
          setNotice("视觉精修已保存到本机");
        },
        onResetVisual: resetVisual
      }}
    />;
  }

  return (
    <>
      <div className="report-runtime-shell">
        <header className="runtime-topbar">
          <div className="runtime-brand">
            <strong>{reportPackage.name}</strong>
            <span>{reportPackage.description || "本地特化报告生成器"}</span>
          </div>
          <div className="runtime-actions">
            <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importData(event)} />
            <button type="button" title="载入数据" onClick={() => importRef.current?.click()}><Upload size={15} />载入数据</button>
            <button type="button" title="导出数据" onClick={exportData}><Download size={15} />导出数据</button>
            <button type="button" title="恢复脱敏示例" onClick={resetData}><RotateCcw size={15} />恢复示例</button>
            <button type="button" title="直接修改文字、图片、位置与图表标签" disabled={!compiledDocument || errors.length > 0} onClick={() => setPrecisionMode(true)}><Pencil size={15} />布局精修{visualOverrideCount(visualOverrides) ? ` ${visualOverrideCount(visualOverrides)}` : ""}</button>
            <button type="button" title="恢复智能体生成的作者布局，不影响数据" disabled={!visualOverrides} onClick={resetVisual}><SlidersHorizontal size={15} />恢复布局</button>
            <button type="button" title={errors.length ? "请先修正生成检查中的错误" : qualityIssues.length ? "存在打印质量提示，仍可生成 PDF" : "生成 PDF"} className="primary" disabled={errors.length > 0} onClick={() => void printReport()}><Printer size={15} />生成 PDF</button>
          </div>
        </header>

        <div className="runtime-workspace">
          <aside className="runtime-input-panel">
            <div className="runtime-panel-heading">
              <div><strong>本地数据</strong><span>{Object.keys(reportPackage.fields || {}).length} 个字段</span></div>
              <small>{storageWarning || notice}</small>
            </div>
            <div className="runtime-form">
              {inputSections.map((section, sectionIndex) => (
                <details key={section.id} open={sectionIndex === 0}>
                  <summary>{section.title}<span>{section.fields.length}</span></summary>
                  <div className="runtime-fields">
                    {section.fields.map((path) => {
                      const definition = reportPackage.fields?.[path];
                      if (!definition) return null;
                      const fieldIssues = issues.filter((issue) => issue.path === path);
                      const invalid = fieldIssues.some((issue) => issue.severity === "error");
                      const helper = [runtimeTypeLabel(definition), definition.unit].filter(Boolean).join(" / ");
                      return (
                        <label className="runtime-field" key={path}>
                          <span>{definition.label}{definition.required ? <b aria-label="必填">*</b> : null}</span>
                          {definition.type === "boolean" ? (
                            <input type="checkbox" checked={drafts[path] === true} onChange={(event) => updateDraft(path, event.target.checked)} />
                          ) : definition.type === "table" || definition.type.endsWith("[]") || path.startsWith("commentary.") ? (
                            <textarea rows={definition.type === "table" ? 5 : path.startsWith("commentary.") ? 3 : 2} value={String(drafts[path] ?? "")} aria-invalid={invalid} onChange={(event) => updateDraft(path, event.target.value)} />
                          ) : (
                            <input type={definition.type === "number" ? "text" : "text"} inputMode={definition.type === "number" ? "decimal" : undefined} value={String(drafts[path] ?? "")} aria-invalid={invalid} onChange={(event) => updateDraft(path, event.target.value)} />
                          )}
                          <small>{fieldIssues[0]?.message || helper}</small>
                        </label>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </aside>

          <main className="runtime-preview-panel">
            <div className="runtime-preview-heading">
              <div><strong>{activePage?.name || "预览不可用"}</strong><span>{compiledDocument ? `${compiledDocument.pages.findIndex((page) => page.id === activePage?.id) + 1} / ${compiledDocument.pages.length}` : "0 / 0"}</span></div>
              <span className={errors.length ? "runtime-state error" : "runtime-state ready"}>{errors.length ? `${errors.length} 项错误` : qualityIssues.length ? `${qualityIssues.length} 项打印提示` : "可生成 PDF"}</span>
            </div>
            <div className="runtime-preview-scroll">
              {compiledDocument && activePage ? <ReportPageView document={compiledDocument} page={activePage} assetData={runtimeAssetData} pxPerMm={activePage.orientation === "landscape" ? 2.35 : 2.2} /> : <div className="runtime-empty">报告编译失败，请检查右侧错误。</div>}
            </div>
            <nav className="runtime-page-nav" aria-label="报告页面">
              {compiledDocument?.pages.map((page, index) => <button type="button" className={page.id === activePage?.id ? "active" : ""} onClick={() => setActivePageId(page.id)} key={page.id}><span>{String(index + 1).padStart(2, "0")}</span>{page.name}</button>)}
            </nav>
          </main>

          <aside className="runtime-issues-panel">
            <div className="runtime-panel-heading"><div><strong>生成检查</strong><span>{displayedIssues.length ? `${displayedIssues.length} 项` : "全部通过"}</span></div></div>
            {displayedIssues.length ? <div className="runtime-issue-list">{displayedIssues.map((issue, index) => <button type="button" onClick={() => locateIssue(issue)} disabled={!issue.locator} key={`${issue.code}-${issue.path || issue.locator || index}`}><AlertTriangle size={15} /><span><strong>{issue.message}</strong><small>{issue.severity === "warning" ? "提示" : "错误"} / {issue.code}{issue.locator ? ` / ${issue.locator}` : issue.path ? ` / ${issue.path}` : ""}</small></span></button>)}</div> : <div className="runtime-pass"><Check size={22} /><strong>结构、数据与打印检查通过</strong><span>打印前仍会等待字体与图表完成。</span></div>}
          </aside>
        </div>
      </div>

      <div className="print-stage" aria-hidden="true">
        {compiledDocument?.pages.map((page) => <ReportPageView document={compiledDocument} page={page} assetData={runtimeAssetData} printing key={page.id} />)}
      </div>
    </>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}</span>{children}</label>;
}

function IconButton({
  label,
  active,
  disabled,
  onClick,
  children,
  className = ""
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""} ${className}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function TextToolbar({ element, page, theme, pxPerMm, onUpdate, onToggleMark }: {
  element: ReportElement;
  page: ReportPage;
  theme: ReportDocument["theme"];
  pxPerMm: number;
  onUpdate: (recipe: (element: ReportElement) => void) => void;
  onToggleMark: (mark: NonNullable<TextRun["marks"]>[number]) => void;
}) {
  const pageWidth = PAGE_MM[page.orientation].width * pxPerMm;
  const width = Math.min(352, pageWidth - 8);
  const left = Math.max(4, Math.min(pageWidth - width - 4, element.x * pxPerMm));
  const above = element.y * pxPerMm - 38;
  const top = above >= 4 ? above : Math.min(PAGE_MM[page.orientation].height * pxPerMm - 38, (element.y + element.h) * pxPerMm + 6);
  const colorTokens = (["text", "primary", "accent", "positive", "negative"] as const);
  const effectiveFontSlot = element.style.fontSlot || (element.semanticRole === "kpi-value" ? "numeric" : ["title", "quote-mark"].includes(element.semanticRole || "") ? "display" : "body");
  return <div className="floating-text-toolbar" style={{ left, top, width }} onPointerDown={(event) => event.stopPropagation()}>
    <select aria-label="字体槽" title="字体槽" value={effectiveFontSlot} onChange={(event) => onUpdate((item) => { item.style.fontSlot = event.target.value as "display" | "body" | "numeric"; })}><option value="display">标题体</option><option value="body">正文体</option><option value="numeric">数字体</option></select>
    <select aria-label="字号" title="字号" value={element.style.fontSize || 10} onChange={(event) => onUpdate((item) => { item.style.fontSize = Number(event.target.value); })}>{FONT_SIZE_STEPS.map((size) => <option value={size} key={size}>{size}</option>)}</select>
    <button type="button" title="粗体" className={(element.style.fontWeight || 400) >= 600 ? "active" : ""} onPointerDown={(event) => event.preventDefault()} onClick={() => onUpdate((item) => { item.style.fontWeight = (item.style.fontWeight || 400) >= 600 ? 400 : 700; })}><Bold size={14} /></button>
    <button type="button" title="左对齐" className={(element.style.align || "left") === "left" ? "active" : ""} onPointerDown={(event) => event.preventDefault()} onClick={() => onUpdate((item) => { item.style.align = "left"; })}><AlignLeft size={14} /></button>
    <button type="button" title="居中" className={element.style.align === "center" ? "active" : ""} onPointerDown={(event) => event.preventDefault()} onClick={() => onUpdate((item) => { item.style.align = "center"; })}><AlignCenter size={14} /></button>
    <button type="button" title="右对齐" className={element.style.align === "right" ? "active" : ""} onPointerDown={(event) => event.preventDefault()} onClick={() => onUpdate((item) => { item.style.align = "right"; })}><AlignRight size={14} /></button>
    <select aria-label="行高" title="行高" value={element.style.lineHeight || 1.5} onChange={(event) => onUpdate((item) => { item.style.lineHeight = Number(event.target.value); })}><option value="1.2">1.2</option><option value="1.35">1.35</option><option value="1.5">1.5</option></select>
    <span className="toolbar-swatches">{colorTokens.map((token) => <button type="button" key={token} title={`文字色：${token}`} className={element.style.color === token ? "active" : ""} style={{ background: resolveThemeColor(theme, token) }} onPointerDown={(event) => event.preventDefault()} onClick={() => onUpdate((item) => { item.style.color = token; })} />)}</span>
    <button type="button" className="run-mark red" title="所选文字使用语义红" onPointerDown={(event) => event.preventDefault()} onClick={() => onToggleMark("accentRed")} />
    <button type="button" className="run-mark green" title="所选文字使用语义绿" onPointerDown={(event) => event.preventDefault()} onClick={() => onToggleMark("accentGreen")} />
  </div>;
}

function ObjectToolbar({
  element,
  page,
  pxPerMm,
  selectedChartLabel,
  chartDataProtected,
  duplicateProtected,
  deleteProtected,
  onEditChartData,
  onEditTableData,
  onSetChartLabelMode,
  onResetSelectedChartLabel,
  onResetChartLabels,
  onDuplicate,
  onToggleLock,
  onToggleHidden,
  onDelete
}: {
  element: ReportElement;
  page: ReportPage;
  pxPerMm: number;
  selectedChartLabel?: ChartPointSelection | null;
  chartDataProtected: boolean;
  duplicateProtected: boolean;
  deleteProtected: boolean;
  onEditChartData: () => void;
  onEditTableData: () => void;
  onSetChartLabelMode: (mode: ChartLabelMode) => void;
  onResetSelectedChartLabel: () => void;
  onResetChartLabels: () => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const pageWidth = PAGE_MM[page.orientation].width * pxPerMm;
  const chartWidth = element.type === "chart" ? 470 : element.type === "table" ? 240 : 176;
  const width = Math.min(chartWidth, pageWidth - 8);
  const left = Math.max(4, Math.min(pageWidth - width - 4, element.x * pxPerMm));
  const above = element.y * pxPerMm - 38;
  const top = above >= 4 ? above : Math.min(PAGE_MM[page.orientation].height * pxPerMm - 38, (element.y + element.h) * pxPerMm + 6);
  return <div className="floating-object-toolbar" style={{ left, top, width }} onPointerDown={(event) => event.stopPropagation()}>
    {element.type === "chart" && <>
      <button type="button" title={chartDataProtected ? "查看绑定数据" : "编辑图表数据"} onClick={onEditChartData}><Database size={14} />{chartDataProtected ? "查看数据" : "编辑数据"}</button>
      <label title="数据标签疏密"><span>标签</span><select value={element.chartLabels?.mode || "auto"} onChange={(event) => onSetChartLabelMode(event.target.value as ChartLabelMode)}><option value="auto">智能</option><option value="all">全部</option><option value="sparse">稀疏</option><option value="key">关键点</option><option value="off">关闭</option></select></label>
      <button type="button" title={selectedChartLabel ? `重置 ${selectedChartLabel.seriesName} / ${selectedChartLabel.categoryName}` : "请先点击一个数据标签"} disabled={!selectedChartLabel} onClick={onResetSelectedChartLabel}><RotateCcw size={13} />单点</button>
      <button type="button" title="清除全部标签人工位置" onClick={onResetChartLabels}><SlidersHorizontal size={13} />重置布局</button>
      <span className="toolbar-separator-mini" />
    </>}
    {element.type === "table" && <>
      <button type="button" title={chartDataProtected ? "查看绑定数据" : "编辑本表数据"} onClick={onEditTableData}><Database size={14} />{chartDataProtected ? "查看数据" : "编辑数据"}</button>
      <span className="toolbar-separator-mini" />
    </>}
    {!duplicateProtected && <IconButton label="复制对象" onClick={onDuplicate}><Copy size={14} /></IconButton>}
    <IconButton label={element.locked ? "解锁对象" : "锁定对象"} active={element.locked} onClick={onToggleLock}>{element.locked ? <Unlock size={14} /> : <Lock size={14} />}</IconButton>
    <IconButton label="隐藏对象" onClick={onToggleHidden}><EyeOff size={14} /></IconButton>
    {!deleteProtected && <IconButton label="删除对象" onClick={onDelete}><Trash2 size={14} /></IconButton>}
  </div>;
}

function CellGridEditor({ kind, draft, readOnly, columnLimit = MAX_GRID_COLUMNS, onChange }: {
  kind: CellGridKind;
  draft: CellGridDraft;
  readOnly: boolean;
  columnLimit?: number;
  onChange: (draft: CellGridDraft) => void;
}) {
  const [activeCell, setActiveCell] = useState("0:0");
  const [actionMessage, setActionMessage] = useState("");
  const validation = useMemo(() => cellGridValidation(kind, draft), [draft, kind]);
  const columnCount = draft.cells[0]?.length || 0;
  const widestRow = Math.max(0, ...draft.cells.map((row) => row.length));
  const totalCharacters = draft.cells.reduce((total, row) => total + row.reduce((sum, cell) => sum + cell.length, 0), 0);
  const [activeRow, activeColumn] = activeCell.split(":").map(Number);
  const sizeError = draft.cells.length > MAX_GRID_ROWS || widestRow > MAX_GRID_COLUMNS || draft.cells.length * widestRow > MAX_GRID_CELLS || totalCharacters > MAX_GRID_TOTAL_CHARS || draft.cells.some((row) => row.some((cell) => cell.length > MAX_GRID_CELL_CHARS))
    ? `当前数据为 ${draft.cells.length - 1} 行 × ${columnCount} 列，超过单元格编辑器的 ${MAX_GRID_ROWS - 1} 行、${MAX_GRID_COLUMNS} 列或 ${MAX_GRID_CELLS} 格安全上限。请将数据拆分为多个独立图表或表格。`
    : "";

  const commitDraft = (recipe: (next: CellGridDraft) => void) => {
    const next = clone(draft);
    recipe(next);
    const nextColumns = Math.max(0, ...next.cells.map((row) => row.length));
    const nextCharacters = next.cells.reduce((total, row) => total + row.reduce((sum, cell) => sum + cell.length, 0), 0);
    if (next.cells.length > MAX_GRID_ROWS || nextColumns > MAX_GRID_COLUMNS || next.cells.length * nextColumns > MAX_GRID_CELLS || nextCharacters > MAX_GRID_TOTAL_CHARS) {
      setActionMessage(`修改后将超过 ${MAX_GRID_ROWS - 1} 行、${MAX_GRID_COLUMNS} 列、${MAX_GRID_CELLS} 格或 1 MB 文本上限`);
      return false;
    }
    onChange(next);
    return true;
  };

  const focusCell = (row: number, column: number) => {
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`.cell-grid-input[data-row="${row}"][data-column="${column}"]`)?.focus();
    });
  };

  const addRow = () => {
    if (draft.cells.length >= MAX_GRID_ROWS || (draft.cells.length + 1) * columnCount > MAX_GRID_CELLS) {
      setActionMessage(`最多支持 ${MAX_GRID_ROWS} 行、合计 ${MAX_GRID_CELLS} 个单元格`);
      return;
    }
    commitDraft((next) => {
      const rowNumber = next.cells.length;
      next.cells.push(Array.from({ length: columnCount }, (_, column) => kind === "chart" ? (column === 0 ? `新类目 ${rowNumber}` : "0") : ""));
      next.rowKeys.push(`row-${uid()}`);
    });
    setActionMessage("已新增一行");
    focusCell(draft.cells.length, 0);
  };

  const addColumn = () => {
    if (columnCount >= columnLimit || draft.cells.length * (columnCount + 1) > MAX_GRID_CELLS) {
      setActionMessage(columnLimit < MAX_GRID_COLUMNS ? "环形图固定使用一列数值系列" : `最多支持 ${MAX_GRID_COLUMNS} 列、合计 ${MAX_GRID_CELLS} 个单元格`);
      return;
    }
    commitDraft((next) => {
      const nextColumn = columnCount;
      next.cells.forEach((row, rowIndex) => row.push(rowIndex === 0 ? (kind === "chart" ? `系列 ${nextColumn}` : `列 ${nextColumn + 1}`) : kind === "chart" ? "0" : ""));
      next.columnKeys.push(`column-${uid()}`);
    });
    setActionMessage("已新增一列");
    focusCell(0, columnCount);
  };

  const removeRow = (rowIndex: number) => {
    if (draft.cells.length <= 2) return;
    commitDraft((next) => {
      next.cells.splice(rowIndex, 1);
      next.rowKeys.splice(rowIndex, 1);
    });
    setActionMessage(`已删除第 ${rowIndex} 行数据`);
  };

  const removeColumn = (columnIndex: number) => {
    const minimum = kind === "chart" ? 2 : 1;
    if (columnCount <= minimum || (kind === "chart" && columnIndex === 0)) return;
    commitDraft((next) => {
      next.cells.forEach((row) => row.splice(columnIndex, 1));
      next.columnKeys.splice(columnIndex, 1);
    });
    setActionMessage(`已删除“${draft.cells[0][columnIndex]}”列`);
  };

  const updateCell = (row: number, column: number, value: string) => {
    if (value.length > MAX_GRID_CELL_CHARS) {
      setActionMessage(`单个单元格不能超过 ${MAX_GRID_CELL_CHARS} 个字符`);
      return;
    }
    if (!commitDraft((next) => { next.cells[row][column] = value; })) return;
    setActionMessage("");
  };

  const pasteCells = (event: ReactClipboardEvent<HTMLInputElement>, startRow: number, startColumn: number) => {
    if (readOnly) return;
    const clipboard = event.clipboardData.getData("text/plain");
    if (clipboard.length > 1024 * 1024) {
      event.preventDefault();
      setActionMessage("剪贴板内容超过 1 MB，已拒绝粘贴；请拆分后重试");
      return;
    }
    if (!clipboard.includes("\t") && !/[\r\n]/.test(clipboard)) return;
    event.preventDefault();
    const parsedClipboard = parseClipboardGrid(clipboard);
    if (!parsedClipboard.cells) {
      setActionMessage(parsedClipboard.error || "剪贴板数据无法识别，未执行粘贴");
      return;
    }
    const block = parsedClipboard.cells;
    const blockColumns = Math.max(0, ...block.map((row) => row.length));
    const requiredRows = startRow + block.length;
    const requiredColumns = startColumn + blockColumns;
    const finalRows = Math.max(draft.cells.length, requiredRows);
    const finalColumns = Math.max(columnCount, requiredColumns);
    if (!block.length || !blockColumns) return;
    if (finalRows > MAX_GRID_ROWS || finalColumns > columnLimit || finalRows * finalColumns > MAX_GRID_CELLS) {
      setActionMessage(columnLimit < MAX_GRID_COLUMNS && requiredColumns > columnLimit ? "环形图只接受一列数值系列" : `粘贴范围过大；最多 ${MAX_GRID_ROWS} 行、${MAX_GRID_COLUMNS} 列、合计 ${MAX_GRID_CELLS} 个单元格`);
      return;
    }
    commitDraft((next) => {
      while (next.cells.length < requiredRows) {
        const rowNumber = next.cells.length;
        next.cells.push(Array.from({ length: next.cells[0].length }, (_, column) => kind === "chart" ? (column === 0 ? `新类目 ${rowNumber}` : "0") : ""));
        next.rowKeys.push(`row-${uid()}`);
      }
      while (next.cells[0].length < requiredColumns) {
        const nextColumn = next.cells[0].length;
        next.cells.forEach((row, rowIndex) => row.push(rowIndex === 0 ? (kind === "chart" ? `系列 ${nextColumn}` : `列 ${nextColumn + 1}`) : kind === "chart" ? "0" : ""));
        next.columnKeys.push(`column-${uid()}`);
      }
      block.forEach((row, rowOffset) => row.forEach((value, columnOffset) => {
        next.cells[startRow + rowOffset][startColumn + columnOffset] = value;
      }));
      reconcilePastedStableKeys(kind, draft, next, startRow, startColumn, block.length, blockColumns);
    });
    setActionMessage(`已从当前格粘贴 ${block.length} 行 × ${blockColumns} 列`);
    focusCell(Math.min(requiredRows - 1, MAX_GRID_ROWS - 1), Math.min(requiredColumns - 1, MAX_GRID_COLUMNS - 1));
  };

  const handleCellKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>, row: number, column: number) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    let nextRow = row;
    let nextColumn = column;
    if (event.key === "Enter") nextRow = Math.max(0, Math.min(draft.cells.length - 1, row + (event.shiftKey ? -1 : 1)));
    else if ((event.metaKey || event.ctrlKey) && event.key === "ArrowDown") nextRow = Math.min(draft.cells.length - 1, row + 1);
    else if ((event.metaKey || event.ctrlKey) && event.key === "ArrowUp") nextRow = Math.max(0, row - 1);
    else if ((event.metaKey || event.ctrlKey) && event.key === "ArrowRight") nextColumn = Math.min(columnCount - 1, column + 1);
    else if ((event.metaKey || event.ctrlKey) && event.key === "ArrowLeft") nextColumn = Math.max(0, column - 1);
    else return;
    event.preventDefault();
    focusCell(nextRow, nextColumn);
  };

  if (sizeError) return <div className="cell-grid-editor"><div className="cell-grid-limit">{sizeError}</div></div>;

  return <div className="cell-grid-editor" data-grid-kind={kind}>
    <div className="cell-grid-toolbar">
      <span>{kind === "chart" ? "首列为类目，后续列为数据系列" : "首行为表头，其余行为数据"}</span>
      {!readOnly && <div>
        <button type="button" onClick={addRow}><Plus size={14} />新增行</button>
        {columnCount < columnLimit && <button type="button" onClick={addColumn}><Plus size={14} />新增列</button>}
        <button type="button" disabled={!Number.isFinite(activeRow) || activeRow < 1 || draft.cells.length <= 2} onClick={() => removeRow(activeRow)}><Trash2 size={13} />删除行</button>
        <button type="button" disabled={!Number.isFinite(activeColumn) || (kind === "chart" && activeColumn === 0) || columnCount <= (kind === "chart" ? 2 : 1)} onClick={() => removeColumn(activeColumn)}><Trash2 size={13} />删除列</button>
      </div>}
    </div>
    <div className="cell-grid-scroll" tabIndex={-1}>
      <table className="cell-grid-table">
        <thead><tr>
          <th className="cell-grid-corner" aria-label="行号" />
          {draft.cells[0].map((cell, column) => {
            const error = validation.cellErrors.get(gridCellKey(0, column));
            const canDelete = columnCount > (kind === "chart" ? 2 : 1) && !(kind === "chart" && column === 0);
            return <th key={draft.columnKeys[column] || column} className={activeCell === gridCellKey(0, column) ? "active" : ""}>
              <div className="cell-grid-header-cell">
                <input
                  className="cell-grid-input"
                  data-row="0"
                  data-column={column}
                  data-column-key={draft.columnKeys[column]}
                  aria-label={kind === "chart" && column === 0 ? "类目列名称" : `第 ${column + 1} 列名称`}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "cell-grid-validation-status" : undefined}
                  title={error}
                  value={cell}
                  maxLength={MAX_GRID_CELL_CHARS}
                  readOnly={readOnly}
                  spellCheck={false}
                  onFocus={() => setActiveCell(gridCellKey(0, column))}
                  onChange={(event) => updateCell(0, column, event.target.value)}
                  onPaste={(event) => pasteCells(event, 0, column)}
                  onKeyDown={(event) => handleCellKeyDown(event, 0, column)}
                />
                {!readOnly && canDelete && <button type="button" tabIndex={-1} title="删除本列" aria-label={`删除“${cell || `第 ${column + 1} 列`}”`} onClick={() => removeColumn(column)}><Trash2 size={13} /></button>}
              </div>
            </th>;
          })}
        </tr></thead>
        <tbody>{draft.cells.slice(1).map((row, rowOffset) => {
          const rowIndex = rowOffset + 1;
          return <tr key={draft.rowKeys[rowIndex] || rowIndex}>
            <th className="cell-grid-row-control"><span>{rowIndex}</span>{!readOnly && <button type="button" tabIndex={-1} title="删除本行" aria-label={`删除第 ${rowIndex} 行`} disabled={draft.cells.length <= 2} onClick={() => removeRow(rowIndex)}><Trash2 size={12} /></button>}</th>
            {row.map((cell, column) => {
              const error = validation.cellErrors.get(gridCellKey(rowIndex, column));
              return <td key={draft.columnKeys[column] || column} className={activeCell === gridCellKey(rowIndex, column) ? "active" : ""}>
                <input
                  className="cell-grid-input"
                  data-row={rowIndex}
                  data-column={column}
                  data-row-key={draft.rowKeys[rowIndex]}
                  data-column-key={draft.columnKeys[column]}
                  aria-label={`第 ${rowIndex} 行，第 ${column + 1} 列`}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "cell-grid-validation-status" : undefined}
                  title={error}
                  value={cell}
                  maxLength={MAX_GRID_CELL_CHARS}
                  readOnly={readOnly}
                  spellCheck={false}
                  onFocus={() => setActiveCell(gridCellKey(rowIndex, column))}
                  onChange={(event) => updateCell(rowIndex, column, event.target.value)}
                  onPaste={(event) => pasteCells(event, rowIndex, column)}
                  onKeyDown={(event) => handleCellKeyDown(event, rowIndex, column)}
                />
              </td>;
            })}
          </tr>;
        })}</tbody>
      </table>
    </div>
    <div className="cell-grid-status" aria-live="polite">
      <span id="cell-grid-validation-status" className={validation.valid ? "ready" : "error"}>{validation.message}</span>
      <span>{actionMessage || (!readOnly ? "可从 Excel 复制多格后粘贴到当前单元格" : "只读数据")}</span>
    </div>
  </div>;
}

function useDialogFocus(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => (dialogRef.current?.querySelector<HTMLElement>(".cell-grid-input") || dialogRef.current?.querySelector<HTMLElement>("button"))?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter((item) => item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [onClose]);
  return dialogRef;
}

function ChartDataDialog({ element, readOnly, onClose, onSave }: {
  element: ReportElement;
  readOnly: boolean;
  onClose: () => void;
  onSave: (chart: ChartData) => void;
}) {
  const [draft, setDraft] = useState(() => chartToCellGrid(element.chart!));
  const validation = useMemo(() => cellGridValidation("chart", draft), [draft]);
  const donutError = element.chartKind === "donut" && draft.cells[0].length !== 2 ? "环形图只能保留一列数值系列" : "";
  const dialogRef = useDialogFocus(onClose);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div ref={dialogRef} className="validation-dialog chart-data-dialog" role="dialog" aria-modal="true" aria-labelledby="chart-data-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-title"><div><h2 id="chart-data-title">{readOnly ? "查看图表数据" : "编辑图表数据"}</h2><small>{element.name}</small></div><IconButton label="关闭" onClick={onClose}><X size={17} /></IconButton></div>
      {readOnly && <p className="bound-data-note"><Lock size={14} />该图表来自旧版集中字段或派生公式，这里按单元格只读显示；标签和位置仍可精修。</p>}
      <CellGridEditor kind="chart" draft={draft} readOnly={readOnly} columnLimit={element.chartKind === "donut" ? 2 : MAX_GRID_COLUMNS} onChange={setDraft} />
      {donutError && <p className="dialog-data-error">{donutError}</p>}
      <div className="dialog-actions"><button type="button" onClick={onClose}>{readOnly ? "关闭" : "取消"}</button>{!readOnly && <button type="button" className="primary" disabled={!validation.valid || Boolean(donutError)} onClick={() => onSave(chartFromCellGrid(draft, element.chart!, element.chartKind))}>应用数据</button>}</div>
    </div>
  </div>;
}

function TableDataDialog({ element, readOnly, onClose, onSave }: {
  element: ReportElement;
  readOnly: boolean;
  onClose: () => void;
  onSave: (table: TableData) => void;
}) {
  const [draft, setDraft] = useState(() => tableToCellGrid(element.table!));
  const validation = useMemo(() => cellGridValidation("table", draft), [draft]);
  const dialogRef = useDialogFocus(onClose);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div ref={dialogRef} className="validation-dialog chart-data-dialog" role="dialog" aria-modal="true" aria-labelledby="table-data-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="dialog-title"><div><h2 id="table-data-title">{readOnly ? "查看表格数据" : "编辑本表数据"}</h2><small>{element.name}</small></div><IconButton label="关闭" onClick={onClose}><X size={17} /></IconButton></div>
      {readOnly && <p className="bound-data-note"><Lock size={14} />该表格来自旧版集中字段，这里按单元格只读显示。</p>}
      <CellGridEditor kind="table" draft={draft} readOnly={readOnly} onChange={setDraft} />
      <div className="dialog-actions"><button type="button" onClick={onClose}>{readOnly ? "关闭" : "取消"}</button>{!readOnly && <button type="button" className="primary" disabled={!validation.valid} onClick={() => onSave(tableFromCellGrid(draft))}>应用数据</button>}</div>
    </div>
  </div>;
}

function PageThumbnail({ page, document, index, active, onClick }: { page: ReportPage; document: ReportDocument; index: number; active: boolean; onClick: () => void }) {
  const size = PAGE_MM[page.orientation];
  const width = page.orientation === "portrait" ? 104 : 132;
  const scale = width / size.width;
  return (
    <button type="button" className={`page-thumb-row ${active ? "active" : ""}`} onClick={onClick}>
      <span className="page-index">{String(index + 1).padStart(2, "0")}</span>
      <span className="page-thumb" style={{ width, height: size.height * scale, background: document.theme.paper }}>
        {page.elements.filter((element) => !element.hidden).map((element) => (
          <span
            key={element.id}
            className={`thumb-element thumb-${element.type}`}
            style={{
              left: element.x * scale,
              top: element.y * scale,
              width: Math.max(1, element.w * scale),
              height: Math.max(1, element.h * scale),
              background: element.type === "divider" ? document.theme.primary : element.type === "chart" ? document.theme.secondary : element.semanticRole === "title" ? document.theme.text : element.style.background ? resolveThemeColor(document.theme, element.style.background) : document.theme.surface,
              opacity: element.semanticRole === "title" ? 0.82 : 0.75
            }}
          />
        ))}
      </span>
      <span className="page-thumb-meta"><strong>{page.name}</strong><small>{page.orientation === "portrait" ? "A4 纵向" : "A4 横向"}</small></span>
    </button>
  );
}

interface DocumentValidationOptions {
  allowTextOnlyMasters?: boolean;
}

function validateDocument(report: ReportDocument, fontWarnings: string[] = [], options: DocumentValidationOptions = {}) {
  const issues: string[] = [...fontWarnings];
  if (!report.pages.length) issues.push("报告中没有页面");
  const totalAssetBytes = report.assets.reduce((sum, asset) => sum + (asset.byteSize || 0), 0);
  if (totalAssetBytes > 50 * 1024 * 1024) issues.push(`工程图片资产共 ${formatBytes(totalAssetBytes)}，超过 50 MB 预算`);
  report.pages.forEach((page, pageIndex) => {
    const size = PAGE_MM[page.orientation];
    if (!options.allowTextOnlyMasters && ["cover", "section", "backcover"].includes(page.master) && !page.masterProps?.imageAssetId) {
      issues.push(`第 ${pageIndex + 1} 页使用${page.master === "cover" ? "封面" : page.master === "section" ? "章节" : "尾页"}母版，但尚未设置母版图片`);
    }
      if (page.masterProps?.imageAssetId && page.masterProps.imageStyle?.overlayKind === "none" && ["cover", "section", "backcover"].includes(page.master)) {
        issues.push(`第 ${pageIndex + 1} 页母版文字压图但未启用叠色层，存在对比度风险`);
      }
      if (page.masterProps?.imageAssetId) {
        const masterAsset = report.assets.find((asset) => asset.id === page.masterProps?.imageAssetId);
        if (!masterAsset) issues.push(`第 ${pageIndex + 1} 页引用的母版图片资产不存在`);
        else {
          const masterHeight = page.master === "section" ? 70 : size.height;
          const dpi = Math.min(masterAsset.width / size.width, masterAsset.height / masterHeight) * 25.4;
          if (dpi < 150) issues.push(`第 ${pageIndex + 1} 页母版图片约 ${Math.round(dpi)} DPI，打印可能发虚`);
        }
      }
    page.elements.forEach((element) => {
      if (element.hidden) return;
      if (element.x < 0 || element.y < 0 || element.x + element.w > size.width || element.y + element.h > size.height) {
        issues.push(`第 ${pageIndex + 1} 页「${element.name}」超出纸张范围`);
      }
      if ((element.type === "chart" || element.type === "table") && element.h < 18) {
        issues.push(`第 ${pageIndex + 1} 页「${element.name}」高度过小，打印时可能无法辨认`);
      }
      if (!FONT_SIZE_STEPS.includes((element.style.fontSize || 10) as (typeof FONT_SIZE_STEPS)[number])) {
        issues.push(`第 ${pageIndex + 1} 页「${element.name}」字号不在白名单中`);
      }
      if (element.type === "table" && element.table) {
        const rowHeight = (element.style.fontSize || 10) * 0.3528 * 1.8;
        const required = 8 + (element.table.rows.length + 1) * rowHeight + (element.style.padding || 0) * 2;
        if (required > element.h) {
          const visibleRows = Math.max(0, Math.floor((element.h - 8 - (element.style.padding || 0) * 2) / rowHeight) - 1);
          issues.push(`第 ${pageIndex + 1} 页「${element.name}」内容高度约 ${round(required)} mm，超过 ${element.h} mm；建议从第 ${visibleRows + 1} 行起拆分`);
        }
      }
      if (element.type === "chart" && element.style.showLabel === false) {
        const count = element.chart?.series.reduce((sum, series) => sum + series.values.length, 0) || 0;
        issues.push(`第 ${pageIndex + 1} 页「${element.name}」隐藏了 ${count} 个数据标签`);
      }
      if (element.type === "image" && element.assetId) {
        const asset = report.assets.find((item) => item.id === element.assetId);
        if (!asset) issues.push(`第 ${pageIndex + 1} 页「${element.name}」引用的图片资产不存在`);
        else {
          const dpi = Math.min((element.crop?.sw || asset.width) / element.w, (element.crop?.sh || asset.height) / element.h) * 25.4;
          if (dpi < 150) issues.push(`第 ${pageIndex + 1} 页「${element.name}」约 ${Math.round(dpi)} DPI，打印可能发虚`);
        }
        const hasOverlaidText = page.elements.some((other) => other.id !== element.id && !other.hidden && other.z > element.z && other.type === "text" &&
          other.x < element.x + element.w && other.x + other.w > element.x && other.y < element.y + element.h && other.y + other.h > element.y);
        if (hasOverlaidText && (element.imageStyle?.overlayKind || "none") === "none") issues.push(`第 ${pageIndex + 1} 页「${element.name}」上方有文字，但图片未启用叠色层`);
      }
    });
    const charts = page.elements.filter((element) => !element.hidden && (element.type === "chart" || element.type === "table"));
    const sources = page.elements.filter((element) => !element.hidden && element.type === "text" && element.semanticRole === "source");
    if (charts.length && !sources.length) issues.push(`第 ${pageIndex + 1} 页包含图表或表格，但缺少资料来源行`);
  });
  report.assets.forEach((asset) => {
    const used = report.pages.some((page) => page.masterProps?.imageAssetId === asset.id || page.elements.some((element) => element.assetId === asset.id));
    if (!used) issues.push(`图片资产「${asset.sourceName || asset.id}」未被任何页面引用`);
  });
  return issues;
}

interface EmbeddedEditorOptions {
  title: string;
  mode?: "bound-precision" | "independent";
  protectedElementIds: ReadonlySet<string>;
  assetNamespace: string;
  onProjectChange: (document: ReportDocument, assetData: Record<string, string>) => void;
  onExit?: (document: ReportDocument, assetData: Record<string, string>) => void;
  onResetVisual: () => void;
  resetLabel?: string;
  initialWarning?: string;
}

function EditorApp({ suppliedProject, embedded }: {
  suppliedProject?: { document: ReportDocument; assetData: Record<string, string> };
  embedded?: EmbeddedEditorOptions;
} = {}) {
  const [initialProject] = useState(() => suppliedProject || loadInitialProject());
  const [document, setDocument] = useState<ReportDocument>(initialProject.document);
  const [assetData, setAssetData] = useState<Record<string, string>>(initialProject.assetData);
  const [printDocument, setPrintDocument] = useState<ReportDocument>(initialProject.document);
  const [printAssetData, setPrintAssetData] = useState<Record<string, string>>(initialProject.assetData);
  const [imageSizeReport, setImageSizeReport] = useState<ImageSizeReport | null>(null);
  const [past, setPast] = useState<ReportDocument[]>([]);
  const [future, setFuture] = useState<ReportDocument[]>([]);
  const [activePageId, setActivePageId] = useState(document.pages[0]?.id || "");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [textEdit, setTextEditState] = useState<TextEditSession | null>(null);
  const [cropEdit, setCropEditState] = useState<CropEditSession | null>(null);
  const [selectedChartLabel, setSelectedChartLabel] = useState<ChartPointSelection | null>(null);
  const [chartDataElementId, setChartDataElementId] = useState<string | null>(null);
  const [tableDataElementId, setTableDataElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(85);
  const [leftTab, setLeftTab] = useState<LeftTab>("pages");
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("data");
  const [search, setSearch] = useState("");
  const [compactLayout, setCompactLayout] = useState(() => window.matchMedia("(max-width: 820px)").matches);
  const [leftOpen, setLeftOpen] = useState(() => !window.matchMedia("(max-width: 820px)").matches);
  const [rightOpen, setRightOpen] = useState(() => !window.matchMedia("(max-width: 820px)").matches);
  const [guides, setGuides] = useState<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [savedAt, setSavedAt] = useState<Date>(new Date());
  const [saveError, setSaveError] = useState<string | null>(embedded?.initialWarning || null);
  const [fontWarnings, setFontWarnings] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[] | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [keepOriginalImages, setKeepOriginalImages] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const mergedCommitRef = useRef<{ key: string; timer: number } | null>(null);
  const documentRef = useRef(document);
  const textEditRef = useRef<TextEditSession | null>(null);
  const cropEditRef = useRef<CropEditSession | null>(null);
  const embeddedRef = useRef(embedded);
  const preparedPrintRef = useRef(false);
  embeddedRef.current = embedded;
  documentRef.current = document;
  zoomRef.current = zoom;
  const pxPerMm = BASE_PX_PER_MM * (zoom / 100);
  const assetNamespace = embedded?.assetNamespace;
  const independentMode = embedded?.mode === "independent";
  const structureEditing = !embedded || independentMode;
  const boundPrecisionMode = Boolean(embedded && !independentMode);

  const activePageIndex = Math.max(0, document.pages.findIndex((page) => page.id === activePageId));
  const activePage = document.pages[activePageIndex] || document.pages[0];
  const selectedElements = activePage?.elements.filter((element) => selectedIds.has(element.id)) || [];
  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;
  const chartDataElement = chartDataElementId ? document.pages.flatMap((page) => page.elements).find((element) => element.id === chartDataElementId) : undefined;
  const tableDataElement = tableDataElementId ? document.pages.flatMap((page) => page.elements).find((element) => element.id === tableDataElementId) : undefined;
  const movableSelectedCount = selectedElements.filter((element) => !element.locked && !element.hidden).length;
  const selectedGroupCount = new Set(selectedElements.map((element) => element.groupId).filter(Boolean)).size;
  const assetTotalBytes = document.assets.reduce((sum, asset) => sum + (asset.byteSize || 0), 0);
  const assetBudgetWarning = assetTotalBytes > 50 * 1024 * 1024 ? `工程图片资产已达 ${formatBytes(assetTotalBytes)}，超过 50 MB 预算。` : null;

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  const replaceTextEdit = (next: TextEditSession | null | ((current: TextEditSession | null) => TextEditSession | null)) => {
    const resolved = typeof next === "function" ? next(textEditRef.current) : next;
    textEditRef.current = resolved;
    setTextEditState(resolved);
  };

  const replaceCropEdit = (next: CropEditSession | null | ((current: CropEditSession | null) => CropEditSession | null)) => {
    const resolved = typeof next === "function" ? next(cropEditRef.current) : next;
    cropEditRef.current = resolved;
    setCropEditState(resolved);
  };

  const finishCropEdit = (mode: "commit" | "cancel" = "commit") => {
    const session = cropEditRef.current;
    if (!session) return documentRef.current;
    replaceCropEdit(null);
    if (mode === "cancel" || JSON.stringify(session.original) === JSON.stringify(session.draft)) return documentRef.current;
    const current = documentRef.current;
    const next = clone(current);
    const page = next.pages.find((item) => item.id === session.pageId);
    if (session.elementId === MASTER_CROP_ELEMENT_ID) {
      if (page) page.masterProps = { ...page.masterProps, crop: clone(session.draft) };
    } else {
      const element = page?.elements.find((item) => item.id === session.elementId);
      if (element) element.crop = clone(session.draft);
    }
    next.updatedAt = new Date().toISOString();
    setPast((items) => [...items.slice(-79), clone(current)]);
    setFuture([]);
    documentRef.current = next;
    setDocument(next);
    return next;
  };

  const beginCropEdit = (elementId: string) => {
    finishTextEdit("commit");
    if (cropEditRef.current?.elementId === elementId) { finishCropEdit("commit"); return; }
    if (cropEditRef.current) finishCropEdit("commit");
    const element = activePage.elements.find((item) => item.id === elementId && item.type === "image");
    const asset = documentRef.current.assets.find((item) => item.id === element?.assetId);
    if (!element || !asset) return;
    const crop = clone(element.crop || { sx: 0, sy: 0, sw: asset.width, sh: asset.height });
    setSelectedIds(new Set([elementId]));
    replaceCropEdit({ pageId: activePage.id, elementId, original: crop, draft: crop, aspect: "current" });
  };

  const beginMasterCropEdit = () => {
    finishTextEdit("commit");
    if (cropEditRef.current?.elementId === MASTER_CROP_ELEMENT_ID) { finishCropEdit("commit"); return; }
    if (cropEditRef.current) finishCropEdit("commit");
    const page = documentRef.current.pages.find((item) => item.id === activePageId);
    const asset = documentRef.current.assets.find((item) => item.id === page?.masterProps?.imageAssetId);
    if (!page || !asset) return;
    const crop = clone(page.masterProps?.crop || { sx: 0, sy: 0, sw: asset.width, sh: asset.height });
    setSelectedIds(new Set());
    replaceCropEdit({ pageId: page.id, elementId: MASTER_CROP_ELEMENT_ID, original: crop, draft: crop, aspect: "current" });
  };

  const finishTextEdit = (mode: "commit" | "cancel" = "commit") => {
    const session = textEditRef.current;
    if (!session) return documentRef.current;
    replaceTextEdit(null);
    if (mode === "cancel") return documentRef.current;
    if (session.elementId && embeddedRef.current?.protectedElementIds.has(session.elementId)) {
      notify("旧版绑定内容只能查看，已放弃未提交的事实修改");
      return documentRef.current;
    }
    const runsChanged = JSON.stringify(session.runs) !== JSON.stringify(session.originalRuns);
    if (session.value === session.originalValue && !runsChanged) return documentRef.current;
    const current = documentRef.current;
    const next = clone(current);
    const page = next.pages.find((item) => item.id === session.pageId);
    const element = page?.elements.find((item) => item.id === session.elementId);
    if (element) writeElementField(element, session.field, session.value, session.runs);
    syncUsedFontSlots(next);
    next.updatedAt = new Date().toISOString();
    setPast((items) => [...items.slice(-79), clone(current)]);
    setFuture([]);
    documentRef.current = next;
    setDocument(next);
    return next;
  };

  const beginTextEdit = (elementId: string | undefined, field: TextEditField, baseDocument?: ReportDocument) => {
    if (elementId && embedded?.protectedElementIds.has(elementId)) {
      notify("该文字绑定真实数据，请在本地数据面板修改");
      return;
    }
    const activeEdit = textEditRef.current;
    if (activeEdit && activeEdit.elementId === elementId && activeEdit.field === field) return;
    const base = baseDocument || (activeEdit ? finishTextEdit("commit") : documentRef.current);
    const page = base.pages.find((item) => item.id === activePageId);
    if (!page) return;
    let value = "";
    let runs: TextRun[] = [];
    let multiline = false;
    const element = page.elements.find((item) => item.id === elementId);
    if (!element || !["text", "table"].includes(element.type)) return;
    value = elementFieldValue(element, field);
    runs = field === "content" ? clone(elementRuns(element)) : [{ text: value }];
    multiline = field === "content";
    replaceTextEdit({
      pageId: page.id,
      elementId,
      field,
      value,
      originalValue: value,
      runs,
      originalRuns: clone(runs),
      multiline,
      selectionStart: value.length,
      selectionEnd: value.length
    });
  };

  const editableTargets = (report: ReportDocument, pageId: string) => {
    const page = report.pages.find((item) => item.id === pageId);
    if (!page) return [] as Array<{ elementId?: string; field: TextEditField }>;
    const targets: Array<{ elementId?: string; field: TextEditField }> = [];
    page.elements.slice().sort((a, b) => a.z - b.z).forEach((element) => {
      if (element.hidden || !["text", "table"].includes(element.type)) return;
      if (element.type === "text") targets.push({ elementId: element.id, field: "content" });
      if (element.type === "table" && element.table) {
        element.table.headers.forEach((_, index) => targets.push({ elementId: element.id, field: `header:${index}` }));
        element.table.rows.forEach((row, rowIndex) => row.forEach((_, cellIndex) => targets.push({ elementId: element.id, field: `cell:${rowIndex}:${cellIndex}` })));
      }
    });
    return targets;
  };

  const handleTextFinish = (mode: TextEditFinishMode) => {
    const current = textEditRef.current;
    if (!current) return;
    const report = finishTextEdit(mode === "cancel" ? "cancel" : "commit");
    if (mode !== "next") return;
    const targets = editableTargets(report, current.pageId);
    const index = targets.findIndex((target) => target.elementId === current.elementId && target.field === current.field);
    const next = targets[(index + 1) % targets.length];
    if (next) beginTextEdit(next.elementId, next.field, report);
  };

  const handleTextInput = (value: string, selectionStart: number, selectionEnd: number) => {
    replaceTextEdit((current) => current ? {
      ...current,
      value,
      runs: replaceRunsText(current.runs, value),
      selectionStart,
      selectionEnd
    } : current);
  };

  const handleTextSelection = (selectionStart: number, selectionEnd: number) => {
    replaceTextEdit((current) => current ? { ...current, selectionStart, selectionEnd } : current);
  };

  const commit = (recipe: (draft: ReportDocument) => void, mergeKey?: string) => {
    const shouldPushHistory = !mergeKey || mergedCommitRef.current?.key !== mergeKey;
    if (!mergeKey && mergedCommitRef.current) {
      window.clearTimeout(mergedCommitRef.current.timer);
      mergedCommitRef.current = null;
    }
    setDocument((current) => {
      const next = clone(current);
      recipe(next);
      syncUsedFontSlots(next);
      next.updatedAt = new Date().toISOString();
      if (shouldPushHistory) {
        setPast((items) => [...items.slice(-79), clone(current)]);
      }
      setFuture([]);
      documentRef.current = next;
      return next;
    });
    if (mergeKey) {
      if (mergedCommitRef.current) window.clearTimeout(mergedCommitRef.current.timer);
      mergedCommitRef.current = {
        key: mergeKey,
        timer: window.setTimeout(() => { mergedCommitRef.current = null; }, 500)
      };
    }
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [clone(document), ...items].slice(0, 80));
    const restored = clone(previous);
    documentRef.current = restored;
    setDocument(restored);
    setSelectedIds(new Set());
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-79), clone(document)]);
    const restored = clone(next);
    documentRef.current = restored;
    setDocument(restored);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const handleLayoutChange = (event: MediaQueryListEvent) => {
      setCompactLayout(event.matches);
      setLeftOpen(!event.matches);
      setRightOpen(!event.matches);
    };
    media.addEventListener("change", handleLayoutChange);
    return () => media.removeEventListener("change", handleLayoutChange);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        embeddedRef.current?.onProjectChange(document, assetData);
        setSavedAt(new Date());
        setSaveError(null);
      } catch (error) {
        setSaveError(`自动保存失败：${error instanceof Error ? error.message : "浏览器拒绝写入"}。请立即导出工程文件。`);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [assetData, document]);

  useEffect(() => {
    if (embedded) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
        setSavedAt(new Date());
        setSaveError(null);
      } catch (error) {
        const reason = error instanceof DOMException && error.name === "QuotaExceededError" ? "浏览器本地空间已满" : "浏览器拒绝写入";
        setSaveError(`自动保存失败：${reason}。请立即导出工程文件。`);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [document, embedded]);

  useEffect(() => {
    let cancelled = false;
    const hydrateAssets = async () => {
      try {
        const ids = document.assets.map((asset) => asset.id);
        const stored = await getAssets(ids, assetNamespace);
        const storedSizes = await getAssetByteSizes(ids, assetNamespace);
        if (!cancelled) {
          setAssetData((current) => ({ ...stored, ...current }));
          setDocument((current) => {
            if (!current.assets.some((asset) => !asset.byteSize && storedSizes[asset.id])) return current;
            const next = clone(current);
            next.assets.forEach((asset) => {
              if (!asset.byteSize && storedSizes[asset.id]) asset.byteSize = storedSizes[asset.id];
            });
            documentRef.current = next;
            return next;
          });
        }
        await Promise.all(Object.entries(assetData).map(([id, data]) => {
          const metadata = document.assets.find((asset) => asset.id === id);
          return metadata ? putAsset(id, data, metadata.mime, assetNamespace) : Promise.resolve();
        }));
      } catch (error) {
        if (!cancelled) setSaveError(`图片存储失败：${error instanceof Error ? error.message : "IndexedDB 不可用"}。请立即导出工程文件。`);
      }
    };
    void hydrateAssets();
    return () => { cancelled = true; };
  }, [assetNamespace, document.assets.map((asset) => asset.id).join("|")]);

  useEffect(() => {
    if (!document.pages.some((page) => page.id === activePageId) && document.pages[0]) {
      setActivePageId(document.pages[0].id);
    }
  }, [activePageId, document.pages]);

  useEffect(() => {
    if (window.innerWidth <= 820) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, []);

  useEffect(() => {
    const scroll = canvasScrollRef.current;
    if (!scroll) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      const currentZoom = zoomRef.current;
      const nextZoom = Math.max(50, Math.min(200, currentZoom + (event.deltaY < 0 ? 5 : -5)));
      if (nextZoom === currentZoom) return;
      const page = canvasRef.current;
      const before = page?.getBoundingClientRect();
      const anchor = before ? {
        x: (event.clientX - before.left) / (BASE_PX_PER_MM * currentZoom / 100),
        y: (event.clientY - before.top) / (BASE_PX_PER_MM * currentZoom / 100)
      } : null;
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const after = canvasRef.current?.getBoundingClientRect();
        if (!anchor || !after) return;
        const nextPxPerMm = BASE_PX_PER_MM * nextZoom / 100;
        scroll.scrollLeft += after.left + anchor.x * nextPxPerMm - event.clientX;
        scroll.scrollTop += after.top + anchor.y * nextPxPerMm - event.clientY;
      }));
    };
    scroll.addEventListener("wheel", onWheel, { passive: false });
    return () => scroll.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const warnings = document.usedFontSlots.flatMap((slot) => {
      const stack = document.theme.fontSlots[slot];
      const primaryFamily = stack.split(",")[0].trim();
      return window.document.fonts?.check(`12px ${primaryFamily}`) ? [] : [`字体替换风险：${slot === "display" ? "标题体" : slot === "body" ? "正文体" : "数字体"}首选字体 ${primaryFamily} 在本机不可用`];
    });
    setFontWarnings(warnings);
  }, [document.theme, document.usedFontSlots.join("|")]);

  useEffect(() => {
    if (preparedPrintRef.current) return;
    setPrintDocument(document);
    setPrintAssetData(assetData);
  }, [assetData, document]);

  const selectPage = (id: string) => {
    finishTextEdit("commit");
    finishCropEdit("commit");
    setActivePageId(id);
    setSelectedIds(new Set());
    setInspectorTab("page");
    setRightOpen(true);
    if (compactLayout) setLeftOpen(false);
  };

  const updateElement = (id: string, recipe: (element: ReportElement) => void, mergeField?: string, protectedField = mergeField) => {
    if (embeddedRef.current?.protectedElementIds.has(id) && ["content", "chart", "table"].includes(protectedField || "")) {
      notify("旧版绑定事实只能查看，请回到本地数据面板修改");
      return;
    }
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      const element = page?.elements.find((item) => item.id === id);
      if (element) recipe(element);
    }, mergeField ? `element:${id}:${mergeField}` : undefined);
  };

  const updateChartLabelMode = (id: string, mode: ChartLabelMode) => {
    updateElement(id, (element) => {
      element.chartLabels = { mode, sparseEvery: element.chartLabels?.sparseEvery || 2, offsets: element.chartLabels?.offsets };
      element.style.showLabel = mode !== "off";
    });
  };

  const moveChartLabel = (selection: ChartPointSelection, dxMm: number, dyMm: number) => {
    updateElement(selection.elementId, (element) => {
      const settings = element.chartLabels || { mode: "auto" as const, sparseEvery: 2 };
      const offsets = clone(settings.offsets || {});
      const byOrientation = { ...(offsets[activePage.orientation] || {}) };
      const key = chartPointKey(selection.seriesId, selection.pointId);
      const current = byOrientation[key] || { dx: 0, dy: 0 };
      byOrientation[key] = { ...current, dx: round(current.dx + dxMm), dy: round(current.dy + dyMm) };
      offsets[activePage.orientation] = byOrientation;
      element.chartLabels = { ...settings, offsets };
    });
    notify(`已保存 ${selection.seriesName} / ${selection.categoryName} 的标签位置`);
  };

  const resetSelectedChartLabel = (id: string) => {
    const selection = selectedChartLabel?.elementId === id ? selectedChartLabel : null;
    if (!selection) return;
    updateElement(id, (element) => {
      const settings = element.chartLabels;
      if (!settings?.offsets?.[activePage.orientation]) return;
      const offsets = clone(settings.offsets);
      const byOrientation = { ...offsets[activePage.orientation] };
      delete byOrientation[chartPointKey(selection.seriesId, selection.pointId)];
      if (Object.keys(byOrientation).length) offsets[activePage.orientation] = byOrientation;
      else delete offsets[activePage.orientation];
      element.chartLabels = { ...settings, offsets: Object.keys(offsets).length ? offsets : undefined };
    });
  };

  const resetChartLabels = (id: string) => {
    updateElement(id, (element) => {
      element.chartLabels = { mode: element.chartLabels?.mode || "auto", sparseEvery: element.chartLabels?.sparseEvery || 2 };
    });
    setSelectedChartLabel(null);
  };

  const updateSelected = (recipe: (element: ReportElement) => void) => {
    if (!selectedIds.size) return;
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      page?.elements.forEach((element) => {
        if (selectedIds.has(element.id)) recipe(element);
      });
    });
  };

  const addElement = (presetId: string) => {
    if (!activePage) return;
    const preset = COMPONENT_PRESETS.find((item) => item.id === presetId)!;
    const size = PAGE_MM[activePage.orientation];
    const w = Math.min(preset.size[0], size.width - document.pageSetup.margin * 2);
    const h = Math.min(preset.size[1], size.height - document.pageSetup.margin * 2);
    const elements = makePreset(preset.id, round((size.width - w) / 2), round((size.height - h) / 2), w, h);
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId)!;
      const maxZ = Math.max(0, ...page.elements.map((item) => item.z));
      elements.forEach((element, index) => { element.z = maxZ + index + 1; });
      page.elements.push(...elements);
    });
    setSelectedIds(new Set(elements.map((element) => element.id)));
    setInspectorTab(elements.length === 1 && ["box", "divider"].includes(elements[0].type) ? "style" : "data");
    notify(`已添加${preset.label}`);
  };

  const addPage = (master: MasterType = "standard", orientation: Orientation = "portrait") => {
    const page = createPage(master, orientation, "新页面", "未分类", [], document.meta);
    commit((draft) => {
      draft.pages.push(page);
      syncPageNumberElements(draft);
    });
    setActivePageId(page.id);
    setSelectedIds(new Set());
    setInspectorTab("page");
    setRightOpen(true);
    if (compactLayout) setLeftOpen(false);
    setNewMenuOpen(false);
  };

  const duplicatePage = () => {
    if (!activePage) return;
    const copied = clone(activePage);
    copied.id = uid("page");
    copied.name = `${copied.name} 副本`;
    const groupIds = new Map<string, string>();
    copied.elements.forEach((element) => {
      element.id = uid("element");
      if (element.groupId) {
        if (!groupIds.has(element.groupId)) groupIds.set(element.groupId, uid("group"));
        element.groupId = groupIds.get(element.groupId);
      }
    });
    commit((draft) => {
      draft.pages.splice(activePageIndex + 1, 0, copied);
      syncPageNumberElements(draft);
    });
    setActivePageId(copied.id);
    setSelectedIds(new Set());
    setInspectorTab("page");
    setRightOpen(true);
    if (compactLayout) setLeftOpen(false);
  };

  const deletePage = () => {
    if (document.pages.length <= 1) return notify("报告至少保留一页");
    const nextId = document.pages[activePageIndex - 1]?.id || document.pages[activePageIndex + 1]?.id;
    commit((draft) => {
      draft.pages = draft.pages.filter((page) => page.id !== activePageId);
      syncPageNumberElements(draft);
    });
    setActivePageId(nextId);
    setSelectedIds(new Set());
    setInspectorTab("page");
  };

  const deleteSelection = () => {
    if (!selectedIds.size || !activePage) return;
    const expanded = expandSelectionToGroups(activePage, selectedIds);
    const protectedIds = embedded?.protectedElementIds || new Set<string>();
    const blockedGroups = new Set(activePage.elements
      .filter((element) => expanded.has(element.id) && (element.locked || protectedIds.has(element.id)) && element.groupId)
      .map((element) => element.groupId));
    const deletableIds = new Set(activePage.elements
      .filter((element) => expanded.has(element.id) && !element.locked && !protectedIds.has(element.id) && !(element.groupId && blockedGroups.has(element.groupId)))
      .map((element) => element.id));
    if (!deletableIds.size) {
      if ([...expanded].some((id) => protectedIds.has(id))) notify("绑定元素不能删除；可继续调整位置、样式和标签");
      return;
    }
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      if (!page) return;
      page.elements = page.elements.filter((element) => !deletableIds.has(element.id));
    });
    setSelectedIds(new Set());
  };

  const duplicateSelection = () => {
    if (!selectedIds.size || !activePage) return;
    const expanded = expandSelectionToGroups(activePage, selectedIds);
    const protectedIds = embedded?.protectedElementIds || new Set<string>();
    const blockedGroups = new Set(activePage.elements
      .filter((element) => expanded.has(element.id) && (element.locked || protectedIds.has(element.id) || Boolean(boundPrecisionMode && ["text", "chart", "table"].includes(element.type))) && element.groupId)
      .map((element) => element.groupId));
    const duplicableIds = new Set(activePage.elements
      .filter((element) => expanded.has(element.id) && !element.locked && !protectedIds.has(element.id) && !(boundPrecisionMode && ["text", "chart", "table"].includes(element.type)) && !(element.groupId && blockedGroups.has(element.groupId)))
      .map((element) => element.id));
    if (!duplicableIds.size) {
      if (boundPrecisionMode) notify("绑定模式精修不复制文字、图表或表格，避免生成不会随数据刷新的旧事实副本");
      return;
    }
    const newIds: string[] = [];
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId)!;
      const groupIds = new Map<string, string>();
      const maxZ = Math.max(0, ...page.elements.map((element) => element.z));
      const copies = page.elements.filter((element) => duplicableIds.has(element.id)).map((element, index) => {
        const copy = clone(element);
        copy.id = uid("element");
        copy.name = `${copy.name} 副本`;
        if (copy.groupId) {
          if (!groupIds.has(copy.groupId)) groupIds.set(copy.groupId, uid("group"));
          copy.groupId = groupIds.get(copy.groupId);
        }
        copy.x = round(copy.x + 4);
        copy.y = round(copy.y + 4);
        copy.z = maxZ + index + 1;
        newIds.push(copy.id);
        return copy;
      });
      page.elements.push(...copies);
    });
    setSelectedIds(new Set(newIds));
  };

  const lockSelection = () => {
    if (!selectedIds.size || !activePage) return;
    const shouldLock = selectedElements.some((element) => !element.locked);
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      if (!page) return;
      const expanded = expandSelectionToGroups(page, selectedIds);
      page.elements.forEach((element) => { if (expanded.has(element.id)) element.locked = shouldLock; });
    });
  };

  const hideSelection = () => {
    if (!selectedIds.size || !activePage) return;
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      if (!page) return;
      const expanded = expandSelectionToGroups(page, selectedIds);
      page.elements.forEach((element) => { if (expanded.has(element.id)) element.hidden = true; });
    });
    setSelectedIds(new Set());
  };

  const ungroupSelection = () => {
    if (!selectedGroupCount || !activePage) return;
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      if (!page) return;
      const expanded = expandSelectionToGroups(page, selectedIds);
      page.elements.forEach((element) => {
        if (!expanded.has(element.id)) return;
        delete element.groupId;
        delete element.groupName;
        delete element.presetId;
        delete element.presetSlot;
      });
    });
    notify("组合已拆分为基础元素");
  };

  const alignSelection = (command: AlignCommand) => {
    if (!activePage || !selectedIds.size) return;
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      if (!page) return;
      const elements = page.elements.filter((element) => selectedIds.has(element.id) && !element.locked && !element.hidden);
      if (!elements.length) return;
      const pageSize = PAGE_MM[page.orientation];
      const bounds = elements.length === 1 ? { left: 0, top: 0, right: pageSize.width, bottom: pageSize.height } : {
        left: Math.min(...elements.map((element) => element.x)),
        top: Math.min(...elements.map((element) => element.y)),
        right: Math.max(...elements.map((element) => element.x + element.w)),
        bottom: Math.max(...elements.map((element) => element.y + element.h))
      };
      elements.forEach((element) => {
        if (command === "left") element.x = round(bounds.left);
        if (command === "center") element.x = round((bounds.left + bounds.right - element.w) / 2);
        if (command === "right") element.x = round(bounds.right - element.w);
        if (command === "top") element.y = round(bounds.top);
        if (command === "middle") element.y = round((bounds.top + bounds.bottom - element.h) / 2);
        if (command === "bottom") element.y = round(bounds.bottom - element.h);
      });
    });
  };

  const distributeSelection = (command: DistributeCommand) => {
    if (!activePage) return;
    const eligibleCount = activePage.elements.filter((element) => selectedIds.has(element.id) && !element.locked && !element.hidden).length;
    if (eligibleCount < 3) return;
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      if (!page) return;
      const elements = page.elements.filter((element) => selectedIds.has(element.id) && !element.locked && !element.hidden);
      if (command === "horizontal") {
        const ordered = elements.slice().sort((a, b) => a.x - b.x);
        const left = ordered[0].x;
        const right = ordered.at(-1)!.x + ordered.at(-1)!.w;
        const gap = (right - left - ordered.reduce((sum, element) => sum + element.w, 0)) / (ordered.length - 1);
        let cursor = left;
        ordered.forEach((element) => {
          element.x = round(cursor);
          cursor += element.w + gap;
        });
      } else {
        const ordered = elements.slice().sort((a, b) => a.y - b.y);
        const top = ordered[0].y;
        const bottom = ordered.at(-1)!.y + ordered.at(-1)!.h;
        const gap = (bottom - top - ordered.reduce((sum, element) => sum + element.h, 0)) / (ordered.length - 1);
        let cursor = top;
        ordered.forEach((element) => {
          element.y = round(cursor);
          cursor += element.h + gap;
        });
      }
    });
  };

  const snapBoxAxis = (
    start: number,
    length: number,
    rawDelta: number,
    targets: number[],
    threshold: number,
    minDelta: number,
    maxDelta: number
  ) => {
    const constrained = Math.max(minDelta, Math.min(maxDelta, rawDelta));
    const movingFeatures = [start + constrained, start + constrained + length / 2, start + constrained + length];
    let best = { delta: constrained, guide: null as number | null, distance: threshold + 1 };
    movingFeatures.forEach((feature) => {
      targets.forEach((target) => {
        const adjustment = target - feature;
        const nextDelta = constrained + adjustment;
        const distance = Math.abs(adjustment);
        if (nextDelta < minDelta || nextDelta > maxDelta || distance > threshold || distance >= best.distance) return;
        best = { delta: nextDelta, guide: target, distance };
      });
    });
    return best;
  };

  const axisTargets = (elements: ReportElement[], axis: "x" | "y") => elements.flatMap((element) => axis === "x"
    ? [element.x, element.x + element.w / 2, element.x + element.w]
    : [element.y, element.y + element.h / 2, element.y + element.h]);

  const snapCoordinate = (value: number, targets: number[], threshold: number, min: number, max: number) => {
    let best = { value: Math.max(min, Math.min(max, value)), guide: null as number | null, distance: threshold + 1 };
    targets.forEach((target) => {
      const distance = Math.abs(value - target);
      if (target < min || target > max || distance > threshold || distance >= best.distance) return;
      best = { value: target, guide: target, distance };
    });
    return best;
  };

  const startElementDrag = (event: ReactPointerEvent, id: string) => {
    event.stopPropagation();
    if (!activePage) return;
    const clicked = activePage.elements.find((element) => element.id === id);
    if (!clicked || clicked.locked || textEditRef.current?.elementId === id || cropEditRef.current?.elementId === id) return;
    if (cropEditRef.current) finishCropEdit("commit");
    const committedDocument = textEditRef.current ? finishTextEdit("commit") : documentRef.current;
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    let ids = new Set(selectedIds);
    const unitIds = selectionUnitIds(activePage, id);
    if (additive) {
      const remove = unitIds.every((unitId) => ids.has(unitId));
      unitIds.forEach((unitId) => remove ? ids.delete(unitId) : ids.add(unitId));
    } else if (!unitIds.every((unitId) => ids.has(unitId))) {
      ids = new Set(unitIds);
    }
    const selectionChanged = ids.size !== selectedIds.size || [...ids].some((selectedId) => !selectedIds.has(selectedId));
    if (selectionChanged) setSelectedIds(ids);
    setRightOpen(true);
    if (compactLayout) setLeftOpen(false);
    if (inspectorTab === "page") setInspectorTab(["divider", "box"].includes(clicked.type) ? "style" : "data");
    const movableIds = [...ids].filter((selectedId) => !activePage.elements.find((item) => item.id === selectedId)?.locked);
    if (!movableIds.length) return;
    const startDocument = clone(committedDocument);
    const startX = event.clientX;
    const startY = event.clientY;
    const movable = activePage.elements.filter((element) => movableIds.includes(element.id));
    const initial = new Map(movable.map((element) => [element.id, { x: element.x, y: element.y }]));
    const bounds = {
      x: Math.min(...movable.map((element) => element.x)),
      y: Math.min(...movable.map((element) => element.y)),
      right: Math.max(...movable.map((element) => element.x + element.w)),
      bottom: Math.max(...movable.map((element) => element.y + element.h))
    };
    const boxWidth = bounds.right - bounds.x;
    const boxHeight = bounds.bottom - bounds.y;
    let moved = false;

    const onMove = (moveEvent: PointerEvent) => {
      moved = true;
      let dx = (moveEvent.clientX - startX) / pxPerMm;
      let dy = (moveEvent.clientY - startY) / pxPerMm;
      const pageSize = PAGE_MM[activePage.orientation];
      const other = activePage.elements.filter((element) => !movableIds.includes(element.id) && !element.hidden);
      let guideX: number | null = null;
      let guideY: number | null = null;
      if (document.pageSetup.snap && !moveEvent.altKey) {
        const threshold = 8 / pxPerMm;
        const grid = document.pageSetup.grid;
        const xFeatures = [bounds.x + dx, bounds.x + dx + boxWidth / 2, bounds.x + dx + boxWidth];
        const yFeatures = [bounds.y + dy, bounds.y + dy + boxHeight / 2, bounds.y + dy + boxHeight];
        const xCandidates = [
          0,
          document.pageSetup.margin,
          pageSize.width / 2,
          pageSize.width - document.pageSetup.margin,
          pageSize.width,
          ...axisTargets(other, "x"),
          ...(grid > 0 ? xFeatures.map((feature) => Math.round(feature / grid) * grid) : [])
        ];
        const yCandidates = [
          0,
          document.pageSetup.margin,
          pageSize.height / 2,
          pageSize.height - document.pageSetup.margin,
          pageSize.height,
          ...axisTargets(other, "y"),
          ...(grid > 0 ? yFeatures.map((feature) => Math.round(feature / grid) * grid) : [])
        ];
        const sx = snapBoxAxis(bounds.x, boxWidth, dx, xCandidates, threshold, -bounds.x, pageSize.width - bounds.right);
        const sy = snapBoxAxis(bounds.y, boxHeight, dy, yCandidates, threshold, -bounds.y, pageSize.height - bounds.bottom);
        dx = sx.delta;
        dy = sy.delta;
        guideX = sx.guide;
        guideY = sy.guide;
      }
      setGuides({
        x: guideX === null ? [] : [guideX],
        y: guideY === null ? [] : [guideY]
      });
      dx = Math.max(-bounds.x, Math.min(pageSize.width - bounds.right, dx));
      dy = Math.max(-bounds.y, Math.min(pageSize.height - bounds.bottom, dy));
      setDocument((current) => {
        const next = clone(startDocument);
        const page = next.pages.find((item) => item.id === activePageId)!;
        page.elements.forEach((element) => {
          const origin = initial.get(element.id);
          if (!origin) return;
          element.x = round(origin.x + dx);
          element.y = round(origin.y + dy);
        });
        next.updatedAt = current.updatedAt;
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setGuides({ x: [], y: [] });
      if (moved) {
        setPast((items) => [...items.slice(-79), startDocument]);
        setFuture([]);
        setDocument((current) => ({ ...current, updatedAt: new Date().toISOString() }));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const startResize = (event: ReactPointerEvent, id: string, direction: ResizeDirection) => {
    event.preventDefault();
    event.stopPropagation();
    if (!activePage) return;
    const element = activePage.elements.find((item) => item.id === id);
    if (!element || element.locked) return;
    finishCropEdit("commit");
    const startDocument = clone(textEditRef.current ? finishTextEdit("commit") : documentRef.current);
    const start = clone(element);
    const startX = event.clientX;
    const startY = event.clientY;
    const pageSize = PAGE_MM[activePage.orientation];
    let moved = false;
    const onMove = (moveEvent: PointerEvent) => {
      moved = true;
      let dx = (moveEvent.clientX - startX) / pxPerMm;
      let dy = (moveEvent.clientY - startY) / pxPerMm;
      let x = start.x;
      let y = start.y;
      let w = start.w;
      let h = start.h;
      if (direction.includes("e")) w = start.w + dx;
      if (direction.includes("s")) h = start.h + dy;
      if (direction.includes("w")) { x = start.x + dx; w = start.w - dx; }
      if (direction.includes("n")) { y = start.y + dy; h = start.h - dy; }
      if (w < 5) { if (direction.includes("w")) x -= 5 - w; w = 5; }
      if (h < 3) { if (direction.includes("n")) y -= 3 - h; h = 3; }
      x = Math.max(0, Math.min(x, pageSize.width - w));
      y = Math.max(0, Math.min(y, pageSize.height - h));
      w = Math.min(w, pageSize.width - x);
      h = Math.min(h, pageSize.height - y);
      let guideX: number | null = null;
      let guideY: number | null = null;
      if (document.pageSetup.snap && !moveEvent.altKey) {
        const threshold = 8 / pxPerMm;
        const grid = document.pageSetup.grid;
        const other = activePage.elements.filter((item) => item.id !== id && !item.hidden);
        const currentX = direction.includes("w") ? x : x + w;
        const currentY = direction.includes("n") ? y : y + h;
        const xCandidates = [0, document.pageSetup.margin, pageSize.width / 2, pageSize.width - document.pageSetup.margin, pageSize.width, ...axisTargets(other, "x")];
        const yCandidates = [0, document.pageSetup.margin, pageSize.height / 2, pageSize.height - document.pageSetup.margin, pageSize.height, ...axisTargets(other, "y")];
        if (grid > 0) {
          xCandidates.push(Math.round(currentX / grid) * grid);
          yCandidates.push(Math.round(currentY / grid) * grid);
        }
        if (direction.includes("w")) {
          const right = x + w;
          const snapped = snapCoordinate(x, xCandidates, threshold, 0, right - 5);
          x = snapped.value;
          w = right - x;
          guideX = snapped.guide;
        } else if (direction.includes("e")) {
          const snapped = snapCoordinate(x + w, xCandidates, threshold, x + 5, pageSize.width);
          w = snapped.value - x;
          guideX = snapped.guide;
        }
        if (direction.includes("n")) {
          const bottom = y + h;
          const snapped = snapCoordinate(y, yCandidates, threshold, 0, bottom - 3);
          y = snapped.value;
          h = bottom - y;
          guideY = snapped.guide;
        } else if (direction.includes("s")) {
          const snapped = snapCoordinate(y + h, yCandidates, threshold, y + 3, pageSize.height);
          h = snapped.value - y;
          guideY = snapped.guide;
        }
      }
      setGuides({ x: guideX === null ? [] : [guideX], y: guideY === null ? [] : [guideY] });
      setDocument(() => {
        const next = clone(startDocument);
        const target = next.pages.find((page) => page.id === activePageId)?.elements.find((item) => item.id === id);
        if (target) Object.assign(target, { x: round(x), y: round(y), w: round(w), h: round(h) });
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setGuides({ x: [], y: [] });
      if (moved) {
        setPast((items) => [...items.slice(-79), startDocument]);
        setFuture([]);
        setDocument((current) => ({ ...current, updatedAt: new Date().toISOString() }));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const startBoxSelect = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !canvasRef.current || !activePage) return;
    if (!(event.metaKey || event.ctrlKey || event.shiftKey)) setSelectedIds(new Set());
    setInspectorTab("page");
    setRightOpen(true);
    if (compactLayout) setLeftOpen(false);
    finishTextEdit("commit");
    finishCropEdit("commit");
    const rect = canvasRef.current.getBoundingClientRect();
    const startX = (event.clientX - rect.left) / pxPerMm;
    const startY = (event.clientY - rect.top) / pxPerMm;
    const previous = new Set(selectedIds);
    const onMove = (moveEvent: PointerEvent) => {
      const currentX = (moveEvent.clientX - rect.left) / pxPerMm;
      const currentY = (moveEvent.clientY - rect.top) / pxPerMm;
      const box = {
        x: Math.max(0, Math.min(startX, currentX)),
        y: Math.max(0, Math.min(startY, currentY)),
        w: Math.abs(currentX - startX),
        h: Math.abs(currentY - startY)
      };
      setSelectionBox(box);
      const matched = activePage.elements.filter((element) => !element.hidden &&
        element.x < box.x + box.w && element.x + element.w > box.x &&
        element.y < box.y + box.h && element.y + element.h > box.y
      ).map((element) => element.id);
      setSelectedIds(expandSelectionToGroups(activePage, [...(event.metaKey || event.ctrlKey || event.shiftKey ? previous : []), ...matched]));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setSelectionBox(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        requestPrint();
        return;
      }
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      if (cropEditRef.current && event.key === "Escape") { event.preventDefault(); finishCropEdit("cancel"); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") { event.preventDefault(); duplicateSelection(); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelectedIds(new Set(activePage?.elements.filter((element) => !element.hidden).map((element) => element.id) || []));
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelection(); return; }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) && selectedIds.size) {
        event.preventDefault();
        const amount = event.shiftKey ? 5 : 1;
        const delta = {
          ArrowLeft: [-amount, 0], ArrowRight: [amount, 0], ArrowUp: [0, -amount], ArrowDown: [0, amount]
        }[event.key] as number[];
        updateSelected((element) => {
          if (element.locked || !activePage) return;
          const size = PAGE_MM[activePage.orientation];
          element.x = round(Math.max(0, Math.min(size.width - element.w, element.x + delta[0])));
          element.y = round(Math.max(0, Math.min(size.height - element.h, element.y + delta[1])));
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    const onBeforePrint = () => {
      if (preparedPrintRef.current) return;
      flushSync(() => {
        finishCropEdit("commit");
        const report = finishTextEdit("commit");
        setPrintDocument(report);
        setPrintAssetData(assetData);
      });
    };
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  });

  const exportZip = async () => {
    try {
      finishCropEdit("commit");
      const report = finishTextEdit("commit");
      const stored = await getAssets(report.assets.map((asset) => asset.id), assetNamespace).catch(() => ({}));
      const portableAssets = { ...stored, ...assetData };
      const missingAsset = report.assets.find((asset) => !portableAssets[asset.id]);
      if (missingAsset) throw new Error(`图片资产「${missingAsset.sourceName || missingAsset.id}」缺失，已拒绝导出不完整工程`);
      const files: Record<string, Uint8Array> = {
        "document.json": strToU8(JSON.stringify(report, null, 2))
      };
      report.assets.forEach((asset) => {
        files[`assets/${asset.id}.${assetExtension(asset.mime)}`] = dataUrlToBytes(portableAssets[asset.id]);
      });
      const archive = zipSync(files, { level: 6 });
      downloadBlob(`${cleanFilename(report.meta.title)}.report.zip`, new Blob([archive.buffer as ArrayBuffer], { type: "application/zip" }));
      notify(`ZIP 工程已导出，共 ${formatBytes(archive.byteLength)}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "ZIP 工程导出失败");
    }
  };

  const exportJson = async () => {
    try {
      finishCropEdit("commit");
      const report = finishTextEdit("commit");
      const stored = await getAssets(report.assets.map((asset) => asset.id), assetNamespace).catch(() => ({}));
      const portableAssets = { ...stored, ...assetData };
      const missingAsset = report.assets.find((asset) => !portableAssets[asset.id]);
      if (missingAsset) throw new Error(`图片资产「${missingAsset.sourceName || missingAsset.id}」缺失，已拒绝导出不完整工程`);
      const project = { ...report, assetData: Object.fromEntries(report.assets.map((asset) => [asset.id, portableAssets[asset.id]])) };
      downloadFile(`${cleanFilename(report.meta.title)}.report.json`, JSON.stringify(project, null, 2), "application/json");
      notify("归档 JSON 已导出；base64 通常增加约 33% 体积");
    } catch (error) {
      notify(error instanceof Error ? error.message : "归档 JSON 导出失败");
    }
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      let imported: { document: ReportDocument; assetData: Record<string, string> };
      if (file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip") {
        if (file.size > MAX_PROJECT_ARCHIVE_BYTES) throw new Error("ZIP 工程超过 64 MB 导入上限");
        const entries = unzipProjectArchive(new Uint8Array(await file.arrayBuffer()));
        const documentEntry = entries["document.json"];
        if (!documentEntry) throw new Error("ZIP 工程缺少 document.json");
        if (documentEntry.byteLength > MAX_PROJECT_DOCUMENT_BYTES) throw new Error("ZIP 工程的 document.json 超过 10 MB 上限");
        const rawDocument = JSON.parse(strFromU8(documentEntry));
        const portableData: Record<string, string> = {};
        const allowedEntries = new Set(["document.json"]);
        for (const asset of rawDocument.assets || []) {
          const entryName = `assets/${asset.id}.${assetExtension(asset.mime || "")}`;
          const assetEntry = entries[entryName];
          if (!assetEntry) throw new Error(`ZIP 工程缺少图片资产文件：${entryName}`);
          allowedEntries.add(entryName);
          portableData[asset.id] = bytesToDataUrl(assetEntry, asset.mime || "image/*");
        }
        const unexpectedEntry = Object.keys(entries).find((name) => !name.endsWith("/") && !allowedEntries.has(name));
        if (unexpectedEntry) throw new Error(`ZIP 工程包含未声明文件：${unexpectedEntry}`);
        imported = normalizeProject({ ...rawDocument, assetData: portableData }, { requireAssetData: true });
      } else {
        if (file.size > MAX_PROJECT_JSON_BYTES) throw new Error("JSON 工程超过 80 MB 导入上限");
        imported = normalizeProject(JSON.parse(await file.text()), { requireAssetData: true });
      }
      const sanitized = await sanitizeImportedProjectAssets(imported, keepOriginalImages);
      await putAssetsAtomically(sanitized.document.assets.map((asset) => ({ id: asset.id, data: sanitized.assetData[asset.id], mime: asset.mime })), assetNamespace);
      setPast((items) => [...items.slice(-79), clone(document)]);
      setFuture([]);
      documentRef.current = sanitized.document;
      setDocument(sanitized.document);
      setAssetData(sanitized.assetData);
      setActivePageId(sanitized.document.pages[0]?.id || "");
      setSelectedIds(new Set());
      notify("工程文件已安全打开；图片已重编码并剥离 EXIF/GPS");
    } catch (error) {
      notify(error instanceof Error ? error.message : "工程文件无法打开");
    }
  };

  const replaceStarter = (kind: StarterKey) => {
    if (!window.confirm("新建报告会替换当前工程。未导出的修改仍可通过撤销恢复，是否继续？")) return;
    const next = createStarterReport(kind);
    setPast((items) => [...items.slice(-79), clone(document)]);
    setFuture([]);
    documentRef.current = next;
    setDocument(next);
    setAssetData({});
    setActivePageId(next.pages[0].id);
    setSelectedIds(new Set());
    setNewMenuOpen(false);
  };

  const requestPrint = () => {
    if (chartDataElementId || tableDataElementId) {
      notify("请先应用或取消单元格编辑，再打印或导出 PDF");
      return;
    }
    finishCropEdit("commit");
    const report = finishTextEdit("commit");
    const issues = validateDocument(report, fontWarnings);
    if (issues.length) setValidationIssues(issues);
    else executePrint();
  };

  const executePrint = async () => {
    if (preparedPrintRef.current) return;
    preparedPrintRef.current = true;
    try {
      setValidationIssues(null);
      finishCropEdit("commit");
      const report = finishTextEdit("commit");
      const prepared = await preparePrintProject(report, assetData, report.pageSetup.printDpi || 300);
      setPrintDocument(prepared.document);
      setPrintAssetData(prepared.assetData);
      await window.document.fonts?.ready;
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
      await prepareChartsForPrint();
      window.print();
      if (prepared.report.items.length) setImageSizeReport(prepared.report);
    } catch (error) {
      notify(`打印准备失败：${error instanceof Error ? error.message : "无法生成打印副本"}`);
    } finally {
      preparedPrintRef.current = false;
    }
  };

  const cacheImageFile = async (file: File) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("图片只支持 PNG、JPEG 或 WebP 位图");
    const result = await readImageAsset(file, keepOriginalImages);
    const duplicate = documentRef.current.assets.find((asset) => asset.hash && asset.hash === result.asset.hash);
    if (duplicate) {
      const data = assetData[duplicate.id] || result.data;
      setAssetData((current) => ({ ...current, [duplicate.id]: data }));
      if (!assetData[duplicate.id]) await putAsset(duplicate.id, result.blob, duplicate.mime, assetNamespace);
      return { asset: duplicate, data, duplicate: true };
    }
    setAssetData((current) => ({ ...current, [result.asset.id]: result.data }));
    try {
      await putAsset(result.asset.id, result.blob, result.asset.mime, assetNamespace);
    } catch (error) {
      setSaveError(`图片存储失败：${error instanceof Error ? error.message : "IndexedDB 不可用"}。请立即导出工程文件。`);
    }
    return { ...result, duplicate: false };
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedElement || selectedElement.type !== "image") return;
    try {
      const { asset, duplicate } = await cacheImageFile(file);
      commit((draft) => {
        if (!duplicate) draft.assets.push(asset);
        const page = draft.pages.find((item) => item.id === activePageId);
        const element = page?.elements.find((item) => item.id === selectedElement.id);
        if (element) {
          element.assetId = asset.id;
          delete element.image;
          element.content = file.name;
          element.crop = { sx: 0, sy: 0, sw: asset.width, sh: asset.height };
          element.imageStyle = { ...DEFAULT_IMAGE_STYLE };
        }
      });
      notify(duplicate ? "检测到相同图片，已复用现有资产" : `图片已优化为 ${asset.width} x ${asset.height}`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "图片读取失败");
    }
  };

  const uploadMasterImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activePage) return;
    try {
      const { asset, duplicate } = await cacheImageFile(file);
      commit((draft) => {
        if (!duplicate) draft.assets.push(asset);
        const page = draft.pages.find((item) => item.id === activePageId);
        if (page) page.masterProps = { ...page.masterProps, imageAssetId: asset.id, crop: { sx: 0, sy: 0, sw: asset.width, sh: asset.height }, focal: { x: 50, y: 50 }, imageStyle: { ...DEFAULT_IMAGE_STYLE, overlayKind: "linear", overlayColor: "primary", overlayColor2: "transparent", strength: 0.72 } };
      });
      notify(duplicate ? "母版已复用相同图片资产" : "母版图片已优化并更新");
    } catch (error) {
      notify(error instanceof Error ? error.message : "图片读取失败");
    }
  };

  const convertMasterToElement = () => {
    const assetId = activePage.masterProps?.imageAssetId;
    if (!assetId) return;
    const size = PAGE_MM[activePage.orientation];
    const h = activePage.master === "section" ? 70 : size.height;
    const asset = document.assets.find((item) => item.id === assetId);
    const element = makeElement("image", 0, 0, size.width, h, { name: "母版图片", assetId, content: "由母版图片转换", z: 0, crop: clone(activePage.masterProps?.crop || { sx: 0, sy: 0, sw: asset?.width || 1, sh: asset?.height || 1 }), imageStyle: clone(activePage.masterProps?.imageStyle || DEFAULT_IMAGE_STYLE) });
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      if (!page) return;
      page.elements.push(element);
      if (page.masterProps) delete page.masterProps.imageAssetId;
    });
    setSelectedIds(new Set([element.id]));
    setInspectorTab("data");
  };

  const setImageAsMaster = (elementId: string) => {
    commit((draft) => {
      const page = draft.pages.find((item) => item.id === activePageId);
      const element = page?.elements.find((item) => item.id === elementId);
      if (!page || !element?.assetId) return;
      page.masterProps = { ...page.masterProps, imageAssetId: element.assetId, crop: clone(element.crop), focal: { x: 50, y: 50 }, imageStyle: clone(element.imageStyle || DEFAULT_IMAGE_STYLE) };
      page.elements = page.elements.filter((item) => item.id !== elementId);
    });
    setSelectedIds(new Set());
    setInspectorTab("page");
    setRightOpen(true);
    if (compactLayout) setLeftOpen(false);
  };

  const cleanupUnusedAssets = async () => {
    const unused = document.assets.filter((asset) => !document.pages.some((page) => page.masterProps?.imageAssetId === asset.id || page.elements.some((element) => element.assetId === asset.id)));
    if (!unused.length) return notify("没有未使用的图片资产");
    if (!window.confirm(`将永久删除 ${unused.length} 个未使用资产，是否继续？`)) return;
    const ids = new Set(unused.map((asset) => asset.id));
    commit((draft) => { draft.assets = draft.assets.filter((asset) => !ids.has(asset.id)); });
    setAssetData((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !ids.has(id))));
    await removeAssets([...ids], assetNamespace);
    notify(`已删除 ${unused.length} 个未使用资产`);
  };

  const optimizeAsset = async (assetId: string) => {
    const asset = document.assets.find((item) => item.id === assetId);
    const data = assetData[assetId];
    if (!asset || !data) return notify("资产数据尚未加载");
    const usages = document.pages.flatMap((page) => page.elements.filter((element) => element.assetId === assetId).map((element) => ({ width: element.w, height: element.h })));
    document.pages.forEach((page) => {
      if (page.masterProps?.imageAssetId !== assetId) return;
      const size = PAGE_MM[page.orientation];
      usages.push({ width: size.width, height: page.master === "section" ? 70 : size.height });
    });
    if (!usages.length) return notify("未使用资产可直接清理");
    const dpi = document.pageSetup.printDpi || 300;
    const requiredWidth = Math.max(...usages.map((usage) => usage.width / 25.4 * dpi));
    const requiredHeight = Math.max(...usages.map((usage) => usage.height / 25.4 * dpi));
    const scale = Math.min(1, Math.max(requiredWidth / asset.width, requiredHeight / asset.height));
    if (scale >= 0.98) return notify("当前资产已满足用途，无需继续缩小");
    const bitmap = await createImageBitmap(await createAssetBlob(data, asset.mime));
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(asset.width * scale));
    canvas.height = Math.max(1, Math.ceil(asset.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const outputMime = asset.mime === "image/png" ? "image/png" : "image/jpeg";
    const blob = await canvasToBlob(canvas, outputMime, outputMime === "image/png" ? undefined : 0.85);
    const nextData = await blobToDataUrl(blob);
    const nextHash = await sha256(blob);
    await putAsset(assetId, blob, outputMime, assetNamespace);
    setAssetData((current) => ({ ...current, [assetId]: nextData }));
    commit((draft) => {
      const metadata = draft.assets.find((item) => item.id === assetId);
      if (metadata) Object.assign(metadata, { mime: outputMime, width: canvas.width, height: canvas.height, byteSize: blob.size, hash: nextHash, optimized: true });
      draft.pages.forEach((page) => page.elements.forEach((element) => {
        if (element.assetId === assetId && element.crop) element.crop = { sx: element.crop.sx * scale, sy: element.crop.sy * scale, sw: element.crop.sw * scale, sh: element.crop.sh * scale };
      }));
    });
    notify(`资产已优化，节省 ${Math.max(0, Math.round((1 - blob.size / Math.max(1, asset.byteSize)) * 100))}%`);
  };

  const filteredPresets = useMemo(() => COMPONENT_PRESETS.filter((preset) =>
    preset.label.toLowerCase().includes(search.toLowerCase()) || preset.id.includes(search.toLowerCase()) || preset.description.toLowerCase().includes(search.toLowerCase())
  ), [search]);

  if (!activePage) return null;

  const exitEmbeddedEditor = () => {
    finishTextEdit("commit");
    finishCropEdit("commit");
    embedded?.onExit?.(documentRef.current, assetData);
  };

  return (
    <>
      <div className="app-shell">
        {(saveError || assetBudgetWarning) && <div className="storage-alert" role="alert"><AlertTriangle size={15} />{saveError || assetBudgetWarning}<button type="button" onClick={() => void exportZip()}>导出工程</button></div>}
        <header className="topbar">
          <div className="brand-block">
            <LayoutTemplate size={20} strokeWidth={ICON_STROKE} />
            <div><strong>{embedded?.title || "本地报告工坊"}</strong><span>毫米级 A4 排版 · v1.7</span></div>
          </div>
          {structureEditing && <div className="toolbar-group file-actions">
            {!embedded && <div className="menu-anchor">
              <button className="command-button" type="button" onClick={() => setNewMenuOpen((open) => !open)}><FilePlus2 size={15} />新建<ChevronDown size={12} /></button>
              {newMenuOpen && <div className="new-menu">
                <button type="button" onClick={() => replaceStarter("professional")}><BarChart3 size={16} /><span><strong>经营分析</strong><small>五页专业示例</small></span></button>
                <button type="button" onClick={() => replaceStarter("finance")}><FileText size={16} /><span><strong>财务简报</strong><small>延续 v4 报告语言</small></span></button>
                <button type="button" onClick={() => replaceStarter("publication")}><LayoutTemplate size={16} /><span><strong>研究出版</strong><small>留白叙事与数据图谱</small></span></button>
                <button type="button" onClick={() => replaceStarter("blank")}><FilePlus2 size={16} /><span><strong>空白报告</strong><small>从 A4 母版开始</small></span></button>
              </div>}
            </div>}
            <button className="command-button quiet" type="button" onClick={() => fileInput.current?.click()}><Upload size={15} />打开</button>
            <button className="command-button quiet" type="button" onClick={() => void exportZip()}><Download size={15} />导出 ZIP</button>
            <input ref={fileInput} type="file" accept=".zip,.report.zip,.json,.report.json,application/zip,application/json" hidden onChange={importJson} />
          </div>}
          {embedded && <div className="toolbar-group file-actions">{embedded.onExit && <button className="command-button" type="button" onClick={exitEmbeddedEditor}><Check size={15} />完成精修</button>}<button className="command-button quiet" type="button" onClick={embedded.onResetVisual}><RotateCcw size={15} />{embedded.resetLabel || "恢复作者布局"}</button></div>}
          <div className="toolbar-separator" />
          <div className="toolbar-group">
            <IconButton label="撤销" disabled={!past.length} onClick={undo}><Undo2 size={17} /></IconButton>
            <IconButton label="重做" disabled={!future.length} onClick={redo}><Redo2 size={17} /></IconButton>
            {structureEditing && <><IconButton label="复制所选" disabled={!selectedIds.size} onClick={duplicateSelection}><Copy size={16} /></IconButton><IconButton label={selectedElements.length && selectedElements.every((element) => element.locked) ? "解锁所选" : "锁定所选"} disabled={!selectedIds.size} active={selectedElements.length > 0 && selectedElements.every((element) => element.locked)} onClick={lockSelection}>{selectedElements.length && selectedElements.every((element) => element.locked) ? <Unlock size={16} /> : <Lock size={16} />}</IconButton><IconButton label="隐藏所选" disabled={!selectedIds.size} onClick={hideSelection}><EyeOff size={16} /></IconButton><IconButton label="拆分组合" disabled={!selectedGroupCount} onClick={ungroupSelection}><Ungroup size={16} /></IconButton><IconButton label="删除所选" disabled={!selectedIds.size} onClick={deleteSelection}><Trash2 size={16} /></IconButton></>}
          </div>
          <div className="toolbar-fill" />
          <div className="zoom-control">
            <IconButton label="缩小" onClick={() => setZoom((value) => Math.max(50, value - 5))}><ZoomOut size={15} /></IconButton>
            <input aria-label="画布缩放" type="range" min="50" max="200" step="5" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
            <span>{zoom}%</span>
            <IconButton label="放大" onClick={() => setZoom((value) => Math.min(200, value + 5))}><ZoomIn size={15} /></IconButton>
          </div>
          <button className="print-button" type="button" onClick={requestPrint}><Printer size={16} />打印 / PDF</button>
        </header>

        <div className="workspace">
          <aside className={`left-panel ${leftOpen ? "open" : "closed"}`}>
            <IconButton label="关闭页面面板" className="panel-close" onClick={() => setLeftOpen(false)}><X size={15} /></IconButton>
            <div className={`panel-tabs ${structureEditing ? "two-tabs" : "one-tab"}`}>
              <button type="button" className={leftTab === "pages" ? "active" : ""} onClick={() => setLeftTab("pages")}><FileText size={14} />页面</button>
              {structureEditing && <button type="button" className={leftTab === "components" ? "active" : ""} onClick={() => setLeftTab("components")}><Plus size={14} />组件</button>}
            </div>
            {leftTab === "pages" ? (
              <div className="panel-content pages-panel">
                <div className="panel-heading"><span>{document.pages.length} 页</span>{structureEditing && <div>
                  <IconButton label="复制当前页" onClick={duplicatePage}><Copy size={14} /></IconButton>
                  <IconButton label="删除当前页" disabled={document.pages.length <= 1} onClick={deletePage}><Trash2 size={14} /></IconButton>
                </div>}</div>
                <div className="page-list">
                  {document.pages.map((page, index) => <PageThumbnail key={page.id} page={page} document={document} index={index} active={page.id === activePageId} onClick={() => selectPage(page.id)} />)}
                </div>
                {structureEditing && <div className="add-page-row">
                  <button type="button" onClick={() => addPage("standard", "portrait")}><Plus size={15} />纵向页</button>
                  <button type="button" onClick={() => addPage("standard", "landscape")}><Plus size={15} />横向页</button>
                </div>}
              </div>
            ) : (
              <div className="panel-content component-panel">
                <label className="search-box"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索组件" /></label>
                {(["basic", "composition"] as const).map((category) => {
                  const presets = filteredPresets.filter((preset) => preset.category === category);
                  if (!presets.length) return null;
                  return <section className="component-section" key={category}>
                    <div className="component-section-title"><strong>{category === "basic" ? "基础元素" : "组合模块"}</strong><span>{category === "basic" ? "单个对象" : "插入后可拆分"}</span></div>
                    <div className="component-grid">
                      {presets.map((preset) => {
                        const Icon = iconForPreset[preset.icon];
                        return <button type="button" key={preset.id} onClick={() => addElement(preset.id)} title={preset.description}><Icon size={19} strokeWidth={1.55} /><span>{preset.label}</span></button>;
                      })}
                    </div>
                  </section>;
                })}
                {!filteredPresets.length && <div className="empty-state"><Search size={22} /><span>没有匹配组件</span></div>}
              </div>
            )}
          </aside>

          <main className="canvas-area">
            <div className="canvas-toolbar">
              <IconButton label={leftOpen ? "收起页面面板" : "展开页面面板"} active={leftOpen} onClick={() => {
                const next = !leftOpen;
                setLeftOpen(next);
                if (next && compactLayout) setRightOpen(false);
              }}><PanelLeftClose size={16} /></IconButton>
              <span className="canvas-title"><strong>{activePage.name}</strong><small>{activePage.orientation === "portrait" ? "210 x 297 mm" : "297 x 210 mm"}</small></span>
              <div className="alignment-tools" role="toolbar" aria-label="元素对齐与分布">
                <IconButton label={movableSelectedCount === 1 ? "与页面左对齐" : "所选元素左对齐"} disabled={!movableSelectedCount} onClick={() => alignSelection("left")}><AlignHorizontalJustifyStart size={14} /></IconButton>
                <IconButton label={movableSelectedCount === 1 ? "与页面水平居中" : "所选元素水平居中"} disabled={!movableSelectedCount} onClick={() => alignSelection("center")}><AlignHorizontalJustifyCenter size={14} /></IconButton>
                <IconButton label={movableSelectedCount === 1 ? "与页面右对齐" : "所选元素右对齐"} disabled={!movableSelectedCount} onClick={() => alignSelection("right")}><AlignHorizontalJustifyEnd size={14} /></IconButton>
                <span className="alignment-divider" />
                <IconButton label={movableSelectedCount === 1 ? "与页面顶部对齐" : "所选元素顶部对齐"} disabled={!movableSelectedCount} onClick={() => alignSelection("top")}><AlignVerticalJustifyStart size={14} /></IconButton>
                <IconButton label={movableSelectedCount === 1 ? "与页面垂直居中" : "所选元素垂直居中"} disabled={!movableSelectedCount} onClick={() => alignSelection("middle")}><AlignVerticalJustifyCenter size={14} /></IconButton>
                <IconButton label={movableSelectedCount === 1 ? "与页面底部对齐" : "所选元素底部对齐"} disabled={!movableSelectedCount} onClick={() => alignSelection("bottom")}><AlignVerticalJustifyEnd size={14} /></IconButton>
                <span className="alignment-divider" />
                <IconButton label="水平等间距分布（至少 3 项）" disabled={movableSelectedCount < 3} onClick={() => distributeSelection("horizontal")}><AlignHorizontalSpaceBetween size={14} /></IconButton>
                <IconButton label="垂直等间距分布（至少 3 项）" disabled={movableSelectedCount < 3} onClick={() => distributeSelection("vertical")}><AlignVerticalSpaceBetween size={14} /></IconButton>
              </div>
              <div className="canvas-toolbar-fill" />
              <button type="button" className={`mode-chip ${document.pageSetup.snap ? "active" : ""}`} onClick={() => commit((draft) => { draft.pageSetup.snap = !draft.pageSetup.snap; })}><MousePointer2 size={13} />吸附</button>
              <button type="button" className={`mode-chip ${document.pageSetup.showGrid ? "active" : ""}`} onClick={() => commit((draft) => { draft.pageSetup.showGrid = !draft.pageSetup.showGrid; })}><Grid3X3 size={13} />网格</button>
              <IconButton label={rightOpen ? "收起属性面板" : "展开属性面板"} active={rightOpen} onClick={() => {
                const next = !rightOpen;
                setRightOpen(next);
                if (next && compactLayout) setLeftOpen(false);
              }}><PanelRightClose size={16} /></IconButton>
            </div>
            <div className="canvas-scroll" ref={canvasScrollRef}>
              <div className="page-stage" style={{ padding: activePage.orientation === "portrait" ? "42px 80px 72px" : "42px 56px 72px" }}>
                <ReportPageView
                  document={document}
                  page={activePage}
                  assetData={assetData}
                  pxPerMm={pxPerMm}
                  selectedIds={selectedIds}
                  textEdit={textEdit}
                  cropEdit={cropEdit}
                  onElementPointerDown={startElementDrag}
                  onResizePointerDown={startResize}
                  onElementDoubleClick={(id, field) => {
                    const element = activePage.elements.find((item) => item.id === id);
                    if (element && ["text", "table"].includes(element.type)) {
                      beginTextEdit(id, field as TextEditField);
                    } else if (element?.type === "image") {
                      beginCropEdit(id);
                    }
                  }}
                  onTextInput={handleTextInput}
                  onTextSelection={handleTextSelection}
                  onTextFinish={handleTextFinish}
                  onCropChange={(crop, aspect) => replaceCropEdit((current) => current ? { ...current, draft: crop, aspect: aspect || current.aspect } : current)}
                  onCropFinish={finishCropEdit}
                  onMasterImageDoubleClick={beginMasterCropEdit}
                  onFormatElement={(id, recipe) => updateElement(id, recipe)}
                  onToggleRunMark={(id, mark) => {
                    const session = textEditRef.current;
                    if (session?.elementId === id && session.field === "content") {
                      replaceTextEdit({ ...session, runs: toggleRunMark(session.runs, session.selectionStart, session.selectionEnd, mark) });
                      return;
                    }
                    updateElement(id, (element) => {
                      const runs = elementRuns(element);
                      element.runs = toggleRunMark(runs, 0, runs.reduce((sum, run) => sum + run.text.length, 0), mark);
                      element.content = element.runs.map((run) => run.text).join("");
                    });
                  }}
                  selectedChartLabel={selectedChartLabel}
                  onSelectChartLabel={(selection) => {
                    setSelectedIds(new Set([selection.elementId]));
                    setSelectedChartLabel(selection);
                  }}
                  onMoveChartLabel={moveChartLabel}
                  onEditChartData={setChartDataElementId}
                  onEditTableData={setTableDataElementId}
                  onSetChartLabelMode={updateChartLabelMode}
                  onResetSelectedChartLabel={resetSelectedChartLabel}
                  onResetChartLabels={resetChartLabels}
                  isElementProtected={(id) => embedded?.protectedElementIds.has(id) || false}
                  preventFactualDuplicates={boundPrecisionMode}
                  onDuplicateElement={() => duplicateSelection()}
                  onToggleElementLock={() => lockSelection()}
                  onToggleElementHidden={() => hideSelection()}
                  onDeleteElement={() => deleteSelection()}
                  onCanvasPointerDown={startBoxSelect}
                  canvasRef={canvasRef}
                  guides={guides}
                  selectionBox={selectionBox}
                />
              </div>
            </div>
          </main>

          <aside className={`right-panel ${rightOpen ? "open" : "closed"}`}>
            <IconButton label="关闭属性面板" className="panel-close" onClick={() => setRightOpen(false)}><X size={15} /></IconButton>
            <div className="panel-tabs inspector-tabs">
              <button title="页面" type="button" className={inspectorTab === "page" ? "active" : ""} onClick={() => setInspectorTab("page")}><FileImage size={15} /><span>页面</span></button>
              <button title="数据" type="button" className={inspectorTab === "data" ? "active" : ""} onClick={() => setInspectorTab("data")}><Database size={15} /><span>数据</span></button>
              <button title="样式" type="button" className={inspectorTab === "style" ? "active" : ""} onClick={() => setInspectorTab("style")}><Palette size={15} /><span>样式</span></button>
              <button title="图层" type="button" className={inspectorTab === "layers" ? "active" : ""} onClick={() => setInspectorTab("layers")}><Layers3 size={15} /><span>图层</span></button>
              <button title="报告" type="button" className={inspectorTab === "document" ? "active" : ""} onClick={() => setInspectorTab("document")}><Settings2 size={15} /><span>报告</span></button>
            </div>
            <div className="panel-content inspector-content">
              {inspectorTab === "page" && <PageInspector document={document} page={activePage} assetData={assetData} update={commit} uploadBackgroundImage={uploadMasterImage} convertBackgroundToElement={convertMasterToElement} />}
              {inspectorTab === "data" && (
                selectedElement ? <DataInspector
                  element={selectedElement}
                  readOnlyData={embedded?.protectedElementIds.has(selectedElement.id) || false}
                  update={(recipe, field) => {
                    if (embedded?.protectedElementIds.has(selectedElement.id) && ["content", "chart", "table"].includes(field || "")) {
                      notify("该元素绑定真实数据，请在本地数据面板修改");
                      return;
                    }
                    updateElement(selectedElement.id, recipe, field);
                  }}
                  uploadImage={uploadImage}
                  setAsMaster={() => setImageAsMaster(selectedElement.id)}
                  onEditChartData={() => setChartDataElementId(selectedElement.id)}
                  onEditTableData={() => setTableDataElementId(selectedElement.id)}
                /> : (
                  <InspectorEmpty count={selectedElements.length} icon={<Database size={24} />} title={selectedElements.length > 1 ? `已选择 ${selectedElements.length} 个元素` : "未选择元素"} />
                )
              )}
              {inspectorTab === "style" && (
                selectedElements.length ? <StyleInspector elements={selectedElements} update={updateSelected} theme={document.theme} /> : <InspectorEmpty count={0} icon={<Palette size={24} />} title="未选择元素" />
              )}
              {inspectorTab === "layers" && <LayersInspector page={activePage} selectedIds={selectedIds} select={setSelectedIds} update={(recipe) => commit((draft) => { const page = draft.pages.find((item) => item.id === activePageId); if (page) recipe(page); })} />}
              {inspectorTab === "document" && <DocumentInspector document={document} assetData={assetData} readOnlyMeta={boundPrecisionMode} update={commit} exportZip={() => void exportZip()} exportJson={exportJson} cleanupUnusedAssets={() => void cleanupUnusedAssets()} optimizeAsset={(id) => void optimizeAsset(id)} keepOriginalImages={keepOriginalImages} setKeepOriginalImages={setKeepOriginalImages} />}
            </div>
          </aside>
        </div>

        <footer className="statusbar">
          <span><Check size={12} />已保存于本机 {savedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
          <span>第 {activePageIndex + 1} / {document.pages.length} 页</span>
          <span>{selectedIds.size ? `已选 ${selectedIds.size} 项${selectedGroupCount ? ` · ${selectedGroupCount} 组` : ""}` : "未选择"}</span>
          <span>{document.pageSetup.grid} mm 网格</span>
        </footer>
      </div>

      <div className="print-stage" aria-hidden="true">
        {printDocument.pages.map((page) => <ReportPageView document={printDocument} page={page} assetData={printAssetData} printing key={page.id} />)}
      </div>

      {toast && <div className="toast"><Check size={15} />{toast}</div>}
      {chartDataElement?.chart && <ChartDataDialog
        key={chartDataElement.id}
        element={chartDataElement}
        readOnly={embedded?.protectedElementIds.has(chartDataElement.id) || false}
        onClose={() => setChartDataElementId(null)}
        onSave={(chart) => {
          if (embedded?.protectedElementIds.has(chartDataElement.id)) {
            notify("旧版绑定图表只能查看，不能在此改写事实数据");
            return;
          }
          if (chartDataElement.chartKind === "donut") {
            const values = chart.series[0]?.values || [];
            if (values.some((value) => value < 0) || !values.some((value) => value > 0)) {
              notify("环形图不接受负数，且至少需要一个正值");
              return;
            }
          }
          updateElement(chartDataElement.id, (element) => { element.chart = chart; pruneChartLabelOffsets(element, chart); }, undefined, "chart");
          setSelectedChartLabel(null);
          setChartDataElementId(null);
        }}
      />}
      {tableDataElement?.table && <TableDataDialog
        key={tableDataElement.id}
        element={tableDataElement}
        readOnly={embedded?.protectedElementIds.has(tableDataElement.id) || false}
        onClose={() => setTableDataElementId(null)}
        onSave={(table) => {
          if (embedded?.protectedElementIds.has(tableDataElement.id)) {
            notify("旧版绑定表格只能查看，不能在此改写事实数据");
            return;
          }
          updateElement(tableDataElement.id, (element) => { element.table = table; }, undefined, "table");
          setTableDataElementId(null);
        }}
      />}
      {validationIssues && <div className="modal-backdrop" role="presentation" onMouseDown={() => setValidationIssues(null)}>
        <div className="validation-dialog" role="dialog" aria-modal="true" aria-labelledby="validation-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="dialog-icon"><AlertTriangle size={21} /></div>
          <div className="dialog-title"><h2 id="validation-title">打印前检查</h2><IconButton label="关闭" onClick={() => setValidationIssues(null)}><X size={17} /></IconButton></div>
          <p>发现 {validationIssues.length} 项需要确认：</p>
          <ul>{validationIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
          <div className="dialog-actions"><button type="button" onClick={() => setValidationIssues(null)}>返回修改</button><button type="button" className="primary" onClick={executePrint}><Printer size={15} />仍然打印</button></div>
        </div>
      </div>}
      {imageSizeReport && <div className="modal-backdrop" role="presentation" onMouseDown={() => setImageSizeReport(null)}>
        <div className="validation-dialog" role="dialog" aria-modal="true" aria-labelledby="size-report-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="dialog-title"><h2 id="size-report-title">打印图片体积报告</h2><IconButton label="关闭" onClick={() => setImageSizeReport(null)}><X size={17} /></IconButton></div>
          <p>图片副本从 {formatBytes(imageSizeReport.before)} 降至 {formatBytes(imageSizeReport.after)}，节省 {imageSizeReport.before ? Math.max(0, Math.round((1 - imageSizeReport.after / imageSizeReport.before) * 100)) : 0}%；原始工程资产未改变。</p>
          <ul>{imageSizeReport.items.slice(0, 5).map((item, index) => <li key={`${item.name}-${index}`}>{item.name}：{formatBytes(item.before)} → {formatBytes(item.after)}，节省 {item.before ? Math.max(0, Math.round((1 - item.after / item.before) * 100)) : 0}%</li>)}</ul>
          <div className="dialog-actions"><button type="button" className="primary" onClick={() => setImageSizeReport(null)}>完成</button></div>
        </div>
      </div>}
    </>
  );
}

export default function App() {
  const bootstrap = window.__REPORT_ENGINE_BOOTSTRAP__;
  if (!bootstrap) return <EditorApp />;
  return bootstrap.reportPackage.authoringMode === "independent"
    ? <IndependentReportRuntime bootstrap={bootstrap} />
    : <SpecializedReportRuntime bootstrap={bootstrap} />;
}

function InspectorEmpty({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }) {
  return <div className="inspector-empty">{icon}<strong>{title}</strong>{count > 1 && <span>位置与基础样式可批量调整</span>}</div>;
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="inspector-section"><div className="section-heading"><strong>{title}</strong>{action}</div>{children}</section>;
}

function ImageStyleControls({ value, onChange }: { value?: ImageStyle; onChange: (next: ImageStyle) => void }) {
  const style = value || DEFAULT_IMAGE_STYLE;
  const update = <K extends keyof ImageStyle>(key: K, next: ImageStyle[K]) => onChange({ ...style, [key]: next });
  return <div className="form-grid image-style-controls">
    <Field label="叠色类型"><select value={style.overlayKind} onChange={(event) => update("overlayKind", event.target.value as ImageStyle["overlayKind"])}><option value="none">无</option><option value="solid">纯色</option><option value="linear">线性渐变</option><option value="duotone">双色映射</option></select></Field>
    <Field label="强度"><select value={style.strength} onChange={(event) => update("strength", Number(event.target.value))}><option value="0.25">25%</option><option value="0.4">40%</option><option value="0.55">55%</option><option value="0.7">70%</option><option value="0.85">85%</option></select></Field>
    {style.overlayKind !== "none" && <>
      <Field label="主色"><select value={style.overlayColor} onChange={(event) => update("overlayColor", event.target.value as ImageStyle["overlayColor"])}><option value="primary">主题主色</option><option value="secondary">主题辅色</option><option value="accent">强调色</option><option value="text">墨色</option><option value="white">白色</option></select></Field>
      <Field label="副色"><select value={style.overlayColor2} onChange={(event) => update("overlayColor2", event.target.value as ImageStyle["overlayColor2"])}><option value="transparent">透明</option><option value="primary">主题主色</option><option value="secondary">主题辅色</option><option value="accent">强调色</option><option value="text">墨色</option><option value="white">白色</option></select></Field>
      <Field label="角度"><select value={style.overlayAngle} onChange={(event) => update("overlayAngle", Number(event.target.value) as ImageStyle["overlayAngle"])}><option value="0">0°</option><option value="45">45°</option><option value="90">90°</option><option value="135">135°</option></select></Field>
      <Field label="混合"><select value={style.blendMode} onChange={(event) => update("blendMode", event.target.value as ImageStyle["blendMode"])}><option value="multiply">正片叠底</option><option value="overlay">叠加</option><option value="soft-light">柔光</option></select></Field>
    </>}
    <Field label="调色预设"><select value={style.grade} onChange={(event) => update("grade", event.target.value as ImageStyle["grade"])}><option value="none">无</option><option value="deep-sea">深海蓝调</option><option value="film">胶片</option><option value="black-gold">黑金</option><option value="documentary-fade">纪实褪色</option></select></Field>
    <Field label="暗角"><select value={style.vignette} onChange={(event) => update("vignette", event.target.value as ImageStyle["vignette"])}><option value="none">无</option><option value="light">轻</option><option value="heavy">重</option></select></Field>
  </div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DataInspector({ element, readOnlyData = false, update, uploadImage, setAsMaster, onEditChartData, onEditTableData }: {
  element: ReportElement;
  readOnlyData?: boolean;
  update: (recipe: (element: ReportElement) => void, mergeField?: string) => void;
  uploadImage: (event: ChangeEvent<HTMLInputElement>) => void;
  setAsMaster: () => void;
  onEditChartData: () => void;
  onEditTableData: () => void;
}) {
  const isChart = element.type === "chart";
  const isCombo = element.chartKind === "combo";
  return <>
    <div className="selection-heading"><span className="type-icon">{(() => { const Icon = iconForType[element.type]; return <Icon size={16} />; })()}</span><div><strong>{element.name}</strong><small>{element.type}</small></div></div>
    {readOnlyData && <p className="binding-readonly-note">该元素绑定本地事实或派生值。内容与图表结构只读，请回到“本地数据”修改；位置、尺寸、样式和标签布局仍可精修。</p>}
    <Section title="内容">
      <div className="form-grid">
        <Field label="图层名称" wide><input value={element.name} onChange={(event) => update((item) => { item.name = event.target.value; }, "name")} /></Field>
        {element.type === "text" && <>
          <Field label="语义角色" wide><select value={element.semanticRole || "body"} onChange={(event) => update((item) => { item.semanticRole = event.target.value as ReportElement["semanticRole"]; }, "semantic-role")}><option value="body">正文</option><option value="title">标题</option><option value="caption">图表 / 图片说明</option><option value="source">资料来源</option><option value="kpi-label">KPI 标签</option><option value="kpi-value">KPI 数值</option><option value="kpi-unit">KPI 单位</option><option value="kpi-note">KPI 变化</option><option value="quote-body">引述正文</option><option value="quote-attribution">引述署名</option></select></Field>
          <Field label="文字内容" wide><textarea rows={5} readOnly={readOnlyData} value={element.content || ""} onChange={(event) => update((item) => { item.content = event.target.value; item.runs = [{ text: event.target.value }]; }, "content")} /></Field>
        </>}
        {isChart && <Field label="图表类型" wide><select disabled={readOnlyData} value={element.chartKind || "line"} onChange={(event) => update((item) => { item.chartKind = event.target.value as NonNullable<ReportElement["chartKind"]>; }, "chart-kind")}><option value="line">折线图</option><option value="bar">柱状图</option><option value="combo">柱线组合图</option><option value="donut">环形图</option></select></Field>}
      </div>
    </Section>
    {isChart && <Section title="本图数据" action={<span className="format-note">{element.chart?.categories.length || 0} 行 × {(element.chart?.series.length || 0) + 1} 列</span>}>
      <div className="data-editor-summary"><div><strong>{element.chart?.series.map((series) => series.name).join("、") || "尚无系列"}</strong><span>每个图表独立保存自己的类目和系列</span></div><button type="button" onClick={onEditChartData}><Table2 size={14} />{readOnlyData ? "查看单元格" : "打开单元格编辑器"}</button></div>
      <div className="toggle-row">
        <label><input type="checkbox" checked={element.style.showLabel !== false} onChange={(event) => update((item) => { item.style.showLabel = event.target.checked; })} />数据标签</label>
        <label><input type="checkbox" checked={element.style.showLegend !== false} onChange={(event) => update((item) => { item.style.showLegend = event.target.checked; })} />图例</label>
      </div>
      {isCombo && !readOnlyData && <div className="combo-series-list">
        {element.chart?.series.map((series, index) => <div className="combo-series-row" key={`${series.name}-${index}`}>
          <strong title={series.name}>{series.name}</strong>
          <select aria-label={`${series.name} 图形类型`} value={series.kind || (index === (element.chart?.series.length || 1) - 1 ? "line" : "bar")} onChange={(event) => update((item) => { const target = item.chart?.series[index]; if (target) target.kind = event.target.value as "bar" | "line"; })}><option value="bar">柱</option><option value="line">线</option></select>
          <select aria-label={`${series.name} 数值轴`} value={series.axis || (index === (element.chart?.series.length || 1) - 1 ? "right" : "left")} onChange={(event) => update((item) => { const target = item.chart?.series[index]; if (target) target.axis = event.target.value as "left" | "right"; })}><option value="left">左轴</option><option value="right">右轴</option></select>
          <input aria-label={`${series.name} 单位`} title="单位" placeholder="单位" value={series.unit || ""} onChange={(event) => update((item) => { const target = item.chart?.series[index]; if (target) target.unit = event.target.value; }, `series-unit-${index}`)} />
        </div>)}
      </div>}
    </Section>}
    {element.type === "table" && <Section title="本表数据" action={<span className="format-note">{element.table?.rows.length || 0} 行 × {element.table?.headers.length || 0} 列</span>}>
      <div className="data-editor-summary"><div><strong>{element.table?.headers.join("、") || "尚无表头"}</strong><span>本表数据只属于当前组件</span></div><button type="button" onClick={onEditTableData}><Table2 size={14} />{readOnlyData ? "查看单元格" : "打开单元格编辑器"}</button></div>
    </Section>}
    {element.type === "image" && <Section title="本地图片">
      <label className="upload-zone"><ImageIcon size={21} /><span>{element.assetId ? "更换图片" : "选择图片"}</span><input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadImage} /></label>
      {element.assetId && <button className="text-action" type="button" onClick={setAsMaster}><LayoutTemplate size={14} />设为本页母版图</button>}
      {element.assetId && <button className="text-action danger" type="button" onClick={() => update((item) => { delete item.assetId; delete item.image; item.content = "请在右侧面板上传本地图片"; })}><Trash2 size={14} />移除图片</button>}
    </Section>}
    <Section title="位置与尺寸">
      <div className="form-grid four-fields">
        {(["x", "y", "w", "h"] as const).map((key) => <Field label={key.toUpperCase()} key={key}><input type="number" step="0.5" value={element[key]} onChange={(event) => update((item) => { item[key] = Number(event.target.value); }, key)} /><em>mm</em></Field>)}
      </div>
    </Section>
  </>;
}

function StyleInspector({ elements, update, theme }: { elements: ReportElement[]; update: (recipe: (element: ReportElement) => void) => void; theme: ReportDocument["theme"] }) {
  const first = elements[0];
  const colors = (["text", "muted", "primary", "accent", "positive", "negative", "white", "transparent"] as const).map((token) => ({ token, value: resolveThemeColor(theme, token) }));
  return <>
    <div className="selection-heading"><span className="type-icon"><Palette size={16} /></span><div><strong>{elements.length === 1 ? first.name : `${elements.length} 个元素`}</strong><small>样式白名单</small></div></div>
    {elements.every((element) => element.type === "image") && <Section title="图片风格">
      <ImageStyleControls value={first.imageStyle} onChange={(next) => update((item) => { item.imageStyle = clone(next); })} />
    </Section>}
    <Section title="文字">
      <div className="form-grid">
        <Field label="字体槽"><select value={first.style.fontSlot || "body"} onChange={(event) => update((item) => { item.style.fontSlot = event.target.value as "display" | "body" | "numeric"; })}><option value="display">标题体</option><option value="body">正文体</option><option value="numeric">数字体</option></select></Field>
        <Field label="字号"><select value={first.style.fontSize || 10} onChange={(event) => update((item) => { item.style.fontSize = Number(event.target.value); })}>{FONT_SIZE_STEPS.map((size) => <option value={size} key={size}>{size} pt</option>)}</select></Field>
        <Field label="字重"><select value={first.style.fontWeight || 400} onChange={(event) => update((item) => { item.style.fontWeight = Number(event.target.value); })}><option value="400">常规</option><option value="500">中等</option><option value="600">半粗</option><option value="700">粗体</option></select></Field>
        <Field label="行高"><select value={first.style.lineHeight || 1.5} onChange={(event) => update((item) => { item.style.lineHeight = Number(event.target.value); })}><option value="1.2">1.2</option><option value="1.35">1.35</option><option value="1.5">1.5</option></select></Field>
        <Field label="对齐"><select value={first.style.align || "left"} onChange={(event) => update((item) => { item.style.align = event.target.value as "left" | "center" | "right"; })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></Field>
      </div>
      <div className="swatch-row"><span>文字色</span>{colors.slice(0, 6).map(({ token, value }) => <button type="button" aria-label={`颜色 ${token}`} title={token} key={token} className={first.style.color === token ? "active" : ""} style={{ background: value }} onClick={() => update((item) => { item.style.color = token; })} />)}</div>
    </Section>
    <Section title="容器">
      <div className="swatch-row"><span>背景色</span>{colors.map(({ token, value }) => <button type="button" aria-label={`背景 ${token}`} title={token} key={token} className={first.style.background === token ? "active" : ""} style={{ background: token === "transparent" ? "linear-gradient(135deg,#fff 45%,#d24a3a 46%,#d24a3a 54%,#fff 55%)" : value }} onClick={() => update((item) => { item.style.background = token; })} />)}</div>
      <div className="form-grid">
        <Field label="内边距"><input type="number" min="0" max="30" step="0.5" value={first.style.padding || 0} onChange={(event) => update((item) => { item.style.padding = Number(event.target.value); })} /><em>mm</em></Field>
        <Field label="圆角"><input type="number" min="0" max="10" step="0.5" value={first.style.radius || 0} onChange={(event) => update((item) => { item.style.radius = Number(event.target.value); })} /><em>mm</em></Field>
        <Field label="边框"><input type="number" min="0" max="3" step="0.1" value={first.style.borderWidth || 0} onChange={(event) => update((item) => { item.style.borderWidth = Number(event.target.value); })} /><em>mm</em></Field>
        <Field label="透明度"><input type="number" min="0" max="100" step="5" value={Math.round((first.style.opacity ?? 1) * 100)} onChange={(event) => update((item) => { item.style.opacity = Number(event.target.value) / 100; })} /><em>%</em></Field>
      </div>
    </Section>
  </>;
}

function LayersInspector({ page, selectedIds, select, update }: { page: ReportPage; selectedIds: Set<string>; select: (ids: Set<string>) => void; update: (recipe: (page: ReportPage) => void) => void }) {
  const layers = page.elements.slice().sort((a, b) => b.z - a.z);
  const setZ = (id: string, direction: 1 | -1) => update((draft) => {
    const ordered = draft.elements.slice().sort((a, b) => a.z - b.z);
    const index = ordered.findIndex((element) => element.id === id);
    const swapIndex = index + direction;
    if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return;
    const z = ordered[index].z;
    ordered[index].z = ordered[swapIndex].z;
    ordered[swapIndex].z = z;
  });
  return <>
    <div className="layers-heading"><div><strong>页面图层</strong><small>{layers.length} 项</small></div></div>
    <div className="layer-list">
      {layers.map((element) => {
        const Icon = iconForType[element.type];
        return <div className={`layer-row ${selectedIds.has(element.id) ? "active" : ""}`} key={element.id} onClick={() => select(new Set(selectionUnitIds(page, element.id)))} title={element.groupId ? `组合：${element.groupName || element.groupId}` : undefined}>
          <Icon size={14} />
          <input value={element.name} onClick={(event) => event.stopPropagation()} onChange={(event) => update((draft) => { const target = draft.elements.find((item) => item.id === element.id); if (target) target.name = event.target.value; })} />
          <IconButton label="上移" onClick={() => setZ(element.id, 1)}><ChevronUp size={13} /></IconButton>
          <IconButton label="下移" onClick={() => setZ(element.id, -1)}><ChevronDown size={13} /></IconButton>
          <IconButton label={element.hidden ? "显示组合" : "隐藏组合"} active={element.hidden} onClick={() => update((draft) => { draft.elements.forEach((item) => { if (item.id === element.id || (element.groupId && item.groupId === element.groupId)) item.hidden = !element.hidden; }); })}>{element.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</IconButton>
          <IconButton label={element.locked ? "解锁组合" : "锁定组合"} active={element.locked} onClick={() => update((draft) => { draft.elements.forEach((item) => { if (item.id === element.id || (element.groupId && item.groupId === element.groupId)) item.locked = !element.locked; }); })}>{element.locked ? <Lock size={13} /> : <Unlock size={13} />}</IconButton>
        </div>;
      })}
      {!layers.length && <div className="empty-state"><Layers3 size={22} /><span>当前页没有图层</span></div>}
    </div>
  </>;
}

function FocalPicker({ image, value, onChange }: { image: string; value: { x: number; y: number }; onChange: (value: { x: number; y: number }) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value.x, value.y]);
  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))), y: round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))) };
  };
  return <div
    className="focal-picker"
    style={{ backgroundImage: `url(${image})` }}
    onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDraft(pointFromEvent(event)); }}
    onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) setDraft(pointFromEvent(event)); }}
    onPointerUp={(event) => { const next = pointFromEvent(event); setDraft(next); onChange(next); event.currentTarget.releasePointerCapture(event.pointerId); }}
  ><span style={{ left: `${draft.x}%`, top: `${draft.y}%` }} /></div>;
}

function PageInspector({ document, page, assetData, update, uploadBackgroundImage, convertBackgroundToElement }: {
  document: ReportDocument;
  page: ReportPage;
  assetData: Record<string, string>;
  update: (recipe: (draft: ReportDocument) => void) => void;
  uploadBackgroundImage: (event: ChangeEvent<HTMLInputElement>) => void;
  convertBackgroundToElement: () => void;
}) {
  const backgroundAssetId = page.masterProps?.imageAssetId;
  const backgroundImage = backgroundAssetId ? assetData[backgroundAssetId] : undefined;
  const backgroundAsset = document.assets.find((asset) => asset.id === backgroundAssetId);
  const updatePage = (recipe: (draft: ReportPage) => void) => update((draft) => {
    const target = draft.pages.find((item) => item.id === page.id);
    if (target) recipe(target);
  });
  return <>
    <div className="selection-heading"><span className="type-icon"><FileImage size={16} /></span><div><strong>{page.name}</strong><small>{page.orientation === "portrait" ? "A4 纵向" : "A4 横向"} · {page.master}</small></div></div>
    <Section title="页面">
      <div className="form-grid">
        <Field label="页面名称" wide><input value={page.name} onChange={(event) => updatePage((draft) => { draft.name = event.target.value; })} /></Field>
        <Field label="章节" wide><input value={page.section} onChange={(event) => updatePage((draft) => { draft.section = event.target.value; })} /></Field>
        <Field label="纸张方向"><select value={page.orientation} onChange={(event) => {
          const next = event.target.value as Orientation;
          if (next === page.orientation) return;
          if (page.elements.length || page.masterProps?.imageAssetId) {
            window.alert("横版与竖版使用不同出版网格。当前页面已有内容，不能直接套用另一方向坐标；请新建目标方向页面后复制所需内容并重新排版。");
            return;
          }
          updatePage((draft) => { draft.orientation = next; });
        }}><option value="portrait">A4 纵向</option><option value="landscape">A4 横向</option></select></Field>
        <Field label="页面类型"><select value={page.master} onChange={(event) => updatePage((draft) => { draft.master = event.target.value as MasterType; })}><option value="cover">封面</option><option value="section">章节页</option><option value="standard">标准页</option><option value="data">数据页</option><option value="blank">空白页</option><option value="backcover">尾页</option></select></Field>
      </div>
    </Section>
    <Section title="页面背景图" action={<span className="format-note">{page.master === "section" ? "顶部 70 mm" : "整页"}</span>}>
      {backgroundImage ? <>
        <FocalPicker image={backgroundImage} value={page.masterProps?.focal || { x: 50, y: 50 }} onChange={(focal) => updatePage((draft) => {
          const frame = { width: PAGE_MM[draft.orientation].width, height: draft.master === "section" ? 70 : PAGE_MM[draft.orientation].height };
          draft.masterProps = { ...draft.masterProps, focal, crop: backgroundAsset ? cropFromFocal(backgroundAsset, frame, focal) : draft.masterProps?.crop };
        })} />
        <div className="master-image-controls"><ImageStyleControls value={page.masterProps?.imageStyle} onChange={(imageStyle) => updatePage((draft) => { draft.masterProps = { ...draft.masterProps, imageStyle }; })} /></div>
        <div className="inline-actions"><label className="text-action"><Upload size={14} />替换<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadBackgroundImage} /></label><button className="text-action" type="button" onClick={convertBackgroundToElement}><ImageIcon size={14} />转为自由元素</button><button className="text-action danger" type="button" onClick={() => updatePage((draft) => { if (draft.masterProps) delete draft.masterProps.imageAssetId; })}><Trash2 size={14} />移除</button></div>
      </> : <label className="upload-zone"><ImageIcon size={21} /><span>选择页面背景图</span><input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={uploadBackgroundImage} /></label>}
    </Section>
  </>;
}

function DocumentInspector({ document, assetData, readOnlyMeta = false, update, exportZip, exportJson, cleanupUnusedAssets, optimizeAsset, keepOriginalImages, setKeepOriginalImages }: {
  document: ReportDocument;
  assetData: Record<string, string>;
  readOnlyMeta?: boolean;
  update: (recipe: (draft: ReportDocument) => void) => void;
  exportZip: () => void;
  exportJson: () => void;
  cleanupUnusedAssets: () => void;
  optimizeAsset: (id: string) => void;
  keepOriginalImages: boolean;
  setKeepOriginalImages: (value: boolean) => void;
}) {
  return <>
    <div className="selection-heading"><span className="type-icon"><FileJson size={16} /></span><div><strong>{document.meta.title}</strong><small>报告设置</small></div></div>
    <Section title="报告信息">
      {readOnlyMeta && <p className="binding-readonly-note">报告标题、机构、期间、编制人和密级来自本地数据，只能在特化生成器的数据面板修改。</p>}
      <div className="form-grid">
        {(["title", "organization", "period", "author", "confidentiality"] as const).map((key) => <Field wide label={{ title: "报告标题", organization: "机构名称", period: "报告期间", author: "编制人", confidentiality: "密级" }[key]} key={key}><input readOnly={readOnlyMeta} value={document.meta[key]} onChange={(event) => update((draft) => { draft.meta[key] = event.target.value; })} /></Field>)}
      </div>
      <div className="inline-actions"><button className="text-action" type="button" onClick={exportZip}><Download size={14} />导出 ZIP 工程</button><button className="text-action" type="button" onClick={exportJson}><FileJson size={14} />归档 JSON（约 +33%）</button></div>
    </Section>
    <Section title="主题">
      <div className="theme-list">{THEMES.map((theme) => <button type="button" className={document.theme.id === theme.id ? "active" : ""} key={theme.id} onClick={() => update((draft) => { draft.theme = clone(theme); })}><span className="theme-colors"><i style={{ background: theme.primary }} /><i style={{ background: theme.accent }} /><i style={{ background: theme.surface }} /></span><span>{theme.name}</span>{document.theme.id === theme.id && <Check size={13} />}</button>)}</div>
    </Section>
    <Section title="资产使用" action={<button className="text-action danger" type="button" onClick={cleanupUnusedAssets}>清理未使用</button>}>
      <p className="asset-budget">总计 {formatBytes(document.assets.reduce((sum, asset) => sum + (asset.byteSize || 0), 0))} / 50 MB</p>
      <div className="toggle-column asset-import-setting"><label><input type="checkbox" checked={keepOriginalImages} onChange={(event) => setKeepOriginalImages(event.target.checked)} />保留原始像素尺寸（仍剥离 EXIF/GPS）</label></div>
      <div className="asset-list">{document.assets.map((asset) => {
        const masterUses = document.pages.filter((page) => page.masterProps?.imageAssetId === asset.id).map((page) => page.master === "cover" ? "封面" : page.master === "section" ? "章节页" : page.master === "backcover" ? "尾页" : page.name);
        const contentUses = document.pages.reduce((count, page) => count + page.elements.filter((element) => element.assetId === asset.id).length, 0);
        const dpiValues = document.pages.flatMap((page) => {
          const content = page.elements.filter((element) => element.assetId === asset.id).map((element) => Math.round(Math.min((element.crop?.sw || asset.width) / element.w, (element.crop?.sh || asset.height) / element.h) * 25.4));
          if (page.masterProps?.imageAssetId === asset.id) {
            const size = PAGE_MM[page.orientation];
            content.push(Math.round(Math.min(asset.width / size.width, asset.height / (page.master === "section" ? 70 : size.height)) * 25.4));
          }
          return content;
        });
        const minimumDpi = dpiValues.length ? Math.min(...dpiValues) : null;
        return <div className={`asset-row ${minimumDpi !== null && minimumDpi < 150 ? "asset-warning" : ""}`} key={asset.id}>{assetData[asset.id] ? <img src={assetData[asset.id]} alt="本地资产" /> : <span className="asset-missing"><ImageIcon size={15} /></span>}<div><strong>{asset.width} x {asset.height} · {formatBytes(asset.byteSize || 0)}</strong><small>{[...masterUses, contentUses ? `内容 x${contentUses}` : ""].filter(Boolean).join(" · ") || "未使用"}{minimumDpi !== null ? ` · 最低 ${minimumDpi} DPI` : ""}</small>{asset.hash && <small>SHA-256 {asset.hash.slice(0, 12)}…</small>}<button className="asset-optimize" type="button" onClick={() => optimizeAsset(asset.id)}>按当前用途优化</button></div></div>;
      })}{!document.assets.length && <span className="format-note">尚未添加图片资产</span>}</div>
    </Section>
    <Section title="对齐规则">
      <div className="form-grid">
        <Field label="网格"><select value={document.pageSetup.grid} onChange={(event) => update((draft) => { draft.pageSetup.grid = Number(event.target.value); })}><option value="2.5">2.5 mm</option><option value="5">5 mm</option><option value="10">10 mm</option></select></Field>
        <Field label="页边距"><input type="number" min="8" max="35" value={document.pageSetup.margin} onChange={(event) => update((draft) => { draft.pageSetup.margin = Number(event.target.value); })} /><em>mm</em></Field>
        <Field label="密级页脚" wide><select value={document.pageSetup.footerMode || "all"} onChange={(event) => update((draft) => { draft.pageSetup.footerMode = event.target.value as "all" | "confidentiality-last"; })}><option value="all">每页显示</option><option value="confidentiality-last">仅末页显示密级</option></select></Field>
        <Field label="打印图片"><select value={document.pageSetup.printDpi || 300} onChange={(event) => update((draft) => { draft.pageSetup.printDpi = Number(event.target.value) as 96 | 150 | 300; })}><option value="300">印刷 300 DPI</option><option value="150">屏读 150 DPI</option><option value="96">草稿 96 DPI</option></select></Field>
      </div>
      <div className="toggle-column"><label><input type="checkbox" checked={document.pageSetup.snap} onChange={(event) => update((draft) => { draft.pageSetup.snap = event.target.checked; })} />拖拽吸附</label><label><input type="checkbox" checked={document.pageSetup.showGrid} onChange={(event) => update((draft) => { draft.pageSetup.showGrid = event.target.checked; })} />显示网格</label></div>
    </Section>
  </>;
}

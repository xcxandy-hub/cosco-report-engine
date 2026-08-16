import {
  ChartData,
  ChartKind,
  createPageDecorations,
  DEFAULT_IMAGE_STYLE,
  ElementType,
  MasterType,
  Orientation,
  ReportDocument,
  ReportElement,
  ReportPage,
  TableData,
  ThemeTokens,
  uid
} from "./model";

export const THEMES: ThemeTokens[] = [
  {
    id: "boardroom-blue",
    name: "董事会蓝",
    primary: "#174f78",
    secondary: "#dce9f1",
    accent: "#d24a3a",
    text: "#15232d",
    muted: "#65747d",
    paper: "#fbfcfd",
    surface: "#eef3f6",
    line: "#c7d2d9",
    positive: "#267052",
    negative: "#b43a42",
    chartPalette: ["#174f78", "#4f89aa", "#94afbf", "#d24a3a", "#6a765f", "#9b7b52"],
    fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    fontSlots: {
      display: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
      body: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
      numeric: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif'
    }
  },
  {
    id: "research-red",
    name: "研报红",
    primary: "#9f2f34",
    secondary: "#f1e3e4",
    accent: "#1e6b67",
    text: "#202327",
    muted: "#6f7175",
    paper: "#fdfdfc",
    surface: "#f3f1ef",
    line: "#d8d2ce",
    positive: "#287058",
    negative: "#a92f38",
    chartPalette: ["#9f2f34", "#d06a62", "#d7aaa3", "#1e6b67", "#67817e", "#9c8668"],
    fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    fontSlots: {
      display: '"Songti SC", "STSong", "Microsoft YaHei", serif',
      body: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
      numeric: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif'
    }
  },
  {
    id: "graphite",
    name: "石墨灰",
    primary: "#343a40",
    secondary: "#e6e8e9",
    accent: "#c45537",
    text: "#202326",
    muted: "#6a7175",
    paper: "#fcfcfb",
    surface: "#eff0f0",
    line: "#ced1d3",
    positive: "#39705b",
    negative: "#a83b43",
    chartPalette: ["#343a40", "#747d83", "#a8afb3", "#c45537", "#6f7563", "#9a7a61"],
    fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    fontSlots: {
      display: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
      body: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
      numeric: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif'
    }
  },
  {
    id: "editorial-neutral",
    name: "出版中性",
    primary: "#2d3338",
    secondary: "#eceae5",
    accent: "#a65e3d",
    text: "#1d2023",
    muted: "#6c706f",
    paper: "#ffffff",
    surface: "#f4f3ef",
    line: "#c9c6bd",
    positive: "#2d6c57",
    negative: "#a63f43",
    chartPalette: ["#2d3338", "#547c78", "#a65e3d", "#8b9a94", "#c79a62", "#72767a"],
    fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    fontSlots: {
      display: '"Songti SC", "STSong", Georgia, serif',
      body: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
      numeric: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif'
    }
  },
  {
    id: "maritime-publication",
    name: "海运出版",
    primary: "#174a5b",
    secondary: "#dfe9e8",
    accent: "#d0674f",
    text: "#17252a",
    muted: "#667579",
    paper: "#fbfcfb",
    surface: "#edf1ef",
    line: "#bdcdca",
    positive: "#28705b",
    negative: "#b3474b",
    chartPalette: ["#174a5b", "#3f7f83", "#d0674f", "#87a6a1", "#d0a85c", "#6d7478"],
    fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
    fontSlots: {
      display: '"Songti SC", "STSong", Georgia, serif',
      body: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
      numeric: '"SF Pro Display", "Helvetica Neue", Arial, sans-serif'
    }
  }
];

const baseStyle = { color: "text" as const, fontSize: 10, lineHeight: 1.5 };

export function sampleChart(): ChartData {
  return {
    categories: ["1月", "2月", "3月", "4月", "5月", "6月"],
    series: [
      { name: "本期", values: [92, 98, 101, 108, 114, 121] },
      { name: "上年", values: [88, 91, 96, 99, 103, 108] }
    ]
  };
}

export function sampleBarChart(): ChartData {
  return {
    categories: ["华东", "华南", "华北", "西部"],
    series: [
      { name: "收入", values: [42, 36, 27, 19] },
      { name: "利润", values: [11, 9, 6, 4] }
    ]
  };
}

export function sampleDonutChart(): ChartData {
  return {
    categories: ["主营业务", "增值服务", "其他"],
    series: [{ name: "收入结构", values: [72, 19, 9] }]
  };
}

export function sampleComboChart(): ChartData {
  return {
    categories: ["1月", "2月", "3月", "4月", "5月", "6月"],
    series: [
      { name: "营业收入", values: [92, 98, 101, 108, 114, 121], kind: "bar", axis: "left", unit: "亿元" },
      { name: "同比增速", values: [4.2, 5.1, 5.8, 6.7, 7.4, 8.4], kind: "line", axis: "right", unit: "%" }
    ]
  };
}

export function sampleTable(): TableData {
  return {
    headers: ["指标", "本期", "上期", "同比"],
    rows: [
      ["营业收入", "128.6", "118.7", "+8.4%"],
      ["利润总额", "21.4", "18.9", "+13.2%"],
      ["经营现金流", "32.8", "29.5", "+11.2%"],
      ["资产负债率", "46.2%", "48.1%", "-1.9pp"]
    ]
  };
}

export function makeElement(
  type: ElementType,
  x: number,
  y: number,
  w: number,
  h: number,
  overrides: Partial<ReportElement> = {}
): ReportElement {
  const defaults: Record<ElementType, Partial<ReportElement>> = {
    text: {
      name: "正文",
      semanticRole: "body",
      content: "双击画布文字，或在右侧面板中编辑内容。",
      style: { ...baseStyle, fontSlot: "body" }
    },
    box: {
      name: "色块",
      style: { background: "surface", borderColor: "line", borderWidth: 0.3, radius: 1.5 }
    },
    chart: {
      name: "图表",
      chartKind: "line",
      chart: sampleChart(),
      style: { ...baseStyle, background: "white", showLabel: true, showLegend: true, padding: 2 }
    },
    table: {
      name: "数据表",
      table: sampleTable(),
      style: { ...baseStyle, fontSize: 8, background: "white", borderColor: "line", padding: 1 }
    },
    image: {
      name: "图片",
      content: "请在右侧面板上传本地图片",
      style: { ...baseStyle, background: "surface", borderColor: "line", borderWidth: 0.3, radius: 1.5 }
    },
    divider: {
      name: "分隔线",
      style: { background: "primary", opacity: 1 }
    }
  };
  const defaultValue = defaults[type];
  const element = {
    id: uid("element"),
    type,
    name: defaultValue.name || type,
    x,
    y,
    w,
    h,
    z: 1,
    ...defaultValue,
    ...overrides,
    style: { ...(defaultValue.style || {}), ...(overrides.style || {}) }
  } as ReportElement;
  if (type === "text") element.runs = overrides.runs || [{ text: element.content || "" }];
  return element;
}

function applyGroup(elements: ReportElement[], presetId: string, groupName: string) {
  const groupId = uid("group");
  return elements.map((element, index) => ({
    ...element,
    groupId,
    groupName,
    presetId,
    presetSlot: element.presetSlot || String(index + 1)
  }));
}

function chartDataFor(kind: ChartKind) {
  if (kind === "bar") return sampleBarChart();
  if (kind === "combo") return sampleComboChart();
  if (kind === "donut") return sampleDonutChart();
  return sampleChart();
}

function chartName(kind: ChartKind) {
  return { line: "趋势图", bar: "对比图", combo: "柱线组合图", donut: "结构图" }[kind];
}

export function makePreset(presetId: string, x: number, y: number, w: number, h: number): ReportElement[] {
  if (presetId === "basic-text") return [makeElement("text", x, y, w, h)];
  if (presetId === "basic-box") return [makeElement("box", x, y, w, h)];
  if (presetId === "basic-divider") return [makeElement("divider", x, y, w, h)];
  if (presetId === "basic-image") return [makeElement("image", x, y, w, h)];
  if (presetId === "basic-chart") return [makeElement("chart", x, y, w, h)];
  if (presetId === "basic-table") return [makeElement("table", x, y, w, h)];
  if (presetId === "title") {
    return [makeElement("text", x, y, w, h, {
      name: "页面标题",
      semanticRole: "title",
      content: "页面标题",
      style: { fontSize: 28, fontSlot: "display", fontWeight: 700, color: "text", background: "transparent", lineHeight: 1.2 }
    })];
  }
  if (presetId === "source") {
    return [makeElement("text", x, y, w, h, {
      name: "资料来源",
      semanticRole: "source",
      content: "资料来源：公司经营数据，示例数据",
      style: { fontSize: 8, fontSlot: "body", color: "muted", background: "transparent", lineHeight: 1.2 }
    })];
  }
  if (presetId === "kpi") {
    const padding = Math.max(2, Math.min(5, w * 0.07));
    const innerWidth = w - padding * 2;
    const valueWidth = innerWidth * 0.72;
    return applyGroup([
      makeElement("box", x, y, w, h, { name: "核心指标 背景", presetSlot: "background", style: { background: "white", borderColor: "line", borderWidth: 0.3, radius: 1.5 } }),
      makeElement("text", x + padding, y + padding, innerWidth, 5, { name: "核心指标 标签", presetSlot: "label", semanticRole: "kpi-label", content: "核心指标", style: { fontSize: 8, fontSlot: "body", color: "muted", lineHeight: 1.2 } }),
      makeElement("text", x + padding, y + padding + 6, valueWidth, Math.max(8, h - padding * 2 - 12), { name: "核心指标 数值", presetSlot: "value", semanticRole: "kpi-value", content: "128.6", style: { fontSize: 28, fontSlot: "numeric", fontWeight: 700, color: "text", lineHeight: 1.2 } }),
      makeElement("text", x + padding + valueWidth, y + h - padding - 12, innerWidth - valueWidth, 6, { name: "核心指标 单位", presetSlot: "unit", semanticRole: "kpi-unit", content: "亿元", style: { fontSize: 8, fontSlot: "body", color: "muted", lineHeight: 1.2 } }),
      makeElement("text", x + padding, y + h - padding - 5, innerWidth, 5, { name: "核心指标 变化", presetSlot: "note", semanticRole: "kpi-note", content: "同比 +8.4%", style: { fontSize: 8, fontSlot: "body", fontWeight: 600, color: "positive", lineHeight: 1.2 } })
    ], presetId, "核心指标");
  }
  if (presetId === "quote") {
    const padding = Math.max(3, Math.min(6, w * 0.05));
    return applyGroup([
      makeElement("box", x, y, w, h, { name: "重点结论 背景", presetSlot: "background", style: { background: "secondary", borderColor: "transparent", radius: 1.5 } }),
      makeElement("text", x + padding, y + padding - 2, 8, 10, { name: "重点结论 引号", presetSlot: "mark", semanticRole: "quote-mark", content: "“", style: { fontSize: 28, fontSlot: "display", color: "primary", lineHeight: 1.2 } }),
      makeElement("text", x + padding + 6, y + padding, w - padding * 2 - 6, h - padding * 2 - 7, { name: "重点结论 正文", presetSlot: "body", semanticRole: "quote-body", content: "经营韧性仍在，但结构性差异正在扩大，需要把资源进一步集中到高贡献业务。", style: { fontSize: 14, fontSlot: "body", fontWeight: 600, color: "text", lineHeight: 1.5 } }),
      makeElement("text", x + padding + 6, y + h - padding - 5, w - padding * 2 - 6, 5, { name: "重点结论 署名", presetSlot: "attribution", semanticRole: "quote-attribution", content: "管理层判断", style: { fontSize: 8, fontSlot: "body", color: "muted", lineHeight: 1.2 } })
    ], presetId, "重点结论");
  }
  if (["chart-line", "chart-bar", "chart-combo", "chart-donut"].includes(presetId)) {
    const kind = presetId.replace("chart-", "") as ChartKind;
    const captionHeight = 7;
    return applyGroup([
      makeElement("text", x, y, w, captionHeight, { name: `${chartName(kind)} 标题`, presetSlot: "caption", semanticRole: "caption", content: chartName(kind), style: { fontSize: 10, fontSlot: "body", fontWeight: 650, color: "text", lineHeight: 1.2 } }),
      makeElement("chart", x, y + captionHeight, w, Math.max(8, h - captionHeight), { name: chartName(kind), presetSlot: "chart", chartKind: kind, chart: chartDataFor(kind) })
    ], presetId, chartName(kind));
  }
  if (presetId === "table-block") {
    const captionHeight = 7;
    return applyGroup([
      makeElement("text", x, y, w, captionHeight, { name: "数据表 标题", presetSlot: "caption", semanticRole: "caption", content: "经营指标明细", style: { fontSize: 10, fontSlot: "body", fontWeight: 650, color: "text", lineHeight: 1.2 } }),
      makeElement("table", x, y + captionHeight, w, Math.max(8, h - captionHeight), { name: "数据表", presetSlot: "table" })
    ], presetId, "数据表");
  }
  if (presetId === "image-caption") {
    const captionHeight = 7;
    return applyGroup([
      makeElement("image", x, y, w, Math.max(8, h - captionHeight), { name: "图片", presetSlot: "image" }),
      makeElement("text", x, y + h - captionHeight, w, captionHeight, { name: "图片说明", presetSlot: "caption", semanticRole: "caption", content: "图：图片说明", style: { fontSize: 8, fontSlot: "body", color: "muted", lineHeight: 1.2 } })
    ], presetId, "图片与说明");
  }
  throw new Error(`未知组件预设：${presetId}`);
}

function setSlot(elements: ReportElement[], slot: string, content: string) {
  const element = elements.find((item) => item.presetSlot === slot);
  if (element) {
    element.content = content;
    if (element.type === "text") element.runs = [{ text: content }];
  }
  return elements;
}

function makeKpi(x: number, y: number, w: number, h: number, label: string, value: string, unit: string, note: string) {
  const elements = makePreset("kpi", x, y, w, h);
  setSlot(elements, "label", label);
  setSlot(elements, "value", value);
  setSlot(elements, "unit", unit);
  setSlot(elements, "note", note);
  const noteElement = elements.find((item) => item.presetSlot === "note");
  if (noteElement) noteElement.style.color = note.includes("-") ? "negative" : "positive";
  elements.forEach((element) => { element.groupName = label; });
  return elements;
}

function makeQuote(x: number, y: number, w: number, h: number, body: string, attribution: string) {
  const elements = makePreset("quote", x, y, w, h);
  setSlot(elements, "body", body);
  setSlot(elements, "attribution", attribution);
  return elements;
}

function makeChartBlock(kind: ChartKind, x: number, y: number, w: number, h: number, title: string, chart?: ChartData) {
  const elements = makePreset(`chart-${kind}`, x, y, w, h);
  setSlot(elements, "caption", title);
  const chartElement = elements.find((item) => item.type === "chart");
  if (chartElement && chart) chartElement.chart = chart;
  return elements;
}

function makeTableBlock(x: number, y: number, w: number, h: number, title: string, table?: TableData) {
  const elements = makePreset("table-block", x, y, w, h);
  setSlot(elements, "caption", title);
  const tableElement = elements.find((item) => item.type === "table");
  if (tableElement && table) tableElement.table = table;
  return elements;
}

function titleElement(x: number, y: number, w: number, h: number, content: string) {
  return makeElement("text", x, y, w, h, {
    name: "页面标题",
    semanticRole: "title",
    content,
    style: { fontSize: 28, fontSlot: "display", fontWeight: 750, color: "text", lineHeight: 1.2 }
  });
}

function sourceElement(x: number, y: number, w: number, content = "资料来源：公司经营数据，示例数据") {
  return makeElement("text", x, y, w, 7, {
    name: "资料来源",
    semanticRole: "source",
    content,
    style: { fontSize: 8, fontSlot: "body", color: "muted", lineHeight: 1.2 }
  });
}

export function createPage(
  master: MasterType,
  orientation: Orientation,
  name: string,
  section: string,
  elements: ReportElement[] = [],
  meta: ReportDocument["meta"] = {
    title: "未命名报告",
    organization: "示例机构",
    period: "2026-08",
    author: "报告编制人",
    confidentiality: "内部资料 注意保密"
  }
): ReportPage {
  const page: ReportPage = {
    id: uid("page"),
    name,
    section,
    master,
    orientation,
    masterProps: {
      focal: { x: 50, y: 50 },
      overlay: "brand",
      overlayStrength: 0.72,
      disclaimer: "本报告仅供内部讨论使用，不构成投资、审计或法律意见。",
      contact: "",
      imageStyle: { ...DEFAULT_IMAGE_STYLE, overlayKind: "linear", overlayColor: "primary", overlayColor2: "transparent", strength: 0.72 }
    },
    elements: []
  };
  const decorations = createPageDecorations(page, meta, 1, 1, "all");
  page.elements = [...decorations, ...elements].map((element, index) => ({ ...element, z: index + 1 }));
  return page;
}

function coverPage(): ReportPage {
  return createPage("cover", "portrait", "封面", "报告", [
    makeElement("divider", 18, 35, 3, 78, { name: "封面色带" }),
    makeElement("text", 29, 39, 46, 8, { name: "报告类型", content: "管理层决策报告", style: { fontSize: 10, fontWeight: 600, color: "primary" } }),
    titleElement(29, 54, 150, 43, "通用经营分析报告"),
    makeElement("text", 29, 104, 145, 22, { name: "报告副标题", content: "关键指标、结构变化与重点行动建议", style: { fontSize: 12, color: "muted", lineHeight: 1.5 } }),
    makeElement("text", 29, 231, 110, 12, { name: "机构名称", content: "示例机构", style: { fontSize: 10, fontWeight: 650 } }),
    makeElement("text", 29, 247, 110, 12, { name: "报告期间", content: "2026年8月", style: { fontSize: 8, color: "muted" } })
  ]);
}

function summaryPage(): ReportPage {
  return createPage("standard", "landscape", "执行摘要", "核心结论", [
    titleElement(18, 19, 150, 14, "执行摘要与关键判断"),
    makeElement("text", 18, 37, 245, 14, { content: "本期经营保持增长，利润与现金流同步改善。区域和业务结构差异仍需在后续经营安排中重点处理。", style: { fontSize: 10, color: "muted", lineHeight: 1.5 } }),
    ...makeKpi(18, 59, 57, 35, "营业收入", "128.6", "亿元", "同比 +8.4%"),
    ...makeKpi(81, 59, 57, 35, "利润总额", "21.4", "亿元", "同比 +13.2%"),
    ...makeKpi(144, 59, 57, 35, "经营现金流", "32.8", "亿元", "同比 +11.2%"),
    ...makeKpi(207, 59, 57, 35, "资产负债率", "46.2", "%", "同比 -1.9pp"),
    ...makeChartBlock("line", 18, 105, 155, 69, "收入与利润趋势"),
    ...makeQuote(183, 105, 81, 69, "增长质量好于规模表现。建议继续提高高毛利业务占比，并提前锁定关键资源。", "本期决策建议"),
    sourceElement(18, 179, 246)
  ]);
}

function analysisPage(): ReportPage {
  return createPage("data", "portrait", "结构分析", "经营分析", [
    titleElement(18, 19, 160, 14, "业务结构与区域表现"),
    makeElement("text", 18, 37, 174, 14, { content: "主营业务仍是增长基础，增值服务贡献持续抬升。华东与华南区域形成主要增量。", style: { fontSize: 10, color: "muted" } }),
    ...makeChartBlock("donut", 18, 58, 82, 77, "收入结构"),
    ...makeChartBlock("combo", 108, 58, 84, 77, "区域收入与利润"),
    ...makeTableBlock(18, 145, 174, 79, "经营指标明细"),
    ...makeQuote(18, 234, 174, 32, "区域增量集中度上升，需要同步评估客户集中与资源配置风险。", "重点观察"),
    sourceElement(18, 273, 174)
  ]);
}

function appendixPage(): ReportPage {
  return createPage("data", "landscape", "数据附录", "附录", [
    titleElement(18, 19, 180, 14, "关键经营指标附录"),
    makeElement("text", 18, 37, 246, 12, { content: "以下为示例口径。实际使用时请在右侧数据面板中粘贴 Excel 数据块。", style: { fontSize: 10, color: "muted" } }),
    ...makeTableBlock(18, 56, 246, 111, "经营指标明细", {
      headers: ["指标", "单位", "1月", "2月", "3月", "4月", "5月", "6月", "累计同比"],
      rows: [
        ["营业收入", "亿元", "92", "98", "101", "108", "114", "121", "+8.4%"],
        ["利润总额", "亿元", "14", "15", "16", "18", "19", "21", "+13.2%"],
        ["经营现金流", "亿元", "18", "20", "19", "26", "28", "33", "+11.2%"],
        ["客户数量", "家", "246", "252", "258", "267", "274", "281", "+9.8%"],
        ["人均产出", "万元", "37", "38", "39", "41", "42", "44", "+6.1%"]
      ]
    }),
    sourceElement(18, 175, 246)
  ]);
}

function publicationPages(): ReportPage[] {
  const cover = createPage("cover", "portrait", "封面", "研究出版", [
    makeElement("text", 20, 24, 165, 7, { name: "出版系列", content: "RESEARCH PUBLICATION · 2026", style: { fontSize: 8, fontWeight: 650, color: "accent" } }),
    makeElement("divider", 20, 36, 170, 0.5, { name: "封面顶线", style: { background: "line" } }),
    titleElement(20, 64, 166, 52, "产业趋势与经营韧性研究"),
    makeElement("text", 20, 124, 154, 24, { name: "报告副标题", content: "从规模、结构、效率和风险四个维度建立可追溯的管理判断", style: { fontSize: 12, color: "muted", lineHeight: 1.5 } }),
    makeElement("box", 20, 178, 170, 42, { name: "摘要底色", style: { background: "surface", borderColor: "transparent" } }),
    makeElement("text", 28, 186, 154, 25, { name: "封面摘要", content: "本模板强调编辑式留白、章节节奏、图表标题与来源分离，以及可在数据密集页面持续复用的稳定网格。", style: { fontSize: 10, color: "text", lineHeight: 1.5 } }),
    makeElement("text", 20, 253, 110, 8, { name: "机构名称", content: "示例研究机构", style: { fontSize: 10, fontWeight: 650 } }),
    makeElement("text", 20, 265, 110, 7, { name: "报告期间", content: "2026年8月", style: { fontSize: 8, color: "muted" } })
  ]);
  const contents = createPage("standard", "portrait", "导读", "研究出版", [
    titleElement(20, 24, 166, 18, "导读与阅读路径"),
    makeElement("text", 20, 52, 76, 12, { content: "01", style: { fontSize: 28, fontSlot: "numeric", color: "accent", fontWeight: 700 } }),
    makeElement("text", 58, 54, 128, 10, { content: "结论摘要", style: { fontSize: 14, fontWeight: 650 } }),
    makeElement("text", 58, 67, 128, 18, { content: "先读规模与质量，再识别结构差异。", style: { fontSize: 10, color: "muted" } }),
    makeElement("divider", 20, 91, 166, 0.3, { style: { background: "line" } }),
    makeElement("text", 20, 105, 76, 12, { content: "02", style: { fontSize: 28, fontSlot: "numeric", color: "accent", fontWeight: 700 } }),
    makeElement("text", 58, 107, 128, 10, { content: "证据拆解", style: { fontSize: 14, fontWeight: 650 } }),
    makeElement("text", 58, 120, 128, 18, { content: "图表回答一个问题，标题直接表达信息。", style: { fontSize: 10, color: "muted" } }),
    makeElement("divider", 20, 144, 166, 0.3, { style: { background: "line" } }),
    makeElement("text", 20, 158, 76, 12, { content: "03", style: { fontSize: 28, fontSlot: "numeric", color: "accent", fontWeight: 700 } }),
    makeElement("text", 58, 160, 128, 10, { content: "数据图谱", style: { fontSize: 14, fontWeight: 650 } }),
    makeElement("text", 58, 173, 128, 18, { content: "用稳定网格承载高密度表格和来源制度。", style: { fontSize: 10, color: "muted" } })
  ]);
  const chapter = createPage("section", "portrait", "章节", "证据拆解", [
    makeElement("text", 20, 94, 48, 24, { content: "01", style: { fontSize: 28, fontSlot: "numeric", fontWeight: 700, color: "accent" } }),
    titleElement(20, 126, 164, 40, "规模增长之后，更应关注结构与现金质量"),
    makeElement("text", 20, 177, 144, 24, { content: "章节页只承担叙事换挡，不堆业务明细。", style: { fontSize: 10, color: "muted", lineHeight: 1.5 } })
  ]);
  const insight = createPage("data", "portrait", "核心洞察", "证据拆解", [
    titleElement(18, 20, 174, 22, "增长保持韧性，但增量继续向高贡献区域集中"),
    makeElement("text", 18, 48, 174, 16, { content: "页面采用窄叙事栏与主图表组合：先给判断，再给证据，最后保留可核验来源。", style: { fontSize: 10, color: "muted", lineHeight: 1.5 } }),
    ...makeKpi(18, 75, 62, 38, "累计收入", "128.6", "亿元", "同比 +8.4%"),
    ...makeQuote(18, 124, 62, 84, "增长质量需要同时看利润、现金与客户结构，不能只看收入增速。", "研究判断"),
    ...makeChartBlock("combo", 91, 75, 101, 133, "收入规模与同比增速"),
    sourceElement(18, 219, 174)
  ]);
  const atlas = createPage("data", "landscape", "数据图谱", "附录", [
    titleElement(18, 19, 196, 16, "稳定网格让密集数据仍然可扫描"),
    makeElement("text", 18, 39, 246, 12, { content: "表头、数字列、规则线、页码与来源位置保持稳定，便于连续翻阅和横向比较。", style: { fontSize: 10, color: "muted" } }),
    ...makeTableBlock(18, 58, 246, 104, "经营与市场指标图谱"),
    sourceElement(18, 173, 246, "资料来源：示例经营数据；使用时请替换为正式来源")
  ]);
  return [cover, contents, chapter, insight, atlas, createPage("backcover", "portrait", "尾页", "研究出版")];
}

function syncDecorationContent(pages: ReportPage[], meta: ReportDocument["meta"], footerMode: ReportDocument["pageSetup"]["footerMode"] = "all") {
  pages.forEach((page, index) => {
    const values: Partial<Record<NonNullable<ReportElement["role"]>, string>> = {
      "header-left": meta.organization || meta.title,
      "header-right": page.section,
      "footer-left": footerMode === "confidentiality-last" && index !== pages.length - 1 ? "" : meta.confidentiality,
      "footer-page-number": String(index + 1).padStart(2, "0"),
      "backcover-organization": meta.organization || meta.title,
      "backcover-disclaimer": page.masterProps?.disclaimer || "本报告仅供内部讨论使用，不构成投资、审计或法律意见。",
      "backcover-contact": page.masterProps?.contact || [meta.author, meta.period].filter(Boolean).join(" · "),
      "backcover-confidentiality": meta.confidentiality
    };
    page.elements.forEach((element) => {
      if (!element.role || values[element.role] === undefined) return;
      element.content = values[element.role];
      element.runs = [{ text: values[element.role] || "" }];
    });
  });
}

export type StarterKey = "professional" | "finance" | "publication" | "blank";

export function createStarterReport(kind: StarterKey = "professional"): ReportDocument {
  const now = new Date().toISOString();
  if (kind === "blank") {
    const meta: ReportDocument["meta"] = {
      title: "未命名报告",
      organization: "",
      period: new Date().toISOString().slice(0, 7),
      author: "",
      confidentiality: "内部资料"
    };
    const pages = [createPage("blank", "portrait", "空白页", "报告", [], meta), createPage("backcover", "portrait", "尾页", "报告", [], meta)];
    syncDecorationContent(pages, meta);
    return {
      version: "1.5",
      meta,
      theme: THEMES[0],
      pageSetup: { grid: 5, margin: 18, snap: true, showGrid: true, footerMode: "all", printDpi: 300 },
      usedFontSlots: ["display", "body", "numeric"],
      assets: [],
      pages,
      updatedAt: now
    };
  }

  const publication = kind === "publication";
  const pages = publication ? publicationPages() : [coverPage(), summaryPage(), analysisPage(), appendixPage(), createPage("backcover", "portrait", "尾页", "报告")];
  const title = publication ? "产业趋势与经营韧性研究" : kind === "finance" ? "通用财务分析简报" : "通用经营分析报告";
  const meta: ReportDocument["meta"] = {
    title,
    organization: publication ? "示例研究机构" : "示例机构",
    period: "2026-08",
    author: "报告编制人",
    confidentiality: "内部资料 注意保密"
  };
  const coverTitle = pages[0].elements.find((item) => item.name === "页面标题");
  if (coverTitle) {
    coverTitle.content = title;
    coverTitle.runs = [{ text: title }];
  }
  if (kind === "finance") {
    const reportType = pages[0].elements.find((item) => item.name === "报告类型");
    if (reportType) {
      reportType.content = "财务分析简报";
      reportType.runs = [{ text: "财务分析简报" }];
    }
    pages[1].name = "财务摘要";
    const summaryTitle = pages[1].elements.find((item) => item.semanticRole === "title");
    if (summaryTitle) {
      summaryTitle.content = "财务摘要与风险观察";
      summaryTitle.runs = [{ text: summaryTitle.content }];
    }
  }
  syncDecorationContent(pages, meta);
  return {
    version: "1.5",
    meta,
    theme: publication ? THEMES[3] : THEMES[0],
    pageSetup: { grid: 5, margin: 18, snap: true, showGrid: true, footerMode: "all", printDpi: 300 },
    usedFontSlots: ["display", "body", "numeric"],
    assets: [],
    pages,
    updatedAt: now
  };
}

export interface ComponentPreset {
  id: string;
  category: "basic" | "composition";
  icon: "text" | "box" | "divider" | "image" | "chart" | "table" | "title" | "source" | "kpi" | "quote";
  label: string;
  description: string;
  size: [number, number];
}

export const COMPONENT_PRESETS: ComponentPreset[] = [
  { id: "basic-text", category: "basic", icon: "text", label: "文本", description: "可直接编辑的单个文本元素", size: [90, 35] },
  { id: "basic-box", category: "basic", icon: "box", label: "色块", description: "背景、边框与强调区域", size: [70, 32] },
  { id: "basic-divider", category: "basic", icon: "divider", label: "分隔线", description: "版式层级与强调", size: [80, 1.2] },
  { id: "basic-image", category: "basic", icon: "image", label: "图片", description: "本地位图元素", size: [90, 60] },
  { id: "basic-chart", category: "basic", icon: "chart", label: "图表", description: "图表类型在数据面板切换", size: [120, 66] },
  { id: "basic-table", category: "basic", icon: "table", label: "表格", description: "不含标题的结构化数据表", size: [150, 66] },
  { id: "title", category: "composition", icon: "title", label: "页面标题", description: "带标题语义的文本预设", size: [120, 18] },
  { id: "kpi", category: "composition", icon: "kpi", label: "KPI 组合", description: "色块、标签、数值、单位与变化文字", size: [55, 35] },
  { id: "quote", category: "composition", icon: "quote", label: "重点结论", description: "背景、引号、正文与署名", size: [110, 42] },
  { id: "chart-line", category: "composition", icon: "chart", label: "趋势图组", description: "标题文本加折线图", size: [120, 72] },
  { id: "chart-bar", category: "composition", icon: "chart", label: "对比图组", description: "标题文本加柱状图", size: [120, 72] },
  { id: "chart-combo", category: "composition", icon: "chart", label: "柱线图组", description: "标题文本加双轴柱线图", size: [120, 72] },
  { id: "chart-donut", category: "composition", icon: "chart", label: "结构图组", description: "标题文本加环形图", size: [84, 72] },
  { id: "table-block", category: "composition", icon: "table", label: "表格模块", description: "标题文本加数据表", size: [150, 72] },
  { id: "image-caption", category: "composition", icon: "image", label: "图片说明", description: "图片加独立说明文字", size: [100, 70] },
  { id: "source", category: "composition", icon: "source", label: "资料来源", description: "带来源语义的文本元素", size: [120, 8] }
];

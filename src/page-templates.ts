import { BRAND_ASSET_IDS, type BrandAssetId } from "./brand-assets";
import {
  DEFAULT_IMAGE_STYLE,
  PAGE_MM,
  type ElementStyle,
  type Orientation,
  type ReportAsset,
  type ReportDocument,
  type ReportElement,
  type ReportPage,
  type ThemeColorToken,
  uid
} from "./model";

export type CoverTemplateId = "cinematic-fullbleed" | "editorial-monogram" | "institutional-rail" | "split-image-panel" | "publication-window";
export type ChromeTemplateId = "minimal-rule" | "brand-rail" | "editorial-corner";

export interface CoverTemplateDescriptor {
  id: CoverTemplateId;
  label: string;
  source: string;
  previewAssetId: BrandAssetId;
}

export interface ChromeTemplateDescriptor {
  id: ChromeTemplateId;
  label: string;
  source: string;
}

export const COVER_TEMPLATES: CoverTemplateDescriptor[] = [
  { id: "cinematic-fullbleed", label: "电影全幅", source: "全幅影像", previewAssetId: BRAND_ASSET_IDS.coverCityShip },
  { id: "editorial-monogram", label: "编辑刊号", source: "刊物封面", previewAssetId: BRAND_ASSET_IDS.coverRiver },
  { id: "institutional-rail", label: "机构侧轨", source: "机构年报", previewAssetId: BRAND_ASSET_IDS.coverTerminal },
  { id: "split-image-panel", label: "分栏影像", source: "管理报告", previewAssetId: BRAND_ASSET_IDS.coverOpenWater },
  { id: "publication-window", label: "出版视窗", source: "研究出版", previewAssetId: BRAND_ASSET_IDS.coverAerialPort }
];

export const CHROME_TEMPLATES: ChromeTemplateDescriptor[] = [
  { id: "minimal-rule", label: "细线页眉", source: "极简机构" },
  { id: "brand-rail", label: "品牌侧轨", source: "高密章节" },
  { id: "editorial-corner", label: "编辑页角", source: "研究刊物" }
];

const coverPreset = (id: CoverTemplateId) => `cover-template:${id}`;
const chromePreset = (id: ChromeTemplateId) => `chrome-template:${id}`;

function element(
  type: ReportElement["type"],
  presetId: string,
  presetSlot: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  style: ElementStyle,
  extra: Partial<ReportElement> = {}
): ReportElement {
  const content = extra.content;
  return {
    id: uid("element"),
    type,
    presetId,
    presetSlot,
    name,
    x,
    y,
    w,
    h,
    z,
    style,
    ...extra,
    runs: type === "text" && typeof content === "string" ? [{ text: content }] : extra.runs
  };
}

function textStyle(fontSize: number, color: ThemeColorToken, extra: ElementStyle = {}): ElementStyle {
  return { fontSize, fontSlot: "body", color, background: "transparent", lineHeight: 1.2, padding: 0, ...extra };
}

function existingCoverContent(page: ReportPage, meta: ReportDocument["meta"]) {
  const elements = page.elements;
  const bySlot = (slot: string) => elements.find((item) => item.presetSlot === slot)?.content?.trim();
  const byName = (pattern: RegExp) => elements.find((item) => pattern.test(`${item.id} ${item.name}`))?.content?.trim();
  const title = bySlot("cover-title") || elements.find((item) => item.semanticRole === "title")?.content?.trim() || byName(/封面标题|cover-title/i) || meta.title;
  return {
    kicker: bySlot("cover-kicker") || byName(/cover-type|封面类型/i) || page.section || "经营分析报告",
    title,
    subtitle: bySlot("cover-subtitle") || byName(/subtitle|副标题/i) || "关键经营表现、趋势判断与管理行动",
    period: bySlot("cover-period") || byName(/period|报告期/i) || `报告期：${meta.period}`,
    author: bySlot("cover-author") || byName(/author|编制/i) || `编制：${meta.author}`,
    confidentiality: bySlot("cover-confidentiality") || byName(/confidential|密级/i) || meta.confidentiality,
    monogram: bySlot("cover-monogram") || "01"
  };
}

function existingCoverImage(page: ReportPage) {
  const slotted = page.elements.find((item) => item.type === "image" && item.presetSlot === "cover-image");
  if (slotted) return slotted;
  if (page.masterProps?.imageAssetId) {
    return {
      assetId: page.masterProps.imageAssetId,
      crop: page.masterProps.crop,
      imageStyle: page.masterProps.imageStyle
    };
  }
  return page.elements.find((item) => item.type === "image"
    && item.assetId
    && /封面|背景|cover|hero/i.test(`${item.id} ${item.name}`)
    && !/logo|标志/i.test(`${item.id} ${item.name}`));
}

function imageElement(
  id: CoverTemplateId,
  source: Pick<ReportElement, "assetId" | "crop" | "imageStyle"> | undefined,
  assetId: string,
  x: number,
  y: number,
  w: number,
  h: number,
  imageStyle = DEFAULT_IMAGE_STYLE
) {
  return element("image", coverPreset(id), "cover-image", "封面图片", x, y, w, h, 1, { background: "surface" }, {
    assetId: source?.assetId || assetId,
    crop: source?.crop,
    content: "选择或拖入封面图片",
    imageStyle: source?.imageStyle || imageStyle
  });
}

function buildCinematic(page: ReportPage, meta: ReportDocument["meta"], orientation: Orientation, source: ReturnType<typeof existingCoverImage>, defaultImageId: string) {
  const p = coverPreset("cinematic-fullbleed");
  const size = PAGE_MM[orientation];
  const c = existingCoverContent(page, meta);
  const panelW = orientation === "portrait" ? 132 : 136;
  const titleY = orientation === "portrait" ? 104 : 66;
  return [
    imageElement("cinematic-fullbleed", source, defaultImageId, 0, 0, size.width, size.height, { ...DEFAULT_IMAGE_STYLE, grade: "film", vignette: "light" }),
    element("box", p, "cover-overlay", "电影感蒙版", 0, 0, panelW, size.height, 2, { background: "primary", opacity: 0.84 }),
    element("divider", p, "cover-accent", "封面强调线", 20, titleY - 13, 18, 1.2, 3, { background: "accent" }),
    element("image", p, "cover-logo", "白色 Logo", 18, 16, 34, 22, 4, { background: "transparent" }, { assetId: BRAND_ASSET_IDS.logoWhite, content: "白色 Logo" }),
    element("text", p, "cover-kicker", "报告类型", 20, titleY - 4, panelW - 34, 7, 5, textStyle(10, "white", { fontWeight: 700 }), { content: c.kicker }),
    element("text", p, "cover-title", "封面标题", 20, titleY + 11, panelW - 34, orientation === "portrait" ? 58 : 46, 6, textStyle(32, "white", { fontSlot: "display", fontWeight: 760, lineHeight: 1.2 }), { semanticRole: "title", content: c.title }),
    element("text", p, "cover-subtitle", "封面副标题", 20, orientation === "portrait" ? 181 : 128, panelW - 35, 30, 7, textStyle(12, "white", { lineHeight: 1.5, opacity: 0.9 }), { content: c.subtitle }),
    element("text", p, "cover-period", "报告期", 20, size.height - 49, panelW - 34, 7, 8, textStyle(10, "white", { fontWeight: 650 }), { content: c.period }),
    element("text", p, "cover-author", "编制部门", 20, size.height - 35, panelW - 34, 6, 9, textStyle(8, "white", { opacity: 0.82 }), { content: c.author }),
    element("text", p, "cover-confidentiality", "密级", 20, size.height - 22, panelW - 34, 6, 10, textStyle(8, "white", { fontWeight: 700 }), { content: c.confidentiality })
  ];
}

function buildEditorial(page: ReportPage, meta: ReportDocument["meta"], orientation: Orientation, source: ReturnType<typeof existingCoverImage>, defaultImageId: string) {
  const p = coverPreset("editorial-monogram");
  const size = PAGE_MM[orientation];
  const c = existingCoverContent(page, meta);
  const panelH = orientation === "portrait" ? 125 : 88;
  const panelY = size.height - panelH;
  const contentW = orientation === "portrait" ? 156 : 194;
  const monogramW = orientation === "portrait" ? 69 : 86;
  return [
    imageElement("editorial-monogram", source, defaultImageId, 0, 0, size.width, size.height, { ...DEFAULT_IMAGE_STYLE, grade: "documentary-fade", vignette: "light" }),
    element("box", p, "cover-overlay", "底部蒙版", 0, panelY, size.width, panelH, 2, { background: "text", opacity: 0.88 }),
    element("image", p, "cover-logo", "白色 Logo", 16, 15, 30, 19.5, 3, { background: "transparent" }, { assetId: BRAND_ASSET_IDS.logoWhite, content: "白色 Logo" }),
    element("text", p, "cover-monogram", "刊号", size.width - monogramW, panelY - 16, monogramW, panelH + 16, 4, textStyle(48, "white", { fontSlot: "numeric", fontWeight: 760, opacity: 0.16, align: "right" }), { content: c.monogram }),
    element("text", p, "cover-kicker", "报告类型", 18, panelY + 13, 92, 7, 5, textStyle(9, "white", { fontWeight: 700 }), { content: c.kicker }),
    element("text", p, "cover-title", "封面标题", 18, panelY + 30, contentW, orientation === "portrait" ? 48 : 36, 6, textStyle(32, "white", { fontSlot: "display", fontWeight: 760 }), { semanticRole: "title", content: c.title }),
    element("text", p, "cover-subtitle", "封面副标题", 18, panelY + (orientation === "portrait" ? 82 : 65), contentW, 22, 7, textStyle(10, "white", { lineHeight: 1.5, opacity: 0.88 }), { content: c.subtitle }),
    element("text", p, "cover-period", "报告期", size.width - 70, panelY + panelH - 31, 52, 7, 8, textStyle(9, "white", { align: "right", fontWeight: 650 }), { content: c.period }),
    element("text", p, "cover-author", "编制部门", size.width - 82, panelY + panelH - 19, 64, 6, 9, textStyle(8, "white", { align: "right", opacity: 0.78 }), { content: c.author }),
    element("text", p, "cover-confidentiality", "密级", 18, size.height - 18, 72, 6, 10, textStyle(8, "accent", { fontWeight: 700 }), { content: c.confidentiality })
  ];
}

function buildInstitutionalRail(page: ReportPage, meta: ReportDocument["meta"], orientation: Orientation, source: ReturnType<typeof existingCoverImage>, defaultImageId: string) {
  const p = coverPreset("institutional-rail");
  const size = PAGE_MM[orientation];
  const c = existingCoverContent(page, meta);
  const rail = orientation === "portrait" ? 18 : 24;
  const imageX = rail;
  const imageW = orientation === "portrait" ? size.width - rail : 148;
  const imageH = orientation === "portrait" ? 118 : size.height;
  const textX = orientation === "portrait" ? 34 : 190;
  const textY = orientation === "portrait" ? 148 : 44;
  const textW = orientation === "portrait" ? 152 : 87;
  return [
    element("box", p, "cover-paper", "封面纸张", 0, 0, size.width, size.height, 1, { background: "paper" }),
    element("box", p, "cover-rail", "品牌侧轨", 0, 0, rail, size.height, 2, { background: "primary" }),
    element("divider", p, "cover-rail-accent", "侧轨强调", 0, orientation === "portrait" ? 205 : 126, rail, 7, 3, { background: "accent" }),
    imageElement("institutional-rail", source, defaultImageId, imageX, 0, imageW, imageH, { ...DEFAULT_IMAGE_STYLE, grade: "documentary-fade" }),
    element("image", p, "cover-logo", "彩色 Logo", textX, orientation === "portrait" ? 132 : 18, 31, 20, 4, { background: "transparent" }, { assetId: BRAND_ASSET_IDS.logoColor, content: "彩色 Logo" }),
    element("text", p, "cover-kicker", "报告类型", textX, textY, textW, 7, 5, textStyle(9, "primary", { fontWeight: 700 }), { content: c.kicker }),
    element("divider", p, "cover-title-rule", "标题线", textX, textY + 13, 24, 1.1, 6, { background: "accent" }),
    element("text", p, "cover-title", "封面标题", textX, textY + 24, textW, orientation === "portrait" ? 54 : 48, 7, textStyle(28, "text", { fontSlot: "display", fontWeight: 760 }), { semanticRole: "title", content: c.title }),
    element("text", p, "cover-subtitle", "封面副标题", textX, textY + (orientation === "portrait" ? 87 : 78), textW, 28, 8, textStyle(11, "muted", { lineHeight: 1.5 }), { content: c.subtitle }),
    element("text", p, "cover-period", "报告期", textX, size.height - 57, textW, 7, 9, textStyle(10, "text", { fontWeight: 650 }), { content: c.period }),
    element("text", p, "cover-author", "编制部门", textX, size.height - 42, textW, 6, 10, textStyle(8, "muted"), { content: c.author }),
    element("text", p, "cover-confidentiality", "密级", textX, size.height - 27, textW, 6, 11, textStyle(8, "negative", { fontWeight: 700 }), { content: c.confidentiality })
  ];
}

function buildSplitPanel(page: ReportPage, meta: ReportDocument["meta"], orientation: Orientation, source: ReturnType<typeof existingCoverImage>, defaultImageId: string) {
  const p = coverPreset("split-image-panel");
  const size = PAGE_MM[orientation];
  const c = existingCoverContent(page, meta);
  const landscape = orientation === "landscape";
  const imageW = landscape ? 174 : size.width;
  const imageH = landscape ? size.height : 140;
  const panelX = landscape ? imageW : 0;
  const panelY = landscape ? 0 : imageH;
  const panelW = landscape ? size.width - imageW : size.width;
  const panelH = landscape ? size.height : size.height - imageH;
  const textX = panelX + (landscape ? 18 : 20);
  const textY = panelY + (landscape ? 54 : 36);
  const textW = panelW - (landscape ? 34 : 40);
  const accentY = landscape ? panelY + panelH - 54 : 270;
  const periodY = landscape ? panelY + panelH - 43 : 276;
  const authorY = landscape ? panelY + panelH - 30 : 285;
  const confidentialityY = landscape ? panelY + panelH - 18 : 291;
  return [
    imageElement("split-image-panel", source, defaultImageId, 0, 0, imageW, imageH, { ...DEFAULT_IMAGE_STYLE, grade: "deep-sea", vignette: "light" }),
    element("box", p, "cover-panel", "标题面板", panelX, panelY, panelW, panelH, 2, { background: "primary" }),
    element("image", p, "cover-logo", "白色 Logo", textX, panelY + (landscape ? 17 : 10), 30, 19.5, 3, { background: "transparent" }, { assetId: BRAND_ASSET_IDS.logoWhite, content: "白色 Logo" }),
    element("text", p, "cover-kicker", "报告类型", textX, textY, textW, 7, 4, textStyle(9, "white", { fontWeight: 700, opacity: 0.8 }), { content: c.kicker }),
    element("text", p, "cover-title", "封面标题", textX, textY + 16, textW, landscape ? 48 : 42, 5, textStyle(28, "white", { fontSlot: "display", fontWeight: 760 }), { semanticRole: "title", content: c.title }),
    element("text", p, "cover-subtitle", "封面副标题", textX, textY + (landscape ? 73 : 62), textW, 29, 6, textStyle(11, "white", { lineHeight: 1.5, opacity: 0.86 }), { content: c.subtitle }),
    element("divider", p, "cover-accent", "面板强调线", textX, accentY, 26, 1.1, 7, { background: "accent" }),
    element("text", p, "cover-period", "报告期", textX, periodY, textW, 7, 8, textStyle(9, "white", { fontWeight: 650 }), { content: c.period }),
    element("text", p, "cover-author", "编制部门", textX, authorY, textW, 6, 9, textStyle(8, "white", { opacity: 0.76 }), { content: c.author }),
    element("text", p, "cover-confidentiality", "密级", textX, confidentialityY, textW, 6, 10, textStyle(8, "white", { fontWeight: 700 }), { content: c.confidentiality })
  ];
}

function buildPublication(page: ReportPage, meta: ReportDocument["meta"], orientation: Orientation, source: ReturnType<typeof existingCoverImage>, defaultImageId: string) {
  const p = coverPreset("publication-window");
  const size = PAGE_MM[orientation];
  const c = existingCoverContent(page, meta);
  const landscape = orientation === "landscape";
  const imageX = landscape ? 146 : 28;
  const imageY = landscape ? 30 : 120;
  const imageW = landscape ? 133 : 182;
  const imageH = landscape ? 150 : 78;
  const titleX = landscape ? 22 : 28;
  const titleY = landscape ? 61 : 48;
  const titleW = landscape ? 107 : 154;
  return [
    element("box", p, "cover-paper", "出版纸张", 0, 0, size.width, size.height, 1, { background: "paper" }),
    element("box", p, "cover-edge", "出版色边", 0, 0, landscape ? 8 : size.width, landscape ? size.height : 8, 2, { background: "primary" }),
    imageElement("publication-window", source, defaultImageId, imageX, imageY, imageW, imageH, { ...DEFAULT_IMAGE_STYLE, grade: "documentary-fade" }),
    element("image", p, "cover-logo", "组合 Logo", titleX, 18, landscape ? 58 : 62, landscape ? 15.5 : 16.5, 4, { background: "transparent" }, { assetId: BRAND_ASSET_IDS.logoLockup, content: "报告工作台组合 Logo" }),
    element("text", p, "cover-kicker", "报告类型", titleX, titleY, titleW, 7, 5, textStyle(9, "accent", { fontWeight: 700 }), { content: c.kicker }),
    element("text", p, "cover-title", "封面标题", titleX, titleY + 17, titleW, landscape ? 54 : 46, 6, textStyle(28, "text", { fontSlot: "display", fontWeight: 760 }), { semanticRole: "title", content: c.title }),
    element("divider", p, "cover-title-rule", "标题线", titleX, titleY + (landscape ? 79 : 72), 34, 1.1, 7, { background: "primary" }),
    element("text", p, "cover-subtitle", "封面副标题", titleX, titleY + (landscape ? 91 : 84), titleW, 35, 8, textStyle(11, "muted", { lineHeight: 1.5 }), { content: c.subtitle }),
    element("box", p, "cover-meta-panel", "信息块", landscape ? 22 : 28, size.height - (landscape ? 54 : 59), landscape ? 107 : 154, landscape ? 33 : 35, 9, { background: "surface", borderColor: "line", borderWidth: 0.3, radius: 0 }),
    element("text", p, "cover-period", "报告期", landscape ? 30 : 36, size.height - (landscape ? 46 : 50), landscape ? 90 : 136, 7, 10, textStyle(9, "text", { fontWeight: 650 }), { content: c.period }),
    element("text", p, "cover-author", "编制部门", landscape ? 30 : 36, size.height - (landscape ? 34 : 37), landscape ? 90 : 136, 6, 11, textStyle(8, "muted"), { content: c.author }),
    element("text", p, "cover-confidentiality", "密级", landscape ? 30 : 36, size.height - (landscape ? 23 : 25), landscape ? 90 : 136, 6, 12, textStyle(8, "negative", { fontWeight: 700 }), { content: c.confidentiality })
  ];
}

const coverBuilders = {
  "cinematic-fullbleed": buildCinematic,
  "editorial-monogram": buildEditorial,
  "institutional-rail": buildInstitutionalRail,
  "split-image-panel": buildSplitPanel,
  "publication-window": buildPublication
} satisfies Record<CoverTemplateId, typeof buildCinematic>;

const COVER_TEMPLATE_LOGO: Record<CoverTemplateId, BrandAssetId> = {
  "cinematic-fullbleed": BRAND_ASSET_IDS.logoWhite,
  "editorial-monogram": BRAND_ASSET_IDS.logoWhite,
  "institutional-rail": BRAND_ASSET_IDS.logoColor,
  "split-image-panel": BRAND_ASSET_IDS.logoWhite,
  "publication-window": BRAND_ASSET_IDS.logoLockup
};

const builtInBrandAssetIds = new Set<string>(Object.values(BRAND_ASSET_IDS));

function builtInIds(ids: Array<string | undefined>) {
  return [...new Set(ids.filter((id): id is BrandAssetId => Boolean(id && builtInBrandAssetIds.has(id))))];
}

export function coverTemplateRequiredAssetIds(page: ReportPage, templateId: CoverTemplateId) {
  const descriptor = COVER_TEMPLATES.find((item) => item.id === templateId)!;
  const imageAssetId = existingCoverImage(page)?.assetId || descriptor.previewAssetId;
  return builtInIds([COVER_TEMPLATE_LOGO[templateId], imageAssetId]);
}

export function applyCoverTemplate(page: ReportPage, meta: ReportDocument["meta"], templateId: CoverTemplateId, assets: readonly ReportAsset[] = []) {
  const descriptor = COVER_TEMPLATES.find((item) => item.id === templateId)!;
  const source = existingCoverImage(page);
  const masterFocal = page.masterProps?.focal;
  if (source && !source.crop && page.masterProps?.imageAssetId === source.assetId && masterFocal) {
    const asset = assets.find((item) => item.id === source.assetId);
    if (asset) {
      const size = PAGE_MM[page.orientation];
      const frameRatio = size.width / size.height;
      const assetRatio = asset.width / asset.height;
      source.crop = assetRatio > frameRatio
        ? { sx: (asset.width - asset.height * frameRatio) * masterFocal.x / 100, sy: 0, sw: asset.height * frameRatio, sh: asset.height }
        : { sx: 0, sy: (asset.height - asset.width / frameRatio) * masterFocal.y / 100, sw: asset.width, sh: asset.width / frameRatio };
    }
  }
  const defaultImageId = source?.assetId || descriptor.previewAssetId;
  page.elements = coverBuilders[templateId](page, meta, page.orientation, source, defaultImageId);
  page.master = "cover";
  if (page.masterProps) {
    delete page.masterProps.imageAssetId;
    delete page.masterProps.crop;
    delete page.masterProps.focal;
    delete page.masterProps.overlay;
    delete page.masterProps.overlayStrength;
    delete page.masterProps.imageStyle;
  }
  return {
    requiredAssetIds: builtInIds(page.elements.map((item) => item.assetId)),
    selectedIds: page.elements.map((item) => item.id)
  };
}

function chromeBase(
  page: ReportPage,
  meta: ReportDocument["meta"],
  pageNumber: number,
  totalPages: number,
  footerMode: ReportDocument["pageSetup"]["footerMode"]
) {
  return {
    section: page.section || page.name,
    organization: meta.organization || meta.title,
    confidentiality: footerMode === "confidentiality-last" && pageNumber !== totalPages ? "" : meta.confidentiality,
    pageNumber: String(pageNumber).padStart(2, "0")
  };
}

function buildMinimalChrome(page: ReportPage, meta: ReportDocument["meta"], pageNumber: number, totalPages: number, footerMode: ReportDocument["pageSetup"]["footerMode"]) {
  const p = chromePreset("minimal-rule");
  const size = PAGE_MM[page.orientation];
  const c = chromeBase(page, meta, pageNumber, totalPages, footerMode);
  const margin = 16;
  return [
    element("image", p, "header-logo", "页眉 Logo", margin, 5, 17, 11, 1, { background: "transparent" }, { assetId: BRAND_ASSET_IDS.logoColor, content: "彩色 Logo" }),
    element("text", p, "header-organization", "页眉机构", margin + 22, 7, 72, 5, 2, textStyle(8, "muted", { fontWeight: 650 }), { role: "header-left", content: c.organization }),
    element("text", p, "header-section", "页眉章节", size.width - 96, 7, 80, 5, 3, textStyle(8, "muted", { align: "right" }), { role: "header-right", content: c.section }),
    element("divider", p, "header-rule", "页眉线", margin, 17, size.width - margin * 2, 0.3, 4, { background: "line" }, { role: "header-rule" }),
    element("divider", p, "footer-rule", "页脚线", margin, size.height - 12, size.width - margin * 2, 0.3, 5, { background: "line" }, { role: "footer-rule" }),
    element("text", p, "footer-confidentiality", "页脚密级", margin, size.height - 9, 90, 5, 6, textStyle(8, "muted"), { role: "footer-left", content: c.confidentiality }),
    element("text", p, "footer-page", "页码", size.width - 36, size.height - 9, 20, 5, 7, textStyle(8, "primary", { fontSlot: "numeric", fontWeight: 700, align: "right" }), { role: "footer-page-number", content: c.pageNumber })
  ];
}

function buildRailChrome(page: ReportPage, meta: ReportDocument["meta"], pageNumber: number, totalPages: number, footerMode: ReportDocument["pageSetup"]["footerMode"]) {
  const p = chromePreset("brand-rail");
  const size = PAGE_MM[page.orientation];
  const c = chromeBase(page, meta, pageNumber, totalPages, footerMode);
  const rail = page.orientation === "portrait" ? 7 : 8;
  return [
    element("box", p, "chrome-rail", "页面侧轨", 0, 0, rail, size.height, 1, { background: "primary" }),
    element("box", p, "chrome-rail-accent", "侧轨强调", 0, 22, rail, 22, 2, { background: "accent" }),
    element("image", p, "header-logo", "页眉 Logo", 13, 5, 17, 11, 3, { background: "transparent" }, { assetId: BRAND_ASSET_IDS.logoColor, content: "彩色 Logo" }),
    element("text", p, "header-section", "页眉章节", 35, 7, size.width - 51, 6, 4, textStyle(8, "primary", { fontWeight: 700, align: "right" }), { role: "header-right", content: c.section }),
    element("divider", p, "header-rule", "页眉线", 13, 18, size.width - 29, 0.5, 5, { background: "primary" }, { role: "header-rule" }),
    element("text", p, "footer-organization", "页脚机构", 13, size.height - 9, 92, 5, 6, textStyle(8, "muted"), { role: "footer-left", content: c.organization }),
    element("text", p, "footer-confidentiality", "页脚密级", size.width - 112, size.height - 9, 78, 5, 7, textStyle(8, "muted", { align: "right" }), { content: c.confidentiality }),
    element("text", p, "footer-page", "页码", 0, size.height - 15, rail, 7, 8, textStyle(8, "white", { fontSlot: "numeric", fontWeight: 700, align: "center" }), { role: "footer-page-number", content: c.pageNumber })
  ];
}

function buildEditorialChrome(page: ReportPage, meta: ReportDocument["meta"], pageNumber: number, totalPages: number, footerMode: ReportDocument["pageSetup"]["footerMode"]) {
  const p = chromePreset("editorial-corner");
  const size = PAGE_MM[page.orientation];
  const c = chromeBase(page, meta, pageNumber, totalPages, footerMode);
  return [
    element("text", p, "header-organization", "页眉机构", 17, 7, 78, 5, 1, textStyle(8, "text", { fontWeight: 700 }), { role: "header-left", content: c.organization }),
    element("divider", p, "header-short-rule", "页眉短线", 17, 15, 42, 0.7, 2, { background: "accent" }, { role: "header-rule" }),
    element("text", p, "header-section", "页眉章节", 66, 7, size.width - 108, 5, 3, textStyle(8, "muted", { align: "right" }), { role: "header-right", content: c.section }),
    element("image", p, "header-logo", "页眉 Logo", size.width - 34, 4, 18, 11.7, 4, { background: "transparent" }, { assetId: BRAND_ASSET_IDS.logoColor, content: "彩色 Logo" }),
    element("text", p, "footer-page", "页码", 17, size.height - 10, 18, 6, 5, textStyle(10, "primary", { fontSlot: "numeric", fontWeight: 760 }), { role: "footer-page-number", content: c.pageNumber }),
    element("divider", p, "footer-short-rule", "页脚短线", 40, size.height - 7.5, 28, 0.6, 6, { background: "primary" }, { role: "footer-rule" }),
    element("text", p, "footer-confidentiality", "页脚密级", size.width - 94, size.height - 10, 77, 6, 7, textStyle(8, "muted", { align: "right" }), { role: "footer-left", content: c.confidentiality })
  ];
}

const chromeBuilders = {
  "minimal-rule": buildMinimalChrome,
  "brand-rail": buildRailChrome,
  "editorial-corner": buildEditorialChrome
} satisfies Record<ChromeTemplateId, typeof buildMinimalChrome>;

function isPageChrome(element: ReportElement) {
  return Boolean(element.role || element.presetId?.startsWith("chrome-template:"));
}

export function applyChromeTemplate(
  page: ReportPage,
  meta: ReportDocument["meta"],
  templateId: ChromeTemplateId,
  pageNumber: number,
  totalPages = pageNumber,
  footerMode: ReportDocument["pageSetup"]["footerMode"] = "all"
) {
  const content = page.elements.filter((item) => !isPageChrome(item));
  const chrome = chromeBuilders[templateId](page, meta, pageNumber, totalPages, footerMode);
  const maxContentZ = Math.max(0, ...content.map((item) => item.z));
  chrome.forEach((item, index) => { item.z = maxContentZ + index + 1; });
  page.elements = [...content, ...chrome];
  return { requiredAssetIds: [BRAND_ASSET_IDS.logoColor] as BrandAssetId[], selectedIds: chrome.map((item) => item.id) };
}

export function syncPageDecorationElements(report: ReportDocument) {
  report.pages.forEach((page, index) => {
    const values = chromeBase(page, report.meta, index + 1, report.pages.length, report.pageSetup.footerMode);
    page.elements.forEach((item) => {
      let content: string | undefined;
      if (item.role === "footer-page-number") content = values.pageNumber;
      if (item.presetId?.startsWith("chrome-template:")) {
        if (item.presetSlot === "header-organization" || item.presetSlot === "footer-organization") content = values.organization;
        if (item.presetSlot === "header-section") content = values.section;
        if (item.presetSlot === "footer-confidentiality") content = values.confidentiality;
      }
      if (content === undefined) return;
      item.content = content;
      if (item.type === "text") item.runs = [{ text: content }];
    });
  });
}

export function pageSupportsChrome(page: ReportPage) {
  return ["standard", "data", "section"].includes(page.master);
}

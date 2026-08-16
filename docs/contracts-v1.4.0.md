# Local Report Studio v1.4.0 契约

状态：规范性基线  
应用版本：`1.4.0`  
工程格式：`ReportDocument 1.4`

## 1. 版本与事实源

1. `VERSION`、`package.json.version` 和 `release/v1.4.0.json.applicationVersion` 必须均为 `1.4.0`。
2. `ReportDocument.version`、模板和发布清单 schema 必须均为 `1.4`。
3. 报告结构唯一持久化事实源是 `ReportDocument`；图片二进制只通过 `assetId` 引用 IndexedDB Blob。
4. 选择、缩放、参考线、面板、对话框和编辑会话不得进入工程 JSON。
5. 编辑态与打印态必须复用同一页面、元素、文字、图片、表格和图表渲染组件。

## 2. 原子元素

`ReportElement.type` 只允许：

```text
text | box | divider | image | chart | table
```

1. 不得在 1.4 工程写入 `title/kpi/quote/source/line-chart/bar-chart/combo-chart/donut-chart`。
2. 不得在 1.4 工程写入旧 `value/unit/note`；这些字段只作为迁移输入。
3. 图表类型只通过 `chartKind: line|bar|combo|donut` 表达。
4. 图表与表格标题必须是相邻 `text` 元素，不得回写为图表或表格内嵌标题事实源。

## 3. 文本语义

`semanticRole` 只允许：

```text
title | body | caption | source
kpi-label | kpi-value | kpi-unit | kpi-note
quote-mark | quote-body | quote-attribution
```

1. 来源检查必须使用 `type === "text" && semanticRole === "source"`，不得依赖旧元素类型或文字前缀猜测。
2. 文本必须存纯文本 `content/runs`，不得存 HTML。
3. runs marks 只允许 `bold/accentRed/accentGreen`。
4. 字体槽只允许 display/body/numeric，字号只允许 8/10/12/14/28 pt，用户行高只允许 1.2/1.35/1.5。
5. `kpi-value` 默认使用数字体，`title/quote-mark` 默认使用标题体；显式字体槽优先。

## 4. 组合

组合元数据为一层可选字段：

```ts
groupId?: string;
groupName?: string;
presetId?: string;
presetSlot?: string;
```

1. 组合不得嵌套，不得成为新的元素类型，也不得保存独立几何副本。
2. 单击组合任一可见成员必须选择整组；框选命中任一成员必须扩展到整组。
3. 移动、键盘微调、复制、删除、锁定和隐藏必须作用于整组。
4. 复制组合和复制页面必须为复制品生成新 group ID，不能与原组合继续联动。
5. 若组合任一成员锁定，删除或复制不得留下半个组合。
6. 拆组只删除四个组合元数据字段，不能改内容、样式、几何、图层或资产。
7. v1.4.0 不承诺组合比例缩放；多选或整组选中时不得显示单元素缩放手柄。

## 5. 迁移

1. 导入必须接受 1.0、1.1、1.2、1.3 和 1.4，运行态固定归一为 1.4。
2. 1.3 KPI 必须展开为 box、标签 text、数值 text、单位 text 和变化 text。
3. 1.3 quote 必须展开为 box、引号 text、正文 text 和署名 text。
4. 1.3 title/source 必须转为带语义角色的 text。
5. 四种旧图表必须转为 caption text + chart；旧 table 必须转为 caption text + table。
6. 展开几何、内容、图表数据和语义必须确定；导入已经归一化的 1.4 工程不得再次展开。
7. 1.0-1.2 缺失的页眉、页脚、规则线、页码和尾页制度元素继续补齐。
8. 迁移必须通过 `npm run test:migration`。

## 6. 页面、坐标与编辑

1. 元素 x/y/w/h 始终为 mm；A4 纵向 210 x 297 mm，横向 297 x 210 mm。
2. 编辑投影由绝对 mm 乘 `pxPerMm` 得到；打印直接使用 CSS mm。
3. 元素移动和缩放必须受页面边界约束；锁定/隐藏元素不得被普通几何命令修改。
4. 单选对齐相对页面，多选对齐相对选区；三项以上才允许等间距分布。
5. 拖动吸附阈值为屏幕空间 8 px，候选含页面、页边距、中心、网格和其他元素；Alt 临时关闭。
6. 页内文字使用原生 input/textarea，保护中文 IME，粘贴只保留纯文本，一次编辑会话至多形成一条历史。
7. 拖动、缩放、裁切和组合操作必须可撤销；历史不得包含图片二进制。

## 7. 图表、表格与来源

1. 图表使用 ECharts SVG；TSV 首列为类目，其余列为系列。
2. combo 每个系列可设置 bar/line、left/right 和 unit。
3. 图表标题由 caption text 提供，图表元素只负责数据与图形。
4. 表格 TSV 首行为表头，其余行为正文；表题由 caption text 提供。
5. 页面有可见 chart/table 而没有可见 source 语义文本时必须告警，不得自动生成来源。
6. 打印前所有图表必须关闭动画、同步 option 并 resize。

## 8. 图片、存储与输出

1. 页面背景是 `masterProps.imageAssetId`，不进入普通图层或组合；内容图片是普通 image 元素。
2. 裁切必须非破坏；导入位图须校正方向、剥离 EXIF/GPS，默认最长边不超过 4096 px。
3. 默认工程包为 `.report.zip`，包含 `document.json + assets/`；单 JSON 归档可以使用顶层 base64 `assetData`。
4. 自动保存/IndexedDB 失败、缺 Blob、低 DPI、50 MB 预算、字体替换和打印风险必须可见提示。
5. 打印态保留 DOM 可搜索文字、ECharts SVG、命名纵横 `@page` 和 96/150/300 DPI 图片副本。

## 9. 离线与研究边界

1. 生产运行时代码不得引用 HTTP/HTTPS 资源，不得包含上传、账号、遥测、广告或远程字体。
2. 研究文档可以保存来源链接，但不得进入运行时请求路径。
3. 新增主题和模板不得复制样本机构的标志、专有字体、摄影或品牌身份。

## 10. 发布门禁

v1.4.0 必须执行：

```bash
npm run typecheck
npm run test:migration
npm run build
npm run check:offline
npm run check:contract
npm run qa:visual
```

`dist/index.html` 的最终字节数和 SHA-256 必须与 `release/v1.4.0.json` 一致。任一 schema 语义、原子元素边界、组合边界、离线边界或产物哈希改变，都不得继续沿用该发布清单。

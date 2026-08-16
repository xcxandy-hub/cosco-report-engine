# 开源项目核验与技术选型

核验日期：2026-08-14。

本文件对原始调研文档中的项目结论做了二次核验。星标数是核验时的快照，不是稳定属性；许可证和生产使用限制则直接影响能否复制代码或作为产品底座，优先级更高。

## 结论摘要

本项目采用“自研轻量 DOM 编辑层 + ECharts SVG + 浏览器打印”的路线。

采用的核心原则：

1. 学 PPTist 的基准坐标与缩放投影，不复制其 AGPL 代码。
2. 学 pdfme 的毫米模板模型、编辑与输出共用数据、元素插件职责拆分。
3. 学 visual-drag-demo 的组件数组、六线吸附和快照历史原理。
4. 学 GoView 的“组件渲染 + 数据面板 + 默认配置”结构。
5. 学 GrapesJS 的 Model/View 分离和模型作为唯一事实源。
6. 保留原 v4 的 DOM 文字、ECharts SVG、`@page`、打印色彩和来源行制度。
7. 不采用 tldraw 作为生产底座；不复制 PPTist、JimuReport 或原 hiprint 的受限代码。

## 项目核验矩阵

| 项目 | 2026-08-14 状态 | 许可证核验 | 有价值的实现 | 本项目决策 |
| --- | --- | --- | --- | --- |
| [PPTist](https://github.com/pipipi-pikachu/PPTist) | 9,259 stars，仍活跃 | AGPL-3.0 | 1000 × 562.5 基准画布、集中 store、数据驱动元素、内容层和工具层分离 | 只参考交互和坐标思想，不复制代码 |
| [vue-fabric-editor](https://github.com/ikuaitu/vue-fabric-editor) | 7,939 stars，仍活跃 | MIT | Fabric 画布、JSON 序列化、编辑器插件生命周期 | Canvas 不利于本项目的 DOM 文字打印，因此不作为渲染底座 |
| [visual-drag-demo](https://github.com/woai3c/visual-drag-demo) | 5,628 stars | MIT | 组件数组、绝对定位、八向缩放、六线吸附、快照历史 | 采用原理，自研轻量 pointer 编辑层 |
| [GoView](https://github.com/dromara/go-view) | 955 stars；最近代码推送为 2025-12-25 | MIT | 图表组件元数据、画布组件与配置面板成对注册、ECharts 数据编辑 | 采用组件与属性面板同构思想；不采用大屏 px 渲染层 |
| [JimuReport](https://github.com/jeecgboot/JimuReport) | 8,165 stars | 仓库许可证为 GPL-3.0 | 报表设计器、数据集与打印能力 | 协议和系统体量不适合作为本地单 HTML 底座 |
| [pdfme](https://github.com/pdfme/pdfme) | 4,770 stars；6.0.0 发布于 2026-04-03 | MIT | `Template = basePdf + schemas`、mm 坐标、`ui/pdf/propPanel` 插件职责、Designer 依赖栈 | 文档模型的重要参考；图表密集报告仍用 DOM + ECharts |
| [GrapesJS](https://github.com/GrapesJS/grapesjs) | 26,123 stars | 仓库许可证文本为 BSD 3-Clause 风格；GitHub API 标记 `NOASSERTION` | Component Definition、类型栈、Model 为事实源、View 与导出分离、traits 属性声明 | 采用模型/视图分离，不采用流式网页 DOM 树作为 A4 模型 |
| [tldraw](https://github.com/tldraw/tldraw) | 49,776 stars | 自定义许可证 | 成熟无限画布、协作和交互 | 默认许可证明确限制生产环境使用，未取得替代许可前不采用 |
| [Paged.js](https://github.com/pagedjs/pagedjs) | 1,471 stars | MIT | Previewer、Chunker、Polisher、CSS Paged Media handlers、Puppeteer CLI | 固定版位页面先用原生 `@page`；长文自动续排再考虑引入 |
| [CcSimple/vue-plugin-hiprint](https://github.com/CcSimple/vue-plugin-hiprint) | 1,711 stars | fork 仓库标 MIT；README 说明基于原 hiprint 2.5.4 LGPL，仍依赖 jQuery | mm 纸张、provider、属性容器、history、`onDataChanged` | 参考对象模型和 provider，不引入依赖与许可证来源复杂的旧栈 |

## 对原调研文档的关键纠正

### GoView 的 star 数量

原文写为“9k+”。核验值是 955，不是 9,000 以上。这不会否定其组件注册设计的参考价值，但会改变对生态规模、维护者数量和长期风险的判断。

### JimuReport 的“双协议”

仓库许可证字段和许可证文件显示 GPL-3.0。仅凭仓库材料不能建立“双协议可自由选择”的结论。如果商业项目需要不同授权，应直接向权利人取得书面条款，不能根据二手介绍推断。

### GrapesJS 的许可证显示

GitHub API 返回 `NOASSERTION`，但仓库中的许可证文本是 BSD 3-Clause 风格。自动化许可证字段缺失不等于没有许可证；真正采用前仍应保留许可证文本并由合规流程确认。

### tldraw 的生产限制

tldraw 不是常规 MIT 库。当前自定义许可证明确禁止未取得替代许可证的生产环境使用。即便技术能力很强，也不应把它列为无条件可用的本地生产底座。

### hiprint 生态的许可证链

`vue-plugin-hiprint` fork 本身标 MIT，但 README 同时说明它基于原 hiprint 2.5.4 LGPL，并且保留 jQuery 依赖。评估时必须同时看 fork 许可证、上游代码来源和实际打包内容，不能只看 GitHub 页面顶部的一个标签。

## 精读实现证据

### PPTist

[Canvas.md](https://github.com/pipipi-pikachu/PPTist/blob/master/doc/Canvas.md) 给出 1000 × 562.5 的基准画布。实际显示尺寸通过缩放比投影，元素数据不随缩放改写。它还将页面内容与选择框、辅助线等画布工具分层。

[DirectoryAndData.md](https://github.com/pipipi-pikachu/PPTist/blob/master/doc/DirectoryAndData.md) 展示 `slides`、`theme`、`viewportSize`、`viewportRatio`、`templates` 等集中状态。这验证了“文档数据是事实源，编辑视图只是投影”的方案。

本项目对应实现：文档保存 `x/y/w/h` 的 mm 数值；编辑态使用 `pxPerMm` 进行缩放；打印态直接输出 mm。

### visual-drag-demo

项目及配套原理文章展示一页由组件数组组成，每个组件包含位置、尺寸、类型和内容。拖动使用指针起点与初始位置的差值，缩放根据八个控制点更新四条边。

吸附并不需要复杂布局引擎。将当前元素的左、右、水平中心和其他元素对应特征线比较，差值低于阈值时改写坐标并显示参考线。撤销重做则是文档快照和游标。

本项目实现了八向缩放、网格/页边距/中心/其他元素吸附、命中参考线和 80 步快照历史。

### h5-editor 与 luban-h5

原调研还列出了 [h5-editor](https://github.com/a7650/h5-editor) 和 [luban-h5](https://github.com/ly525/luban-h5)。它们对本项目最有帮助的不是纸张渲染，而是编辑器交互边界：h5-editor 将画布、用户参考线和其他组件作为三类吸附目标，标尺点击生成参考线，拖动修改位置，双击删除；同时使用 IndexedDB 做本地自动备份。

这些机制与机密报告的本地化要求一致，因此当前版本使用 localStorage 自动保存文档结构，以 IndexedDB 单独保存图片 Blob，并实现元素/页边距/中心/网格特征线吸附。撤销历史只保存结构，不复制图片二进制。

luban-h5 更接近页面级低代码编辑器，适合参考页面 schema、组件配置和素材管理的组织方式。原调研没有把它作为本项目的许可证依据；若未来直接引入代码，必须针对当前仓库的许可证和每个依赖重新核验。本版本只采用“页面是组件数组，配置面板编辑组件属性”的抽象，不复制其实现。

### pdfme

[当前 schema.ts](https://github.com/pdfme/pdfme/blob/main/packages/common/src/schema.ts) 定义元素 `position`、`width`、`height`，空白 PDF 的尺寸与 padding，并将模板表达为 `schemas + basePdf`。插件同时承担 `ui`、`pdf` 和 `propPanel` 职责。

[UI package.json](https://github.com/pdfme/pdfme/blob/main/packages/ui/package.json) 显示 Designer 当前使用 `react-moveable`、`react-selecto`、`@scena/react-guides` 和 dnd-kit。这说明成熟编辑器可以组合移动缩放、框选、标尺和排序库。

本版本为了离线体积、交互可控性和更小的依赖面，自研了当前所需的 pointer 交互。后续如果增加旋转、多级组合和自定义标尺，可以重新评估 moveable/selecto/guides。

### GrapesJS

[Components 文档](https://grapesjs.com/docs/modules/Components.html) 将 HTML 解析为 Component Definition，按类型栈识别组件，Model 是导出和状态的事实源，View 只负责编辑器中的呈现。traits 则从组件类型声明生成属性编辑 UI。

本项目没有直接存 HTML 字符串。JSON 元素模型生成编辑态和打印态，右侧面板根据元素类型显示数据字段。

### Paged.js

[README](https://github.com/pagedjs/pagedjs) 和官方文档描述 `Previewer`、`Chunker`、`Polisher` 以及 print CSS handlers。它适合将连续内容测量并切成页盒，也提供 Puppeteer CLI。

本项目是一页一母版的固定版位系统，不需要在运行时切分长内容。引入 Paged.js 会增加测量成本和包体，当前不采用。未来若新增多页长表、脚注续排或孤行控制，Paged.js 是合适的专项方案。

### GoView 与 hiprint

GoView 的组件约定可概括为元数据/默认 option、画布渲染组件、右侧配置组件三件套。hiprint 则采用 Template、panel、printElement 三级对象，并通过 provider 注册元素，使用 setting container 渲染属性。

两者共同证明“组件定义同时拥有渲染、默认值和编辑字段”比在主编辑器中堆积类型判断更可维护。本版本先用有限类型联合实现，后续扩展到大量图表时应升级为注册表。

## 原财务生成器审计

原文件 `财务分析报告生成器_v4.6.16_20260814.html` 约 7.6 MB、13,213 行，完全内联。核验文件 SHA-256：

```text
7b435d1c0cc6efce676d9fbbbc6540bf9c6f7ebd8e205df60fc0ab54fd878e70
```

值得保留的工程资产：

- ECharts SVG renderer，避免整页位图化。
- 中文字体策略和无外部依赖的交付形式。
- `@page`、打印颜色调整、显式分页和纵横版切换。
- 页面注册、自定义页面和 JSON 工程导入导出。
- Excel TSV 粘贴和报告就绪检查。
- 图表端点标签、标签碰撞抑制、会计负数格式。
- 本地图片与背景。

不应延续的部分：

- 大量 `v4*`、`v44*`、`v45*`、`v46*`、`v4616*` 函数覆盖早期行为。
- 页面数据、编辑状态和打印逻辑之间缺少稳定边界。
- 版本补丁持续叠加，难以判断哪个函数是最终事实源。

本项目因此采用一个 `ReportDocument`、一个页面渲染器和一条历史链。打印态不另做一套模板，只关闭编辑装饰并切换长度单位。

## 研报设计语言的参数化

原调研对 JPM、KPMG、MGI、Maersk 及中文券商研报的归纳是成立的，最适合转成以下约束：

| 设计规则 | 生成器参数 |
| --- | --- |
| 页眉、主体、页脚三段版心 | 带 role 的可编辑制度元素 + 页面 `margin` |
| 4-5 级字阶 | `fontSize` 白名单和元素预设 |
| 主品牌色、一个强调色、语义红绿、有限图表色 | `ThemeTokens` |
| 图表少网格、端点标注、表格弱竖线 | ECharts 预设和表格 CSS |
| 页码、密级、图表标题、资料来源 | 可编辑页眉/页脚/页码 role 元素和显式 `source` 元素 |
| 基线网格 | 2.5/5/10 mm 网格与吸附 |
| 95% 遵循模板，5% 自由微调 | 默认吸附，Alt 临时关闭 |

专业感主要来自约束的一致性，而不是装饰数量。当前主题只暴露三套克制色板，画布组件使用低圆角和明确边界，报告页面不使用网页式悬浮卡片或大面积渐变。

## 采用风险与后续建议

### 可以直接演进

- 增加目录、章节页、双图页、密排表页等母版。
- 将瀑布图、桥图、散点图和甘特图作为新元素类型接入。
- 把组件类型判断改造成注册表，每个插件提供默认数据、渲染器和属性定义。
- 将 localStorage 自动保存升级为 IndexedDB，以支持更大的本地图片工程。

### 需要专项设计

- 旋转、持久化组合/拆分和自定义标尺会显著增加几何与历史复杂度。当前版本已实现多选包围盒操作与水平/垂直等间距分布，但不会把选区持久化为组合对象。
- 长文流入和跨页长表应单独引入分页算法，不应挤入固定版位渲染器。
- 直接生成 PDF 字节需要解决中文字体授权、字体内嵌和 ECharts 矢量转换；当前浏览器打印更稳妥。
- 多人协作、云模板库和远程数据源会改变“机密数据只留本地”的产品边界，需要独立安全评审。

## 参考链接

- [PPTist Canvas](https://github.com/pipipi-pikachu/PPTist/blob/master/doc/Canvas.md)
- [PPTist DirectoryAndData](https://github.com/pipipi-pikachu/PPTist/blob/master/doc/DirectoryAndData.md)
- [visual-drag-demo 原理文章 1](https://github.com/woai3c/Front-end-articles/issues/19)
- [visual-drag-demo 原理文章 2](https://github.com/woai3c/Front-end-articles/issues/20)
- [visual-drag-demo 原理文章 3](https://github.com/woai3c/Front-end-articles/issues/21)
- [visual-drag-demo 原理文章 4](https://github.com/woai3c/Front-end-articles/issues/33)
- [pdfme Getting Started](https://pdfme.com/docs/getting-started)
- [GrapesJS Components](https://grapesjs.com/docs/modules/Components.html)
- [Paged.js documentation](https://pagedjs.org/en/documentation/)

星标、版本和最后推送日期来自核验当日的 GitHub API/仓库元数据。许可证判断以仓库许可证文件和明确的使用条款为主。任何对外分发或商业集成仍应经过组织自己的开源合规流程。

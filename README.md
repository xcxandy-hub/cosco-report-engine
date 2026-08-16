# 通用本地 PDF 报告生成器

这是一个面向经营分析、财务简报、专题研究和管理层汇报的本地报告工作台。编辑器负责毫米级页面、人工微调与 A4 打印；报告内核把智能体制作的特化报告包编译到同一个渲染器。当前发布候选应用版本为 `1.8.0`，工程格式为 `ReportDocument 1.5`。版本边界见 [v1.8.0 特性基线](./docs/feature-baseline-v1.8.0.md) 和 [v1.8.0 契约](./docs/contracts-v1.8.0.md)。

本仓库是社区项目，不是中远海运集团或其下属公司的官方软件、品牌手册或数据产品。默认主题只是可替换的本地企业报告起点，公开样例使用合成数据。内置彩色和白色 Logo 位图从用户提供的旧版工具原始路径提取，相关名称与商标归其权利人；这些商标资产明确排除于仓库 MIT 许可之外，使用者需自行确认使用与再分发权限。“中远海运 / COSCO SHIPPING REPORTS”横向组合是本项目的报告工作台组合标识，不是正式品牌规范资产。封面起始照片来自 Wikimedia Commons 的公有领域或 CC0 素材，逐项来源见 [素材说明](./src/assets/brand/covers/NOTICE.md)。

## GitHub 安装与智能体调用

完整使用需要克隆引擎仓库。仅安装 Skill 只会获得工作流和规范，不会单独安装 React/ECharts 内核。

```bash
git clone https://github.com/xcxandy-hub/cosco-report-engine.git
cd cosco-report-engine
npm ci
npm run engine:build
```

在 Codex 中打开克隆后的项目，直接说：

```text
使用 $cosco-report，根据我提供的脱敏文字稿和页面要求，先提交逐页方案，我确认后再制作特化报告生成器。
```

需要把 Skill 安装到 Codex 全局目录时，可使用 Codex 内置 `skill-installer`：

```bash
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo xcxandy-hub/cosco-report-engine \
  --path .agents/skills/cosco-report
```

安装后重新启动 Codex，并在本仓库目录中运行智能体。如果 Skill 和引擎不在同一工作区，设置 `COSCO_REPORT_ENGINE_ROOT` 为引擎克隆的绝对路径。其他智能体可直接读取 [`.agents/skills/cosco-report/SKILL.md`](./.agents/skills/cosco-report/SKILL.md) 并依照其中工作流调用 `scripts/report-engine.mjs`。

可直接复制的任务模板：

- [新建特化报告](./.agents/skills/cosco-report/references/prompt-create-report.md)
- [修改某个特化报告](./.agents/skills/cosco-report/references/prompt-modify-specialized-report.md)
- [修改通用内核源码](./.agents/skills/cosco-report/references/prompt-modify-core-engine.md)

## 直接使用

打开 [dist/index.html](./dist/index.html) 即可使用，不需要安装软件，也不需要网络连接。

第一个特化参考实现位于 [artifacts/finance-brief/finance-brief-generator.html](./artifacts/finance-brief/finance-brief-generator.html)。它是 `independent` 独立模板：智能体生成十页初版，用户直接编辑每个文字、图片、图表和表格；图表与表格各自维护自己的数据，彼此没有勾稽或关联。十页只是该参考模板当前页数，不是内核上限。

推荐工作流：

1. 从“经营分析”“财务简报”“研究出版”或“空白报告”新建工程。
2. 在左侧切换“页面 / 组件 / 模板”。组件库分为“基础元素”和“组合模块”；模板库提供 5 套封面和 3 套页眉页脚，每套都按当前横版或竖版生成独立几何。KPI、重点结论和模板都只是快速入口，插入后仍由文字、色块、分隔线、图片、图表和表格等普通元素组成。
3. 在画布中拖动、框选、多选和八向缩放。默认吸附 5 mm 网格、页边距、画布中心及其他元素；工具栏支持相对页面或选区的六向精确对齐和等间距分布。
4. 双击任一文本或表格单元格可在页面内直接修改。组合默认整体选择、移动、复制、锁定和隐藏；点击“拆分组合”后可逐元素重排。多行内容使用原生 `textarea`，单行字段使用原生 `input`。
5. 选中图表或表格后，点击组件旁的“编辑数据”，只修改当前对象；图表还可在同一浮动工具条调整标签疏密和单点位置。右侧面板用于样式、图层、图片、页面和报告级高级设置。
6. 定期导出默认的 `.report.zip` 工程文件，其中包含 `document.json` 与 `assets/` 图片。需要长期归档到单文件时可另选 base64 JSON，但体积通常增加约 33%。浏览器会自动保存文档结构，并将图片 Blob 单独保存在本机 IndexedDB。
7. 点击“打印 / PDF”。打印设置建议选择 100% 比例、无页边距并启用背景图形。

页面可以在同一报告中混用 A4 纵向与横向。已有元素或母版图的页面不会直接换向，以免把旧几何错误套到另一种纸张；应新建目标方向页面后重新排版。打印 CSS 使用命名 `@page` 规则分别输出两种方向。报告内核要求至少一页，但不设置固定最大页数；实际容量取决于浏览器内存、图片体积、图表数量和打印环境。财务简报参考实现的十页只属于该参考包的回归值。

## 已实现能力

| 领域 | 能力 |
| --- | --- |
| 文档 | 1.5 版本化模型、1.0-1.5 自动迁移并统一写出 1.5、毫米坐标、A4 纵横版混排、主题 token、受限文本 runs |
| 编辑 | 拖动、八向缩放、框选、组合选择、原生输入控件页内编辑、单会话历史、中文输入法保护、键盘微调、复制、删除、撤销、重做 |
| 窄屏 | 390 px 下页面栏和属性栏互斥显示，画布与页面导航各自在自身容器滚动，不产生文档级横向溢出 |
| 对齐 | 相对页面/选区六向精确对齐、水平/垂直等间距分布、2.5/5/10 mm 网格、页边距/页面中心/其他元素特征线吸附、屏幕空间阈值、Alt 临时关闭 |
| 内容 | `text/box/divider/image/chart/table` 六种基础元素；标题、来源、KPI 与引述用文本语义和组合预设表达；文本不存 HTML |
| 组合 | KPI、重点结论、带标题图表/表格和图片说明；整体选择、移动、复制、删除、锁定、隐藏和拆组，复制时更新 group ID |
| 数据 | 每个图表/表格直接持有自己的数据；组件旁单元格编辑；Excel 连续区域从当前格粘贴并按需扩展；可增删行列；ECharts SVG；组合图逐系列柱/线与左右轴；系列/类目稳定 ID；五种标签模式；纵横版独立毫米偏移 |
| 页面 | 封面、章节、标准、数据、空白、尾页；所有页面类型支持背景图、焦点、主题叠色与双向转换；新建纵横版页面、空页面换向、复制与删除 |
| 模板 | 5 套封面设计与 3 套页眉页脚设计；每套分别定义纵横坐标；图片、蒙版、Logo、标题、规则线、章节名、密级和页码全部生成普通元素，可继续替换、拖动、缩放、改字、改色和撤销；页面增删或报告设置变化后制度槽位自动同步 |
| 品牌 | 内置透明彩色 Logo、透明白色 Logo 和报告工作台横向组合；5 张本地可再分发航运起始图；模板应用与报告运行均不联网 |
| 制度元素 | 页眉、页脚、页码、顶部/底部规则线与尾页制度文字均为普通元素，可选择、移动、缩放、对齐、锁定、显隐和排序 |
| 图片 | 内容图与页面母版图均可直接非破坏裁切、自由/固定比例取景、纯色/渐变/duotone 叠色、混合模式、调色预设、暗角、编辑与打印同构 |
| 资产 | 导入矫正方向并剥离 EXIF/GPS，最长边默认 4096 px，照片 JPEG q0.85，SHA-256 去重；本地仓仅接受经 MIME、规范 base64 与文件签名复核的 PNG/JPEG/WebP，旧 IndexedDB 记录读取时重新校验；工程导入最多 256 张、单图 64 MP、合计 256 MP，并在完整解码前预读尺寸头 |
| 工程 | 默认 `.report.zip`（`document.json + assets/`）；可选 base64 单 JSON 归档；缺 Blob、低 DPI、未使用资产与 50 MB 预算均显式提示 |
| 本地化 | `localStorage` 结构自动保存、IndexedDB 图片存储、配额失败显式报警、零远程请求 |
| 输出 | 96/150/300 DPI 打印副本、可见裁切区加余量、体积报告、越界/来源/压图/清晰度/字体检查；打印前冻结图表动画；原生 `@page` PDF 输出 |
| 报告内核 | `independent` 与 `bound` 双模式；前者禁止集中字段、公式、规则和绑定，后者保留 typed fields、安全派生 AST、规则、脱敏 preview 与稳定 ID 视觉覆盖 |
| 特化工具 | 独立模式打开即为完整模板编辑器并保存完整 `ReportDocument`；绑定模式保留字段表单与事实保护；两者均为 CSP 单 HTML、零网络、报告包资产隔离和统一 PDF 门禁 |

## 两种特化模式

`independent` 是智能体新建报告的唯一模式。智能体把脱敏文字稿、页面要求和示例数据编译为一个完整 `ReportDocument` 初版；用户打开单 HTML 后直接增删页面和组件、修改文字图片、编辑每个图表/表格自己的数据并调整标签。完整文档按报告包 ID 保存在本机，“恢复智能体模板”才会清除这些编辑和该包的图片资产。该模式在验证器层拒绝 `fields`、`derived`、`rules`、`inputSections`、`dataMigrations` 以及 `contentTemplate/chartBinding/tableBinding`。

`bound` 只作为旧报告包兼容模式。它继续执行“编译作者基线 -> 按稳定 ID 重放 `VisualOverrideSet` -> 渲染”，并在界面、覆盖生成、覆盖应用三层保护绑定事实；缺省未声明 `authoringMode` 的旧报告包仍按 `bound` 解释，但 Skill 不用它新建报告。

## 交互说明

- 单击选择，`Shift`、`Ctrl` 或 `Command` 单击增减选择。
- 在空白画布拖动可以框选。
- 方向键移动 1 mm，`Shift + 方向键` 移动 5 mm。
- `Ctrl/Command + D` 复制，`Delete` 删除，`Ctrl/Command + A` 全选当前页。
- `Ctrl/Command + Z` 撤销，`Ctrl/Command + Y` 或 `Ctrl/Command + Shift + Z` 重做。
- 拖动时按住 `Alt` 临时关闭吸附。
- 单选时六向对齐以页面为基准；多选时以整个选区包围盒为基准。水平或垂直等间距分布至少需要三个可移动元素。
- `Ctrl/Command + 滚轮` 以 5% 步进缩放画布，范围为 50%-200%，并尽量保持鼠标下方的页面位置不变。缩放只影响编辑投影，不修改 mm 坐标。
- 双击文本或表格单元格可以在画布上直接编辑；选中图表或表格后可从组件旁“编辑数据”打开当前对象的单元格编辑器。右侧数据面板只显示当前对象的数据规模和入口，不再暴露原始制表符文本。
- 单元格编辑器可直接改表头、类目、系列名和数值，支持增删行列；从 Excel 复制连续区域后，在目标格粘贴即可从该格向右下展开。`Enter/Shift+Enter` 上下移动，`Ctrl/Command + 方向键` 移动到相邻格。
- 页内编辑期间粘贴只保留纯文本，中文输入法组合期间不会误触提交或快捷键。`Esc` 放弃整个会话，`Tab` 提交并跳到下一字段，整次页内编辑只产生一条全局撤销记录。
- 行内只允许粗体和语义红/绿；字体、字号、颜色、对齐与行高使用预设 token，不接受任意 HTML、hex 色值或自由字号。
- 所有页面类型支持页面级背景图片：章节页使用顶部 70 mm 槽位，其余页面使用整页槽位。背景图固定在最底层，不参与图层和吸附；可与普通图片双向转换，并可双击后直接拖动、滚轮缩放进行非破坏取景。
- 页眉、页脚、页码、顶部/底部规则线和尾页制度文字都是普通报告元素，不是渲染器生成的不可编辑装饰。
- 双击内容图片或页面母版图进入非破坏裁切；选择比例后可拖动、滚轮缩放或用八个手柄调整，退出后一次裁切只形成一条历史。原始资产不被裁掉。
- 图表标签支持 `auto/all/sparse/key/off` 五种模式；人工拖动偏移以毫米保存，并按 `portrait` 与 `landscape` 分支隔离，同一标签用稳定系列 ID 与类目 ID 定位。

## 单元格数据

智能体根据提示词为每个图表和表格预先创建独立网格。图表的第一列是类目，后续列是系列；例如：

| 类目 | 本期 | 上年 |
| --- | ---: | ---: |
| 1月 | 92 | 88 |
| 2月 | 98 | 91 |
| 3月 | 101 | 96 |

表格的第一行是表头，其余行是正文；例如：

| 指标 | 本期 | 上期 | 同比 |
| --- | ---: | ---: | ---: |
| 营业收入 | 128.6 | 118.7 | +8.4% |
| 利润总额 | 21.4 | 18.9 | +13.2% |

这些表格只是说明网格结构，不是要求用户编写文本格式。实际使用时逐格输入，或把 Excel 连续区域粘贴到选中的单元格。图表数值必须是有限十进制数，错误会标到具体单元格；取消或校验失败不会改动报告。

## 本地开发

环境要求：Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
npm run typecheck
npm run test:migration
npm run test:engine
npm run test:assets
npm run test:overrides
npm run test:templates
npm run check:brand-assets
npm run engine:validate
npm run engine:compile
npm run engine:build
npm run test:cell-grid
npm run engine:pdf
npm run test:pdf-determinism
npm run engine:inspect-pdf
npm run build
npm run check:offline
npm run check:engine-html
npm run check:contract
npm run qa:visual
npm run qa:templates
npm run verify:release
```

`npm run build` 使用 `vite-plugin-singlefile` 将 React、ECharts、Lucide 和全部 CSS 内联到 `dist/index.html`。`npm run check:offline` 会扫描最终 HTML 的资源属性、CSS `url()` 以及源码中的 HTTP/HTTPS 字符串，发现外部运行时资源即失败。

`npm run qa:visual` 会用无头 Chromium 生成混合纵横版 PDF、逐页 PNG 与 `artifacts/visual-qa/contact-sheet.png`。`npm run qa:templates` 进一步把 5 套封面和 3 套页眉页脚的全部横竖版组合打印为 16 页 PDF，逐页核对 A4 方向、可搜索文字与异常空白，并固化 `artifacts/template-visual-qa/contact-sheet.png` 总览。每次有意义的版式改动后都应运行，并按打印检查清单逐页目检。

PDF 检查需要 `pdfplumber`、Pillow 和 Poppler。`engine:inspect-pdf` 会依次探测 `CODEX_PYTHON`、Codex 工作区自带 Python 和系统 `python3`，自动选择具备依赖的环境；普通环境可先执行 `python3 -m pip install pdfplumber pillow`，并确保可调用 `pdftoppm`。

`npm run test:migration` 会验证 1.0-1.5 导入、原子化迁移、稳定图表 ID、图片和主题注入。`npm run test:engine` 覆盖派生覆盖、未知绑定、畸形包、报告包图片签名、主题注入、重复事实和脱敏边界。`npm run test:assets` 验证本地 PNG/JPEG/WebP 的 MIME、签名、规范 base64、零 `fetch`、IndexedDB 重校验与报告包命名空间；`npm run test:overrides` 验证数据刷新后的稳定 ID 重放、事实字段/删除/复制三重保护、纵横版标签偏移隔离和孤儿覆盖提示。`npm run test:templates` 验证 5 套封面与 3 套页眉页脚在横竖版中的边界、原子性、可编辑性、母版图片/裁切保留、实际资产安装、密级规则和页码；`npm run check:brand-assets` 验证 Logo 的 PNG 签名、RGBA、透明四角以及全部起始图签名、尺寸、字节数与固化哈希。`npm run test:cell-grid` 在真实 Chrome 中验证逐格编辑、增删行列、Excel 连续区域粘贴、非法值、取消、两次应用两次撤销、图表隔离、稳定 ID 重排、表格草稿和 390 px 内部滚动。`npm run engine:compile` 生成本轮 `artifacts/finance-brief/document.json`，`engine:inspect-pdf` 从其中读取页数和逐页方向，不硬编码十页，并逐页验证 A4。`npm run test:pdf-determinism` 会连续打印两次同一特化 HTML 并要求字节完全一致。`npm run check:contract` 会核对应用版本、文档 schema、隐私/CSP、模板视觉矩阵和固化产物 SHA-256。`npm run verify:release` 顺序执行完整仓库门禁，实际 PDF 由模板矩阵、`engine:pdf`、可复现性测试和 `engine:inspect-pdf` 联合验收。

仓库内的 `scripts/print-pdf.mjs` 使用本机 Chrome DevTools Protocol 的 `preferCSSPageSize` 生成混合纵横版样例，便于在没有打印对话框的环境中复验 CSS 页面尺寸：

```bash
node scripts/print-pdf.mjs dist/index.html artifacts/report.pdf
```

## 隐私与边界

- 应用代码不包含上传、遥测、登录或后端接口。
- 工程、图片和自动备份只存在于当前浏览器或用户显式导出的本地文件中。图片不进入撤销历史快照。
- `.report.zip` 是默认可移植工程包：`document.json` 使用 1.5 结构，图片放在 `assets/`。导入要求图片完整，限制文件/条目/解压总量、图片数量和解码像素，并在切换文档前重编码去除 EXIF/GPS、重映射资产 ID、按缩放比例换算原裁切框、以单个事务写入 IndexedDB；失败时不切换当前工程。单 JSON 归档同样要求完整 `assetData` 并执行上述清洗。
- 本地资产转换不调用 `fetch`、XHR、WebSocket 或远程解码；历史 IndexedDB 图片在返回渲染器前也会执行同一套 PNG/JPEG/WebP 校验，失败资产不会静默进入页面。
- 上传和工程导入图片都会经过 Canvas 重绘以校正方向并剥离 EXIF/GPS。关闭“保留原始像素尺寸”时，长边超过 4096 px 的图片会先缩小；同一像素内容通过 SHA-256 识别。
- 清除浏览器站点数据会删除自动保存和 IndexedDB 图片，因此重要报告必须另行导出工程文件。
- 若浏览器配额不足或自动保存失败，界面会显示持续红色告警，并提供立即导出工程的入口。
- HTML 单文件可以离线使用，但浏览器自身的打印、下载和本地存储行为仍受浏览器安全策略控制。
- 特化 HTML 只嵌入脱敏 preview，并使用禁止网络连接的 CSP。用户导入的真实数据不会发送给智能体，也不会进入报告包或发布清单。
- 公开仓库不接受含真实业务数据的 issue 或附件；漏洞报告见 [SECURITY.md](./SECURITY.md)。

## 打印检查说明

封面、章节页和尾页在没有母版图片时会被打印检查列为提示。这是有意的质量门禁，不影响继续编辑；可以上传母版图，或确认无图版式后选择继续打印。字体检查使用 `document.fonts.check()` 检测主题所用字体槽的首选字体，在不同机器上打开工程时可能出现“字体替换风险”。

## 设计与研究

- [v1.8.0 特性基线](./docs/feature-baseline-v1.8.0.md)
- [v1.8.0 规范契约](./docs/contracts-v1.8.0.md)
- [v1.8.0 发布清单](./release/v1.8.0.json)
- [头部机构版式研究 v1.8](./docs/institutional-layout-study-v1.8.0.md)
- [报告内核架构](./docs/report-engine-architecture.md)
- [GitHub Skill 与 PDF 工程调研](./docs/github-skill-research.md)
- [旧财务简报行为承接矩阵](./docs/legacy-finance-parity-v1.5.0.md)
- [第三方方法与许可证说明](./docs/third-party-methodology-notices.md)
- [在线 PDF / 报告编辑器调研 v1.4](./docs/online-editor-research-v1.4.md)
- [头部机构研报设计语言学习 v1.4](./docs/institutional-report-design-study-v1.4.md)
- [开源项目核验与选型](./docs/open-source-research.md)
- [架构与文档模型](./docs/architecture.md)
- [编辑器交互调研 v1.3](./docs/editor-research-v1.3.md)
- [Skill 官方资料学习记录](./docs/skill-learnings.md)
- [打印检查清单 v2](./docs/print-quality-checklist.md)

本实现保留了原财务生成器的 ECharts SVG、打印 CSS、纵横版、工程导入导出、Excel 粘贴、来源行和报告检查等优点，但没有延续其多版本补丁覆盖式结构。所有页面都由统一的 `ReportDocument` 模型和统一渲染器生成。

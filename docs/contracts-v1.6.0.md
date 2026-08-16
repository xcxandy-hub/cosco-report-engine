# Local Report Studio v1.6.0 契约

状态：发布候选规范基线  
应用版本：`1.6.0`  
工程格式：`ReportDocument 1.5`  
报告内核：`0.1`

v1.4.0 的原子元素、编辑、图片和打印契约以及 v1.5.0 的报告包、数据、隐私和 fail-closed 契约继续有效。发生冲突时，以本文件为准。

## 1. 文档与迁移

1. `VERSION`、`package.json.version` 和 `release/v1.6.0.json.applicationVersion` 必须均为 `1.6.0`。
2. `ReportDocument.version`、默认模板、编译出口和发布清单 schema 必须均为 `1.5`。
3. 工程导入接受 1.0-1.5；归一化和再次导出只写 1.5。旧图表缺失的系列 ID 和类目 ID 必须确定性补齐。
4. 持久化元素仍只有 text、box、divider、image、chart、table。KPI、引语和标题区块仍是作者宏或原子组合，不得恢复专用持久化类型。

## 2. 编译基线与视觉覆盖

1. 报告包和本地事实数据先确定性编译为作者基线文档；人工精修以独立 `VisualOverrideSet` 保存，不得把编译后的 DOM 当作事实源。
2. 覆盖存档必须包含固定格式、覆盖 schema、package id、来源 package version 和稳定 page/element ID。package id 不匹配时必须忽略并提示。
3. 数据变化或同一报告包再次编译后，几何、样式、图层、裁切、图片和图表标签精修必须按稳定 ID 重放。
4. 绑定文字、绑定图表、绑定表格和制度元素属于受保护元素。布局精修侧栏必须把其内容、图表结构和表格数据设为只读；保存视觉覆盖和读取旧覆盖时都必须剥离 `content/runs/chart/table` 事实字段。事实只能在本地数据表单、派生公式或报告包中修改。
5. 静态图表和静态表格仍可在通用编辑器中直接编辑；一旦报告包声明 `chartBinding` 或 `tableBinding`，视觉编辑器不得将人工数据副本保存为覆盖。
6. 报告包版本变化可以按稳定 ID尝试重放。找不到页面或元素时必须产生 `orphan-override` 提示并安全忽略，不得静默套到数组序号或同名文本。
7. v1.6.0 不宣称具备语义指纹、三方属性合并或自动 ID rename 迁移。报告包作者必须保持 ID 语义稳定；发生拆分、删除或改义时需要人工复核孤儿提示。
8. `document.meta` 中的报告标题、机构、期间、编制人和密级属于事实，不属于视觉覆盖；特化精修中的报告设置只读，必须回到本地数据面板修改。
9. 事实保护必须覆盖界面、覆盖生成和覆盖应用三层。受保护元素不能删除或复制；特化精修不得把新 text、chart、table 作为视觉覆盖加入，避免数据刷新后留下旧事实副本。新增覆盖对象仅允许 box/divider/image，并必须剥离 `content/runs/chart/table`。既有静态元素仍可编辑，需要新增事实型元素时应更新报告包作者基线。
10. 从本地存储读取的视觉覆盖属于不可信 JSON。页面 patch 只能应用 `name/section/masterProps`，元素 patch 只能应用模型声明的视觉字段，`elementOrder` 只能是去重后的字符串数组；不得依赖 TypeScript 类型断言后直接合并外部对象。

## 3. 数据与视觉重置

1. 本地数据与视觉覆盖使用不同存储键、不同状态和不同重置命令。
2. “恢复示例”只清除本地事实数据并恢复脱敏 preview，不得删除视觉精修。
3. “恢复布局”只删除视觉覆盖并恢复智能体生成的作者基线，不得清除本地事实数据。
4. localStorage 或 IndexedDB 的读写、删除或重校验失败必须可见，不得显示虚假的保存成功。

## 4. 图表标签

1. 图表系列和类目必须具有稳定 ID；单个标签键由系列 ID 与类目 ID组成，不能依赖显示名称或数组序号。
2. 标签模式只允许 auto、all、sparse、key、off；稀疏步长只允许 2-12。
3. 人工标签偏移使用毫米 `dx/dy`，并分别保存在 portrait 和 landscape 分支。横版偏移不得污染竖版，反之亦然。
4. 切换页面方向不能把已有页面的几何直接套到另一纸张。已有内容或母版图时必须拒绝直接切换，并要求建立目标方向页面后重新排版。

## 5. 图片裁切与资产安全

1. 内容图片和页面母版图都允许直接进入非破坏裁切；裁切使用原图像素坐标，滚轮缩放和拖动只修改取景参数，不覆盖原始资产。
2. 焦点控件与直接裁切必须写入同一个 `masterProps.crop` 出口，编辑态与打印态使用同一取景数据。
3. 本地资产仓只接受经过重校验的 PNG、JPEG 和 WebP data URL 或 Blob。必须验证声明 MIME、实际 Blob MIME 和文件签名；SVG、GIF、外部 URL、伪造扩展、损坏 base64 和签名不符必须拒绝。
4. 资产转换不得调用 `fetch`、XHR、WebSocket 或远程解码。历史 IndexedDB 记录在返回给渲染器前必须重新执行同样校验。
5. 报告包内嵌资产与工程导入执行同等强度的规范 base64、MIME、声明字节数和 PNG/JPEG/WebP 文件签名校验；特化 HTML 的 CSP 必须保持 `connect-src 'none'`。
6. IndexedDB 资产键必须包含报告包命名空间，同名 `logo` 或 `cover-image` 不得跨报告包覆盖。工程导入的主题颜色和色板只接受 6 位十六进制值，字体不得包含 URL、协议或标记。

## 6. 页面与输出边界

1. 报告包至少包含一页；内核不设置固定最大页数。实际容量受浏览器内存、图片体积、图表数量和打印环境约束。
2. 当前 `finance-brief` 基线编译为 10 页，这只是参考包当前行为，不得写成内核上限或所有报告的固定页数。
3. 每个报告包可自由混用纵横 A4 页面，但每页几何必须在自身方向内通过验证。
4. PDF 检查的期望页数和逐页 `portrait`/`landscape` 顺序必须从同一轮 `engine:compile` 输出的 `artifacts/finance-brief/document.json` 读取，不得在检查命令中硬编码 10。检查器必须逐页记录期望方向、实际方向并验证 A4 尺寸；PDF 仍须检查可检索文字、空白页、越界、来源、图片焦点和图表标签。
5. 窄屏精修模式一次只能打开页面栏或属性栏之一；选择页面、元素或其他主动打开属性栏的动作必须同步收起页面栏，不能让两个抽屉互相遮挡。

## 7. 门禁

发布候选必须至少通过：

```bash
npm run typecheck
npm run test:migration
npm run test:engine
npm run test:assets
npm run test:overrides
npm run engine:validate
npm run engine:compile
npm run check:contract
```

最终冻结发布还必须执行 build、离线/CSP、视觉 QA、PDF、PDF 可复现性和逐页 PDF 检查。逐页检查以本轮编译文档为页数基线；随后把三个固化产物的 byteSize 与 SHA-256 回填 `release/v1.6.0.json`。占位未回填时，契约检查必须失败，候选版不得宣称 frozen。

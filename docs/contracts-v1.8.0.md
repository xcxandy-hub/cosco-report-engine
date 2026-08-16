# Local Report Studio v1.8.0 契约

状态：`release-candidate`
应用版本：`1.8.0`
工程格式：`ReportDocument 1.5`

本文定义 v1.8.0 新增的模板与品牌资源契约。v1.7.0 已固化的 independent/bound、局部数据、资产导入、打印和隐私契约继续有效，除非本文明确覆盖。

## 1. 模板不是新元素类型

模板应用后必须只留下 `text | box | divider | image | chart | table`。模板身份使用：

```ts
presetId: "cover-template:<template-id>" | "chrome-template:<template-id>"
presetSlot: string
```

`presetSlot` 只用于识别标题、图片、蒙版、Logo、页码等模板槽位。它不能让元素变成不可选择的母版对象。模板元素默认不锁定，可移动、缩放、复制、隐藏、删除、改样式或替换内容。

## 2. 封面模板

内核必须提供至少以下 5 个稳定 ID：

- `cinematic-fullbleed`
- `editorial-monogram`
- `institutional-rail`
- `split-image-panel`
- `publication-window`

每个 ID 必须显式实现 `portrait` 和 `landscape` 两套毫米坐标。禁止只把 210×297 坐标按比例缩放为 297×210。所有模板元素及其选择框必须位于页面边界内。

切换封面模板时，应按稳定槽位或保守名称规则保留人工标题、副标题、报告类型、报告期、编制部门、密级和现有封面图片。应用动作替换当前封面元素，但只形成一条撤销记录。

## 3. 页眉页脚模板

内核必须提供至少以下 3 个稳定 ID：

- `minimal-rule`
- `brand-rail`
- `editorial-corner`

页眉页脚模板仅应用于 `section`、`standard` 和 `data` 页面。应用时只能删除既有 `role` 元素或 `chrome-template:*` 元素，正文、图表、表格和普通图片必须保留。页码元素继续使用 `role: "footer-page-number"`，以便页面增删后同步。

模板中的机构名、章节名、页码和密级是可编辑的普通文字，但也是受报告设置驱动的制度槽位。页面增删、章节修改、机构/密级修改或 `footerMode` 切换后，内核必须统一同步这些槽位；`confidentiality-last` 必须始终只在当前末页显示密级。

报告包如果已经显式包含 `chrome-template:*` 元素，编译器的默认 `pageDecorations()` 必须返回空数组，禁止生成第二套页眉页脚。

## 4. 品牌资源

三个内置 Logo 必须是本地 PNG：

- `cosco-logo-color.png`
- `cosco-logo-white.png`
- `cosco-logo-lockup.png`

所有 Logo 必须通过 PNG 签名、RGBA 通道和四角 alpha=0 检查，不得有白色底板。彩色和白色 Logo 从用户提供旧版工具的同一原始路径提取；横向组合中的附加文字是项目工作台组合，不得表述为正式品牌标准件。

封面起始图必须是本地 JPEG/PNG/WebP，不能热链网上图片。仓库内置图必须有可再分发许可和来源说明；从机构年报学习得到的页面图片不得复制进模板资产。

## 5. independent 数据所有权

`authoringMode: "independent" | "bound"` 的兼容契约不变。智能体新建报告包一律使用 `independent`，每个图表和表格直接保存自己的内容，不建立跨组件引用、派生或勾稽。

选中图表或表格后，从组件旁打开单元格编辑器；保存只修改当前元素。模板系统不得引入报告级数据面板或把图表数据移入页眉页脚对象。

## 6. 隐私与运行时

- 模板预览和应用所需位图必须被构建进单 HTML；运行时 `connect-src 'none'`。
- 不允许 CDN、远程字体、远程图片、登录、遥测或上传。
- 公开报告包只含合成或脱敏数据。
- 内置品牌资源的稳定 ID 不得与用户导入资产 ID 冲突；导出工程必须携带实际被文档引用的全部资产。

## 7. 页面与打印

报告至少一页，不设置固定最大页数。横版和竖版均为 A4，模板元素和图表标签偏移分别按方向保存。最终验收必须生成 PDF、渲染全部页面并检查重叠、裁切、页眉页脚、图片焦点、来源行和纸张方向。

## 8. 发布门禁

v1.8.0 必须包含：

- `typecheck`
- `test:migration`
- `test:engine`
- `test:assets`
- `test:overrides`
- `test:templates`
- `qa:templates` 全模板横竖版真实打印矩阵
- `check:brand-assets`
- `engine:validate`
- `engine:compile`
- `engine:build`
- `test:cell-grid`
- `test:dynamic-pages`
- 离线/CSP 检查
- 浏览器视觉检查
- PDF 生成、确定性与逐页检查
- 发布清单哈希核验

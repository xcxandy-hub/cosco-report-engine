# Local Report Studio v1.5.0 契约

状态：规范性基线  
应用版本：`1.5.0`  
工程格式：`ReportDocument 1.4`  
报告内核：`0.1`

v1.4.0 的编辑器、原子元素、迁移、图片、页面和打印契约继续有效。v1.5.0 新增以下强制契约。

## 1. 分层

1. 报告包声明字段、派生值、规则、页面、主题和资产；不得实现渲染器。
2. 报告内核把声明式报告包和本地数据编译为 `ReportDocument 1.4`；不得保存真实数据或执行任意代码。可信 `.mjs` 作者源码属于 CLI 加载边界，必须显式授权且限制在 `report-packages/`；不可信输入只接受 JSON。
3. 通用编辑器继续作为统一渲染器和人工微调工具；不得承载财务专用公式。
4. Skill 必须通过确定性 CLI 调用内核，不得绕过验证直接拼接最终 HTML。

## 2. 包级 Fail-closed

以下任一问题必须产生结构化 error，并返回零页面安全文档：

- 报告包版本、ID、字段、派生表达式、规则或输入分区无效。
- 页面方向、母版、几何、元素类型、稳定 ID 或 ID 唯一性无效。
- 模板引用未声明字段、格式化器未知或占位符语法残缺。
- 主题含非白名单色值、URL、标记或非法字体。
- 字号不在 8/10/12/14/28 白名单，样式数值非有限值。
- 图表/表格绑定结构无效，图片资产缺失、MIME 不允许或字节数不符。
- 未知报告包属性、静态图表/表格 schema、公式参数或稳定 `documentUpdatedAt` 无效。

任何畸形对象都只能返回 issue，不得产生未处理异常。

## 3. 数据与公式

1. 编译数据只能包含 `fields` 声明的输入和 `derived` 计算结果；未声明字段必须丢弃。
2. 源数据不得覆盖派生路径；同一路径不得同时声明为字段和派生值。
3. 表达式只允许内核白名单 AST 操作，禁止 `eval`、`Function` 和字符串代码。
4. 循环依赖、未知路径、未知操作、零分母和序列长度不一致必须可见。
5. 同一事实不得分别录入图表值和展示表行；展示表应通过 rows 单一事实或 columns 派生事实生成。

## 4. 脱敏与本地运行

1. 敏感字段必须标记 `sensitive: true`；preview 从空对象构建并替换全部敏感值。
2. `build` 必须嵌入 preview，不得原样嵌入数据文件中的敏感值或未声明字段。
3. `preview` 与 `build` 必须重新编译脱敏数据；有 error 时不得写出产物。
4. 真实数据只允许由用户在本机运行时录入或导入。
5. JSON 导入必须同时匹配格式、package id 和 package version。
6. localStorage 读写或删除失败必须显示持续警告，不得静默宣称已保存。

## 5. 数据版本与打印门禁

1. 报告包必须声明 `dataSchemaVersion`；若需要跨版本保留本地事实，只能通过声明式 `dataMigrations` 迁移，迁移失败必须返回 error 并拒绝载入。
2. 特化运行时复用通用文档质量检查。越界、表格高度、来源行、图片 DPI、字号和叠色风险以 warning 展示；只有内核 error 或运行时异常禁用 PDF。
3. `documentUpdatedAt` 同时作为编译文档和 PDF `/CreationDate`、`/ModDate` 的稳定来源；同一输入连续生成的 PDF 必须字节一致。

## 6. 离线与资产

1. 特化 HTML 必须包含 CSP，至少有 `default-src 'none'`、`connect-src 'none'`、`object-src 'none'` 和 `base-uri 'none'`。
2. 特化 HTML 不得包含外部 src、href、srcset 或 CSS URL。
3. 报告包图片只允许 PNG、JPEG、WebP 或 GIF data URL；元数据 MIME、字节数和资产 ID 必须匹配。
4. 编译文档必须保留声明的资产元数据；预览和打印必须使用同一 assetData。

## 7. 财务参考实现

1. 必须生成十页，页面和元素 ID 在同一包版本内稳定。
2. 收入、成本、利润、财务费用构成的四条勾稽规则必须通过。
3. 收入结构、贸易区、成本和费用表必须从单一事实字段派生，不得保留重复 rows。
4. 本参考实现不得宣称完全继承旧工具；未实现项以 `docs/legacy-finance-parity-v1.5.0.md` 为准。

## 8. 发布门禁

发布必须通过：

```bash
npm run typecheck
npm run test:migration
npm run test:engine
npm run engine:validate
npm run engine:build
npm run check:offline
npm run check:engine-html
npm run check:contract
npm run qa:visual
npm run engine:pdf
npm run test:pdf-determinism
npm run engine:inspect-pdf
```

最终 `dist/index.html`、财务特化 HTML 和财务 PDF 的字节数与 SHA-256 必须与 `release/v1.5.0.json` 一致。PDF 必须为 10 页、文字可检索、无空白页，并完成 contact sheet 与代表页视觉检查。

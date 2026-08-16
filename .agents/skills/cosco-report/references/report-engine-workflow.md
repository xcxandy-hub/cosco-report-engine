# 报告内核工作流

## 适用边界

用户提供脱敏文字稿、页面要求和图表要求，希望得到一个本地特化 PDF 生成器时使用本流程。智能体只负责制作初版；用户必须能在生成器中继续修改文字、图片、页面、图表、表格、标签和布局。

旧财务简报生成器只作为业务行为和视觉节奏证据；通用编辑器提供 `ReportDocument 1.5`、毫米页面、原子元素、直接编辑、图片裁切和打印。不得复制旧工具中的私有数据，也不得把 DOM 当成持久化源。

## 先选择模式

智能体新建报告包一律选择 `authoringMode: "independent"`。每个 text/chart/table 直接持有自己的内容；每个图表和表格独立维护数据，没有跨组件引用、派生、勾稽或集中录入栏。用户打开特化 HTML 后直接进入完整编辑器。

`bound` 只用于加载、维护和回归既有旧报告包，包括这些历史能力：

- 同一事实需要在多个页面自动同步；
- 需要公式、派生指标或单位换算；
- 需要跨表或跨图勾稽；
- 需要集中字段表单和数据版本迁移。

两种模式继续共存于内核以保证旧包兼容，但智能体不得为新报告增加绑定，同一个报告包也不能混用所有权。

## independent 契约

1. 报告包声明 engineVersion、authoringMode、id、version、稳定 documentUpdatedAt、meta、theme、pageSetup、pages 和可选 assets/assetData。
2. 不得出现 dataSchemaVersion、fields、derived、rules、inputSections、dataMigrations、contentTemplate、chartBinding 或 tableBinding。
3. 文字写 `content`；图表写自己的 `chart.categories/series`；表格写自己的 `table.headers/rows`。
4. KPI、引语和图表区块可以作为作者宏，但展开结果只能是 text、box、divider、image、chart、table 六种原子元素。
5. 页面、元素、图表系列、类目和资产使用稳定、显式 ID。报告至少一页，内核没有固定最大页数。
6. 特化运行时保存完整 `ReportDocument`，不调用 VisualOverrideSet。存储键和图片命名空间必须包含报告包 ID。
7. 选中 chart 或 table 后，组件旁必须有“编辑数据”；提交只修改当前对象。图表标签疏密、单点毫米偏移和位置也从组件附近调整。
8. “恢复智能体模板”清除该包的完整文档存档，再载入作者初版。

## bound 契约

bound 继续遵守 v1.6 规则：fields 只声明一次，derived 使用安全 AST，rules 提供稳定 locator，页面使用 contentTemplate/chartBinding/tableBinding。运行时固定为 `compile baseline -> apply stable-ID visual override -> render`。

绑定文字、图表、表格和制度元素由界面、覆盖生成、覆盖应用三层保护；事实字段、删除标记和事实型副本不得进入覆盖。数据重置与视觉重置分离，孤儿覆盖显式告警。缺省未声明 authoringMode 的旧包按 bound 处理。

## 通用安全边界

- 真实数据不得写入报告包、命令日志、智能体上下文或版本库。
- 单 HTML 只嵌入脱敏模板或 bound preview，并保持 `connect-src 'none'`。
- 图片只允许本地 PNG/JPEG/WebP，验证 MIME、规范 base64、签名和字节数；读取 IndexedDB 历史记录时重新验证。
- `.mjs` 只有已审阅且位于 report-packages/ 的作者源码才能以 `--trusted-code` 执行；外部输入只接受声明式 JSON。
- 文字只存纯文本/runs，不执行 HTML、Markdown HTML、公式代码、eval 或 Function。
- 横竖版分别使用各自 A4 几何；图表标签偏移按 portrait/landscape 分支保存。

## 确定性命令

```bash
node .agents/skills/cosco-report/scripts/report-engine.mjs --trusted-code validate <package.mjs> <redacted-data.json>
node .agents/skills/cosco-report/scripts/report-engine.mjs --trusted-code preview <package.mjs> <redacted-data.json> <preview-data.json>
node .agents/skills/cosco-report/scripts/report-engine.mjs --trusted-code compile <package.mjs> <redacted-data.json> <document.json>
node .agents/skills/cosco-report/scripts/report-engine.mjs --trusted-code build <package.mjs> <redacted-data.json> <base.html> <specialized.html>
```

independent 的 data 文件使用 `{}`；preview 结果也是 `{}`，因为示例数据已经直接写入各组件。JSON 报告包可以省略 `--trusted-code`，是交给其他智能体时的优先格式。

## 实现顺序

1. 从脱敏稿提取页面问题、结论层级、图表、表格、图片位置、来源和待确认项。
2. 写不超过五条设计观，确定每页方向、母版、阅读顺序和公司主题 token。
3. 新建包固定使用 independent；遇到既有 bound 包时只做兼容维护，不把它作为新报告模板。
4. 用作者宏生成原子元素页面。independent 把每个图表和表格的脱敏示例数据直接放入本组件。
5. 执行 validate、compile 和 build；包级 error 必须全部修复。
6. 打开最终单 HTML 做真实交互：直接文字编辑、图表局部编辑、表格局部编辑、图 A/图 B 隔离、标签拖动、增删页面、刷新保存、恢复模板。
7. 在桌面和 390 px 检查侧栏互斥、按钮文字、工具条和横竖版页面；不得出现遮挡或文档级横向溢出。
8. 生成实际 PDF，逐页渲染 PNG，检查页数、方向、A4、空白、裁切、来源、页脚、图表标签和可检索文字。

## 完成门禁

- TypeScript、迁移、engine、assets、overrides、离线/CSP、构建全部通过；bound 旧测试不得因 independent 新默认而删除。
- independent 正向包无 fields/dataSchemaVersion，且验证器拒绝空壳集中属性、派生、规则、迁移和绑定。
- 组件旁图表/表格对话框保存一次形成一次撤销记录；非法 TSV 与取消不改文档。
- 修改一个图表不改变另一图表；修改表格不改变相邻图表；刷新后完整文档保留。
- 390 px 页面栏和属性栏互斥；15/20 页浏览器文档与打印层同步。复杂大图压力未运行时必须明确披露。
- `npm run test:dynamic-pages` 以临时 20 页交替横竖报告包重放真实 PDF 与逐页 A4/方向检查；该数字只代表测试规模。
- 最终 PDF 按同轮编译文档读取实际页数和逐页方向，不硬编码十页。

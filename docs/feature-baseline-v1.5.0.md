# Local Report Studio v1.5.0 特性基线

状态：`frozen-baseline`  
应用版本：`1.5.0`  
工程格式：`ReportDocument 1.4`  
固化日期：`2026-08-15`

## 1. 本版目标

v1.5.0 不再把通用编辑器继续扩成 PPT，而是在其渲染和打印能力之上增加可调用报告内核。智能体根据脱敏文稿制作特化报告包，用户在本机专用界面录入真实数据并生成 PDF。

## 2. 新增能力

| 领域 | v1.5.0 基线 |
| --- | --- |
| 内核 | typed fields、derived AST、rules、bindings、assets、编译到 `ReportDocument 1.4` |
| 验证 | 包级 fail-closed、稳定 ID、几何、主题、字号、表达式、模板、图表、表格、资产检查 |
| 数据 | 只选择声明字段、派生值优先、循环检测、零分母处理、结构化 issue 与 locator |
| 隐私 | 敏感 preview、未声明字段剔除、构建只嵌入脱敏值、真实值只在浏览器本地 |
| 专用运行时 | 字段分区、本地自动保存、严格 JSON 导入导出、实时编译、错误定位、PDF 启停 |
| 安全 | 特化 HTML CSP、无网络、无任意代码执行、主题 URL 拒绝、位图资产验证 |
| 财务参考包 | 十页混合方向报告、44 个输入字段、四条关键勾稽、四类单一事实表格 |
| 调用 | validate、preview、compile、build、PDF、PDF inspection 命令及 Skill wrapper |
| 测试 | 28 个内核反例测试，覆盖派生覆盖、未知绑定、畸形包、资产、主题、公式参数和脱敏 |

## 3. 保持不变

- 文档 schema 仍为 `ReportDocument 1.4`，不需要新增迁移版本。
- 持久化元素仍只有 text、box、divider、image、chart、table。
- KPI、引语和带标题图表/表格仍是作者宏，输出后只含基础元素。
- 通用编辑器的毫米坐标、纵横混排、主题 token、图片、图表 SVG 和浏览器打印继续复用。

## 4. 首个端到端纵向样例

财务分析简报包验证了从脱敏材料到专用本地工具再到十页 PDF 的完整链路。收入、贸易区、成本和费用明细不再手工维护展示 rows，而是从标签、数值和公式生成，避免图表与表格相互矛盾。

该实现是架构上的首个端到端纵向样例，不是旧 `v4.6.16` 工具的完整等价迁移。期间滚动、多口径快照、单位转换、风险阈值、外汇日序列、全部旧规则、页面启停/排序仍属于后续阶段。

## 5. 研究固化

- GitHub Skill 与 PDF 项目借鉴见 `docs/github-skill-research.md`。
- 内核分层与隐私边界见 `docs/report-engine-architecture.md`。
- 旧工具承接差距见 `docs/legacy-finance-parity-v1.5.0.md`。
- 外部方法和许可证边界见 `docs/third-party-methodology-notices.md`。

## 6. 明确不做

- 不让智能体接触用户真实财务数据。
- 不在报告包中加入远程数据源、登录、上传、遥测或 CDN。
- 不为每种报告复制一套渲染器。
- 不把连续长文自动分页、脚注、跨页表格硬塞进固定页面内核。
- 不承诺导入任意 Word、Excel 或 PDF 后自动理解所有报告结构。

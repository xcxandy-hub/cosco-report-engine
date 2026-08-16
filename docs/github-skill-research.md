# GitHub Skill 与 PDF 工程调研

核验日期：`2026-08-15`。本次通过 GitHub API 与仓库文件核对结构、方法和许可证。结论是：没有一个现成 Skill 能直接替代本项目的“领域报告包 + 安全公式 + 本地录入 + ReportDocument 编译”内核，但有多项成熟方法可复用。

## 1. 采用的方法经验

| 来源 | 许可证 | 可借鉴经验 | 本项目落点 |
| --- | --- | --- | --- |
| [agentskills/agentskills](https://github.com/agentskills/agentskills) | Apache-2.0 | SKILL.md 保持精简，脚本、参考和资产按需加载；脚本需自包含并清晰报错 | 项目 Skill 增加单层 workflow 参考和确定性 wrapper |
| [pdfme/pdfme](https://github.com/pdfme/pdfme) | MIT | 模板、生成器和设计器分层；JSON-first；validate/doctor/generate 后渲染图片检查 | 报告包与渲染器分层；validate/compile/build/PDF inspection |
| [garrytan/gstack](https://github.com/garrytan/gstack) 的 make-pdf | MIT | 明确 CLI 输出、退出码、准备检查和出版级完成定义 | CLI 错误退出、构建前验证、实际 PDF 门禁 |
| [daymade/claude-code-skills](https://github.com/daymade/claude-code-skills) 的 frontend-visual-qa | MIT | 区分源码证据与真实渲染证据；固定目标、状态、视口和输出身份 | 桌面/窄屏运行检查、最终 PDF 逐页渲染、发布哈希 |
| [zubair-trabzada/ai-sales-team-claude](https://github.com/zubair-trabzada/ai-sales-team-claude) 的 sales-report-pdf | MIT | 领域专用 schema、前置条件、错误分支和明确输出章节 | 财务包字段、规则、十页叙事、输入分区 |
| [bdfinst/agentic-dev-team](https://github.com/bdfinst/agentic-dev-team) 的 report-pdf | MIT | Skill 做薄封装，共享渲染模块承担机械工作 | Skill 不复制实现，只调用项目 CLI |
| [microsoft/playwright](https://github.com/microsoft/playwright) | Apache-2.0 | 可重复浏览器交互与多视口证据 | 本地运行态和响应式回归 |
| [pagedjs/pagedjs](https://github.com/pagedjs/pagedjs) | MIT | CSS 分页、页眉页脚和长文流式排版 | 仅列为未来流式报告出口候选 |

## 2. 明确不采用

- `anthropics/skills` 仓库中的 `skills/pdf/LICENSE.txt` 是专有许可，明确限制提取、复制、衍生和分发。本项目不复制该 Skill 的提示词、文件或代码；“生成后渲染检查”仅作为独立形成的通用质量方法。
- `ojura/claude-html-pdf-polisher` 在核验时是空仓库且无许可证，不能作为实现来源。
- [vivliostyle/vivliostyle.js](https://github.com/vivliostyle/vivliostyle.js) 使用 AGPL-3.0。未经过法律评估前不引入本地单 HTML 产品。
- 不直接采用 pdfme 作为当前渲染器。它很成熟，但替换现有 `ReportDocument 1.4` 会同时改变迁移、图片、编辑器和打印契约，成本高于本版收益。
- 不采用“让智能体每次临时写一个 PDF 脚本”的模式。该模式缺少稳定 ID、公式单一来源、包级验证和用户本地微调闭环。

## 3. 对现成 Skill 的独立判断

多数 PDF Skill 属于两类：一类把 Markdown 或固定 schema 直接交给 ReportLab/Pandoc；另一类是已有渲染脚本的薄包装。它们适合一次性文档或单一领域，但没有覆盖本项目同时要求的业务勾稽、脱敏构建、用户本地录入、可编辑页面模型和混合方向打印。

因此，本项目借鉴的是工程方法，而不是把外部 Skill 当内核。最终结构为“薄 Skill + 确定性 CLI + 声明式报告包 + 现有渲染器”。

## 4. 后续观察项

当报告类型出现跨页长表、自动目录和连续正文时，再用独立原型比较 Paged.js 与当前固定页渲染器。评估必须同时覆盖中文字体、孤行寡行、表头续排、脚注、DOM 可搜索文字、离线单文件和许可证，不因一个演示页面成功就迁移主引擎。

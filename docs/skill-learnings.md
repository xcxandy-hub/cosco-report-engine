# 报告生成与 Skill 设计学习记录

本记录对应 Local Report Studio v1.2 的 C1-D1。研究日期为 2026-08-14，只使用任务书列出的 OpenAI 与 Anthropic 官方资料。Anthropic 材料仅用于提炼方法，不复制原文、代码或模板。

## 结论先行

通用报告生成器不能只提供“导出 PDF”按钮。可靠流程应当是：先把内容、口径和来源组织进结构化模型，再把主题与版式约束变成 token，随后生成真实 PDF/PNG，按量化清单逐页检查，发现问题后回到模型修正并重验。可复用规范则应打包为小型 Skill：触发条件放 metadata，核心流程放 `SKILL.md`，详细口径放 `references`，主题与模板放 `assets`，脆弱且重复的动作才进入 `scripts`。

## 1. OpenAI PDF Skill

来源：[OpenAI skills / PDF](https://github.com/openai/skills/blob/main/skills/.curated/pdf/SKILL.md)

| 学习收获 | 本项目落点 |
| --- | --- |
| PDF 版式不能只靠文本抽取判断，必须把最终页渲染为图片后目检。 | D3：`npm run qa:visual` 输出逐页 PNG 与 contact sheet。 |
| 每次有意义的版式更新都应重复“生成、渲染、检查、修正”，最终一轮必须零明显缺陷。 | D2：打印检查清单把完整复验设为交付门禁。 |
| 对齐、间距、字体、裁切、表格、图表清晰度、页眉页脚应分别检查，不能用“能打开”代替质量验收。 | R13 / R18 / R21：静态检查与渲染后检查分层。 |

## 2. OpenAI Codex Skills 文档

来源：[Codex Skills](https://developers.openai.com/codex/skills)

| 学习收获 | 本项目落点 |
| --- | --- |
| Skill 的名称与 description 是触发入口，description 必须同时说明能力和适用场景。 | D4：`cosco-report` metadata 明确经营分析、财务简报、专题报告和打印验收触发条件。 |
| `SKILL.md` 只保留核心流程，详细资料按需放到 references、assets、scripts。 | D4：指标口径与主题 token 从主文件拆出。 |
| 目录级 Skill 可以与项目一起版本化，让同一套规范在后续任务中被稳定发现和复用。 | D4：Skill 固定在 `.agents/skills/cosco-report/`。 |

## 3. Anthropic PDF Skill

来源：[Anthropic skills / PDF](https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md)

| 学习收获 | 本项目落点 |
| --- | --- |
| 生成与检查要分开：先产出文件，再用独立渲染结果判断视觉质量。 | D3：打印脚本与逐页 PNG 检查脚本分层。 |
| 不能只确认页面数量；还要检查字体替换、文字截断、图像模糊和页面尺寸。 | R3 / R13 / R21：字体、溢出、DPI 与纵横尺寸进入检查。 |
| 中间文件应集中管理，最终产物使用稳定、可识别的名称。 | D3：视觉检查统一放入 `artifacts/visual-qa/`。 |

## 4. Anthropic PPTX Skill

来源：[Anthropic skills / PPTX](https://github.com/anthropics/skills/blob/main/skills/pptx/SKILL.md)

| 学习收获 | 本项目落点 |
| --- | --- |
| “好看”需要量化：普通内容距页面边缘不小于 0.5 英寸（约 12.7 mm）。 | D2 / R13：安全边距规则。 |
| 内容块之间建议保留 0.3-0.5 英寸（约 7.6-12.7 mm），拥挤时先重排，不盲目缩小字号。 | D2 / R13：7.6 mm 内容间距与字号白名单。 |
| 必须检查溢出、重叠、低对比、来源/页脚碰撞和占位符残留。 | R13 / R18：打印前模型检查与最终 contact sheet 清单。 |

## 5. Anthropic Canvas Design Skill

来源：[Anthropic skills / canvas-design](https://github.com/anthropics/skills/tree/main/skills/canvas-design)

| 学习收获 | 本项目落点 |
| --- | --- |
| 先定义设计哲学，再把它翻译为构图、空间、比例、颜色和层级规则。 | D5：母版先有角色与构图原则，再有坐标实现。 |
| 视觉元素应服务内容层级，不能把装饰当作报告主角。 | R18：图片风格受主题控制，压图时优先保证文字可读。 |
| 版面判断必须落到真实画布，而不是只描述“专业、现代”等抽象形容词。 | D3：每次改版都生成真实页面图片。 |

## 6. Anthropic Frontend Design Skill

来源：[Anthropic skills / frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design)

| 学习收获 | 本项目落点 |
| --- | --- |
| 在写界面前先明确产品对象、主要用户与唯一核心任务。 | 编辑器定位为高频本地报告生产，而不是营销网站。 |
| 界面应形成一致的设计语言，避免无关装饰和无意义的组件堆叠。 | 编辑器保持紧凑工具型布局，控件继续沿用单一圆角、色板与图标体系。 |
| 第一轮完成后要主动做第二轮批评，检查拥挤、重复、弱层级和移动端失效。 | D3 与浏览器回归：桌面、390×844、打印页三种表面分别检查。 |

## 7. Anthropic Brand Guidelines Skill

来源：[Anthropic skills / brand-guidelines](https://github.com/anthropics/skills/tree/main/skills/brand-guidelines)

| 学习收获 | 本项目落点 |
| --- | --- |
| 品牌规范不能只有主色，还需要字体角色、回退栈、语义色与应用边界。 | R3 / D4：字体槽、明确字族栈、语义红绿和 token 资产。 |
| 颜色值应集中定义，输出元素只引用语义角色，避免局部随意取色。 | R9 / R18：文字和图片叠色只存 token 引用。 |
| 规范需要同时说明“应该怎样用”和“哪些情况不能用”。 | D4：Skill 明确禁止杜撰来源、裸颜色、任意字号和网络依赖。 |

## 8. Anthropic Theme Factory Skill

来源：[Anthropic skills / theme-factory](https://github.com/anthropics/skills/tree/main/skills/theme-factory)

| 学习收获 | 本项目落点 |
| --- | --- |
| 主题应是一组完整方案，而不是零散的颜色选择器。 | `ThemeTokens` 同时包含字体、纸张、文字、线条、语义色和图表色。 |
| 主题应用应保持全局一致，切换后同类组件不能遗留旧样式。 | 统一渲染组件从文档主题解析元素、图表与图片风格。 |
| 主题资产应可预览、可确认、可复用。 | D4：`assets/theme-tokens.json` 作为规范化输出素材。 |

## 9. Anthropic Skill Creator

来源：[Anthropic skills / skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator)

| 学习收获 | 本项目落点 |
| --- | --- |
| 复杂规范要采用渐进披露，避免一个主文件承载全部背景知识。 | D4：主流程、指标口径与主题资产分层。 |
| 确定性越高、越容易重复出错的步骤，越适合固化为脚本；需要判断的内容保留文字指导。 | D3 固化渲染；报告叙事和结论仍由模型基于证据判断。 |
| 创建后需要校验结构，并通过真实任务观察漏触发、误触发与执行摩擦。 | D4：运行 `quick_validate.py`，再用本项目五页样例做手工正向检查。 |

## 10. Anthropic 完整 Skill 指南

来源：[The Complete Guide to Building Skills for Claude](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)

| 学习收获 | 本项目落点 |
| --- | --- |
| 先定义 2-3 个真实使用场景及成功标准，再决定 Skill 内容。 | D4：覆盖经营分析、财务简报、专题研究三类报告。 |
| 三层渐进披露分别承担触发、核心流程和按需资源，主文件应保持紧凑。 | D4：metadata、`SKILL.md`、references/assets 三层结构。 |
| Skill 是持续迭代的规范，应根据真实失败样例修订，而不是一次写完后冻结。 | 后续把漏掉的指标口径、打印缺陷和用户修正回写到 references 或检查清单。 |

## 11. v1.6.0 内核迭代学习

v1.6.0 把“数据生成”和“人工排版”从同一份可变文档中拆开，形成 `compile baseline -> apply stable-ID visual override -> render`。这不是新增一层任意合并逻辑，而是明确两类所有权：报告包与本地数据拥有业务事实，用户视觉覆盖拥有几何、层级、样式和局部排版意图。

| 学习收获 | v1.6.0 落点 |
| --- | --- |
| 视觉微调要能跨数据刷新保留，但不能冻结旧数字。 | 对带 `contentTemplate`、`chartBinding`、`tableBinding` 或内核角色的受保护元素，界面只读且禁删/禁复制，并在覆盖生成与读取两端剥离 `content`、`runs`、`chart`、`table`、删除标记和事实型副本；`document.meta` 也不进入覆盖。 |
| “静态”是事实所有权边界，不是元素类型。 | 既有无绑定 text/chart/table 可以保存人工内容；特化精修不新增事实型元素，一旦内容需要随字段或公式变化，就必须回到报告包改为绑定元素，不能复制展示值。 |
| 稳定 ID 是可解释重放的最低契约。 | 覆盖按 page ID 和 element ID 查找目标；目标消失计为孤儿、显示 warning 并忽略，不猜测相似元素。 |
| 横版与竖版不是同一坐标系。 | 图表点以稳定 series/category ID 定位，毫米偏移分别存入 `portrait` 和 `landscape`；已有内容页面不直接切换方向。 |
| 恢复操作必须与用户心智模型一致。 | “恢复示例”只重置本地数据，“恢复布局”只重置视觉覆盖，避免一次操作同时丢失两类工作。 |
| 母版也应服从同一图片编辑模型。 | 内容图和母版图都可直接非破坏性裁切，保存原图像素坐标，不要求先转换为自由元素。 |
| 本地优先不等于信任本地缓存。 | 工程、报告包、写入和历史 IndexedDB 读取都校验 PNG/JPEG/WebP 的 MIME、规范 base64 和文件签名；资产按报告包命名空间隔离，且路径不使用 `fetch`。 |
| 页数能力不能从一个样例外推。 | 内核只要求报告包至少一页，不设置固定最大页数；10 页只属于财务参考包，实际容量仍受内存、图片与打印环境约束。 |

本次能力边界需要持续保留在文档和发布检查中：v1.6.0 没有语义指纹、三方合并或 ID 自动重命名迁移。稳定 ID 被作者改变时，系统只能报告并忽略孤儿覆盖，不能自动判断新旧元素是否语义相同。

## 12. v1.7.0 独立模板学习

用户真正需要的不是把所有报告数据抽象成统一 schema，而是让智能体搭一个可继续编辑的初版生成器。报告数量有限、结构差异大时，强行集中字段和勾稽会把一次性版式问题变成长期数据建模成本。

| 学习收获 | v1.7.0 落点 |
| --- | --- |
| 每个图表/表格可以是自己的事实源。 | independent 的 chart/table 直接携带数据，验证器拒绝 fields、derived、rules 和 binding。 |
| “组件旁编辑”比报告级数据栏更符合局部对象心智模型。 | 图表和表格共用浮动“编辑数据”入口，只提交当前对象。 |
| 独立模板不是 bound 精修去掉只读。 | 运行时分成 generic、bound precision、independent 三种能力组合；independent 保存完整 ReportDocument。 |
| 保留高级模式比删除旧能力稳妥。 | 缺省旧包继续按 bound；公式、迁移、脱敏、勾稽和视觉覆盖测试使用固化夹具继续运行。 |
| 页数结论必须通过真实当前文档验证。 | 浏览器交替新增纵横页面至 15/20 页，刷新和打印层均读取当前页数。 |
| UI 入口必须在真实组合选择中测试。 | 浏览器发现表格标题+表格组合会挡住工具条，改为选择组内唯一 data element 后复验通过。 |

independent 仍不是自由 DOM 编辑器：它继续使用 ReportDocument、毫米坐标、主题 token、稳定 ID、资产签名和统一打印层。它删除的是跨组件数据所有权，不是结构化模型和质量门禁。

可移植工程导入也是隐私边界，不能把“没有联网”误当成“不会泄漏”。缺失图片不得从同命名空间旧 IndexedDB 记录补齐，否则旧敏感图片可能在新工程导出时被复活。v1.7 因此要求图片完整、限制 ZIP/JSON、解压规模、图片数量和解码像素，在完整解码前解析 PNG/JPEG/WebP 尺寸头，Canvas 重编码去除 EXIF/GPS，导入资产 ID 重映射和单事务写入；图片缩小后还必须按新旧尺寸比例换算裁切框，恢复智能体模板同时清理该包图片命名空间。

文本继续使用字号白名单，但从五档扩展为覆盖 8-48 pt 的正文、卡片标题、页标题和封面档位。结构化约束的目的应是阻止不可控值和迁移漂移，而不是剥夺用户完成常规排版微调的空间。

## 独立判断与证据边界

- 任务书中“Google Docs、Figma、Fabric、Excalidraw、Konva 全部采用原生输入控件路线”没有在本次白名单资料中得到逐项核验，且“采用”可能掩盖各产品自研输入层、Canvas 与隐藏控件之间的差异。本项目使用原生 `textarea/input` 的依据是自身需求：行内 mark 很少、必须离线、中文输入法稳定性优先、无需引入大型富文本框架；不把该产品列表当作已证实的行业事实。
- Anthropic 的页面边距与间距阈值来自演示文稿质检方法，迁移到 A4 报告时作为风险提示，而不是一刀切的排版定律。全幅母版图、制度页眉页脚和有意叠放的压图设计需要例外分支。
- `.agents/skills/cosco-report/assets/theme-tokens.json` 是本项目的保守企业报告主题，不宣称是任何公司的官方品牌手册；拿到正式品牌规范后应替换其数值，但保留 token 角色。

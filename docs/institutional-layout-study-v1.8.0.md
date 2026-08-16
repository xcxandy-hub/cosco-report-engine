# 头部机构报告版式研究 v1.8

研究日期：`2026-08-16`
用途：提炼封面、Logo、页眉页脚和高信息密度方法，不复制报告页面、图片、文字或品牌规范。

## 核验范围

| 机构与报告 | 官方来源 | 本次核验范围 |
| --- | --- | --- |
| A.P. Moller - Maersk Annual Report 2025 | [发布页](https://investor.maersk.com/news-releases/news-release-details/annual-report-2025) / [PDF](https://ml-eu.globenewswire.com/Resource/Download/61eb6ba2-916f-4254-8af6-4b2ff2717858) | 本地下载 185 页 PDF，渲染并检查前 12 页 |
| Goldman Sachs Annual Report 2025 | [发布页](https://www.goldmansachs.com/investor-relations/financials/current/annual-reports/2025-annual-report) / [PDF](https://www.goldmansachs.com/investor-relations/financials/current/annual-reports/2025/annual-report.pdf) | 本地下载 274 页 PDF，渲染并检查前 12 页 |
| COSCO SHIPPING International Annual Report 2024 | [PDF](https://hk.coscoshipping.com/cms_files/filemanager/1915204376/attach/20251/FB48D0FD33A6D28EA252E55252DA8D34.pdf) | 本地下载 232 页 PDF，渲染并检查前 12 页；部分中文字体渲染有 Poppler 警告，不作为设计事实 |
| McKinsey Technology Trends Outlook 2025 | [PDF](https://www.mckinsey.com/~/media/mckinsey/business%20functions/mckinsey%20digital/our%20insights/the%20top%20trends%20in%20tech%202025/mckinsey-technology-trends-outlook-2025.pdf) | 浏览器确认 108 页并目检封面；本地下载未完成，因此不声称逐页研究 |

## 可迁移的设计经验

### Maersk

- 横版全幅纪实照片可以承载强主题，但标题和元数据保持克制，避免营销海报化。
- 内容页用稳定的垂直品牌轨道形成章节定位，正文仍以两栏或三栏高密布局为主。
- KPI、图表和叙述可通过浅色整带组织，不必把每个内容块都做成悬浮卡片。
- 页面节奏来自固定几何、章节标记和图片页穿插，而不是每页重新发明布局。

### Goldman Sachs

- 纵版封面采用小型左上 Logo、下部标题和出血边缘的大型刊号/字母，建立编辑出版感。
- 内容页使用细规则线、小型 running header、较大的编辑标题和紧凑双栏正文。
- 图表可嵌入叙事流，不必总是占据整张大卡片；高信息密度依赖对齐和字号层级，而不是减少留白。

### COSCO SHIPPING

- 纵版封面常把大幅图像、白色信息区和企业 Logo 分成受控区域，避免 Logo 随意漂浮在复杂背景上。
- 蓝、青、绿、黄用于章节区分和重点提示，底色仍保持白或很浅的纸张色。
- 财务表格采用小字号、轻规则和清楚的单位/表头层级；Logo 与双语机构名集中在固定页眉区。

### McKinsey

- 深色底、左上白色 Logo、大型白色标题和小型日期形成清晰不对称结构。
- 几何或影像集中在一侧，另一侧保留稳定标题区；封面不需要卡片框架。
- 由于本次只核验封面，不把其内页结构写成已验证结论。

## 模板落点

| 模板 | 主要吸收的方法 | 未复制的内容 |
| --- | --- | --- |
| `cinematic-fullbleed` | 全幅纪实图、定向深色蒙版、白色 Logo 与紧凑元数据 | 不复制 Maersk/McKinsey 图像、字号或版面 |
| `editorial-monogram` | 下部标题区、边缘刊号、编辑出版层级 | 不复制 Goldman Sachs 字标和专有字体 |
| `institutional-rail` | 品牌侧轨、图像区与白色信息区的稳定分割 | 不复制 Maersk 导航颜色或 COSCO 年报页面 |
| `split-image-panel` | 影像与实色标题面板的严格分栏 | 采用项目 token 和独立毫米几何 |
| `publication-window` | 白纸张、局部图窗、标题规则线和密集元数据 | 不复制任何机构封面图或 Logo 组合 |
| `minimal-rule` | 小 Logo、running header、细线与右下页码 | 使用可编辑普通元素 |
| `brand-rail` | 页面边缘轨道与章节连续定位 | 轨道宽度和颜色来自项目主题 |
| `editorial-corner` | 页角 Logo、短规则线、克制页脚 | 不复制机构字号和字族 |

## 高信息密度原则

1. 每页先确定一个主问题，再把结论、证据、来源和行动压进同一阅读路径；密度不是把字号无限缩小。
2. KPI 使用文字、数字、单位、注释和底色的原子组合，不新增不可拆 KPI 元素。
3. 图表标题、单位、图例、来源和结论应围绕图表紧凑对齐；重复说明移出卡片边框。
4. 页眉页脚只承担机构、章节、页码和密级，不与正文争夺视觉权重。
5. 封面模板负责建立主题与身份，内容页模板负责稳定导航；二者都必须允许用户逐元素改动。

## 素材边界

本研究下载的机构 PDF 和渲染页只位于 `tmp/`，不进入版本库。模板起始照片来自 Wikimedia Commons 的公有领域或 CC0 素材，见 [`src/assets/brand/covers/NOTICE.md`](../src/assets/brand/covers/NOTICE.md)。

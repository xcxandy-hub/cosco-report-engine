# 第三方方法与许可证说明

v1.5.0 没有复制外部 PDF Skill 或 PDF 编辑器代码。GitHub 仓库只用于学习 Skill 组织、CLI 契约、模板/生成器分层和视觉验证方法。具体来源与许可证见 [GitHub Skill 与 PDF 工程调研](./github-skill-research.md)。

运行时依赖及其许可证继续以 `package-lock.json` 和各 npm 包许可证为准。`sharp` 只用于仓库维护阶段生成、重编码和核验位图，不进入浏览器运行时。报告内核不引入 CDN、远程字体、遥测或云服务。

v1.8.0 的 5 张封面起始图来自 Wikimedia Commons 的 Public Domain 或 CC0 条目，逐项来源和作者见 [`src/assets/brand/covers/NOTICE.md`](../src/assets/brand/covers/NOTICE.md)。项目只保存去元数据、压缩后的本地 JPEG，不在运行时下载。头部机构年报和研报只用于人工学习版式，没有把其页面、图片或文字复制进模板。

彩色与白色 COSCO SHIPPING Logo 位图从用户提供旧版工具的同一原始路径提取；名称和商标归其权利人，并由根 `LICENSE` 明确排除于 MIT 许可范围。仓库公开可读不构成对商标资产的再许可；使用者必须自行确认使用与再分发权限。横向“中远海运 / COSCO SHIPPING REPORTS”是项目报告工作台组合标识，不是官方品牌标准件。

专有许可、无许可证、空仓库或 AGPL 项目均未复制、vendor 或链接到运行时。Anthropic PDF Skill 的 `skills/pdf/LICENSE.txt` 禁止提取、复制、衍生和分发，本项目未使用其内容。后续若要引入任何第三方代码，必须先完成许可证审查并单独更新本说明。

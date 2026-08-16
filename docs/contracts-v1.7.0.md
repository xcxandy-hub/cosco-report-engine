# Local Report Studio v1.7.0 契约

状态：发布候选规范基线  
应用版本：`1.7.0`  
工程格式：`ReportDocument 1.5`  
报告内核：`0.1`

v1.6.0 的原子元素、图片安全、横竖版、打印和 `bound` 视觉覆盖契约继续有效。发生冲突时，以本文件为准。

## 1. 报告包模式

1. 报告包只允许 `authoringMode: "independent" | "bound"`；缺省按 `bound` 解释，保证旧报告包兼容。
   智能体新建报告包一律使用 `independent`；`bound` 只用于加载、维护和回归既有旧包。
2. `independent` 不得出现 `dataSchemaVersion`、`fields`、`derived`、`rules`、`inputSections` 或 `dataMigrations`，也不得在元素中出现 `contentTemplate`、`chartBinding` 或 `tableBinding`。
3. `independent` 的 text、chart、table 直接持有 `content/runs`、`chart`、`table`。每个图表和表格是独立数据对象；内核不建立跨组件引用、派生或勾稽。
4. `bound` 继续要求 `dataSchemaVersion` 和至少一个字段，并保留派生 AST、规则、迁移、脱敏预览、绑定与三层事实保护。
5. 两种模式都必须通过主题、资产、页面、几何、图表、表格和稳定 ID 验证；包级错误继续 fail-closed。

## 2. 独立模板运行时

1. 独立特化 HTML 打开后直接进入完整编辑器，不出现集中“本地数据”面板，也没有“进入布局精修”的中间步骤。
2. 用户可以编辑报告 meta、直接修改文字、增删复制页面和所有六种基础元素、调整样式和图层、裁切图片、拖动图表标签。
3. 选中图表或表格后，组件旁必须提供“编辑数据”按钮；打开后显示按报告提示词预建的单元格网格。保存只修改当前元素；取消、非法单元格或编辑其他组件不得改写当前对象。
4. 独立模式保存完整 `ReportDocument`，不创建或应用 `VisualOverrideSet`。存储键和 IndexedDB 资产命名空间必须包含报告包 ID，避免不同生成器串数据或串图。
5. “恢复智能体模板”清除该报告包的完整文档存档及图片命名空间，再重新载入作者初版；操作前必须确认。存储失败必须显示持续告警并提供工程导出入口。
6. `.report.zip` 和 JSON 导入继续进入 `normalizeProject()` 与图片签名门禁，不执行导入内容中的代码。可移植工程必须包含全部图片；导入限制文件、条目、解压总量、图片数量（256）、单图解码像素（64 MP）和总解码像素（256 MP），PNG/JPEG/WebP 在完整解码前读取尺寸头。图片经 Canvas 重编码去除 EXIF/GPS、资产 ID 重映射、原裁切框按新旧尺寸比例换算和单事务写入后，才能切换当前文档。

## 3. 组件局部数据

1. 图表网格第一列为类目，其余列为系列；系列名和类目名可逐格修改。数值必须是幅度受限的有限十进制数，行列必须完整；环形图固定一列数值系列，不接受负数且至少有一个正值。
2. 表格网格第一行为非空表头，至少一行正文。用户可增删行列，也可将 Excel 连续区域从当前格向右下粘贴并扩展网格；不完整引号、非矩形区域、超限内容必须整次拒绝。
3. 图表更新保留仍存在行列的系列 ID、类目 ID 及组合图系列配置；新增行列生成唯一稳定 ID，删除行列同步清理孤儿标签偏移。标签偏移继续按 portrait/landscape 分支保存。
4. 单元格草稿只有点击“应用数据”才形成一次撤销记录；取消、校验失败、只读 bound 数据或未应用即打印均不得写回文档。
5. 右侧数据面板只显示当前图表/表格的数据规模、系列或表头摘要以及单元格入口，不得恢复原始制表符文本框或集中报告级数据表单。

## 4. 页面、输出与隐私

1. 报告至少一页，不设置固定最大页数；当前财务独立模板为十页，仅是参考实现。
2. 页面可混用 A4 纵向和横向；打印态复用当前完整文档，并在打印请求时同步当前动态页数。
3. 单 HTML 保持 `connect-src 'none'`，不得增加上传、遥测、登录、CDN 或运行时网络请求。
4. 用户的真实编辑只保存在当前浏览器或其显式导出的本地工程中；智能体和报告包只接触脱敏稿与脱敏模板数据。

## 5. 门禁

发布候选至少通过：

```bash
npm run typecheck
npm run test:migration
npm run test:engine
npm run test:assets
npm run test:overrides
npm run engine:validate
npm run engine:compile
npm run engine:build
npm run test:cell-grid
npm run test:dynamic-pages
npm run check:offline
npm run check:engine-html
```

浏览器验收还必须证明：独立模板首屏无集中数据面板；单元格增删、Excel 区域粘贴、取消和逐次撤销有效；图 A 修改不影响图 B；表格修改不影响相邻图表；直接文字编辑和刷新保存有效；390 px 侧栏互斥；15/20 页混合方向的当前文档与打印层页数一致。`test:cell-grid` 固化单元格事务、稳定 ID 重排和 390 px 内部滚动；`test:dynamic-pages` 另以临时 20 页交替纵横报告包重放编译、单 HTML、真实 PDF 与逐页 A4/方向检查。20 只是测试规模，不是内核上限。最终冻结还需 PDF 可复现性和逐页 A4 检查。

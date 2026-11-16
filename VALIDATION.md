# v0.2 验证记录

验证日期：2026-11-04（Asia/Shanghai）。验证环境：Windows、Node 23.5.0、Next.js 16.3.8。

## 已通过

- Windows 一键入口烟测通过：自动使用生产构建启动网页和独立 worker、重复启动复用现有服务；实际执行“停止画室.cmd”后，两类托管子进程均退出、监听端口关闭、运行记录清除，作品记录保留。

- `npm test`：7 个文件、49 项测试全部通过。
- TypeScript 检查通过，`npm run build` 生产构建通过。
- 单元与路由测试包含：会话及素材隔离、同源检查、请求大小与图片解码、事件幂等、慢请求竞态、当前作品与预览授权、旧理解失效、取消后的迟到结果、原子结果提交、视频查询/媒体错误分类、Live/Demo 双向隔离及 SQLite checkpoint 重开/删除。
- 实际 DeepSeek 联调使用程序合成的房树人测试画：画面观察、流式对话、工具起草图片变化建议、用户拒绝后撤销建议均通过；过程中创建的媒体生成作业数量为 0。
- Playwright 实际走查：Canvas 示例画与刷新恢复、首次 AI 处理说明、提交、自述、建议清单编辑、显式确认、独立 worker 的模拟结果、结果预览、舍弃恢复原作、跳过评分正常完成。
- 停止开发服务后启动生产构建，在同一浏览器会话恢复原画、聊天和结果。生产走查期间浏览器错误与警告均为 0。
- 1280×720：工具栏及提交按钮均在视口内。390×844：作品/聊天切换正常，无横向溢出。

## 真实生成的验证边界

本机已有 DeepSeek 配置，可调用对话与视觉；没有配置 `DASHSCOPE_API_KEY`、`DASHSCOPE_IMAGE_ENDPOINT` 和 `DASHSCOPE_VIDEO_ENDPOINT`，所以没有声称真实图像或视频生成已联通。

Qwen 图像编辑、Wan 首帧图生视频的请求与响应协议由 mock HTTP 契约测试覆盖。真实环境中的账户权限、区域、耗时、费用、图像保真及视频一致性，需补齐配置后用 `npm run check:api -- --image --video` 实测。

模拟模式的图片是带 DEMO 标记的原画，不代表完成了用户要求的真实编辑；模拟模式不提供伪造的生成视频。真实服务失败不会降级成假成功。

## 验证产物

- `.data/checks/latest.json`：实际 DeepSeek 检查的脱敏状态与耗时。
- `output/playwright/studio-desktop-fitted.png`：桌面画室。
- `output/playwright/studio-mobile-art.png`：手机作品区。
- `output/playwright/studio-mobile-chat.png`：手机聊天区。
- `output/playwright/studio-result.png`：显著标记的模拟结果。

这些运行数据与截图均在 `.gitignore` 中；源代码交付不包含密钥或本地会话数据。

## 设计图先行的界面更新

- 项目内技能已保存至 `.agents/skills/`：frontend-design、vercel-react-best-practices、playwright、imagegen。99 个源技能文件经 SHA-256 完整性核验，来源及清单保存在仓库内。
- 先通过内置 imagegen 生成 `design/desktop-studio-v1.png`，再调整 React、CSS 和 Canvas。完整提示词与设计说明保存在 `design/`；页面没有使用整张设计图作为背景。
- 更新品牌栏、标题、同排版本切换、托盘式绘画工具、叶枝标记、聊天气泡和改动确认卡。夜色示例由原生 Canvas 绘制，默认仍为空白画布。
- 更新后 49 项测试与类型检查通过。浏览器走查夜色示例→提交→聊天→待确认卡→拒绝变化通过，没有新增浏览器错误。
- 1440×960：绘画工具和提交按钮在首屏内；1280×720：提交按钮底部约 672px；390×844：作品和聊天切换无横向溢出。
- 对照截图：`output/playwright/design-v1-implemented-conversation.png`、`design-v1-short-desktop.png`、`design-v1-mobile-art.png`、`design-v1-mobile-chat.png`。

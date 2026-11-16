# Draw Your World

电脑优先的中文 Web 创作原型：绘画、一起看画的 Agent 对话、用户确认后的图像编辑，以及可选的画作短片。界面采用纸感画室，手机窄屏可切换作品与聊天。

## 启动

Windows 可以直接在项目文件夹双击：

- **`启动画室.cmd`**：启动真实 AI 模式，自动打开浏览器，沿用 `.env.local` 配置。
- **`启动模拟演示.cmd`**：启动明确标识的本地模拟模式。
- **`停止画室.cmd`**：停止一键入口启动的网页与后台任务，保留作品记录。

首次启动会在需要时安装依赖、构建界面；重复点击会打开已运行的同模式画室。后台进程隐藏运行，日志位于 `.data/launcher/`。切换模式前先停止当前画室。命令行等价入口为 `npm run launch`、`npm run launch:demo`、`npm run stop`。

需要 Node.js 22.13+（建议当前 LTS；本机 Node 23.5 已验证）与 npm。项目使用内置 `node:sqlite`，不需要另外安装数据库。

```powershell
npm install
# 从 .env.example 创建 .env.local，填写自己的服务端配置
npm run dev
```

打开 http://127.0.0.1:3000 。命令同时启动 Next.js 和独立生成 worker，Ctrl+C 关闭两者。`PORT` 可调整端口。

```powershell
# 不使用任何真实模型服务，界面始终标明模拟模式
npm run demo
# 稳定演示前构建
npm run build
npm start
```

模拟模式只验证交互、草稿确认、图片任务与恢复：图片结果是带 **DEMO** 标记的原画预览，不声称实际执行编辑；没有伪造的生成视频。真实图片/视频功能必须使用 live 模式并配置相应服务。

## 服务配置

复制 `.env.example` 到 `.env.local`。不要把密钥放到浏览器代码或提交到版本库。

| 配置 | 用途 |
|---|---|
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | 对话、可见内容观察；默认 `deepseek-flash` |
| `DEEPSEEK_BASE_URL` | 默认 `https://api.deepseek.com` |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_IMAGE_ENDPOINT` | Qwen 图像编辑，必须对应同一账户区域 |
| `DASHSCOPE_IMAGE_MODEL` | 默认 `qwen-image-3.0` |
| `DASHSCOPE_VIDEO_ENDPOINT` / `WAN_MODEL` | Wan 图生视频；默认 `wan3.0-video` |
| `DASHSCOPE_TASK_ENDPOINT` | 可选；视频查询地址，默认从视频端点 origin 解析 |
| `STUDIO_MODE` | `live`（默认）或 `demo` |
| `STUDIO_DATA_DIR` | 默认项目 `.data`，保存 SQLite、checkpoint 与私有素材 |

端点示例见 `.env.example`。模型、密钥、workspace 与 endpoint 必须按实际供应商控制台配套配置。没有配置的能力在界面标明；失败不转换成成功。

视频默认 5 秒、720P、无音轨、固定镜头。供应商异步生成通常需要分钟级等待，期间可继续聊天。保留手绘和局部变化由提示约束及用户验收共同控制，不保证像素级不变。

## 交互和数据

- 提交原画后做一次中性观察；失败仍可自述。原画永远独立保留。
- LangGraph `prepare → reason → tools → finish` 负责聊天、记忆与提出草稿；工具无法生成媒体。
- 用户原话、AI 理解草稿、已确认理解、被否认解释分别记录。更正会作废相关旧理解与建议。
- 只有点击当前草稿的确认按钮才创建生成任务。改动画、改原画、选择其他结果后，旧来源的草稿不能执行。
- 图片结果可对照、接受或舍弃；动画不自动播放。重复点击复用同一任务，网络提交状态不明时不自动再次付费调用。
- 匿名 HttpOnly Cookie 绑定本地会话。接口只接受用户事件，不接受前端提交的整份会话。素材必须由所属会话读取。
- 刷新可恢复，数据保存在此电脑；“重新开始”清理旧会话、素材及图记忆。画布未提交草稿暂存在当前浏览器。
- 取消代表停止等待和使用结果，已提交给供应商的任务可能继续执行。供应商副本不受本地删除控制。

本轮按本机单实例演示实现，不包含账号、公开分享、专业人员工作台、社区或支付。开始页说明 AI 处理范围，保存与外发作品由用户操作决定；产品不作诊断或疗效承诺。

## 验证

```powershell
npm test
npm run typecheck
npm run build
# 使用 .env.local 实际调用识图与三轮 Agent 对话（会消耗供应商额度），仅上传程序生成的测试画
npm run check:api
# 以下参数另行调用真实图片/视频，需先配齐对应服务
npm run check:api -- --image --video
```

API 检查报告只记录成功/失败、耗时和数量，保存在 `.data/checks/latest.json`，不记录凭据或服务原始响应。浏览器走查截图保存在 `output/playwright/`。

当前验证结果与真实生成边界见 [VALIDATION.md](./VALIDATION.md)。切换 Live/Demo 时会开启对应模式的新会话，另一模式的本地记录与队列保留且不会被当前 worker 执行。

测试覆盖原作保留、源版本校验、生成确认、重复请求、取消与旧结果、模拟标识、缺配置失败、会话隔离、跨源请求、动态工具草稿、用户纠正及 SQLite 恢复。真实模型的措辞、识别与手绘保真还需由实际体验验证。

## 开发资料

原始交接见 [prdv0.1.md](./prdv0.1.md)。旧 `src/lib/harness` 作为历史实现与基线测试保留，当前产品使用 `src/lib/studio`。修改 Next.js 前按 `AGENTS.md` 阅读当前安装版本的本地文档。

项目技能仓库位于 [`.agents/skills/`](./.agents/skills/README.md)，包含 `frontend-design`、`vercel-react-best-practices`、`playwright`、`imagegen` 的完整快照与来源校验记录。它们不会成为应用运行依赖。

界面采用设计图先行的流程：先生成并保存 [桌面设计稿](./design/desktop-studio-v1.png)，再用真实 React、CSS、Canvas 组件还原。视觉规则与生成提示词见 [design/README.md](./design/README.md)。实际用户画作、聊天和生成状态仍来自运行时数据，设计稿不作为整页图片使用。

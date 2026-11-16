# Draw Your World 项目技能仓库

本目录保存四个完整的项目内技能快照。它们从本机已安装版本复制，文件数量与每个文件的 SHA-256 均已核验；这表示复制完整，不表示它们等同于上游最新版本。上游 `SKILL.md` 正文保持原样，相关 scripts、references、agents、assets 与许可证文件一并保留。

| 技能目录 | 用途 | 快照来源 |
|---|---|---|
| `frontend-design` | 根据项目主题制定视觉风格，并将设计图还原为可交互的前端 | 本机同名技能；上游 [Anthropic skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design) |
| `vercel-react-best-practices` | React / Next.js 的异步请求、渲染、组件与加载性能指导 | 本机同名技能；上游 [Vercel agent-skills](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) |
| `playwright` | 真实浏览器中的流程走查、截图、交互和错误恢复验证 | 本机同名技能；上游 [OpenAI skills](https://github.com/openai/skills/tree/main/skills/.curated/playwright) |
| `imagegen` | 开发阶段生成设计图、风格参考及必要的位图素材 | 本机 Codex 系统内置 imagegen 技能快照 |

`manifest.json` 记录四个技能的文件清单、文件数、相对路径与 SHA-256，便于核对或审阅后升级。不要只更新 `SKILL.md` 而遗漏其支持文件；更新前比较新旧快照，避免盲目覆盖项目版本。

`.agents/skills` 是官方支持的仓库内技能发现路径。Codex 会从当前工作目录向仓库根目录扫描此路径。新一轮对话可发现本项目技能；若界面没有刷新，重新打开项目或重启 Codex。项目内与全局同名技能可能同时出现，选择本目录的项目快照，不假设它们会自动合并。

官方说明：[Build skills — Where Codex loads local skills](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)。

本项目先以 `design/desktop-studio-v1.png` 和 `design/README.md` 确定桌面视觉，再用 HTML/CSS、React 组件、画布和真实交互还原。设计图用于参考，不能将整张设计图作为网页界面。

这些技能是开发助手的工作流程，不是产品运行时的 API 服务。对话、识图、图片编辑及视频生成仍需通过项目服务端接入相应提供商。

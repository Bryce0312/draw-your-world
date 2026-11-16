<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:draw-your-world-project-skills -->

## Draw Your World 项目技能与设计实现

- 开展相关任务时优先读取本仓库 `.agents/skills/` 中的项目快照：`frontend-design`、`vercel-react-best-practices`、`playwright`、`imagegen`。技能用途和来源见 `.agents/skills/README.md`；文件完整性见 `.agents/skills/manifest.json`。
- 保留上方 Next.js 自动生成规则；修改 Next.js 代码前仍须读取当前安装版本的本地文档。项目快照不会替代版本匹配的框架文档，也不会覆盖用户的明确指令。
- 桌面视觉以 `design/desktop-studio-v1.png` 和 `design/README.md` 为参考。先检查设计图及其说明，再实现或调整布局、配色、排版、间距与交互状态。
- 用真实 React 组件、HTML/CSS、可操作画布和已有服务接口还原设计，保留对话、确认、原作对照、取消、重试及失败恢复行为；不能把整张设计图作为网页界面，也不能用视觉效果冒充真实生成成功。
- 本目录保存的是已核验的本地快照，不自动跟随上游更新。不要修改上游技能正文来夹带项目需求；项目补充规则放在本文件或设计说明中。

<!-- END:draw-your-world-project-skills -->

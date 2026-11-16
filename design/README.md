# 界面设计基准

## 当前基准：v3 Little Post 邮局小镇

用户明确选定“美式复古手绘、明信片与私人信箱”，并进一步要求 **更像交互游戏，避免网站常见排版**。当前 `/` 是英文为主、前端交互可演示的完整故事原型：覆盖最新架构图除视频生成外的全部环节，包括独立许可、作品对话、反馈与分享卡、作品库与周/月/年报告、匿名树洞、模拟专业支持及预约沟通。它不等于真实账号、社交、专业服务或支付上线。

- 流程与跳转：[v3/flow-spec.md](./v3/flow-spec.md)。功能覆盖不能再按 v2 缩减。
- 视觉与故事设计合同：[v3/theme-spec.md](./v3/theme-spec.md)。邮局世界进入导航、创作桌、信件、私藏、分享信封和预约票据。
- 设计思考及符号与行为映射：[v3/design-rationale.md](./v3/design-rationale.md)。说明邮戳、信封、邮筒、票据为什么匹配具体操作。
- 实页设计验收：[v3/visual-review.md](./v3/visual-review.md)，包含首轮发现、修订闭环与最终production桌面/窄屏截图、邮袋键盘交互验证。
- **最新游戏场景基准**：[v3/town-game-scene.png](./v3/town-game-scene.png)、[v3/letter-game-scene.png](./v3/letter-game-scene.png)，实施合同：[v3/game-shell-spec.md](./v3/game-shell-spec.md)。全屏地图、建筑入口、稀疏场景HUD、物件内操作，取消网站式header/hero/footer。
- 早期方向图：[v3/town-map-prototype.png](./v3/town-map-prototype.png)、[v3/letter-room-prototype.png](./v3/letter-room-prototype.png)、[v3/sharing-envelope-prototype.png](./v3/sharing-envelope-prototype.png)。只保留字体/材质/物件造型参考，其网页框架被最新游戏场景替代。设计图不能整图嵌入；所有文字、输入、标牌和状态用真实组件实现。
- **最终独立地图素材**：[v3/elsewhere-town-gentle.png](./v3/elsewhere-town-gentle.png)。用户后来要求内容不变、画风更可爱更温柔，已改彩铅/蜡笔绘本质感与奶油/浅绿/鹅黄/珊瑚色；`elsewhere-town.png`为较浓复古画风的早稿。游戏图按场景构图参考，插画画风以gentle素材为准。地图插画可用作素材，地标标签必须是可访问、可点击的真实 HTML。
- 全部原型图与地图素材由内置 imagegen 生成；确切 prompts 在 [v3/prompts/](./v3/prompts/)。页面必须保持清晰的真实功能标签和模拟边界。

v2 画室作为 `/studio` 的历史原型保留。下面 v2/v1 是历史说明；若与 v3 冲突，以 v3 的完整流程及已选主题为准。

## 历史基准：v2 晨光画室

2026-11-16 本轮以用户的新架构与视觉偏好为准：英文主界面、艺术感、留白、温暖、显著字号层次、丰富且有意义的动态变化。

- 设计合同：[v2/ui-spec.md](./v2/ui-spec.md)，包含用户旅程、设计 tokens、欢迎/创作/对话布局、几何拼贴、真实确认与失败状态、响应式及动效规则。
- 竞品研究：[v2/competitor-research.md](./v2/competitor-research.md)。研究与 UI 设计 agent 已直接协调，开发依据设计合同实现。
- 欢迎参考：[v2/welcome-v2.png](./v2/welcome-v2.png)。工作区参考：[v2/workspace-v2.png](./v2/workspace-v2.png)。二者为高保真方向图，不可整图嵌入网页。
- 可用于欢迎页的独立原创艺术素材：[v2/studio-collage-art.png](./v2/studio-collage-art.png)。不能把它当用户原作或真实模型编辑结果。
- 三张图均由内置 image_gen 生成；确切提示词位于 [v2/prompts/](./v2/prompts/)。UI 采用真实 React/Canvas/SVG 交互实现；实现的辅助文案与控件按设计合同 13–16px，生成图中的部分辅助字号偏大，不逐像素照抄。

下面 v1 章节及 `desktop-studio-v1.png` 保留为历史参考。现有原作保护、显式生成确认、取消、失败恢复、模拟标识和数据处理事实继续有效；当前新原型的功能及样式采用 v3。

## 历史基准：v1 纸感画室

本项目采用“先生成设计图，再用真实组件还原”的流程。主参考为 [desktop-studio-v1.png](./desktop-studio-v1.png)，生成方式为内置 imagegen；完整提示词见 [prompts/desktop-studio-v1.txt](./prompts/desktop-studio-v1.txt)。

## 画室的视觉结构

- 顶部是精简品牌栏：线描房子标记、Draw Your World、副标题“画出你的世界”、当前“我的画室”和“新的一页”。
- 左侧约三分之二为创作区，右侧是持续聊天区。大标题“你的世界，慢慢展开。”，说明“先画几笔，再一起看看。”。
- 画纸标题“我的画面”和版本切换同处画纸顶部，下面是干净可绘制的画布；画笔、橡皮、颜色、粗细、撤销和清空组成底部的铅笔托盘。
- 聊天区采用淡纸色、柔和气泡与克制的叶形标记。建议卡明确列出“改变”和“保留”，用户确认后才执行。
- 纸白 `#F6F1E8`、画纸 `#FFFDF8`、墨色 `#29332D`、墨绿 `#526B55`、陶土 `#B87860`。标题用中文衬线，正文和控件用可读无衬线。
- 陶土色主要用于“新的一页”与待确认提示；墨绿用于当前工具、发送和确认操作。

## 实现边界

设计图是高保真视觉参考，不是网页背景；所有文字、输入、工具、对话、确认卡都必须实现为可访问、可交互的真实组件。

图中的夜色房树人是演示内容，不能自动替代用户画作，也不代表服务已生成结果。实际产品默认空白画布，用户主动点击后才放入本地 Canvas 示例。

状态仍由现有 API 决定：live/demo 标识、未配置提示、草稿状态、worker 状态、接受/舍弃和结束分支均保留。不得为了看起来与图一致而硬编码聊天或假装生成成功。

布局以 1440px 桌面为基准，1280×720 时绘画工具和主要操作保持可达；手机采用作品/聊天切换。相较单一静态图，响应式间距和完整异常状态应按实际空间调整。

## 后续修改顺序

先更新设计图和本说明，再调整组件与样式，最后用浏览器截图比较。保持用户选择的纸感画室方向；新增视觉方向需要单独说明。

# v2 UI 设计比对记录

设计负责人：UI/UX agent。基准：`ui-spec.md`、`welcome-v2.png`、`workspace-v2.png`。以下只记录实际查看的截图或代码证据，不把静态图当作动效实测。

## 第一轮：欢迎页桌面

证据：`output/playwright/v2-welcome-desktop.png`，1440×960。

已达到：英文大字号标题与小尺寸说明形成清楚反差；左文右画、画作单焦点、温暖自然纸色与深橄榄主操作、较大留白均符合方向。真实页面使用单独原创素材和真实控件，不是整张mockup背景。辅助文案比生成图小，符合规格，不要求放大到生成图的程度。

| 项目 | 比对发现 | 给开发的明确修正 | 状态 |
|---|---|---|---|
| V-01 品牌 | 当前八角星与房屋/画室意象不一致 | 改为极简房屋轮廓，保留当前品牌字号和位置 | 已通知，待复核 |
| V-02 主按钮 | Start creating 的 ↗ 容易暗示跳转外链 | 去掉箭头；按钮通过按压/阶段切换提供动态反馈 | 已通知，待复核 |
| V-03 选择器 | 方法选项使用serif，不同于通用UI sans | 设计批准此局部编辑式表达；其余正文/控件仍按spec | 通过 |

等待工作台、1280×720、390×844截图及动效证据后继续记录。

## 第二轮：工作台初版

证据：`output/playwright/v2-studio-desktop.png`，1440×960。

暖纸/桌面/旁注层次与40px标题、27px侧栏标题基本通过，侧栏开放排版符合要求。问题 V-04：1200×780 画布直接满宽展示，顶部标题/版本/模式/帮助多层叠加，导致工具和主要操作落到首屏外。已通知开发：保持导出比例，将画纸按剩余视高等比缩小、居中；压缩上方顶栏，合并 Your page/方法选择/版本，保留单独简短帮助行。1440×960 纸高目标460–500px，1280×720为280–320px。允许适度桌面左右留白，不允许拉伸画布或隐藏关键操作。待修正截图复核。

## 第三轮：视口修正复核

实际查看更新后的 `v2-studio-desktop.png`、`v2-studio-laptop.png`、`v2-studio-mobile.png`（均在 output/playwright）。

- V-01 通过：三个视口均已恢复极简房屋轮廓；品牌与画室意象一致。
- V-04 通过：1440×960 画纸约480px高、顶栏合并，工具和提交可见；1280×720 画纸约300px高、缩小标题和空间后CTA完整可见。短屏纸张左右桌面留白较多，是保持1200×780原作比例与可操作性的设计批准取舍。
- 390×844：Picture/Conversation切换、标题反差和主操作可达；画具分两行、不横向挤出；页面可纵向滚动，不要求所有说明挤进首屏。
- 操作层次：New page为轻文本、入口AI邀请为当前主按钮；原作结果图中的Back to canvas为次要按钮，符合阶段层次。

新增状态修正 V-05：主 agent 流程实测发现已提交后仍出现空态绘画邀请，且草稿存在时可重复起草。设计已决策空态仅在无原作且无消息时显示；有媒体草稿时隐藏重复起草快捷键。开发已反馈实施，待最终状态截图核对。

动效代码审查可见 welcome-in、art-settle、paper-open、message/proposal 等过渡及 prefers-reduced-motion 降级；尚不以此替代实际交互中是否顺畅的浏览器验证。

主 agent 补充实际运行证据：浏览器设置 `reducedMotion: 'reduce'` 后，结束 dialog 的计算样式 `animationDuration = 1e-05s`；不评分、不输入反思仍可完成 Finish。说明减少动态模式实际生效，且结束操作不依赖动画或必填评价。

## 最终生产版本验收：通过

UI agent 使用独立浏览器会话 `ui-review-v2`，在 production demo `http://127.0.0.1:3010` 实际执行欢迎→选择Shapes→进入→新增/键盘移动/改色→明确同意本地模拟处理→提交→输入变化请求→查看草稿。没有调用真实付费模型。验收后已关闭此浏览器。

最终截图（均在 `output/playwright/`）：

- `v2-final-welcome.png`：1440×960，房屋logo与无外链箭头的Start creating均复核，V-01/V-02通过。
- `v2-welcome-laptop-final.png`：1280×720，标题强反差、主按钮完整可见，欢迎艺术材料与留白通过。
- `v2-welcome-mobile-final.png`：390×844，主按钮先于艺术图，手机文案可读，无横向挤压，艺术图仍是独立素材。
- `v2-final-shapes.png`：1440×960，有选中形状、尺寸/旋转/删除行。曾发现多出的属性行将CTA压到首屏外，随后采用固定额外48px高度预算（避免每次选中画纸跳动）。最终实际纸高431.99px，主按钮底部927.67px，小于960，修正通过。
- `v2-final-shapes-laptop.png`：1280×720，最终纸高251.99px，主按钮底部662.06px，小于720；document横向overflow=false。
- `v2-final-proposal.png`：真实模拟会话起草的卡片，已滚动查看完整Change/Keep和Confirm change/Adjust/Not now。原作可见、Back to canvas次要、Confirm change为当前主动作。空态邀请已移除，重复起草快捷键已隐藏，V-05通过。

未提交时实际DOM只有Create，不再放disabled Original；提交后才显示Original。该渐进呈现已核对。

### 实际动效和可读性证据

操作后在浏览器读取计算样式（不是仅查源码）：进入画室 `paper-open 0.42s`、旁注 `companion-in 0.42s`；创建工具切换 `tools-in 0.22s`；新增形状 `piece-in 0.22s`；真实起草卡 `proposal-in 0.3s`。选择方法时艺术素材有相应姿态变化；所有动作保持可操作。

最终降低动态模式实测：art-column、两枚collage-piece、proposal-card的 `animationDuration=1e-05s` 且 `animationIterationCount=1`，避免无限动画被压成快速循环。与主agent已验证的可跳过结束流程共同确认功能不依赖动态。

正文可读性修正后实测：chat-message段落16px，proposal-detail14px，connection-note12px；画布帮助、来源等按合同提升。大字号层次来自80/40/27px标题，而非把关键正文压到8–9px。

结论：本轮温暖、艺术感、留白、强字号层次、分阶段交互动态和真实状态的视觉标准通过。短屏画纸缩小与手机页面纵向滚动是明确批准的响应式取舍。该结论是本地原型设计验收，不等同真实用户研究或Qwen/Wan生成质量验收。

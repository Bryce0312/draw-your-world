# v3 流程与权限验收

日期：2026-11-16。范围：最新版 PDF 非视频流程全覆盖、页面跳转与前端状态。此记录区分代码预审与实际浏览器验证。

## 代码预审

已实际读取 `src/lib/prototype/model.ts` 和 `src/components/prototype/support-pages.tsx`。

通过的结构：

- 持久化明确仅包含本地演示身份及授权保存的图库；草稿、社区帖子、预约不写 storage。
- 已保存原作不同图像另存新版本；相同图像同来源重复保存不会重复新增。
- 预约持有开始时作品的内存快照；接收者背景按当前选中字段计算，不被后续另一作品替换。
- 专业服务有虚构资料、价格、时间、三种沟通方式、分享预览、模拟付费失败、预约摘要、撤回及取消。
- 不分享背景仍可预约；取消会清除分享项及总许可；非confirmed预约不能进入沟通视图。
- 明确不访问真实支付服务、真实服务者或麦克风。

预审待修正项（已发送 root）：

| 编号 | 发现 | 要求 | 状态 |
| --- | --- | --- | --- |
| Q01 | confirmed预约回sharing新增一项时toggleField保留consent=true | 新增加分享项需要重新确认预览；移除应即时生效 | root浏览器实测通过 |
| Q02 | confirmed预约编辑方式/时间时信息已同步到bookings，status仍confirmed | 编辑后明确回draft/待确认，重新确认才reserved，不能跳回摘要误称新时间已约 | root浏览器实测通过 |
| Q03 | 已预约摘要只有withdraw/cancel，缺少明确修改详情/分享入口 | 提供可到达的Edit visit与Manage sharing，返回路径清楚 | root浏览器实测通过 |
| Q04 | 退出移除profile；Returning visitor又要求profile存在，所以无法重新登录 | 提供准确的本地游客恢复交互 | 已改为明确的Return to this browser，退出后恢复图库实测通过 |
| Q05 | 社区确认预览未绑定草稿版本，切页改作品后原确认仍有效 | 更换作品/所含内容后预览及确认失效 | 改card文字后旧preview/确认失效，实测通过 |
| Q06 | end仅按作品id判断当前图已保存，改图未另存时可能错误提示 | 匹配当前图像与保存快照 | 已保存→再改图→end未保存提示实测通过 |
| Q07 | 将user消息自动复制为confirmedWords并在专业背景页标成Reviewed AI notes | 用户原话、观察及明确确认的整理内容分别呈现，不能改写来源 | 已改为可编辑、独立勾选的example companion note；保存内容与专业筛选实测通过 |
| Q08 | 深链可越过booking页日期检查，checkout只有非空检查 | checkout动作也验证时间和服务可约日 | root实测过去日深链checkout被禁用 |
| Q09 | hash为`#%`时decodeURIComponent抛URI malformed | 安全解析并回到可用场景 | 已修；完整新导航`?qa=flow-final#%`规范到`#map`且pageerror=[]，回归通过 |

## 实际浏览器验收

环境：Windows Chromium，`http://127.0.0.1:3012`。流程agent使用独立Playwright CLI会话`flow-v3`；root独立验证支持服务。演示数据只在隔离浏览器中，不是用户作品。3011没有监听，未用于验收。

| 路径 | 实际执行与观察 | 结果 / 执行者 |
| --- | --- | --- |
| A 首次完整链 | 注册→地图→真实pointer画线→提交→AI/save分别选择→scripted聊天→观察加入及移除→明确勾选修改过的example note→quiet/letter切换→卡片标题/自评Lighter→明确save→support。存储原话与reviewed notes来源不同，图仍是原图 | 通过 / flow agent |
| B 拒绝链 | 拼贴加圆/三角、undo/redo→AI拒绝/save拒绝→自己的文字→manual观察→quiet反馈→卡片→skip save。无AI companion/AI note，图库数量不增 | 通过 / flow agent |
| C 提交失败 | 画线后打开故障控制，提交留在create，错误说明明确；取消故障后原图提交成功 | 通过 / flow agent |
| D 匿名空间 | 写本地note→单独选图/原话→预览未确认不能发布→确认后改card内容导致旧预览失效→再预览确认→本地发布→本地回复→withdraw消失 | 通过 / flow agent |
| E 文字专业支持 | Mara→未来工作日/10:00→零分享许可→$0模拟支付；模拟失败保持选项，再试成功；文字输入显示本地示例回复 | 通过 / root |
| F 语音/面对面 | 已约改voice需重确认；开始、静音、结束均可操作。改inperson重确认后显示虚构场所的会面卡，无真实麦克风或地点预约 | 通过 / root |
| G 授权与取消 | 新增分享清空总许可、button disabled；重确认后withdraw即时空；编辑预约后深链summary显示未预约；取消后深链visit显示已取消 | 通过 / root |
| H 个人空间 | 图库→作品详情→原话→返回；week/month/year都显示正确自评；Example almanac清楚标示非本人记录；profile→pricing→services可达；退出后Return to this browser恢复同一浏览器图库 | 通过 / flow agent |
| I 返回/深链/刷新 | 浏览器Back后重复save只有一条；缺work显示可返回页，缺draft进入create并解释，缺booking进入选服务；未知普通hash显示map。未保存card刷新丢失而图库保存仍在；checkout刷新不保留预约；非法编码hash修复后新导航恢复map且无错误 | 通过 / flow agent、root |
| J 尺寸/可操作性 | card和almanac在1440×900、1280×720、390×844无横向溢出；主操作可滚入视窗；手机可推进save；reduced-motion下状态可操作；删除取消与Escape保留作品 | 通过所列范围 / flow agent；整体视觉另由UI agent验收 |

补充实测：

- **存储边界**：存储key仅`dyw-story-prototype-v3`，对象字段仅version/profile/gallery。选AI/save许可但未点save时gallery仍为空。拒绝保存的测试词不在localStorage；社区帖与预约不持久化。root的含图拒绝保存链也确认gallery=0，私密词不泄露。
- **专业来源筛选**：root以真实sample画布、本人句子`I like the night. Keep the person unchanged.`和已编辑/确认的示例整理分别测试三个checkbox；接收者仅出现对应来源，图count=1，撤图后count=0。过去日2026-11-15深链checkout不可支付。
- **原图保留**：revisit重置AI/save许可；编辑副本再保存后图库新增一份，旧作品image字节未变、新副本image不同。同来源/同图重复save不增加作品。
- **保存提示准确**：已保存副本再次修改图后，end明确说当前页未保存，不把旧版当作新图已保存。
- **真实文件导出**：Download postcard成功下载PNG；已实际打开核对标题、绘画、自写卡片文本和日期在同一张图中。没有把下载按钮当静态装饰。
- **控制台**：正常路径仅开发服务器HMR日志；主动测试非法编码hash时发现Q09，已修复并完整新导航复验没有pageerror。

证据文件（本地测试产物）：

- `output/playwright/v3-flow-almanac-desktop.png`
- `output/playwright/v3-flow-almanac-laptop.png`
- `output/playwright/v3-flow-almanac-mobile.png`
- `output/playwright/v3-flow-gallery-desktop.png`
- `output/playwright/v3-flow-card-desktop.png`
- `output/playwright/v3-flow-card-laptop.png`
- `output/playwright/v3-flow-card-mobile.png`
- `output/playwright/v3-flow-postcard-download.png`
- `output/playwright/v3-sharing-root.png`

本记录只验收前端场景及本地状态，不代表真实AI、真实身份认证、真正公开发布、支付或专业服务已接通。按用户范围移除了视频专属流程，观察→反馈→卡片仍连续可达。

# 2026-09-25 首页与消息页交付、技术日志和验收

依据：9 月 25 日《AI Agent 产品工作推进会议》原纪要及两张会议图、用户确认的首页与第三页范围、此前的首页／消息／私聊／群聊／社区详细原稿和后续确认。群聊以用户本轮确认的 Cola/Fortune 对谈为方向：Agent 在群内公开参与协作、可协助组群、牵线、日程协调与整理共识。具体实现仍遵守已有的真人身份、资料授权和外部行动确认规则。

| 原稿及后续要求 | 当前代码实现 | 验收证据 |
| --- | --- | --- |
| 首页保留原排版，早／午／晚三时段卡片依据真实当日任务变化 | `app/v28/features/home/home-page.tsx`、`app/v28/core/brief-event.mjs`；隔离数据为三个时段提供明确标记的测试任务 | `tests/elfred/brief-event.test.mjs`、`npm test`；`npm run seed:fixtures` |
| 五个主 Agent 保持区分、等级基于证据 | `app/v28/features/home/home-page.tsx`、`app/v28/features/home/agent-level-page.tsx` | 产品测试中首页五 Agent 和等级用例通过 |
| Agent 朋友圈在首页中段，沿原手机排版；真实成果或公开来源才可发布 | `app/v28/features/home/private-feed.tsx`、`server/elfred/feed.mjs`、`server/elfred/observation.mjs`；测试数据始终标“隔离验收数据” | 1000 条隔离动态在 390×844 页面首屏只渲染 30 条；加载更多到 60，筛选后 30；无浏览器脚本错误 |
| 不要求用户手工订阅 RSS；根据初始化选择筛选公开资讯 | `server/elfred/auto-discovery.mjs` 为已确认的初始选择生成公开资讯源草稿；本人点击“开始发现”后定期检查，首批真实来源可进入私人朋友圈，保留来源和不确定性 | `tests/elfred/auto-discovery.test.mjs` 验证来源、首次发布、去重和不进入真人社区；网络 RSS 读取实测可用 |
| 社区只能真人发，动态／作品／共创卡片清晰，空分类有状态 | `server/elfred/community.mjs` 限制真人主动发布；`app/v28/legacy/legacy-ui.tsx` 只显示公开、真人、有效帖子和发布作品，补标题／图片预览及分类空态 | `tests/elfred/home-community-messages.test.mjs`、`tests/elfred/completion.test.mjs`、空社区界面检查 |
| 全局搜索穷举内容类型并显示空态 | `server/elfred/search-engine.mjs` 的 16 类对象与 `app/v28/features/home/connected-search.tsx` 完整筛选选项；隔离数据每类一条可查样本 | `npm run seed:fixtures` 对 16 类逐类检索断言；浏览器检查文件命中与无匹配空态 |
| 私聊的 @ 由用户输入；辅助结果只本人可见，不冒充真人发送 | `app/v28/legacy/legacy-ui.tsx` 原有输入式提及和 `server/elfred/social.mjs` 的私人辅助 | `tests/elfred/at-onboarding.test.mjs` 等运行时用例 |
| 多人群聊的 Elfred 在群里以 AI 身份回复，并可参与牵线、日程和共识整理 | `server/elfred/group-agent.mjs`、`server/elfred/social.mjs`、`app/v28/features/messages/group-agent.tsx`；群内 @ 手动输入，模型按最近 20 条授权群消息作答 | `tests/elfred/group-agent.test.mjs` 验证全员授权、撤权、主动触发和建群后介绍；运行时套件通过 |
| Agent 发起群聊与主动协作 | 本人提供好友、群名和目标并确认后，Agent 创建公开邀请；全部成员授权后进行群内介绍。群主可开启或关闭主动提醒，每小时最多 3 次，至少间隔 3 条真人消息 | 群 Agent 测试覆盖；无授权或失去成员资格即停止读取与发布 |
| 资料与身份边界 | AI 回复标记“群协作 Agent”、保留来源及待确认说明；不读取成员私库、不代表成员接受邀约或日程；真人消息入口拒绝 AI 伪装 | 群 Agent 与既有社交权限测试通过 |

今日完成：群 Agent 服务与界面、自动公开资讯发现、16 类搜索和千条动态隔离数据、朋友圈来源详情、社区卡片与空态、静态检查修复。`npm run test:runtime` 为 159/159，`npm test` 为 25/25，类型检查和生产构建通过；`npm run lint` 为 0 错误、50 条既有警告。浏览器在生产构建上检查 390×844 手机尺寸的动态分页、筛选、搜索命中与空态、私人动态详情、社区空态及 Agent 建群／授权入口。

外部依赖：Jev 服务仍没有接口地址和凭证，现有文字模型中转站不等于 Jev；群 Agent 的模型回复在未配置服务时保持明确待配置状态。邮件、支付、网页代操作和部署平台尚未选定，不能作为已接通功能对外承诺。后续收到这些服务的正式接口资料后，再做真实调用与跨用户验收。

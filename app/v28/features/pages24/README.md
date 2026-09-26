# 第二、四页合并说明

本目录保留 PR #1 的页面结构与视觉组件。合并后的数据源是现有 V28 登录会话、SQLite 对象和命令服务；不存在 `elfred-page2-api` 仓库，因此不能把原 PR 的独立进程当作已交付依赖。

`core/page2-identity.tsx` 把当前会话快照传入 `api/page2-api.ts`。工具、记忆、文档、成果、关系和个人资料均从同一会话读取。新账号显示空态；账号切换时丢弃上一账号的投影。本地页面偏好按用户 ID 分开存储。

已接通的写入路径：文本文件进入 `document.create`，网址进入 `resource.create`（仅保存网址，不抓取正文），知识固化为工具走 `tool.save` 和 `tool.activate`，知识生成任务走 `task.create`，能力卡进入该工具所属 Agent 的持久对话并预填真实工具说明。资料编辑沿用现有 `profile.save`。

能力分、自动升级、成果撤销裁定、EMOS 记忆体检、Skill Foundry 版本与 Jev 评估需要 PR 未提交的服务或额外规则，目前不展示伪造数值，也不冒称调用成功。成果详情保留来源和任务入口，撤下只改浏览器的假按钮已移除。原 `tools/page2-checks` 的独立服务探针是 PR 提交者的历史验证工具，在本合并架构下不作为验收依据。

验收使用 `npm test`、`npm run test:runtime`、`npm run typecheck`、`npm run lint`、`npm run build`，以及登录后走查第二、四页。


---

## 这次新增（2026-09-26，第二/四页）

在你们合并后的架构上，这次往前推了四块，都是这几个文件的改动（探针也一起提了）：

| 块 | 说明 | 文件 |
|---|---|---|
| 能力洞察的「起点」 | 新用户不再看一张全 0 的雷达：答完那份轻量测试就有一张**低起点**图 + 综合分，之后按真实成果升、判错与长期不用会降 | `screens/questionnaire-page.tsx` · `api/page2-api.ts` · `screens/knowledge-page.tsx` |
| 第四页「Agent 动态」 | 最左边那栏从"成果+记忆合并流"换成**朋友圈那份数据的总览**（最近 3 条 + 查看全部；有 runtime 才走它，没有就退回原来那条流） | `parts/agent-feed-overview.tsx` |
| 第四页身份区 | 去掉贴图时代的写死高度与隐形热区：封面 168 + 头像 88 + 名字/遮蔽账号/简介/标签 + **数字条**（成果·能力卡·勋章·理解度）+ 编辑资料/分享一行；右上角「设置背景」换成真按钮「设置」 | `screens/profile-page.tsx` · `styles/profile.module.css` |
| 设置页 / 编辑资料页 | 设置页自己一份（6 组 + 只读行不做成按钮 + 退出二次确认 + 上游服务状态）；编辑资料改成"点一个字段 → 单独编辑 → 保存即落库"（不再有总保存），标签是**预设多选**，昵称默认「路人」 | `screens/settings-page.tsx` · `parts/settings-panels.tsx` · `screens/profile-edit-page.tsx` |

### ⚠️ 需要你定的一件事：这两页的数据源

你们那边的 `api/page2-api.ts` 现在是**读会话快照**（README 里写明"不存在 `elfred-page2-api` 仓库"）；
我们这次的新屏里仍有几处调用我们那套独立后端（`/page2/profile`、`/page2/questionnaire`、`/health/deps`）。
合到你们环境里，这几处会**拿不到数据并如实降级**（空态 / "题目没取到" / "读不到服务状态"），不会造假。

请定一下 canonical 的数据源：
1. 保留我们那套服务作为这两页的数据源（我们继续维护）；
2. 或者你们把这几处改成走会话快照 —— 告诉我一句，我照你们的口径改。

探针（`tools/page2-checks/`）里我们自己那份仍在跑：`questionnaire-check`（27/27）、
`page4-agent-feed`（9/9）、`page4-settings-check`（19/19）、`page4-profile-edit-check`（25/25）。

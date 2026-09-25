# 第二、四页合并说明

本目录保留 PR #1 的页面结构与视觉组件。合并后的数据源是现有 V28 登录会话、SQLite 对象和命令服务；不存在 `elfred-page2-api` 仓库，因此不能把原 PR 的独立进程当作已交付依赖。

`core/page2-identity.tsx` 把当前会话快照传入 `api/page2-api.ts`。工具、记忆、文档、成果、关系和个人资料均从同一会话读取。新账号显示空态；账号切换时丢弃上一账号的投影。本地页面偏好按用户 ID 分开存储。

已接通的写入路径：文本文件进入 `document.create`，网址进入 `resource.create`（仅保存网址，不抓取正文），知识固化为工具走 `tool.save` 和 `tool.activate`，知识生成任务走 `task.create`，能力卡进入该工具所属 Agent 的持久对话并预填真实工具说明。资料编辑沿用现有 `profile.save`。

能力分、自动升级、成果撤销裁定、EMOS 记忆体检、Skill Foundry 版本与 Jev 评估需要 PR 未提交的服务或额外规则，目前不展示伪造数值，也不冒称调用成功。成果详情保留来源和任务入口，撤下只改浏览器的假按钮已移除。原 `tools/page2-checks` 的独立服务探针是 PR 提交者的历史验证工具，在本合并架构下不作为验收依据。

验收使用 `npm test`、`npm run test:runtime`、`npm run typecheck`、`npm run lint`、`npm run build`，以及登录后走查第二、四页。

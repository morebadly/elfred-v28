# PR：第二页 / 第四页（我们的模块）

> 合并记录：本文件记录 PR 提交时的设计和独立后端假设。该后端未包含在仓库中。最终合并版改为复用现有 V28 登录会话和服务端对象，当前接线与边界以 `app/v28/features/pages24/README.md` 为准。

## 这个 PR 做了什么

1. **把这两页收敛成一个模块**：`app/v28/features/pages24/`，入口只有一个 `index.ts`。
   原来散在 `knowledge / memory / profile / library` 四个目录、22 个文件。
2. **清成空态交付**：新账号进来看到的是"待设置 / 待发生"，不种样板数据、不放演示 skill。
3. **把这两页的后端整理成分层服务**（另一个仓库 `elfred-page2-api`，和 EMOS / Skill Foundry
   一样是独立进程）：`api/`（九个路由文件）· `services/` · `core/` · `clients.py`（上游集成）。

## 新增（都是我们自己的文件，不与你的代码重名）

- `app/v28/features/pages24/**` —— 22 个文件 + `index.ts` + `README.md`
  （`api/` 接口与本地状态 · `data/` 数据层 · `parts/` 组件 · `screens/` 页面 · `styles/`）
- `app/v28/core/page2-identity.tsx` —— 一个小挂件：把当前登录的 handle 推给这两页的接口层
- `tools/page2-checks/**` —— 我们用的探针（21 屏走查、身份、桥接、闭环、弹层、接口打桩），
  你本地跑之前先看 `GET /health/deps`
- `docs/**` —— 设计、接缝审计、给同事的接口需求

## 接缝改动（**动到你文件的地方只有这些，逐条列理由**）

| 你的文件 | 规模 | 为什么 |
|---|---|---|
| `app/v28/core/screen.ts` | +5 | 第二页有四个二级屏（成果列表 / 成果详情 / 维度详情 / 能力画像），路由契约要加这四个名字 |
| `app/v28/core/app-shell.tsx` | +65 −6 | ① 这两页整块**只从一个入口** import（`features/pages24`）；② 挂上那四个二级屏的路由；③ 给 `KnowledgePage` / `ProfilePage` 传 `runtime`（它们的接口层要按当前登录的人取数）；④ 记忆库指向我们的实现 |
| `app/v28/legacy/legacy-ui.tsx` | +79 −46 | ① 三个 import 收成从入口来；② 第四页在 `runtime` 存在时改走我们的组件（勋章与关系图沿用你的数据） |
| `app/v27-7-state.ts` | +40 −4 | 老版本往 localStorage 存过一份**种子身份**（Harisen）。种子清了但老会话还留着，会让"我的 / 编辑资料"显示别人的资料、还会被同步回后端。恢复时**只在值与那份种子完全一致时**丢掉，用户自己改过一个字就完全不动 |
| `app/v27-9.css` / `app/v27-7-tasks-profile.css` | 18 / 4 | 这两页的版式微调（底部栏、卡片文本夹断），都在第二页/第四页范围内 |
| `tests/v277-flow.test.tsx` | +5 −4 | ① 这个测试按**路径**读源码，我们搬了文件，两个路径要跟着改；② 一处文案断言从"今天的新进展"改成我们版本里的"待验证" |

除以上文件外，**没有改你任何业务代码**。

### 被删掉的两个文件（口径已确认：**第二页/第四页以我们这边为准**）

| 删掉 | 为什么 |
|---|---|
| `app/v28/features/knowledge/knowledge-page.tsx` | 这是你原来那份第二页实现，内容整块被 `features/pages24/` 取代 |
| `app/v28/features/profile/profile-page.tsx` | 同上，第四页 |

这两页归我们负责，所以按约定：**它们的实现以 `features/pages24/` 为准**，
你原来那两份就删掉了（仍在 git 历史里，要留档随时能翻）。
我们这边承诺的是：**只动这两页，不动你其余任何页面**（接缝改动见上表，逐条有理由）。

（我们自己的走查截图不进 PR —— 那是 QA 证据，留在我们本地/内测仓库；`.gitignore` 里加了
`docs/证据-*/`。）

## 需要你决定 / 需要你那边加的东西

1. **（必需）`conversation.ensure_personal`**：`我的 Elfred` 那个会话现在**没有任何命令能建出来**
   （全库 0 个会话对象；能建会话的代码只有"好友通过→私聊"和"建群聊"两处），
   而 `message.send` / `draft.save` 都要求先有会话成员。所以第二页的「用它做一件事」
   现在只能退回到"没有会话"这条路。
   我们这边**接口已经写好并用打桩验过**（`tools/page2-checks/skill-launch-contract-check.mjs` 9/9）：
   你加上这条幂等命令，我们一行都不用改就会通。详见
   `docs/给同事的接口需求-个人agent会话-20260925.md`。
2. **（可选）skill 形态的只读加载点**：让执行器能读到用户自己产出的 skill
   （现在步骤与规矩是通过任务的 `constraints` 带过去的，这一半已经通）。见
   `docs/什么才算产出一条skill-20260925.md`。
3. **上游要起三个**：EMOS(8200) · Skill Foundry(8765) · PA 网关(8790)。
   注意团队仓库里的 `scripts/restart-gateway.ps1` 会失败 —— 它写死用
   `services/elfred-pa-gateway/.venv/Scripts/python.exe`，而那个 `.venv` 不存在；
   直接 `python -m uvicorn app.main:app --port 8790` 在那个目录下起就可以。

## 空态口径（交付口径）

新账号进第二页/第四页看到的是：能力卡组"还没替你干过活" · 知识库"今天还没有沉淀" ·
理解度是起点值 · 第四页"点右侧「编辑资料」写下你是谁"。
后端 `SEED_ON_START=false`，`skills-out/` 里不放任何演示 skill；
「理解度」这个名字只叫理解度（不要换成别的字）。

## 怎么验

```bash
npm test && npm run test:runtime            # 你的测试
npx tsc --noEmit                            # 类型
node tools/page2-checks/full-sweep-pages24.mjs   # 这两页 21 屏走查 + 截图
# 其余探针见 app/v28/features/pages24/README.md
```

## 已知边界（没做的，不是漏了）

- 「陈旧 skill 要不要更新」的问句：后端能算出来（`/page2/skill-triggers`），界面**还没接**。
- Jev 切主（M6）：影子数据表明分歧是**单向漏记**（`/health/deps` 里的 `missed/overcaught`），
  还在 shadow，没切。

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

### 2026-09-26 追加：五维能力与那份「轻量测试」的口径（改了，麻烦按这版）

新用户进第二页看到的能力洞察是**空态**（只有「开始测试」），**不是**一张全是 0 /
全是"未知"的五维图。答完那份测试 → 立刻有一张**起点图**（22–52，偏低）+ 一个**综合分**；
之后按真实表现更新：做出成果往上走，**被指正 / 判错 / 长期不用会回落**。

- **起点计入综合分**：不再有"自评不计入综合分"这套（上一版有，已删）。雷达只有一种画法，
  说明只留一句「起点来自那次测试 / X 已经按真实成果动过」。
- 题库换成 **IPIP（公有领域）16 题 + 自研「判断」6 题 = 22 题**，正反向项各半（13 正 / 9 反）。
- 接口：`GET/POST /page2/questionnaire`；`/insight/abilities` 每维多了
  `source`（`baseline` / `growing` / `evidence` / `insufficient`）与 `started`。
- 新增探针 `tools/page2-checks/questionnaire-check.mjs`（24/24，跑完自己清数据），
  算法自测见后端仓库 `tools/dimension_selftest.py`。

### （原来的空态口径，仍然有效）

新账号进第二页/第四页看到的是：能力卡组"还没替你干过活" · 知识库"今天还没有沉淀" ·
理解度是起点值 · 第四页"点右侧「编辑资料」写下你是谁"。
后端 `SEED_ON_START=false`，`skills-out/` 里不放任何演示 skill；
「理解度」这个名字只叫理解度（不要换成别的字）。

### 2026-09-26 追加：第四页最左边那栏改成「Agent 动态」

### 2026-09-26 再追加：第四页身份区重做 + 设置页换成我们的（**又动了 4 处接缝**）

**首页（第四页）身份区**：原来 hero 是 385px 写死 + 三个 `opacity:0.001` 的隐形热区（照 402×867 的贴图量的），
现在按内容撑开：封面 168 → 头像 88 压在封面下沿 → 名字/账号（遮蔽）/简介/标签 → **数字条**
（成果·能力卡·勋章·理解度，都能点）→ 编辑资料 + 分享一行。封面右上角那颗「设置背景」提示
换成了真按钮「设置」。依据与取舍见 `docs/调研-个人页与设置-20260926.md`。

**新动的接缝（逐条）**：

| 你的文件 | 改动 | 为什么 |
|---|---|---|
| `app/v27-7-tasks-profile.css` | hero/body 改成自适应高度；删掉 `.v277-profile-hero button{position:absolute;opacity:0}` | 那条规则把这一屏所有按钮变成隐形热区，不改它没法做正常布局 |
| `app/v27-8-final-pass.css` | `.v277-profile-hero{height:385px!important}` → `auto`；删掉三个隐形热区的 `opacity:0.001!important` | 同上（`!important` 会压过我们 module 里的新样式） |
| `app/v27-9.css` | 末尾追加编辑资料页的一小段（头像/封面空态/标题层级/用户名说明） | 那一屏是公共组件，样式归这两页 |
| `app/v28/core/app-shell.tsx` | `settings` 路由改指我们的 `SettingsPage`；props 收窄为 `state/go/logout/runtime` | 原来的设置入口是隐形热区，用户根本不知道有设置 |

**（同日再补）编辑资料页也换成我们的** —— 又多一处接缝改动：

| `app/v28/core/app-shell.tsx` | `profile-edit` 路由改指我们的 `ProfileEditPage`（props：`state/setState/go/onBack/notify/runtime`） | 老那版字段全挤在一页、顶部一个"总保存"，改完忘点保存就白改；现在是"点一个字段 → 单独编辑 → 保存即落库"（小红书/微信都是这个做法），依据见调研文档 §11.6 |

另外**我们后端**（另一个仓库 `elfred-page2-api`）的 `/page2/profile` 加了 `showLevel` 一个字段（KV 白名单里），
用来存"主页要不要显示等级与理解度"——因为老那版那个开关其实是个**死开关**（没人读它）。

**设置页（我们自己那份）**：本人卡片 + 6 组（账号与身份 / Elfred 对我的理解 / 隐私与授权 / 数据与额度 /
使用偏好 / 帮助与反馈）+ 页脚；**只读行不做成按钮**；退出登录二次确认。
面板里的**真命令仍然是你的**（`ConnectedSettings`）——我们只做分组和文案。
新增一栏「上游服务状态」，读我们后端 `/health/deps`，把 EMOS / Skill Foundry / 网关 / Jev 的实时状态摆给用户看
（顺手把那三个探测改成并发，7s → 4s）。

原来那栏叫「动态」，内容是我们后端把"成果 + 记忆"合并出来的流。现在改成 **Agent 动态**：
**内容就是你那个「Agent 朋友圈」的数据**（`runtime.snapshot.objects.feed`，同一份，不另存副本），
第四页只做**总览** —— 标题行（"来自五个 Agent 的最新动态 · 共 N 条"）+ 最近 3 条，
点「查看全部」去朋友圈、点某一条去它的详情页（`feed-detail`）。

- **没有动你的代码**：只读 `runtime` 里的 feed 对象，跳转走你已有的 `feed` / `feed-detail` 两个屏。
- 隐藏过的动态（`state.hiddenPostIds`）在第四页也照样不显示（和朋友圈一致）。
- 一条都没有时给空态 +「去朋友圈看看」，**不拿 `agentMoments` 那份演示数据顶**。
- 我们自己单独跑的那份（没有 runtime）退回原来的"成果 + 记忆"流，所以后端 `/page2/feed` 留着。

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

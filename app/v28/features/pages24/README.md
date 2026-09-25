# 第二页 / 第四页（我们负责的模块）

一个自包含模块：**只要认这个目录和它的入口 `index.ts`**，就能改这两页。

## 目录

| 目录 | 放什么 |
|---|---|
| `api/` | 跟后端说话 + 本地状态：`page2-api.ts`（接口客户端、身份头）、`page2-store.ts`（本地裁定/固化卡）、`skill-launch.ts`（「用它做一件事」）、`task-draft.ts` |
| `data/` | 前端数据层：`knowledge-data.ts`（真数据到了就地替换演示数据）、`memory-data.ts` |
| `parts/` | 可复用组件：能力卡弹层、理解度弹层、雷达图、勋章、页头 |
| `screens/` | 页面级：第二页、第四页，以及四个二级屏（维度/能力画像/成果列表/成果详情） |
| `styles/` | CSS Modules |

**入口只有一个**：`index.ts`。别人的代码（`core/app-shell.tsx`、`core/page2-identity.tsx`、
`legacy/legacy-ui.tsx`）只从它 import。

## 后端

这两页的数据来自一个**独立的后端服务**（`elfred-page2-api`，默认 `http://127.0.0.1:8000`），
和 EMOS、Skill Foundry 一样是单独进程。它有清晰的分层：

| 层 | 干什么 |
|---|---|
| `api/` | 接口（一组路由一个文件，九个） |
| `services/` | 领域服务（卡的分数/等级重算、桥接、任务契约） |
| `core/` | 运行期常量与身份 |
| `clients.py` | 上游集成：EMOS / Skill Foundry / 网关 |

### 身份怎么传

后端按请求头 `X-Elfred-User` 认人（`core/identity.py`），**没带就退回 `DEMO_USER_ID`** ——
所以老的脚本、curl、探针不带这个头时行为完全不变。
前端由 `core/page2-identity.tsx` 把当前登录的 handle 推给 `api/page2-api.ts`，每个请求带上它。

### 上游依赖（三条，缺谁都会如实降级、不会编数据）

| 上游 | 默认地址 | 缺了会怎样 |
|---|---|---|
| EMOS 记忆中枢 | 8200 | 记忆库为空、契约里召回不到记忆 |
| Skill Foundry | 8765 | 指正产出的 skill 退回本地写盘（`via=local`），**不冒充** Foundry 的产物 |
| PA 网关 | 8790 | skill 卡的分算不出来 |

`GET /health/deps` 一次列清这三条的死活 —— **动这两页之前先看它**。

## 空态

新账号进这两页看到的是"待设置 / 待发生"：能力卡组是"还没替你干过活"、
知识库是"今天还没有沉淀"、理解度是起点值、第四页是"点右侧编辑资料写下你是谁"。
**不种任何样板数据**（`SEED_ON_START=false`），也不放演示 skill。

## 怎么验

```bash
node tools/page2-checks/full-sweep-pages24.mjs        # 21 屏全量走查 + 截图
node tools/page2-checks/identity-check.mjs            # 身份按用户分开取数
node tools/page2-checks/bridge-check.mjs              # 他那边验收 → 这边长成果
node tools/page2-checks/loop-check.mjs                # 指正 → 规矩 → 下次契约带着它
node tools/page2-checks/sheet-footer-check.mjs        # 弹层底部栏不被裁
node tools/page2-checks/skill-launch-contract-check.mjs  # 「用它做一件事」的接口（打桩）
```

# 第二页 / 第四页 真机检查脚本

这些是"前端 ↔ 后端闭环"的**真机验证脚本**（Playwright，跑无头 Edge）。
以前它们只躺在 `%TEMP%` 里，别人没法重跑；现在收进仓库，谁都能复现。

## 跑之前要满足

1. **后端在跑**：`elfred-page2-api`（有数据版 8000；空库预览版 8001）
2. **前端在跑**：仓库根目录 `npm run dev -- --port 5182`
3. **前端指向要对**：起 dev 时用 `NEXT_PUBLIC_PAGE2_API` 指定后端，例如
   `$env:NEXT_PUBLIC_PAGE2_API="http://127.0.0.1:8000"; npm run dev -- --port 5182`
4. **装 Playwright（不要动仓库的依赖清单）**：在**仓库根目录**执行

   ```powershell
   npm i --no-save playwright
   ```

   ⚠️ 一定要带 `--no-save`：**不带它会把 playwright 写进产品自己的 `package.json` / `package-lock.json`**
   （我第一次就踩了，等于给产品加了个依赖，后来用 `git checkout -- package.json package-lock.json` 回退了）。
   它只装进 `node_modules`（已被 `.gitignore` 的 `/node_modules` 忽略），脚本从根解析依赖。
   脚本用的是系统已装的 Edge（`channel: "msedge"`），不额外下载 Chromium。

## 每个脚本干什么

| 脚本 | 验什么 | 期望 |
|---|---|---|
| `page2-integration.mjs` | 第二页读的是不是后端真数据（卡片标题命中率、综合分、成果条数） | 命中接口卡片标题 ≥1；页面无报错 |
| `page2-profile-check.mjs` | 第四页：英雄区是否显示后端资料、动态是否渲染后端 feed | 「显示的是后端资料名：true」「动态 10/10」 |
| `page2-profile-edit-probe.mjs` | **编辑资料 → 真的落库**（改名 → 保存 → 返回 → 查 `/page2/profile`） | 末行 `落库成功：true` |
| `page2-memory-probe.mjs` | 记忆库读路径（条数/天数/可信度与 `/memory` 一致）；预留入口是否已隐藏 | 「有『已确认的记忆』：true」 |
| `page2-run-probe.mjs` | 卡片「真跑一次」（**预留功能，默认隐藏**，仅当 `SHOW_RESERVED_ACTIONS=true` 时有意义） | 页面报「跑通了一次…分数已更新」 |
| `page2-offline-probe.mjs` | 后端够不着时是否**显式**标出「演示数据」 | 「页面出现『演示数据』：true」 |
| `page2-hidden-check.mjs` | 两个预留入口（记忆体检 / 真跑一次）**确实不展示** | 两行都是 `false` |
| `page2-field-alignment.mjs` | **前端 `Live*` 类型 ↔ 后端真实返回字段** 的对齐 diff | `RESULT: ALIGNED`（发现"前端声明了后端没有"就退出非 0） |

## 一条命令跑全部

```powershell
node tools\page2-checks\run-all.mjs
```

它会先探后端(8000)与前端(5182)在不在，然后依次跑：字段对齐 → 两个入口隐藏 → 编辑资料落库 → 第四页读真数据；
**任何一项不符就退出非 0**。需要特殊配置的那条（离线降级要把前端指到关着的端口）会**跳过并告诉你怎么单跑**，不会假装跑过。

## 用法

```powershell
cd <仓库根>
npm i playwright                     # 第一次
node tools\page2-checks\page2-profile-edit-probe.mjs
```

脚本里的 `PAGE2_API` 默认 `http://127.0.0.1:8000`；要打空库就 `$env:PAGE2_API="http://127.0.0.1:8001"`。
截图默认写到 `%TEMP%\elfred-poc\integration-0924\`。

## 注意

- 脚本会**真跑一遍 onboarding**（欢迎页 → 验证码随便填 6 位 → 个人信息 → Agent 团队 → 进入首页），
  因为它每次都是全新的浏览器上下文（没有 localStorage）。导航要按 `aria-label` 点
  （底部导航是图标 + aria-label，没有文字：`aria=首页/知识/消息/我的`）。
- `page2-run-probe.mjs` 会真的调模型产出并写一条成果（会改卡片分数），只在需要时跑。

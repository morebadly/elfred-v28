# Windows 本地运行

工作目录：`D:\软工任务\elfred-v28-modular\Elfred-V28`。已在 Node 24.15 验收，依赖原生 `node:sqlite`。

```powershell
npm run dev:local
```

打开 `http://127.0.0.1:3000/v28`。该命令同时启动 Next 界面、业务 API、SQLite 和执行 Worker。单独启动普通 Next 或旧 Sites/Vinext 前端不会提供本地业务 API。

构建后的本地运行：先停止开发服务，再执行：

```powershell
npm run build:local
npm run start:local
```

默认监听 `127.0.0.1:3000`，数据存放于 `.elfred-data/elfred.sqlite`。`ELFRED_PORT` 修改端口；`ELFRED_DATA_DIR` 指定数据目录。数据库、会话、`.env.local` 已被 Git 忽略。

服务器通过反向代理访问时，设置 `ELFRED_PUBLIC_ORIGIN` 为真实访问源，例如 `https://elfred.example`；Nginx 必须保留客户端 Host。生产模式根路径 `/` 跳转 `/v28`。服务器替换流程见 [PR #2 合并与服务器部署记录](./PR2-MERGE-AND-DEPLOY.md)。

## 模型配置

在根目录创建 `.env.local`，填写供应商实际参数：

```dotenv
ELFRED_MODEL_BASE_URL=https://your-provider.example/v1
ELFRED_MODEL_NAME=your-model-name
ELFRED_MODEL_API_KEY=your-secret-key
```

BASE_URL 为兼容 Chat Completions 的 API 根地址，服务端追加 `/chat/completions`。仅允许 HTTPS 或本机 HTTP。重启后，在任务详情同意发送所选目标/资料，再确认和启动。密钥不返回浏览器。

未配置时，本地资料、检索、人工待办、关系消息和静态共创可用。模型超时/中断可能已产生供应商费用，系统保留预留额度，需依据真实记录对账。界面的本地配额不是人民币费用。

## 备份和恢复

运行中可创建一致性备份，并执行完整性检查：

```powershell
node scripts/backup-local.mjs
```

脚本输出文件路径，也可传入一个尚不存在的目标文件路径。

恢复前，在启动终端用 Ctrl+C 正常停止服务。确认备份路径后执行：

```powershell
node scripts/restore-local.mjs "D:\备份\elfred-backup.sqlite" --confirm
npm run dev:local
```

恢复脚本拒绝运行中的服务、损坏备份及不支持的数据库版本；原数据库及 WAL/SHM 保留为 `.before-restore-时间戳`。备份包含本地全部账号，应按私有数据保管。

## 校验

```powershell
npm test
npm run test:runtime
npx tsc --noEmit
npm run lint
npm run build:local
```

`tests/elfred` 使用隔离数据库和测试 Provider，不调用付费模型或改写开发数据库。浏览器联调账号与项目以“验收”命名，属于本地测试数据，不代表用户的真实好友或互联网内容。

实现与依赖范围见 [IMPLEMENTATION.md](./IMPLEMENTATION.md)。

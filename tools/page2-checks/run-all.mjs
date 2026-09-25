// 一条命令跑完全部真机检查：每项都带"期望出现的那行"，任何一项不符就退出非 0。
//
// 用法：node tools/page2-checks/run-all.mjs          （后端 8000 + 前端 5182 都要在跑）
// 说明：离线降级那条需要把前端指到一个关着的端口，所以默认跳过，只提示怎么单跑。

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const FRONTEND = process.env.PAGE2_FRONT || "http://localhost:5182";

const CHECKS = [
  { name: "字段对齐（前端类型 ↔ 后端返回）", script: "page2-field-alignment.mjs", expect: /RESULT: ALIGNED/ },
  { name: "两个预留入口确实不展示", script: "page2-hidden-check.mjs",
    expectAll: [/还有『体检一遍』吗：false/, /还有『真跑一次』吗：false/] },
  { name: "编辑资料 → 真的落库", script: "page2-profile-edit-probe.mjs", expect: /落库成功：true/ },
  { name: "第四页读后端资料与动态", script: "page2-profile-check.mjs", expect: /显示的是后端资料名：true/ },
];

const SKIP = [
  { name: "后端够不着时显式标『演示数据』", script: "page2-offline-probe.mjs",
    why: "需要把前端指到关着的端口（NEXT_PUBLIC_PAGE2_API=http://127.0.0.1:8099 再起 5182）" },
];

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

if (!(await reachable(`${API}/health`))) {
  console.log(`❌ 后端没在跑（${API}/health 不通）——先把 elfred-page2-api 起起来`);
  process.exit(1);
}
if (!(await reachable(FRONTEND))) {
  console.log(`❌ 前端没在跑（${FRONTEND} 不通）——先 npm run dev -- --port 5182`);
  process.exit(1);
}

let failed = 0;
for (const check of CHECKS) {
  const result = spawnSync(process.execPath, [path.join(HERE, check.script)], {
    encoding: "utf8", env: { ...process.env, PAGE2_API: API },
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const expectations = check.expectAll ?? [check.expect];
  const missed = expectations.filter((pattern) => !pattern.test(output));
  const ok = result.status === 0 && missed.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${check.name}（${check.script}）`);
  if (!ok) {
    console.log(`     exit=${result.status} 没出现的期望：${missed.map(String).join(" / ") || "（退出码非 0）"}`);
    console.log("     末尾输出：" + output.trim().split("\n").slice(-3).join(" | "));
  }
}

for (const item of SKIP) {
  console.log(`⏭️  ${item.name}（${item.script}）：默认跳过 —— ${item.why}`);
}

console.log(`\nRESULT: ${failed === 0 ? "ALL PASSED" : `${failed} 项没过`}`);
process.exit(failed === 0 ? 0 : 1);

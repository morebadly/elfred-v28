// 用**我自己的 DS key** 跑通同事那条 AI 链路：注册 → 建任务 → 确认 → 起跑 → 等回执。
// 目的：确认整合版里"要用到模型"的部分是真的能出东西，不是只到"已配置"。
//
// 用法： node tools\page2-checks\integration-ai-run.mjs
// 前置：他的本地服务在跑（npm run dev:local，带 .env.local 里的 ELFRED_MODEL_*）

const BASE = process.env.ELFRED_BASE || "http://127.0.0.1:3100";
const API = `${BASE}/api/elfred`;
const handle = `ai${Date.now() % 100000}@example.com`;
const password = "elfred-test-2026";

let cookie = "";
let csrf = "";

// 他的 /commands 要求带 Idempotency-Key（缺了直接 400 IDEMPOTENCY_REQUIRED）
const command = (action, input) =>
  call("/commands", { action, input }, { "Idempotency-Key": crypto.randomUUID() });

async function call(path, body, extraHeaders = {}) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      // 他的入口对非 GET 请求要求：Origin 必须等于服务端 origin，且带 x-elfred-client: 1
      // （Node 的 fetch 默认不发 Origin，少这个头就是 403 CSRF_REJECTED —— 实测踩到）
      ...(body === undefined ? {} : { "Content-Type": "application/json", "X-Elfred-Client": "1", Origin: BASE }),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON */
  }
  return { status: res.status, json, text: text.slice(0, 300) };
}

console.log(`【1】注册 ${handle}`);
let r = await call("/auth/register", { handle, password, name: "AI 冒烟" });
console.log(`    status=${r.status} ${r.status === 200 ? "✅" : "❌ " + r.text}`);
if (r.status !== 200) process.exit(1);

console.log("【2】取 session / csrf");
r = await call("/session");
csrf = r.json?.csrf || "";
console.log(`    user=${r.json?.user?.handle} csrf=${csrf ? "有" : "无"} ${csrf ? "✅" : "❌"}`);

console.log("【3】读 bootstrap，看模型状态");
r = await call("/bootstrap");
const provider = r.json?.provider || {};
console.log(
  `    provider.configured=${provider.configured} model=${provider.model} judge=${provider.judge} jev=${provider.jev}`,
);

const goal = "用一两句话说明：为什么把长文档提炼成要点对做产品的人有用。";
console.log("【4】建任务（内置能力 explore-0 调研）");
r = await command("task.create", {
  goal, system: "explore", capability_id: "explore-0", mode: "compose", review_mode: "auto", source_refs: [],
});
const taskId = r.json?.id;
console.log(`    status=${r.status} task=${taskId} ${taskId ? "✅" : "❌ " + r.text}`);
if (!taskId) process.exit(1);

console.log("【5】确认任务（带模型授权）");
r = await call(`/objects/${taskId}`);
let version = r.json?.version;
r = await command("task.confirm", { id: taskId, version, confirm: true, model_consent: true });
console.log(`    status=${r.status} ${r.status === 200 ? "✅" : "❌ " + r.text}`);

console.log("【6】起跑");
r = await call(`/objects/${taskId}`);
version = r.json?.version;
r = await command("run.start", { id: taskId, version });
console.log(`    status=${r.status} ${r.status === 200 ? "✅" : "❌ " + r.text}`);

console.log("【7】等回执（最多 120 秒）");
let output = null;
let status = "";
for (let i = 1; i <= 40; i++) {
  await new Promise((s) => setTimeout(s, 3000));
  const snap = await call("/bootstrap");
  const task = (snap.json?.objects?.task || []).find((t) => t.id === taskId);
  status = String(task?.data?.status || "");
  const run = (snap.json?.objects?.run || []).find((x) => x.id === task?.data?.run_id);
  const receipts = (run?.data?.receipts || []).filter((x) => x.phase !== "review" && typeof x.output === "string");
  if (receipts.length) output = receipts[receipts.length - 1].output;
  process.stdout.write(`\r    ${i * 3}s  任务=${status}  回执=${receipts.length} 条   `);
  if (output || ["failed", "blocked", "cancelled", "awaiting_acceptance", "completed"].includes(status)) break;
}
console.log("");

if (output) {
  console.log("\n===== 模型真的产出了 =====\n");
  console.log(output.slice(0, 700));
  console.log("\nRESULT: 模型链路跑通 ✅");
} else {
  console.log(`\nRESULT: 没拿到产出 ❌（任务状态=${status}）`);
  process.exit(1);
}

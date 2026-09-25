// 闭环专项：**"做事 → 指正 → 变成能力与记忆 → 下次按它做"** 这条链真的转起来没有。
//
// 为什么单写一个：桥接原来只做了"验收 → 记一条成果"（事后记账），
// 循环里真正承重的两半是空的 —— 指正没进记忆、也没变成能力的规矩。
// 这个脚本走真实链路去验那两半，并且**再取一次契约**，证明下次确实按新规矩来。
//
// 用法：node tools\page2-checks\loop-check.mjs
import { mkdirSync } from "node:fs";

const BASE = process.env.ELFRED_BASE || "http://127.0.0.1:3100";
const API = `${BASE}/api/elfred`;
const P2 = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/loop";
const PW = "elfred-test-2026";
const handle = `lp${Date.now() % 100000}@example.com`;
const FEEDBACK = "讲这类题要逐句展开推导，不许跳步，答案要带单位。";
// 前端点「用它做一件事」时手里是**卡片标题**（不是 skill 目录名），所以这里也按标题问 ——
// 和真实调用路径一致，否则测的是另一条路。
const SKILL = "执行规划";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};

let cookie = "", csrf = "";
async function call(path, body, extra = {}) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json", "X-Elfred-Client": "1", Origin: BASE }),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; }
  catch { return { status: res.status, json: null, text: text.slice(0, 240) }; }
}
const command = (action, input) =>
  call("/commands", { action, input }, { "Idempotency-Key": crypto.randomUUID() });

async function mine(path, init = {}) {
  const res = await fetch(`${P2}${path}`, { ...init, headers: { "X-Elfred-User": handle, ...(init.headers || {}) } });
  if (!res.ok) return null;
  return res.json();
}
const sync = () => fetch(`${P2}/page2/bridge/sync`, { method: "POST" }).then((r) => r.json());

console.log(`【1】注册 ${handle}`);
let r = await call("/auth/register", { handle, password: PW, name: "闭环冒烟" });
check("注册成功", r.status === 200, String(r.status));
csrf = (await call("/session")).json?.csrf || "";

console.log("【2】先用「执行规划」这条能力做一件事（走契约）");
const contract0 = await mine("/page2/contract?skill=" + encodeURIComponent(SKILL) + "&goal=" + encodeURIComponent("把会议结论整理成待办"));
// 新账号还没产出过 `execute-0` 这条能力，所以第一次拿不到契约是**对的**（如实说没有，
// 不能假装按一条不存在的 skill 做）。能拿到当然更好；两种都不算错，后面才验"指正之后有了"。
check("契约要么给得出、要么如实说没有这条能力",
      Boolean(contract0?.ok) || contract0 === null || contract0?.skill === null || contract0?.ok === false,
      JSON.stringify({ ok: contract0?.ok, skill: contract0?.skill?.title ?? null }));
const rulesBefore = contract0?.skill?.rules?.length || 0;

const goal = `把这份会议记录整理成待办清单（${Date.now() % 100000}）`;
const created = await command("task.create", {
  goal, criteria: contract0?.criteria, constraints: contract0?.constraints,
  mode: "compose", system: contract0?.system || "execute",
});
const taskId = created.json?.id;
check("任务建出来了", Boolean(taskId), created.text || String(created.status));
let version = (await call(`/objects/${taskId}`)).json?.version;
await command("task.confirm", { id: taskId, version, confirm: true, model_consent: true });
version = (await call(`/objects/${taskId}`)).json?.version;
await command("run.start", { id: taskId, version });

console.log("【3】等回执");
let runId = "";
for (let i = 0; i < 40; i++) {
  await new Promise((s) => setTimeout(s, 3000));
  const snap = await call("/bootstrap");
  const task = (snap.json?.objects?.task || []).find((t) => t.id === taskId);
  runId = task?.data?.run_id || "";
  const run = (snap.json?.objects?.run || []).find((x) => x.id === runId);
  if ((run?.data?.receipts || []).some((x) => typeof x.output === "string" && x.output.trim())) break;
}
check("模型产出了回执", Boolean(runId), runId ? `run=${runId.slice(0, 8)}` : "没有 run");

console.log("【4】他**不认这次的结果**，写下指正");
const task = (await call(`/objects/${taskId}`)).json;
r = await command("task.accept", { id: taskId, version: task?.version, accept: false, feedback: FEEDBACK });
check("驳回+指正被记下", r.status === 200, `status=${r.status}`);

console.log("【5】跑桥接，看指正有没有变成「规矩 + 记忆」");
const stats = await sync();
// 按新规则，第一次指正**不该**产出规矩（这条能力只做过 1 次），只进记忆当原料。
// 真正的固化在第 5b 步（做到第 2 次）验。
check("第一次指正没有直接固化出规矩", (stats?.memory?.rules || 0) === 0,
      JSON.stringify(stats?.memory || {}));

const contract1 = await mine("/page2/contract?skill=" + encodeURIComponent(SKILL) + "&goal=" + encodeURIComponent("再整理一份待办"));
const rulesAfterFirst = contract1?.skill?.rules || [];
// **新规则**：同一条能力做过 < 2 次时，指正只作为"记忆的原料"记进去，**不产 skill** ——
// 一次只是事件，重复出现才算"做法"。原来一次指正就固化，于是"随便做一件事就有 skill"。
check("第一次指正不产 skill（这条能力只做过 1 次）",
      rulesAfterFirst.length === rulesBefore, `${rulesBefore} → ${rulesAfterFirst.length} 条`);
const memo1 = await mine("/page2/memory");
check("但这次指正进了记忆（作为原料）", (memo1?.memoryCount || 0) >= 1, `记忆 ${memo1?.memoryCount} 条`);

console.log("【5b】同一条能力做第 2 次 → 这时才该固化出 skill");
const goal2 = `再整理一份会议待办（${Date.now() % 100000}）`;
const created2 = await command("task.create", {
  goal: goal2, criteria: contract1?.criteria, constraints: contract1?.constraints,
  mode: "compose", system: contract1?.system || "execute",
});
const task2 = created2.json?.id;
let v2 = (await call(`/objects/${task2}`)).json?.version;
await command("task.confirm", { id: task2, version: v2, confirm: true, model_consent: true });
v2 = (await call(`/objects/${task2}`)).json?.version;
await command("run.start", { id: task2, version: v2 });
for (let i = 0; i < 40; i++) {
  await new Promise((s) => setTimeout(s, 3000));
  const snap = await call("/bootstrap");
  const t = (snap.json?.objects?.task || []).find((x) => x.id === task2);
  const run = (snap.json?.objects?.run || []).find((x) => x.id === t?.data?.run_id);
  if ((run?.data?.receipts || []).some((r) => typeof r.output === "string" && r.output.trim())) break;
}
const t2 = (await call(`/objects/${task2}`)).json;
await command("task.accept", { id: task2, version: t2?.version, accept: false, feedback: FEEDBACK });
await sync();
const contract2 = await mine("/page2/contract?skill=" + encodeURIComponent(SKILL) + "&goal=" + encodeURIComponent("再整理一份待办"));
const rulesAfter = contract2?.skill?.rules || [];
check("做到第 2 次才固化出规矩", rulesAfter.length > rulesBefore, `${rulesBefore} → ${rulesAfter.length} 条`);
check("规矩就是他说的那句话", rulesAfter.some((x) => String(x).includes("不许跳步")), rulesAfter.join("；"));
check("**下次的契约里带着这条新规矩**（循环合上了）",
      String(contract2?.constraints || "").includes("不许跳步"), String(contract2?.constraints || "").slice(0, 90));

console.log("【6】他显式确认过的一条理解，也应该进记忆中枢");
const mem = await command("memory.create", { content: "我在准备概率论补考，考完之前优先做习题。", scope: "execute", risk: "high" });
const memoryId = mem.json?.id;
if (memoryId) {
  const entity = (await call(`/objects/${memoryId}`)).json;
  await command("memory.decide", { id: memoryId, version: entity?.version, decision: "confirm" });
}
await sync();
const written = await mine("/page2/memory");
check("记忆中枢里有这个人的记忆", (written?.memoryCount || 0) >= 1, `count=${written?.memoryCount}`);
check("记忆内容就是他确认的那句",
      JSON.stringify(written?.memories || []).includes("概率论补考"),
      JSON.stringify(written?.memories || []).slice(0, 140));

const bad = results.filter((x) => !x.ok);
console.log(`\n${bad.length ? "❌ FAILED" : "✅ ALL PASSED"}  ${results.length - bad.length}/${results.length}`);
if (bad.length) {
  bad.forEach((b) => console.log(`   - ${b.name}: ${b.detail}`));
  process.exit(1);
}

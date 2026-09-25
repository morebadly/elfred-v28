// 演示场景的验收：**页面开着不动**，在同事那边做完一件事并验收，第二页会不会自己长出来。
//
// 这条链是三个后台动作接起来的，任何一环断了都会"看着像没通"：
//   他那边验收 → 我后端后台任务扫到（默认 20 秒一趟）→ 前端下一次刷新重拉（跟着他的 server_time）
// 所以这里故意**不刷新页面、不点任何东西**，只看 DOM 自己变不变。
//
// 用法：node tools\page2-checks\page2-live-sync.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.ELFRED_BASE || "http://127.0.0.1:3100";
const API = `${BASE}/api/elfred`;
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/live-sync";
const PW = "elfred-test-2026";
const handle = `lv${Date.now() % 100000}@example.com`;
const goal = "把这三条会议结论整理成待办清单，标出负责人。";
mkdirSync(OUT, { recursive: true });

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
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; }
  catch { return { status: res.status, json: null, text: text.slice(0, 200) }; }
}
const command = (action, input) =>
  call("/commands", { action, input }, { "Idempotency-Key": crypto.randomUUID() });

await call("/auth/register", { handle, password: PW, name: "实时同步冒烟" });
csrf = (await call("/session")).json?.csrf || "";

const browser = await chromium.launch({ channel: "msedge" });
let ok = false, elapsed = 0;
try {
  const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  console.log(`【1】浏览器登录 ${handle}，停在第二页（之后不再动它）`);
  await page.goto(`${BASE}/v28`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.locator("input:visible").first().fill(handle).catch(() => {});
  await page.locator("button:visible").filter({ hasText: "继续" }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.locator("input[type=password]:visible").first().fill(PW).catch(() => {});
  await page.locator("button:visible").filter({ hasText: /登录并继续|创建账号并继续/ }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.locator("button:visible").filter({ hasText: /稍后继续/ }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator('nav button[aria-label="知识"]').first().click({ timeout: 8000 }).catch(async () => {
    await page.locator("button:visible").filter({ hasText: /^知识$/ }).first().click({ timeout: 8000 }).catch(() => {});
  });
  await page.waitForTimeout(4000);
  const before = await page.evaluate(() => document.body.innerText);
  console.log(`    进页面时是空态：${/还没有这一类能力卡|去和 Elfred 说/.test(before) ? "✅" : "❌"}`);

  console.log("【2】他那边建任务 → 确认 → 起跑 → 等产出");
  const created = await command("task.create", {
    goal, system: "execute", capability_id: "execute-0", mode: "compose", review_mode: "auto", source_refs: [],
  });
  const taskId = created.json?.id;
  let version = (await call(`/objects/${taskId}`)).json?.version;
  await command("task.confirm", { id: taskId, version, confirm: true, model_consent: true });
  version = (await call(`/objects/${taskId}`)).json?.version;
  await command("run.start", { id: taskId, version });
  for (let i = 0; i < 40; i++) {
    await new Promise((s) => setTimeout(s, 3000));
    const snap = await call("/bootstrap");
    const task = (snap.json?.objects?.task || []).find((t) => t.id === taskId);
    const run = (snap.json?.objects?.run || []).find((x) => x.id === task?.data?.run_id);
    if ((run?.data?.receipts || []).some((r) => typeof r.output === "string" && r.output.trim())) break;
  }
  console.log("【3】他那边验收（这一步之后**不再碰页面**）");
  const task = (await call(`/objects/${taskId}`)).json;
  const accepted = await command("task.accept", {
    id: taskId, version: task?.version, accept: true, satisfaction: "satisfied",
  });
  console.log(`    验收状态=${accepted.status}`);

  console.log("【4】盯着页面，等它自己变（最多 120 秒，不刷新、不点击）");
  const started = Date.now();
  for (let i = 1; i <= 40; i++) {
    await new Promise((s) => setTimeout(s, 3000));
    const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
    elapsed = Math.round((Date.now() - started) / 1000);
    process.stdout.write(`\r    ${elapsed}s  `);
    if (text.includes("执行规划") && text.includes(goal.slice(0, 10))) { ok = true; break; }
  }
  console.log("");
  const after = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
  await page.screenshot({ path: `${OUT}/page2-self-updated.png`, fullPage: true });
  console.log(`  ${ok ? "✅" : "❌"} 第二页自己长出来了（用时 ${elapsed}s）`);
  console.log(`  ${errors.length === 0 ? "✅" : "❌"} 页面没有报错 ${errors.join(" / ")}`);
  console.log(`\n页面文字：${after.slice(0, 220)}`);
} finally {
  await browser.close();
}

console.log(`\n${ok ? "RESULT: 实时同步通了 ✅" : "RESULT: 实时同步没通 ❌"}`);
console.log(`截图：${OUT}`);
process.exit(ok ? 0 : 1);

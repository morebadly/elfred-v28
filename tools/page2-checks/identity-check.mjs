// 身份贯通专项巡检：第二/四页读的到底是不是"当前登录这个人"的数据。
//
// 背景（用户实际看到的现象）：不管注册哪个账号，第二页都是同一份演示数据。
// 原因：整合版只接了 UI，没接数据层身份——第二页后端是独立进程，写死了一个用户。
//
// 这个脚本验四件事：
//   1. 前端每个到 :8000 的请求都带上了 `X-Elfred-User`，且值 == 当前登录的 handle；
//   2. 新账号的第二页是**空态**（不是别人的卡），且看不到演示卡的名字；
//   3. A / B 两个账号各自空态、互不串号；
//   4. 不带头的请求（脚本、curl、旧探针）仍然拿到 demo 那份数据——**旧行为没被改掉**。
//
// 用法：node tools\page2-checks\identity-check.mjs
// 前置：整合版在跑（127.0.0.1:3100）+ 我的后端在跑（127.0.0.1:8000）。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { DEMO_HANDLE } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/identity";
const PW = "elfred-test-2026";
const DEMO_CARD = "概率论分步解题";   // demo 那份数据里的一张卡的名字

mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};

async function apiCount(path, handle) {
  const headers = handle ? { "X-Elfred-User": handle } : {};
  const r = await fetch(`${API}${path}`, { headers });
  if (!r.ok) return `HTTP ${r.status}`;
  const body = await r.json();
  return Array.isArray(body) ? body.length : (body?.memories?.length ?? "?");
}

/** 走同事的注册入口，返回这个账号的 handle */
async function register(page, handle) {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const input = page.locator("input:visible").first();
  if (await input.count()) await input.fill(handle).catch(() => {});
  await page.locator("button:visible").filter({ hasText: "继续" }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const toRegister = page.locator("button:visible").filter({ hasText: /首次使用，创建账号/ }).first();
  if (await toRegister.count()) await toRegister.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const pw = page.locator("input[type=password]:visible").first();
  if (await pw.count()) await pw.fill(PW).catch(() => {});
  await page
    .locator("button:visible")
    .filter({ hasText: /创建账号并继续|登录并继续/ })
    .first()
    .click({ timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(4000);
  const skip = page.locator("button:visible").filter({ hasText: /稍后继续/ }).first();
  if (await skip.count()) await skip.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

/**
 * 从**页面一建好**就盯着到 :8000 的请求。
 * ⚠️ 不能等到进第二页才挂监听：身份一变（登录那一刻）第二页就会拉一次数据，
 * 那次才是我们要看的（实测挂在点击前 → 0 条，白测一轮）。
 */
function watchApi(page) {
  const hits = [];
  page.on("request", (r) => {
    if (!r.url().startsWith(API)) return;
    hits.push({ url: r.url().replace(API, ""), user: r.headers()["x-elfred-user"] ?? null });
  });
  return hits;
}

/** 进第二页，回收所有打到 :8000 的请求（含头） */
async function openPage2(page, hits, handle, tag) {
  await page.locator('nav button[aria-label="知识"]').first().click({ timeout: 8000 }).catch(async () => {
    await page.locator("button:visible").filter({ hasText: /^知识$/ }).first().click({ timeout: 8000 }).catch(() => {});
  });
  await page.waitForTimeout(4500);
  const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
  await page.screenshot({ path: `${OUT}/${tag}-page2.png`, fullPage: true });

  const withHeader = hits.filter((h) => h.user);
  // 上游注册时把 handle 归一成小写，后端跟着归一，所以这里按小写比
  const wrong = withHeader.filter((h) => h.user !== handle.toLowerCase());
  check(`${tag}：第二页有打到后端的请求`, hits.length > 0, `${hits.length} 条`);
  check(`${tag}：每个请求都带了身份头`, hits.length > 0 && withHeader.length === hits.length,
        `${withHeader.length}/${hits.length}`);
  check(`${tag}：身份头 == 当前账号`, withHeader.length > 0 && wrong.length === 0,
        wrong.length ? `串号 ${wrong.slice(0, 3).map((w) => w.user).join(",")}` : handle);
  check(`${tag}：第二页是空态，不是演示卡`,
        /还没有这一类能力卡|去和 Elfred 说/.test(text) && !text.includes(DEMO_CARD),
        text.slice(0, 110));
  return text;
}

const browser = await chromium.launch({ channel: "msedge" });
try {
  const stamp = Date.now() % 100000;
  const handleA = `idA${stamp}@example.com`;
  const handleB = `idB${stamp}@example.com`;

  console.log("\n── A 账号 ─────────────────────────────");
  const ctxA = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true });
  const pageA = await ctxA.newPage();
  const hitsA = watchApi(pageA);
  await register(pageA, handleA);
  await openPage2(pageA, hitsA, handleA, "A");
  check("A：后端认为 /capabilities 是 0 张卡", (await apiCount("/capabilities", handleA)) === 0);
  check("A：后端认为 /page2/skills 是 0 条", (await apiCount("/page2/skills", handleA)) === 0);

  console.log("\n── B 账号 ─────────────────────────────");
  const ctxB = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true });
  const pageB = await ctxB.newPage();
  const hitsB = watchApi(pageB);
  await register(pageB, handleB);
  await openPage2(pageB, hitsB, handleB, "B");
  check("B：后端认为 /capabilities 是 0 张卡", (await apiCount("/capabilities", handleB)) === 0);

  console.log("\n── 旧行为（不带头的请求）─────────────");
  // ⚠️ 断言口径改过：demo 不再是"一份样板数据"了 —— 样板数据已清、`SEED_ON_START` 也关掉了，
  // 所以这里要验的是**身份回退还成立**（不带头时后端仍按 DEMO_USER_ID 算、请求正常返回），
  // 而不是"demo 必须有多少条数据"。带不带头的差别只该是"按谁算"，不该是"能不能用"。
  const demoUser = await fetch(`${API}/health`)
    .then((r) => r.json()).then((j) => j.user).catch(() => "");
  check("不带身份头 → 后端仍按 DEMO_USER_ID 算", demoUser === DEMO_HANDLE, `user=${demoUser}`);
  const demoCaps = await apiCount("/capabilities", null);
  check("不带头的请求能正常返回（不是报错）", typeof demoCaps === "number", `capabilities=${demoCaps}`);

  await ctxA.close();
  await ctxB.close();
} finally {
  await browser.close();
}

const bad = results.filter((r) => !r.ok);
console.log(`\n${bad.length ? "❌ FAILED" : "✅ ALL PASSED"}  ${results.length - bad.length}/${results.length}`);
if (bad.length) {
  bad.forEach((b) => console.log(`   - ${b.name}: ${b.detail}`));
  process.exit(1);
}

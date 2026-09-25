// 整合版专项巡检：在同事的 app（他的 runtime）里，打开**我负责的第二页 / 第四页**，
// 确认它们照样是我的实现、能渲染、能点开，并且没把同事的家当弄坏。
//
// 用法： node tools\page2-checks\integration-pages24.mjs
// 前置：他的本地服务在跑（npm run dev:local，端口 3100）+ 我的后端在跑（:8000）。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

// ⚠️ 必须 127.0.0.1：他的服务端做 Host 校验，localhost 会被判"无效主机"
const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-p24";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const page = await (
  await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 180)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 180)}`);
});

const shots = [];
let n = 0;
const shot = async (label, wait = 1600) => {
  await page.waitForTimeout(wait);
  n += 1;
  const file = `${String(n).padStart(2, "0")}-${label}.png`;
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  shots.push(file);
  return page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
};

// ── 1. 注册一个本地账号（他的入口）──────────────────────────────
const handle = `qa${Date.now() % 100000}@example.com`;
const pw = "elfred-test-2026";
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.locator("input:visible").first().fill(handle).catch(() => {});
await page.locator("button:visible").filter({ hasText: "继续" }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.locator("button:visible").filter({ hasText: /首次使用，创建账号/ }).first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.locator("input[type=password]:visible").first().fill(pw).catch(() => {});
await page.locator("button:visible").filter({ hasText: /创建账号并继续/ }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(4000);
// 初始化可以"稍后继续"
await page.locator("button:visible").filter({ hasText: /稍后继续/ }).first().click({ timeout: 6000 }).catch(() => {});
const home = await shot("01-home-他的首页", 3000);
const homeOk = /动态|社区|Agent 朋友圈/.test(home);

const results = [];
const say = (k, v) => results.push([k, v]);
say("注册 + 到首页（同事的流程）", homeOk ? "✅" : "❌ " + home.slice(0, 80));

// ── 2. 第二页（我方实现）────────────────────────────────────────
const toKnowledge = page.locator('nav button[aria-label="知识"]').first();
if (await toKnowledge.count()) {
  await toKnowledge.click({ timeout: 8000 }).catch(() => {});
} else {
  await page.locator("button:visible").filter({ hasText: /^知识$/ }).first().click({ timeout: 8000 }).catch(() => {});
}
const p2 = await shot("02-p2-能力库", 3000);
say(
  "第二页 · 是不是我的实现",
  /能力卡组/.test(p2) ? "✅ 出现「能力卡组」（我的版式）" : "❌ " + p2.slice(0, 120),
);
say("第二页 · 卡组里有卡吗", /能力分/.test(p2) ? "✅ 有卡" : "（空态）");

// 能力卡详情（我的 CapabilitySheet）
const card = page.locator(".v277-ability-cards > button").first();
if (await card.count()) {
  await card.click({ timeout: 8000 }).catch(() => {});
  const sheet = await shot("03-p2-能力卡详情", 2200);
  say(
    "第二页 · 卡详情（我的弹层）",
    /使用说明/.test(sheet) ? "✅ 打开且是我的版式" : "❌ " + sheet.slice(0, 120),
  );
  await page.locator('button[aria-label="关闭"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
} else {
  say("第二页 · 卡详情", "⚠️ 没有卡可点（新用户是空态，正常）");
}

// 理解度弹层（我的 UnderstandingSheet，含勋章那一栏）
const chip = page.locator('button[aria-label*="理解度"]').first();
if (await chip.count()) {
  await chip.click({ timeout: 8000 }).catch(() => {});
  const u = await shot("04-p2-理解度", 2200);
  say("第二页 · 理解度弹层", /理解与成长|等级/.test(u) ? "✅ 我的版式" : "❌ " + u.slice(0, 100));
  await page.locator("button").filter({ hasText: /荣誉勋章/ }).first().click({ timeout: 6000 }).catch(() => {});
  const honors = await shot("05-p2-勋章栏", 1800);
  say("第二页 · 勋章栏（读我方 /page2/badges）", /勋章图鉴/.test(honors) ? "✅ " + honors.replace(/\s+/g, " ").slice(0, 90) : "❌ " + honors.slice(0, 100));
  await page.locator('button[aria-label="关闭"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(900);
} else {
  say("第二页 · 理解度弹层", "❌ 找不到入口");
}

// 记忆库（我方 features/memory）
const toMemory = page.locator("button").filter({ hasText: /记忆库/ }).first();
if (await toMemory.count()) {
  await toMemory.click({ timeout: 8000 }).catch(() => {});
  const mem = await shot("06-p2-记忆库", 2600);
  say(
    "第二页 · 记忆库（我的实现）",
    /对你的当前理解|已确认的记忆/.test(mem) ? "✅ 我的版式" : "❌ " + mem.slice(0, 120),
  );
} else {
  say("第二页 · 记忆库", "❌ 找不到入口");
}

// ── 3. 第四页（我方实现）────────────────────────────────────────
const toMine = page.locator('nav button[aria-label="我的"]').first();
if (await toMine.count()) {
  await toMine.click({ timeout: 8000 }).catch(() => {});
} else {
  await page.locator("button:visible").filter({ hasText: /^我的$/ }).first().click({ timeout: 8000 }).catch(() => {});
}
const p4 = await shot("07-p4-我的", 3000);
say("第四页 · 是不是我的实现", /动态/.test(p4) && /能力/.test(p4) && /勋章/.test(p4) ? "✅ 三个页签都在" : "❌ " + p4.slice(0, 120));

// 能力页签 → 点开一张卡（我的能力卡在个人页）
await page.locator("nav.v277-profile-tabs button").filter({ hasText: "能力" }).first().click().catch(() => {});
const ability = await shot("08-p4-能力", 2200);
say("第四页 · 能力栏", /还没有能力卡|Lv\./.test(ability) ? "✅ 正常（新用户空态或列表）" : "❌ " + ability.slice(0, 100));

// 勋章页签 → 荣誉勋章（我的 HonorGallery）
await page.locator("nav.v277-profile-tabs button").filter({ hasText: "勋章" }).first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator("button").filter({ hasText: /成长勋章/ }).first().click({ timeout: 6000 }).catch(() => {});
const ph = await shot("09-p4-荣誉勋章", 2400);
say(
  "第四页 · 荣誉勋章（与第二页同一组件）",
  /勋章图鉴/.test(ph) ? "✅ " + ph.replace(/\s+/g, " ").slice(0, 90) : "❌ " + ph.slice(0, 120),
);

// 编辑资料（我的空态改动）
await page.locator('button[aria-label="返回"]').first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1000);
await page.locator("button").filter({ hasText: /编辑资料/ }).first().click({ timeout: 6000 }).catch(() => {});
const edit = await shot("10-p4-编辑资料", 2200);
const editLeak = ["Harisen", "harisen", "产品负责人"].filter((x) => edit.includes(x));
say(
  "第四页 · 编辑资料空态",
  editLeak.length ? `❌ 还有演示身份：${editLeak.join("/")}` : "✅ 无演示身份",
);

// ── 汇总 ────────────────────────────────────────────────────────
console.log("============ 整合版 · 第二页/第四页巡检 ============");
let bad = 0;
for (const [k, v] of results) {
  if (String(v).startsWith("❌")) bad++;
  console.log(`[${k}]\n    ${v}`);
}
console.log(`\n页面报错：${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 6)) console.log(`   ! ${e}`);
console.log(`\n截图：${OUT}`);
console.log(`共 ${shots.length} 屏`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);

// 第四页（我的）新加的两块，以及"两处勋章必须一样"这条：
//   ① 我的 → 能力：是不是真的把能力卡摆出来了；点开是不是同一个详情弹层
//   ② 我的 → 勋章：勋章名单
//   ③ 第二页 → 理解度 → 荣誉勋章：勋章名单
//   ② 和 ③ 必须**完全一致**（用户要求：第四页的勋章应该和第二页理解度里的一样）
//
// 用法： node tools\page2-checks\profile-ability-honors.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/profile-ability";
mkdirSync(OUT, { recursive: true });
const FILL = process.env.FILL || "用户";

const browser = await chromium.launch({ channel: "msedge" });
const page = await (
  await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  // ⚠️ 用**新注册的一次性账号**并给它建一张卡：`demo` 现在是真的空态（样板数据已清、
  // SEED_ON_START 关掉），而这条探针要验"我的→能力里点开的是同一个弹层"，必须有一张卡。
  const handle = await enterMergedApp(page, { register: true });
  const created = await fetch(`${process.env.PAGE2_API || "http://127.0.0.1:8000"}/capabilities`, {
    method: "POST",
    headers: { "X-Elfred-User": String(handle), "content-type": "application/json" },
    body: JSON.stringify({ title: "勋章探针卡", copyText: "只为验我的页能力栏", type: "Skill", dimension: "交付" }),
  }).then((r) => r.json()).catch(() => null);
  if (created?.id) {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
  }
  return Boolean(created?.id);
}

// 勋章名单：图鉴里的每一枚（名字 + 有没有点亮）
const readMedals = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('[class*="medalGrid"] > div')).map((el) => ({
      name: (el.querySelector("b")?.textContent || "").trim(),
      locked: (el.className || "").includes("medalLocked"),
      progress: (el.querySelector("small")?.textContent || "").trim(),
    })),
  );

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();

// ① 我的 → 能力
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.locator("nav.v277-profile-tabs button").filter({ hasText: "能力" }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-profile-ability.png`, fullPage: true });
const abilityCards = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[class*="cardList"] li')).map((li) =>
    (li.textContent || "").replace(/\s+/g, " ").trim(),
  ),
);

// 点第一张 → 详情弹层
const firstCard = page.locator('[class*="cardList"] li button').first();
let sheetTitle = "";
if (await firstCard.count()) {
  await firstCard.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/02-ability-sheet.png`, fullPage: true });
  sheetTitle = await page.evaluate(
    () => document.querySelector(".v279-capability-sheet h2")?.textContent?.trim() || "",
  );
  await page.locator('button[aria-label="关闭"]').first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);
}

// ② 我的 → 勋章
await page.locator("nav.v277-profile-tabs button").filter({ hasText: "勋章" }).first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator("button").filter({ hasText: /成长勋章/ }).first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/03-profile-honors.png`, fullPage: true });
const profileMedals = await readMedals();
await page.locator('button[aria-label="返回"]').first().click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(1200);

// ③ 第二页 → 理解度 → 荣誉勋章
await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.locator('button[aria-label*="理解度"]').first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.locator("button").filter({ hasText: "荣誉勋章" }).first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/04-knowledge-honors.png`, fullPage: true });
const knowledgeMedals = await readMedals();

const same = JSON.stringify(profileMedals) === JSON.stringify(knowledgeMedals);
console.log("================ 我的页 · 能力 / 勋章 ================");
console.log(`\n【我的 → 能力】${abilityCards.length} 张卡`);
for (const line of abilityCards) console.log(`   · ${line}`);
console.log(`\n【点开的详情弹层】${sheetTitle ? `✅ ${sheetTitle}` : "❌ 没打开"}`);
console.log(`\n【我的 → 勋章】${profileMedals.length} 枚：${profileMedals.map((m) => `${m.name}${m.locked ? "(未点亮)" : ""}`).join(" / ") || "（空）"}`);
console.log(`【第二页 → 理解度 → 荣誉勋章】${knowledgeMedals.length} 枚：${knowledgeMedals.map((m) => `${m.name}${m.locked ? "(未点亮)" : ""}`).join(" / ") || "（空）"}`);
console.log(`\n两处勋章一致：${same ? "✅ 完全一样" : "❌ 不一样"}`);
if (!same) {
  console.log("   我的页 :", JSON.stringify(profileMedals, null, 0));
  console.log("   第二页 :", JSON.stringify(knowledgeMedals, null, 0));
}
console.log(`页面报错：${errors.length}${errors.length ? ` （${errors[0].slice(0, 120)}）` : ""}`);
console.log(`截图：${OUT}`);
await browser.close();
process.exit(same && abilityCards.length > 0 && sheetTitle && errors.length === 0 ? 0 : 1);

// 精确复验两件事：① 记忆库筛选 chip 到底怎么变 ② 卡片详情内容是不是取错了卡
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
import fs from "node:fs";

const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/sweep";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true })).newPage();
const text = () => page.evaluate(() => document.body.innerText);

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

/** 记忆库里"某一组还剩几条"：找组标题后面的"N 条" 或该组区块里的条目数 */
async function groupCounts() {
  return page.evaluate(() => {
    const out = {};
    for (const section of Array.from(document.querySelectorAll("section"))) {
      const title = section.querySelector("h2")?.textContent?.trim() || "";
      if (!["基础", "社交", "习惯", "偏好"].includes(title)) continue;
      const count = section.querySelectorAll("button").length;
      out[title] = count;
    }
    return out;
  });
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
await page.waitForTimeout(2000);
await page.getByRole("button", { name: "记忆库", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2200);

console.log("【记忆库筛选】初始各组可点条目数：" + JSON.stringify(await groupCounts()));
for (const chip of ["基础", "社交", "习惯", "偏好", "全部"]) {
  await page.getByRole("button", { name: chip, exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const counts = await groupCounts();
  console.log(`  点「${chip}」→ ${JSON.stringify(counts)}`);
}
await page.screenshot({ path: `${OUT}/verify2-memory.png`, fullPage: true });

// 卡片详情：分别打开两张卡，比"它能替你做"的内容
// ⚠️ 要用**页面上真的显示**的那两张卡来比：页面卡组画的是 `/page2/skills` 那批，
// 而 `/capabilities` 里还混着早期演示种子卡（机会检索/内容提炼/主动连接）——那些页面上点不到。
const skills = await (await fetch(`${API}/page2/skills`)).json();
const targets = skills.slice(0, 2);
const details = {};
for (const card of targets) {
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
  await page.waitForTimeout(1800);
  const opened = await page.getByText(card.title, { exact: false }).first().click({ timeout: 6000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1800);
  const sheet = await text();
  const replaced = sheet.replace(card.title, "");
  const canDo = /它能替你做([\s\S]{0,120})/.exec(replaced)?.[1]?.replace(/\n+/g, " / ").slice(0, 110) ?? "（没有这一段）";
  details[card.title] = { opened, canDo };
  console.log(`\n【卡片详情】${card.title}（点开=${opened}）`);
  console.log(`   它能替你做：${canDo}`);
  await page.screenshot({ path: `${OUT}/verify2-card-${card.title.slice(0, 6)}.png`, fullPage: true });
}
const first = Object.values(details)[0]?.canDo;
const second = Object.values(details)[1]?.canDo;
console.log(`\n两张卡的"它能替你做"是否相同：${first === second}（相同=共用模板；不同=各卡自己的内容）`);
await browser.close();

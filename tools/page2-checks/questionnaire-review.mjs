// 「题库走查」：把那份轻量测试的 **22 道题原样看一遍** —— 控制台打全量清单，
// 另存两张截图（一道 5 档量表题、一道 3 档情景题），改题库之后肉眼复核用。
//
// 只读：答到第 5 题就退出，**不提交**，所以不会往库里写任何东西（没有起点、没有成果）。
//
// 用法：node tools\page2-checks\questionnaire-review.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/questionnaire-review";
mkdirSync(OUT, { recursive: true });

console.log("【题库清单】来自后端 GET /page2/questionnaire（题目/选项全由后端给）");
const paper = await fetch(`${API}/page2/questionnaire`).then((r) => r.json()).catch(() => null);
if (!paper?.items?.length) {
  console.log("❌ 取不到题目：后端没起？");
  process.exit(1);
}
console.log(`版本 ${paper.version} · ${paper.items.length} 题`);
paper.items.forEach((item, index) => {
  console.log(`  ${String(index + 1).padStart(2)}. [${item.id}] ${item.text}`);
  console.log(`      选项：${item.options.join(" ／ ")}`);
});
console.log(`  note：${paper.note}`);

const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })).newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await enterMergedApp(page, { ready: 3000, register: true });
  await goTab(page, "知识");
  await page.waitForTimeout(3000);
  await page.locator("button:visible").filter({ hasText: "开始测试" }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);

  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
    console.log(`  ${name}: ${text.slice(0, 110)}`);
  };
  // 第 1 题 = IPIP 量表题（5 档）；第 5 题 = 自研「判断」情景题（3 档）
  await shot("1-item-o1-likert");
  for (let step = 0; step < 4; step += 1) {
    const options = page.locator("main button[aria-pressed]");
    const count = await options.count();
    if (count === 0) break;
    await options.nth(Math.floor(count / 2)).click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(200);
    await page.locator("button:visible").filter({ hasText: "下一步" }).first()
      .click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(420);
  }
  await shot("2-item-j1-scenario");
  console.log(`截图：${OUT}`);
} finally {
  await browser.close();
}

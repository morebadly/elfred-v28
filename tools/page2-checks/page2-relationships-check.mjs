// 记忆库 →「查看关系图」这一屏：确认它读的是 /page2/relationships，而不是写死的 Mia/Kevin/Lena。
//
// 用法： node tools\page2-checks\page2-relationships-check.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/relationships";
mkdirSync(OUT, { recursive: true });
const FILL = process.env.FILL || "用户";

const real = await (await fetch(`${API}/page2/relationships`)).json().catch(() => null);
const realNames = (real?.relationships || []).map((r) => r.name);
console.log(`【接口】${API}/page2/relationships → ${realNames.length} 位：${realNames.join("、") || "（空）"}`);

const browser = await chromium.launch({ channel: "msedge" });
const page = await (
  await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
).newPage();

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
// 记忆库（第二页的另一面）
await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.locator("button").filter({ hasText: /记忆库/ }).first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(2500);
// 「查看关系图」
await page.locator("button").filter({ hasText: /查看关系图/ }).first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/relationship-graph.png`, fullPage: true });

const text = await page.evaluate(() => document.body.innerText);
const fake = ["Mia", "Kevin", "Lena", "最近一次联系"].filter((t) => text.includes(t));
console.log(`\n【页面】${text.replace(/\n+/g, " | ").slice(0, 260)}`);
console.log(`\n写死的三个陌生人还在吗：${fake.length ? `❌ 还在 ${fake.join("、")}` : "✅ 没出现"}`);
console.log(`截图：${OUT}/relationship-graph.png`);
await browser.close();
process.exit(fake.length ? 1 : 0);

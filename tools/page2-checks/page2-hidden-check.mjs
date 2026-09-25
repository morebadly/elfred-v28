// 确认两个预留入口"代码留着但不展示"：记忆库无「体检一遍」，卡片面板无「真跑一次」
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";

const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-0924";
const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true });
const page = await context.newPage();

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
await page.waitForTimeout(2500);

// ① 记忆库页
await page.getByRole("button", { name: "记忆库", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2000);
const memText = await page.evaluate(() => document.body.innerText);
console.log("【记忆库】还有『体检一遍』吗：" + memText.includes("体检一遍"));
await page.screenshot({ path: `${OUT}/11-memory-hidden.png`, fullPage: true });

// ② 卡片面板
await page.getByRole("button", { name: "能力库", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await page.getByText("文档要点摘要", { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(2000);
const sheetText = await page.evaluate(() => document.body.innerText);
console.log("【卡片面板】还有『真跑一次』吗：" + sheetText.includes("真跑一次"));
await page.screenshot({ path: `${OUT}/12-card-hidden.png`, fullPage: true });
await browser.close();

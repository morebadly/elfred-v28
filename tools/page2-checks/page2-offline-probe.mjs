// 验降级标记：后端够不着时，卡片组标题旁必须出现「演示数据」
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";

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
await page.waitForTimeout(4000);
const text = await page.evaluate(() => document.body.innerText);
console.log("【降级标记】页面出现『演示数据』：" + text.includes("演示数据"));
console.log("【正文前 160】" + text.slice(0, 160).replace(/\n+/g, " | "));
await page.screenshot({ path: "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-0924/10-offline-chip.png", fullPage: true });
await browser.close();

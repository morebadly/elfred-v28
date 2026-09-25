// 检查"给用户用不该露的示例素材"是否已经不再出现（程序化 + 截图）
// 用法：node tools/page2-checks/page2-asset-check.mjs      （前端要指到有数据的后端）
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
import fs from "node:fs";

const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/sweep";
fs.mkdirSync(OUT, { recursive: true });
const BAD = ["profile-reference", "reference-knowledge", "reference-memory", "reference-home", "reference-community", "reference-messages", "reference-player"];

const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true })).newPage();
const text = () => page.evaluate(() => document.body.innerText);

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

/** 页面上所有"可能被示例图占着"的元素，把它们的 background-image 打出来 */
async function auditAssets(label) {
  const found = await page.evaluate((bad) => {
    const selectors = [".v277-ability-visual", ".v277-memory-photo", ".v277-relation-photo", ".v277-profile-hero", ".v277-sprite-home", ".v277-sprite-community"];
    const rows = [];
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      if (!elements.length) continue;
      const images = new Set(elements.map((el) => getComputedStyle(el).backgroundImage));
      rows.push({ selector, count: elements.length, images: [...images], tainted: [...images].some((img) => bad.some((name) => img.includes(name))) });
    }
    return rows;
  }, BAD);
  console.log(`\n【${label}】`);
  if (!found.length) { console.log("  页面上没有这些元素"); return; }
  let bad = 0;
  for (const row of found) {
    if (row.tainted) bad++;
    console.log(`  ${row.tainted ? "❌" : "✅"} ${row.selector} ×${row.count} → ${row.images.map((i) => i.slice(0, 60)).join(" | ")}`);
  }
  console.log(`  ${bad === 0 ? "✅ 没有示例素材" : `❌ 有 ${bad} 类元素还在用示例素材`}`);
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
await auditAssets("能力库（卡面）");
await page.screenshot({ path: `${OUT}/asset-capability.png`, fullPage: true });

await page.getByRole("button", { name: "记忆库", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2000);
await auditAssets("记忆库（身份卡 / 关系人像）");
await page.screenshot({ path: `${OUT}/asset-memory.png`, fullPage: true });

await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2000);
await auditAssets("我的（英雄区）");
await page.screenshot({ path: `${OUT}/asset-profile.png`, fullPage: true });
await browser.close();

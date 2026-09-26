// 第二页 / 第四页 全局走查（发现问题用，不做断言）：把可点元素逐个真点，记录结果与报错。
// 用法：node tools/page2-checks/page2-sweep.mjs         （后端 8000 + 前端 5182 要在跑）
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
import fs from "node:fs";

const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/sweep";
fs.mkdirSync(OUT, { recursive: true });

const caps = await (await fetch(`${API}/capabilities`)).json();
const mem = await (await fetch(`${API}/memory`)).json();
const feed = await (await fetch(`${API}/page2/feed`)).json();
console.log(`【接口】卡片 ${caps.length} 张 | 记忆 ${mem.totalCount} 条 | 动态 ${feed.count} 条`);
console.log(`【接口】卡片：${caps.map((c) => `${c.title}=${c.score}/Lv.${c.level}`).join(" , ")}`);

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true });
const page = await context.newPage();
const errors = [];
const failed = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 100)));
page.on("requestfailed", (r) => { if (!r.url().includes("favicon")) failed.push(`${r.url().slice(0, 70)}`); });

const text = () => page.evaluate(() => document.body.innerText);
const head = (t, n = 90) => t.replace(/\n+/g, " | ").slice(0, n);

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

/** 真点一个按钮/文字，记录点前后页面变化 */
async function probe(label, locator, shot) {
  const before = await text();
  if (!(await locator.count())) {
    console.log(`· ${label} → ❓ 找不到这个控件`);
    return;
  }
  await locator.first().click({ timeout: 6000 }).catch((e) => console.log(`· ${label} → 点不动：${String(e).slice(0, 40)}`));
  await page.waitForTimeout(1600);
  const after = await text();
  const changed = after.slice(0, 400) !== before.slice(0, 400);
  console.log(`· ${label} → ${changed ? "✅ 页面有变化" : "⚠️ 点了没变化"} | 现在：${head(after)}`);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}.png`, fullPage: true });
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/01-capability.png`, fullPage: true });
console.log(`\n【能力库】${head(await text(), 200)}`);

for (const chip of ["全部", "Skill", "Mini App", "Agent"]) {
  const locator = page.getByRole("button", { name: chip, exact: true });
  if (await locator.count()) {
    await locator.first().click().catch(() => {});
    await page.waitForTimeout(900);
    const t = await text();
    const hits = caps.filter((c) => t.includes(c.title)).length;
    console.log(`· 筛选「${chip}」→ 命中后端卡片 ${hits}/${caps.length}`);
  }
}
await page.getByRole("button", { name: "全部", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(800);

if (caps.length) {
  await page.getByText(caps[0].title, { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const sheet = await text();
  await page.screenshot({ path: `${OUT}/02-card-sheet.png`, fullPage: true });
  console.log(`\n【卡片详情·${caps[0].title}】${head(sheet, 220)}`);
  console.log(`· 有「等级阶梯」：${sheet.includes("等级阶梯")} | 有「使用记录」：${sheet.includes("使用记录")} | 有「真跑一次」：${sheet.includes("真跑一次")}`);
  const close = page.locator("button[aria-label*='关闭'], button[aria-label*='返回']").first();
  await close.click().catch(() => {});
  await page.waitForTimeout(1200);
}

console.log("\n【工具行四个入口】");
for (const label of ["导入", "文档", "创建工具", "我的工具"]) {
  const locator = page.getByRole("button", { name: label });
  await probe(`工具行「${label}」`, locator);
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
  await page.waitForTimeout(1500);
}

console.log("\n【记忆库】");
await page.getByRole("button", { name: "记忆库", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2000);
const memoryText = await text();
await page.screenshot({ path: `${OUT}/03-memory.png`, fullPage: true });
console.log(`· ${head(memoryText, 220)}`);
console.log(`· 与后端一致：记忆 ${mem.totalCount} 条 → 页面上出现「${mem.totalCount} 已确认的记忆」：${memoryText.includes(`${mem.totalCount} 已确认的记忆`)}`);
console.log(`· 体检入口是否隐藏（应为 false）：${memoryText.includes("体检一遍")}`);
for (const group of ["基础", "社交", "习惯", "偏好"]) {
  const locator = page.getByRole("button", { name: group, exact: true });
  if (await locator.count()) {
    await locator.first().click().catch(() => {});
    await page.waitForTimeout(800);
    console.log(`· 记忆库筛选「${group}」→ 现在：${head(await text(), 60)}`);
  }
}

console.log("\n【第四页】");
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2200);
await page.screenshot({ path: `${OUT}/04-profile.png`, fullPage: true });
console.log(`· ${head(await text(), 200)}`);
// 最左边那栏 2026-09-26 从「动态」改成「Agent 动态」（内容是朋友圈那份的总览）
for (const tab of ["Agent 动态", "能力", "勋章"]) {
  const locator = page.getByRole("button", { name: tab, exact: true });
  await probe(`我的页标签「${tab}」`, locator);
}
for (const label of ["编辑资料", "个人设置", "分享个人主页", "设置背景"]) {
  await probe(`我的页「${label}」`, page.getByRole("button", { name: label }));
  await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
  await page.waitForTimeout(1200);
}

console.log(`\n【页面报错】${errors.length ? errors.join(" | ") : "无"}`);
console.log(`【失败请求】${failed.length ? [...new Set(failed)].slice(0, 6).join(" | ") : "无"}`);
console.log(`截图目录：${OUT}`);
await browser.close();

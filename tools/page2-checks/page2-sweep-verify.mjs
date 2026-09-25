// 对走查里"存疑"的几条做精确复验（浮层要按整体文本变化判断，不能只比前 400 字符）
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
import fs from "node:fs";

const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/sweep";
fs.mkdirSync(OUT, { recursive: true });
const mem = await (await fetch(`${API}/memory`)).json();

const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 90)));
const text = () => page.evaluate(() => document.body.innerText);

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
const goKnow = async () => {
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
  await page.waitForTimeout(1800);
};
await goKnow();

// ① 工具行「导入」「文档」：浮层要看整体文本/长度变化 + 有没有对话框特征文字
for (const [label, marker] of [["导入", /选文件|粘贴链接|导入|拖|上传/], ["文档", /文档库|还没有文档|解析/]]) {
  await goKnow();
  const before = await text();
  const button = page.getByRole("button", { name: label }).first();
  const found = await button.count();
  await button.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1800);
  const after = await text();
  console.log(`① 「${label}」：找到控件=${found} | 文本长度 ${before.length}→${after.length} | 出现「${marker}」相关文案：${marker.test(after.slice(before.length > 0 ? 0 : 0))}`);
  console.log(`   增量文本前 120：${after.slice(before.length).replace(/\n+/g, " | ").slice(0, 120) || "（没有新增文本）"}`);
  await page.screenshot({ path: `${OUT}/verify-${label}.png`, fullPage: true });
}

// ② 记忆库筛选：数一下每组标题出现几次（按整体文本判断）
await goKnow();
await page.getByRole("button", { name: "记忆库", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2000);
const groups = ["基础", "社交", "习惯", "偏好"];
for (const group of groups) {
  const before = await text();
  await page.getByRole("button", { name: group, exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  const after = await text();
  const shown = groups.filter((g) => after.includes(`${g}\n`) || after.includes(`${g} `));
  console.log(`② 记忆库筛选「${group}」：文本 ${before.length}→${after.length} | 仍出现其他组标题：${shown.join("/") || "无"}`);
}
await page.screenshot({ path: `${OUT}/verify-memory-filter.png`, fullPage: true });
console.log(`② 后端记忆 ${mem.totalCount} 条；页面「已确认的记忆」附近文本：${(await text()).match(/[\d]+\s*已确认的记忆/)?.[0] ?? "没匹配到"}`);

// ③ 我的页：设置背景 / 个人设置 / 分享 到底是什么元素
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2000);
const elements = await page.evaluate(() => {
  const out = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const label = (el.getAttribute("aria-label") || "") + "|" + (el.textContent || "").trim().slice(0, 12);
    if (/设置背景|个人设置|分享个人主页/.test(label) && el.children.length <= 1) {
      out.push(`${el.tagName} aria=${el.getAttribute("aria-label") || "-"} text=${(el.textContent || "").trim().slice(0, 8)}`);
    }
  }
  return out.slice(0, 8);
});
console.log("③ 我的页三个元素的真实标签：" + (elements.join(" ; ") || "没找到"));
const byAria = async (label) => {
  const locator = page.locator(`[aria-label="${label}"]`).first();
  if (!(await locator.count())) return "❌ 没有这个 aria-label";
  const tag = await locator.evaluate((el) => el.tagName);
  const clickable = await locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return style.pointerEvents !== "none" && Boolean(el.onclick || el.closest("button") || el.tagName === "BUTTON");
  });
  return `${tag}（可点=${clickable}）`;
};
console.log(`③ 设置背景：${await byAria("设置背景")} | 个人设置：${await byAria("个人设置")} | 分享个人主页：${await byAria("分享个人主页")}`);
await page.screenshot({ path: `${OUT}/verify-profile.png`, fullPage: true });

console.log(`【页面报错】${errors.length ? errors.join(" | ") : "无"}`);
await browser.close();

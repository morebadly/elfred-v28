// 第四页（我的）接线验证：英雄区读后端资料、动态列表读后端 feed
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
import fs from "node:fs";

const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-0924";
fs.mkdirSync(OUT, { recursive: true });
const API = process.env.PAGE2_API || "http://127.0.0.1:8000";

const profile = await (await fetch(`${API}/page2/profile`)).json();
const feed = await (await fetch(`${API}/page2/feed`)).json();
console.log(`【接口】资料 name=${profile.name} tags=${(profile.tags || []).join("/")}`);
console.log(`【接口】动态 ${feed.count} 条，第一条：${feed.items?.[0]?.title ?? "（空）"}`);

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.waitForTimeout(1000);

// ⚠️ 这个原型的底部导航是"图标 + aria-label"（没有文字）：
// 0:动态 1:社区 2:aria=首页 3:aria=知识 4:aria=消息 5:aria=我的 —— 必须按 aria-label 点
const mine = page.locator('nav button[aria-label="我的"]').first();
console.log("【导航】按 aria-label=我的 匹配到：" + (await mine.count()));
await mine.click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/05-profile.png`, fullPage: true });
const text = await page.evaluate(() => document.body.innerText);
console.log("【我的页】文字前 260：" + text.slice(0, 260).replace(/\n+/g, " | "));
// ⚠️ 这里必须**轮询到两边一致**：页面自己可能刚把本地那份 PATCH 上去（600ms 防抖 + 请求），
// 也可能后端刚被别的探针改过（run-all 会先跑"编辑资料"那条）。取一次就断言会出假失败（踩过两次）。
let matched = false;
let lastName = "";
for (let attempt = 1; attempt <= 6 && !matched; attempt++) {
  const now = await (await fetch(`${API}/page2/profile`)).json();
  lastName = now.name || "";
  // ⚠️ 页面文本必须在循环里**重新读**：循环外那份是旧快照，拿它比会永远比不中（又踩一次）
  const pageText = await page.evaluate(() => document.body.innerText);
  matched = Boolean(lastName) && pageText.includes(lastName);
  if (!matched) await page.waitForTimeout(1200);
}
console.log("【我的页】显示的是后端资料名：" + (lastName ? String(matched) : "（后端没名字）"));
console.log("【我的页】标签显示：" + (profile.tags || []).filter((t) => text.includes(t)).join("/"));
const firstFeed = feed.items?.[0]?.title ?? "";
console.log("【我的页】动态第一条出现在页面上：" + (firstFeed ? text.includes(firstFeed) : "（后端无动态）"));

// 最左边那栏 2026-09-26 从「动态」改成「Agent 动态」：内容换成了**朋友圈**的总览
// （不再是我们后端那条"成果 + 记忆"合并流 —— 那条只在没有 runtime 的独立版里兜底）。
// 这里只截图 + 如实打印看到的东西，具体验收在 page4-agent-feed.mjs。
const tab = page.locator("nav.v277-profile-tabs button").filter({ hasText: "Agent 动态" }).first();
if (await tab.count()) {
  await tab.click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/06-profile-agent-feed.png`, fullPage: true });
  const body = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
  console.log("【Agent 动态页】" + (body.includes("查看全部")
    ? "总览：" + (body.match(/共 \d+ 条/) ?? ["（没读到条数）"])[0]
    : body.includes("还没有 Agent 动态") ? "空态（朋友圈里没有动态）" : body.slice(0, 80)));
}
console.log("【页面报错】" + (errors.length ? errors.join(" | ") : "无"));
await browser.close();

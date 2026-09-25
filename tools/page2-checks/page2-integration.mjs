// 第二页 · 真实前端联调（9/24）：验证页面读的是我们后端的真数据，并真点一遍卡片
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
import fs from "node:fs";

const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-0924";
fs.mkdirSync(OUT, { recursive: true });
const API = "http://127.0.0.1:8000";

const apiCards = await (await fetch(`${API}/capabilities`)).json();
const apiTitles = apiCards.map((c) => c.title);
console.log("【接口】卡片数 " + apiCards.length + "：" + apiCards.map((c) => `${c.title}=${c.score}`).join(" , "));
const apiInsight = await (await fetch(`${API}/insight/abilities`)).json();
console.log("【接口】综合分 " + apiInsight.composite + "，五维：" +
  apiInsight.axes.map((a) => `${a.label}=${a.value}`).join(" "));
const apiEvidence = await (await fetch(`${API}/evidence`)).json();
console.log("【接口】成果流条数 " + apiEvidence.length);
const apiMemory = await (await fetch(`${API}/memory`)).json();
const memoryLabels = Object.values(apiMemory.groups ?? {}).flat().map((row) => row.label).filter(Boolean);
console.log("【接口】记忆 totalCount=" + apiMemory.totalCount + " 标签=" + memoryLabels.join(" , "));

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true,
});
const page = await context.newPage();
// 原型第一次进来有多步 onboarding（账号→验证码→…→确认）。这里自动走一遍，
// 目的是把页面点到第二页去看真数据；onboarding 本身是前端自己的域，我们不评价它。
async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}
const errors = [];
const failed = [];
const apiHits = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
page.on("requestfailed", (r) => failed.push(`${r.url().slice(0, 80)} :: ${r.failure()?.errorText}`));
page.on("request", (r) => {
  if (r.url().includes("127.0.0.1:8000") || r.url().includes("localhost:8000")) {
    apiHits.push(`${r.method()} ${r.url()}`);
  }
});
page.on("response", (r) => {
  if (r.url().includes(":8000")) apiHits.push(`  ← ${r.status()} ${r.url()}`);
});

async function look(url, tag) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  const text = await page.evaluate(() => document.body.innerText);
  const hit = apiTitles.filter((t) => text.includes(t));
  console.log(`【页面 ${tag}】命中接口卡片的标题 ${hit.length}/${apiTitles.length}：${hit.join(" , ")}`);
  const nums = text.match(/Lv\.?\s?\d+/g) || [];
  console.log(`【页面 ${tag}】页面上的等级文本：${[...new Set(nums)].join(" ")}`);
  console.log(`【页面 ${tag}】正文前 300 字：` + text.slice(0, 300).replace(/\n+/g, " | "));
  return text;
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
// 收尾：进入首页 → 切到"能力库"那一格
for (const label of ["进入首页"]) {
  const button = page.getByRole("button", { name: new RegExp(label) }).first();
  if (await button.count()) { await button.click().catch(() => {}); await page.waitForTimeout(2500); }
}
const tabInfo = await page.evaluate(() => document.body.innerText);
console.log("【首页】正文前 200 字：" + tabInfo.slice(0, 200).replace(/\n+/g, " | "));
// 找第二页的入口：挨个试可能的标签，出现我们的卡片标题就算找对了
const targetTab = process.env.PAGE2_TAB || "";
const candidates = targetTab ? [targetTab] : ["打开我的工具", "知识", "能力库", "能力", "工具", "我的"];
for (const label of candidates) {
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const tab = page.getByRole("button", { name: label, exact: true }).first();
  if (!(await tab.count())) continue;
  await tab.click().catch(() => {});
  await page.waitForTimeout(2000);
  const seen = await page.evaluate(() => document.body.innerText);
  const hit = apiTitles.filter((t) => seen.includes(t));
  console.log(`【找入口】点「${label}」→ 命中卡片 ${hit.length}/${apiTitles.length}` +
    (hit.length ? " ✅ 就是这个入口：" + hit.join(" , ") : ""));
  if (hit.length) { await page.screenshot({ path: `${OUT}/02-cards.png`, fullPage: true }); break; }
}
// 记忆库：真数据里的记忆标签有没有出现在页面上
if (memoryLabels.length) {
  const seenNow = await page.evaluate(() => document.body.innerText);
  const hitLabels = memoryLabels.filter((label) => seenNow.includes(label));
  console.log(`【记忆库】命中后端记忆标签 ${hitLabels.length}/${memoryLabels.length}：${hitLabels.join(" , ")}`);
  console.log("【记忆库】页面是否显示『已确认的记忆』：" + seenNow.includes("已确认的记忆"));
}
// 回到第二页（底部「知识」），留一张"当前样子"的截图——空态预览就靠它
const back = page.getByRole("button", { name: "知识", exact: true }).first();
if (await back.count()) { await back.click().catch(() => {}); await page.waitForTimeout(2500); }
await page.screenshot({ path: `${OUT}/03-page2-current.png`, fullPage: true });
const current = await page.evaluate(() => document.body.innerText);
console.log("【第二页当前】文字前 220：" + current.slice(0, 220).replace(/\n+/g, " | "));
await page.screenshot({ path: `${OUT}/01-no-live.png`, fullPage: true });
const firstLook = await page.evaluate(() => document.body.innerText);
console.log("【能力库】命中接口卡片的标题 " +
  apiTitles.filter((t) => firstLook.includes(t)).length + "/" + apiTitles.length +
  "：" + apiTitles.filter((t) => firstLook.includes(t)).join(" , "));
console.log("【能力库】页面文字前 300：" + firstLook.slice(0, 300).replace(/\n+/g, " | "));
const liveText = await look("http://localhost:5182/v28?live", "02-live");

// 真点一遍：找一张真卡片 → 点开 → 看有没有"用它做一件事"
const cardTitle = apiTitles.find((t) => liveText.includes(t));
console.log("【点击】准备点这张卡：" + (cardTitle ?? "（页面上没有接口卡片，跳过点击）"));
if (cardTitle) {
await page.getByText(cardTitle, { exact: false }).first().click({ timeout: 8000 }).catch((e) =>
  console.log("【点击】点卡片失败：" + String(e).slice(0, 120)));
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/03-card-detail.png`, fullPage: true });
const detail = await page.evaluate(() => document.body.innerText);
console.log("【详情页】有没有『用它做一件事』：" + detail.includes("用它做一件事"));
const btn = page.getByText("用它做一件事", { exact: false }).first();
if (await btn.count()) {
  await btn.click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/04-after-click.png`, fullPage: true });
  console.log("【点击后】URL = " + page.url());
  const after = await page.evaluate(() => document.body.innerText);
  console.log("【点击后】页面文字前 160：" + after.slice(0, 160).replace(/\n+/g, " | "));
}
}

console.log("【页面请求过我们后端】" + (apiHits.length ? apiHits.slice(0, 12).join(" | ") : "一次都没有"));
console.log("【页面报错】" + (errors.length ? errors.join(" | ") : "无"));
console.log("【请求失败】" + (failed.length ? failed.slice(0, 5).join(" | ") : "无"));
console.log("截图目录：" + OUT);
await browser.close();

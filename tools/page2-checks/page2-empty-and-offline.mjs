// 空态 / 离线两个环境的关键检查（合并成一条命令，省得来回切前端）
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
import fs from "node:fs";

const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/sweep";
fs.mkdirSync(OUT, { recursive: true });
const API = process.env.PAGE2_API || "http://127.0.0.1:8001";
const tag = process.env.CHECK_TAG || "empty";

const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true })).newPage();
const errors = [];
const failed = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 90)));
page.on("requestfailed", (r) => { if (!r.url().includes("favicon")) failed.push(r.url().slice(0, 60)); });
const text = () => page.evaluate(() => document.body.innerText);

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
await page.waitForTimeout(3000);
const capability = await text();
await page.screenshot({ path: `${OUT}/${tag}-capability.png`, fullPage: true });
console.log(`【能力库】理解度 0%：${/理解度[\s\S]{0,12}0%/.test(capability)} | 卡组空态「还没替你干过活」：${capability.includes("还没替你干过活")} | 「演示数据」标记：${capability.includes("演示数据")} | 「部分数据没拿到」：${capability.includes("部分数据没拿到")}`);

await page.getByRole("button", { name: "记忆库", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(2000);
const memory = await text();
await page.screenshot({ path: `${OUT}/${tag}-memory.png`, fullPage: true });
console.log(`【记忆库】空态「还没有记忆」：${memory.includes("还没有记忆")} | 0 已确认的记忆：${memory.includes("0") && memory.includes("已确认的记忆")}`);

await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
const profile = await text();
await page.screenshot({ path: `${OUT}/${tag}-profile.png`, fullPage: true });
console.log(`【第四页】动态空态「还没有动态」：${profile.includes("还没有动态")} | 名字待设置：${profile.includes("还没有名字")} | 标签待设置：${profile.includes("添加标签")}`);

console.log(`【页面报错】${errors.length ? [...new Set(errors)].join(" | ") : "无"}`);
console.log(`【失败请求】${failed.length ? [...new Set(failed)].slice(0, 4).join(" | ") : "无"}`);
await browser.close();

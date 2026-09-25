// 验证卡片面板新补的「真跑一次」：点完应拿到 runId，并且卡片分数变化
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";

const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const before = await (await fetch(`${API}/capabilities`)).json();
const target = before.find((c) => c.title === "文档要点摘要") ?? before[0];
console.log(`【接口】跑之前：${target.title} 分数=${target.score} 成果数=${target.evidence}`);

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

// 点开目标卡片
await page.getByText(target.title, { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-0924/08-card-sheet.png", fullPage: true });
const sheet = await page.evaluate(() => document.body.innerText);
console.log("【卡片面板】有『真跑一次』按钮：" + sheet.includes("真跑一次"));
if (!sheet.includes("真跑一次")) { await browser.close(); process.exit(0); }

const runBtn = page.getByRole("button", { name: /真跑一次/ }).first();
await runBtn.click().catch(() => {});
console.log("【点击】已点『真跑一次』，等模型逐步跑（最多 60 秒）");
await page.waitForTimeout(50000);
const after = await page.evaluate(() => document.body.innerText);
const note = (after.match(/跑通了一次[^\n]*|没跑通：[^\n]*/) || ["（没出结果）"])[0];
console.log("【结果】" + note);
await page.screenshot({ path: "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-0924/09-run-done.png", fullPage: true });

const post = await (await fetch(`${API}/capabilities`)).json();
const now = post.find((c) => c.title === target.title);
console.log(`【接口】跑之后：${now.title} 分数=${now.score} 成果数=${now.evidence}（变化：${target.score}→${now.score}）`);
await browser.close();

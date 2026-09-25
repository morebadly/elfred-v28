// 验证"编辑资料 → 真的落库"：改名 → 保存 → 回我的页 → 查后端
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";

const API = "http://127.0.0.1:8000";
const OUT = "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-0924";
const before = await (await fetch(`${API}/page2/profile`)).json();
const wantName = `闭环验证${Date.now() % 1000}`;
console.log(`【接口】改之前 name=${before.name}`);

const browser = await chromium.launch({ channel: "msedge" });
const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true })).newPage();

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2000);

// 打开编辑资料
await page.getByText("编辑资料", { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/13-edit-open.png`, fullPage: true });
const inEdit = await page.evaluate(() => document.body.innerText);
console.log("【编辑页】正文前 200：" + inEdit.slice(0, 200).replace(/\n+/g, " | "));
const buttons = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button")).map((b) => (b.textContent || "").trim()).filter(Boolean).slice(0, 12));
console.log("【编辑页】按钮：" + buttons.join(" / "));

// 改名字：找 label/placeholder 像"名字"的输入框
const nameInput = page.locator('input[placeholder*="名字"], input[placeholder*="昵称"], input[placeholder*="称呼"]').first();
const visibleInputs = page.locator("input:visible");
if (await nameInput.count()) {
  await nameInput.fill(wantName).catch(() => {});
} else if (await visibleInputs.count()) {
  await visibleInputs.first().fill(wantName).catch(() => {});
}
console.log("【编辑页】已把第一个输入框改成：" + wantName);
await page.screenshot({ path: `${OUT}/14-edit-filled.png`, fullPage: true });

// 保存：按钮文案可能是 保存/完成/确定/保存并返回
const save = page.locator("button:visible").filter({ hasText: /保存|完成|确定|应用/ }).first();
if (await save.count()) {
  await save.click({ timeout: 6000 }).catch(() => {});
} else {
  console.log("【编辑页】没找到保存按钮，按钮清单见上");
}
await page.waitForTimeout(2500);

// 回到"我的"，等同步 effect 跑（600ms 防抖 + 请求）
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/15-after-save.png`, fullPage: true });

const after = await (await fetch(`${API}/page2/profile`)).json();
console.log(`【接口】改之后 name=${after.name}  →  落库成功：${after.name === wantName}`);
await browser.close();

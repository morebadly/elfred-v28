// 查"点页头「记忆库」切不过去"到底是选择器问题还是真 bug
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";
const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";

const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const memory = await (await fetch(`${API}/memory`)).json();
const labels = Object.values(memory.groups ?? {}).flat().map((row) => row.label).filter(Boolean);
console.log(`【接口】totalCount=${memory.totalCount} labels=${labels.join(" , ")}`);

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
// 底部导航进第二页
const nav = page.locator("nav button");
const navCount = await nav.count();
const navInfo = [];
for (let i = 0; i < navCount; i++) {
  const b = nav.nth(i);
  navInfo.push(`${i}:「${(await b.innerText().catch(() => "")).trim().slice(0, 8)}」` +
    `/aria=${await b.getAttribute("aria-label").catch(() => "")}`);
}
console.log("【底部导航】" + navInfo.join("  "));
// 点"知识"（底部导航的主入口），进不去就逐个试
let landed = false;
for (let i = 0; i < navCount && !landed; i++) {
  await nav.nth(i).click().catch(() => {});
  await page.waitForTimeout(1500);
  const t = await page.evaluate(() => document.body.innerText);
  if (/能力卡组|理解度/.test(t)) {
    console.log(`【进第二页】点第 ${i} 个导航按钮成功`);
    landed = true;
  }
}
await page.waitForTimeout(800);
// 页头那两个标签长什么样
const tabs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("button"))
    .filter((b) => /能力库|记忆库/.test(b.textContent || ""))
    .map((b) => ({ text: (b.textContent || "").trim().slice(0, 20), cls: String(b.className).slice(0, 60), disabled: b.disabled }))
);
console.log("【页头标签】" + JSON.stringify(tabs));

const before = await page.evaluate(() => document.body.innerText.length);
const tab = page.locator("button").filter({ hasText: "记忆库" }).first();
console.log("【点前】匹配到记忆库按钮数：" + (await page.locator("button").filter({ hasText: "记忆库" }).count()));
await tab.click({ timeout: 6000 }).catch((e) => console.log("【点击失败】" + String(e).slice(0, 80)));
await page.waitForTimeout(2500);
const text = await page.evaluate(() => document.body.innerText);
console.log("【点后】正文前 200：" + text.slice(0, 200).replace(/\n+/g, " | "));
console.log("【点后】有『已确认的记忆』：" + text.includes("已确认的记忆"));
console.log("【点后】命中后端记忆标签：" + labels.filter((l) => text.includes(l)).join(" , "));
console.log("【点前/点后 body 文本长度】" + before + " -> " + text.length);

// 记忆体检入口（这次新补的）：点一下看有没有真结果
const runBtn = page.getByRole("button", { name: "体检一遍" }).first();
console.log("【体检入口】页面上有这个按钮：" + (await runBtn.count()));
if (await runBtn.count()) {
  await runBtn.click().catch(() => {});
  await page.waitForTimeout(3000);
  const afterRun = await page.evaluate(() => document.body.innerText);
  const note = (afterRun.match(/体检过一遍[^\n]*|记忆体检暂时不可用[^\n]*/) || ["（没出结果）"])[0];
  console.log("【体检结果】" + note);
  await page.screenshot({ path: "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-0924/07-memory-hygiene.png", fullPage: true });
}
await browser.close();

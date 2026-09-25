// 摸清「整合版」（同事的 runtime + 我的第二页/第四页）的入口流程：
// 他的 app 要先注册/登录，我的老巡检脚本是按老 onboarding 写的，所以先把流程走一遍看看。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

// ⚠️ 必须用 127.0.0.1：他的服务端做 Host 校验，用 localhost 会被判"无效主机"（403）
const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/integration-explore";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
const page = await (
  await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
).newPage();
page.on("pageerror", (e) => console.log("  ! pageerror:", String(e).slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") console.log("  ! console:", m.text().slice(0, 160));
});

const dump = async (label, i) => {
  await page.screenshot({ path: `${OUT}/${String(i).padStart(2, "0")}-${label}.png`, fullPage: true });
  const t = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
  console.log(`\n[${i}] ${label}\n    ${t.slice(0, 260)}`);
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
await dump("entry", 1);

// 试着注册一个本地账号
const handle = `qa${Date.now() % 100000}@example.com`;
const pw = "elfred-test-2026";
const inputs = page.locator("input:visible");
console.log(`\n可见 input 数：${await inputs.count()}`);
for (let i = 0; i < (await inputs.count()); i++) {
  const el = inputs.nth(i);
  const type = await el.getAttribute("type");
  const label = await el.getAttribute("aria-label");
  console.log(`   #${i} type=${type} aria=${label} ph=${await el.getAttribute("placeholder")}`);
}

for (let i = 0; i < (await inputs.count()); i++) {
  const el = inputs.nth(i);
  const type = await el.getAttribute("type");
  const aria = (await el.getAttribute("aria-label")) || "";
  const val = /密码|password/i.test(aria) || type === "password" ? pw : handle;
  await el.fill(val).catch(() => {});
}
await dump("filled-login", 2);

const cta = page.locator("button:visible").filter({ hasText: /创建账号|登录|继续/ }).first();
console.log("\n点击：", (await cta.textContent().catch(() => "")) || "(找不到)");
await cta.click({ timeout: 8000 }).catch((e) => console.log("  点击失败", e.message));
await page.waitForTimeout(4000);
await dump("after-login", 3);

// 到密码页：先切到"首次使用，创建账号"，再填密码提交
const toRegister = page.locator("button:visible").filter({ hasText: /首次使用，创建账号/ }).first();
if (await toRegister.count()) {
  await toRegister.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const pwInput = page.locator("input[type=password]:visible").first();
  if (await pwInput.count()) await pwInput.fill(pw).catch(() => {});
  await dump("register-form", 4);
  const goBtn = page.locator("button:visible").filter({ hasText: /创建账号并继续/ }).first();
  if (await goBtn.count()) {
    await goBtn.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await dump("after-register", 5);
  }
}

// 之后每步都尝试"填空输入 + 点主按钮"，最多 15 步
for (let step = 1; step <= 15; step++) {
  const text = await page.evaluate(() => document.body.innerText);
  if (/能力库|知识库|记忆库/.test(text) && !/进入首页/.test(text)) {
    await dump("reached-main", 90);
    break;
  }
  const fields = page.locator("input:visible, textarea:visible");
  for (let i = 0; i < (await fields.count()); i++) {
    const f = fields.nth(i);
    if (await f.inputValue().catch(() => "")) continue;
    const ph = (await f.getAttribute("placeholder").catch(() => "")) || "";
    const aria = (await f.getAttribute("aria-label").catch(() => "")) || "";
    const val = /验证码|code/i.test(ph + aria) ? "123456" : /手机|邮箱|account|handle/i.test(ph + aria) ? handle : "用户";
    await f.fill(val).catch(() => {});
  }
  const next = page
    .locator("button:visible")
    .filter({ hasText: /获取验证码|验证并|继续|开始|确认|保存|完成|下一步|跳过|进入首页|同意|提交/ })
    .first();
  if (!(await next.count())) {
    console.log(`\n[step ${step}] 没有可点的主按钮了`);
    await dump(`stuck-${step}`, 40 + step);
    break;
  }
  const label = (await next.textContent().catch(() => "")) || "";
  console.log(`\n[step ${step}] 点「${label.trim().slice(0, 20)}」`);
  await next.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dump(`step${step}`, 10 + step);
}

console.log(`\n截图：${OUT}`);
await browser.close();

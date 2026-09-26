// 第四页 →「设置」的**闭环验收**：每一行点下去都必须有结果 ——
//   要么弹出一个面板，要么跳到另一个真页面；**不许出现"点了没反应"的行**。
//
// 用法：node tools\page2-checks\page4-settings-check.mjs
//      $env:HANDLE="...@example.com" 可以换账号看有数据时的样子
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/page4-settings";
const HANDLE = process.env.HANDLE || "";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};
const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));

/**
 * 回到"设置"这一屏。**用刷新 + 重新进**，不做"猜返回按钮"那套 ——
 * 之前试过点返回，结果卡在编辑资料页上，后面每一行都被误判成"点了没反应"（实测踩到）。
 * 会话在 localStorage 里，刷新之后还是登录态。
 */
async function openSettings(page) {
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(2200);
  if (await page.locator('nav button[aria-label="我的"]').count()) {
    await goTab(page, "我的");
    await page.waitForTimeout(1600);
  }
  await page.locator('button[aria-label="个人设置"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1600);
  return /账号与身份/.test(await bodyText(page));
}

const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await enterMergedApp(page, { ready: 3000, ...(HANDLE ? { handle: HANDLE } : {}) });
  await goTab(page, "我的");
  await page.waitForTimeout(2200);

  console.log("【1】右上角那颗「设置」是真的入口");
  const settingsBtn = page.locator('button[aria-label="个人设置"]').first();
  check("身份区右上角有「设置」按钮", await settingsBtn.count() > 0, "");
  await settingsBtn.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1800);
  const text = await bodyText(page);
  await page.screenshot({ path: `${OUT}/1-settings.png`, fullPage: true });
  for (const group of ["账号与身份", "Elfred 对我的理解", "隐私与授权", "数据与额度", "使用偏好", "帮助与反馈"]) {
    check(`设置页有分组「${group}」`, text.includes(group), "");
  }
  check("底部有退出登录", text.includes("退出登录"), "");
  check("页面上不再出现「设置背景」", !text.includes("设置背景"), "");

  console.log("【2】每一行点下去都有结果（面板 / 跳页），没有死行");
  const total = await page.locator("main button[class*=row]").count();
  check("设置页有可点的行", total >= 6, `${total} 行`);
  const dead = [];
  for (let index = 0; index < total; index += 1) {
    if (!(await openSettings(page))) {
      dead.push(`第 ${index + 1} 行（没能回到设置页）`);
      continue;
    }
    const row = page.locator("main button[class*=row]").nth(index);
    const label = (await row.innerText().catch(() => "")).split("\n")[0] || `第 ${index + 1} 行`;
    await row.click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const after = await bodyText(page);
    const dialog = await page.locator('[role="dialog"]').count();
    const leftSettings = !(/账号与身份/.test(after) && /退出登录/.test(after));
    if (!dialog && !leftSettings) dead.push(label);
  }
  check("没有点了没反应的行", dead.length === 0, dead.join(" / "));

  console.log("【3】上游服务状态：读到真状态（不是空壳）");
  check("回到设置页", await openSettings(page), "");
  await page.locator("main button[class*=row]").filter({ hasText: "上游服务状态" }).first()
    .click({ timeout: 6000 }).catch(() => {});
  // 上游体检要挨个探三个服务（实测 4 秒上下）：轮询到面板出内容再断言，别拿"读取中"当结论
  for (let wait = 0; wait < 12; wait += 1) {
    const now = await bodyText(page);
    if (/记忆中枢/.test(now) || /读不到服务状态/.test(now)) break;
    await page.waitForTimeout(1000);
  }
  const deps = await bodyText(page);
  await page.screenshot({ path: `${OUT}/2-deps.png`, fullPage: true });
  // 面板是 portal 渲染在 body 末尾，所以看**尾部**的文本才是面板内容
  check("面板打开了（role=dialog）", (await page.locator('[role="dialog"]').count()) > 0, deps.slice(-160));
  check("列出了 EMOS / Skill Foundry / PA 网关",
        /记忆中枢/.test(deps) && /Skill Foundry/.test(deps) && /PA 网关/.test(deps), deps.slice(-200));
  check("列了 Jev 的状态", /Jev/.test(deps), "");

  console.log("【4】退出登录要二次确认");
  check("回到设置页（再验退出）", await openSettings(page), "");
  await page.locator("main button").filter({ hasText: "退出登录" }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const confirm = await bodyText(page);
  await page.screenshot({ path: `${OUT}/3-logout-confirm.png`, fullPage: true });
  check("弹出确认、并说清后果", /退出登录？/.test(confirm) && /本机数据仍在/.test(confirm), confirm.slice(0, 120));
  await page.locator("main button").filter({ hasText: "再想想" }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  check("点「再想想」回到设置页（没真退）", /账号与身份/.test(await bodyText(page)), "");

  check("页面没有报错", errors.length === 0, errors.join(" / "));
} finally {
  await browser.close();
}

const bad = results.filter((x) => !x.ok);
console.log(`\n${bad.length ? "❌ FAILED" : "✅ ALL PASSED"}  ${results.length - bad.length}/${results.length}`);
console.log(`截图：${OUT}`);
if (bad.length) {
  bad.forEach((b) => console.log(`   - ${b.name}: ${b.detail}`));
  process.exit(1);
}

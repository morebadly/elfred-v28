// 第四页（我的 / 编辑资料 / 设置 / 勋章）空态巡检：
//   1. 用全新浏览器上下文走一遍 onboarding（等于"新用户第一次进来"）
//   2. 把每个页面截图，并把"可能露示例素材 / 假数据"的地方读出来
//   3. 结果打成一张表，方便一眼看出哪里还不是空态
//
// 用法：
//   node tools\page2-checks\page4-empty-sweep.mjs
//   $env:OUT="..."; node tools\page2-checks\page4-empty-sweep.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT =
  process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/page4-empty";
mkdirSync(OUT, { recursive: true });
// onboarding 里"必填"的几栏得填上，否则按钮点不动；填什么不影响本次巡检
const FILL = process.env.FILL || "用户";

// 示例素材文件名（出现这些就是"露了演示图"）
const DEMO_ASSETS = [
  "profile-reference",
  "reference-knowledge",
  "reference-memory",
  "reference-home",
  "reference-community",
  "reference-messages",
  "reference-player",
];
// 写死的演示身份（出现这些就是"露了假资料"）
const DEMO_TEXT = ["harisen", "Harisen", "正在把 Personal Agent", "产品、创业"];

const rows = [];
const say = (area, item, value) => rows.push([area, item, value]);

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

// ── 走 onboarding（新用户第一次进来）──────────────────────────────
async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

// ── 读数工具 ────────────────────────────────────────────────────
const probe = (selectors) =>
  page.evaluate((list) => {
    const out = {};
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (!el) {
        out[sel] = null;
        continue;
      }
      const cs = getComputedStyle(el);
      out[sel] = {
        bgImage: cs.backgroundImage,
        text: (el.textContent || "").trim().slice(0, 40),
      };
    }
    return out;
  }, selectors);

const judge = (value) => {
  const v = String(value ?? "");
  const hitAsset = DEMO_ASSETS.find((a) => v.includes(a));
  if (hitAsset) return `❌ 露示例图 ${hitAsset}`;
  const hitText = DEMO_TEXT.find((t) => v.includes(t));
  if (hitText) return `❌ 露演示资料「${hitText}」`;
  return "✅";
};

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const onboarded = await walkOnboarding();
console.log(`【onboarding】走到主界面：${onboarded}`);

// ── 我的 ────────────────────────────────────────────────────────
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/01-profile.png`, fullPage: true });
const mine = await page.evaluate(() => document.body.innerText);
say("我的", "正文", mine.replace(/\n+/g, " | ").slice(0, 300));
{
  const p = await probe([
    ".v277-profile-hero",
    ".v277-profile-hero > div",
    ".v277-owner-avatar",
  ]);
  for (const [sel, v] of Object.entries(p)) {
    say("我的", sel, v ? judge(v.bgImage) + " " + v.bgImage.slice(0, 70) : "（元素不存在）");
  }
}

// ── 编辑资料 ────────────────────────────────────────────────────
// ── 分享个人主页（第四页的弹层，之前只改了代码没验过真机）──────────
await page
  .locator('button[aria-label="分享个人主页"]')
  .first()
  .click({ force: true, timeout: 6000 })
  .catch(() => {});
await page.waitForTimeout(1400);
{
  const card = await page.evaluate(
    () => document.querySelector(".v279-share-card")?.innerText.replace(/\n+/g, " | ") || "",
  );
  const avatarBg = await page.evaluate(() => {
    const el = document.querySelector(".v279-share-card .v279-owner-avatar");
    return el ? getComputedStyle(el).backgroundImage : "（元素不存在）";
  });
  const sheet = await page.evaluate(
    () =>
      document.querySelector(".v279-profile-share-sheet")?.innerText.replace(/\n+/g, " | ") || "",
  );
  await page.screenshot({ path: `${OUT}/07-share-sheet.png`, fullPage: true });
  say("分享个人主页", "名片", card ? `${judge(card)}「${card.slice(0, 120)}」` : "❌ 弹层没打开");
  say("分享个人主页", "头像", judge(avatarBg) + " " + String(avatarBg).slice(0, 60));
  say("分享个人主页", "正文", sheet.slice(0, 280) || "❌ 空");
  await page.locator('button[aria-label="关闭"]').first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);
}

await page.getByText("编辑资料", { exact: false }).first().click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(2000);
if (/编辑资料/.test(await page.evaluate(() => document.body.innerText))) {
  await page.screenshot({ path: `${OUT}/02-profile-edit.png`, fullPage: true });
  // ⚠️ 编辑资料 2026-09-26 换成我们自己的那份：封面/头像不再是 `.v279-profile-cover` /
  //    `.v279-owner-avatar`（那两个是公共组件的类名），字段也不再是常驻输入框
  //    （改成"点开弹层单独编辑"）。
  const p = await probe(["button[aria-label='更换封面']", "button[aria-label='更换头像']"]);
  for (const [sel, v] of Object.entries(p)) {
    say("编辑资料", sel, v ? judge(v.bgImage) + " " + v.bgImage.slice(0, 70) : "（元素不存在）");
  }
  // 字段现在是"行"，点开才是输入框 —— 这里只如实打印"有没有常驻输入框"（有反而是错的）
  const visibleInputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input, textarea"))
      .filter((el) => el.offsetParent !== null && el.type !== "file").length);
  say("编辑资料", "常驻输入框", `${visibleInputs} 个（现在的做法是点字段才展开输入）`);
  const editText = await page.evaluate(() => document.body.innerText);
  say("编辑资料", "正文", editText.replace(/\n+/g, " | ").slice(0, 300));
  await page.locator('button[aria-label="返回"], .v277-icon-button').first().click().catch(() => {});
  await page.waitForTimeout(1500);
} else {
  say("编辑资料", "页面", "❌ 没能打开编辑资料页");
}

// ── 设置 ────────────────────────────────────────────────────────
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator('button[aria-label="个人设置"]').first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1800);
if (/设置/.test(await page.evaluate(() => document.body.innerText))) {
  await page.screenshot({ path: `${OUT}/03-settings.png`, fullPage: true });
  // ⚠️ 设置页 2026-09-26 换成我们自己的那份（分组 + 本人卡片），老选择器 `.v279-settings-profile` 已经不在页面里
  const p = await probe(["main button[class*=me] > span:first-child"]);
  for (const [sel, v] of Object.entries(p)) {
    say("设置", sel, v ? judge(v.bgImage) + " " + v.bgImage.slice(0, 70) : "（元素不存在）");
  }
  const t = await page.evaluate(() => document.body.innerText);
  say("设置", "正文", t.replace(/\n+/g, " | ").slice(0, 320));
  // 设置里「理解度」那一行点开的面板：原来写死 86% / Lv.4 —— 现在走我们自己的「理解与成长」弹层
  await page
    .locator("main button[class*=row]")
    .filter({ hasText: /理解度/ })
    .first()
    .click({ timeout: 6000 })
    .catch(() => {});
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/06-settings-understanding.png`, fullPage: true });
  // 弹层的类名换过好几轮（`.v279-setting-summary` → 同事的 ConnectedSettings → 我们自己的
  // 「理解与成长」弹层），所以这里按"能读到内容的那个 sheet"兜底，别再写死一个选择器（踩过两次）。
  const panel = await page.evaluate(() => {
    const pick = (selector) =>
      document.querySelector(selector)?.innerText.replace(/\n+/g, " | ") || "";
    return (
      pick('[class*="sheet"]:not([class*="Backdrop"])') ||
      pick(".v279-setting-summary") ||
      pick(".v279-setting-sheet")
    );
  });
  say(
    "设置 · 理解度面板",
    "点开「理解度」",
    panel
      ? `${/86%/.test(panel) ? "❌ 还是写死的 86%" : "✅ 不是写死的 86%"}  「${panel.slice(0, 120)}」`
      : "❌ 面板没打开",
  );
  await page.locator('button[aria-label="关闭"]').first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(800);
} else {
  say("设置", "页面", "❌ 没能打开设置页");
}

// ── 勋章（从"我的"进去的荣誉页）──────────────────────────────────
// 设置页是二级页，底栏不在，用页头那个「返回」回"我的"
await page.locator('button[aria-label="返回"]').first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1500);
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
// 1) 切到"勋章"页签
await page
  .locator('nav.v277-profile-tabs button')
  .filter({ hasText: "勋章" })
  .first()
  .click({ timeout: 6000 })
  .catch(() => {});
await page.waitForTimeout(1200);
// 2) 点那张"成长勋章"的跳转卡
const honorCard = page.locator("button").filter({ hasText: /成长勋章/ }).first();
if (await honorCard.count()) {
  await honorCard.click({ timeout: 6000 }).catch(() => {});
}
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/04-honors.png`, fullPage: true });
{
  const t = await page.evaluate(() => document.body.innerText);
  say("勋章", "正文", t.replace(/\n+/g, " | ").slice(0, 320));
}

// ── 汇总 ────────────────────────────────────────────────────────
// ── 老会话：localStorage 里还存着那份演示身份，刷新之后必须被清掉 ──
// （用户自己那台浏览器就是这个状态，光看"新用户"是不够的）
await page.evaluate(() => {
  const key = "elfred-v278-product";
  const raw = window.localStorage.getItem(key);
  if (!raw) return;
  const state = JSON.parse(raw);
  state.phase = "ready";
  state.account = { ...(state.account || {}), onboardingComplete: true, verified: true };
  state.profile = {
    ...(state.profile || {}),
    name: "1",
    username: "harisen",
    role: "产品经理与创业者",
    bio: "正在把 Personal Agent 做成真正懂你、能行动的数字伙伴。",
    focus: "完成 Elfred 移动端体验",
    tags: ["产品", "创业"],
  };
  window.localStorage.setItem(key, JSON.stringify(state));
});
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(2500);
// 只看英雄区（名字/用户名/简介/标签都在这一块），别把动态流里的正文算进来
const legacyText = await page.evaluate(
  () => document.querySelector(".v277-profile-hero")?.innerText || "",
);
const legacyLeak = ["harisen", "正在把 Personal Agent", "产品", "创业"].find((token) =>
  legacyText.includes(token),
);
say(
  "老会话",
  "localStorage 里的演示身份",
  legacyLeak ? `❌ 刷新后还留着「${legacyLeak}」` : "✅ 刷新后已清空",
);
await page.screenshot({ path: `${OUT}/05-legacy-storage.png`, fullPage: true });

console.log("\n================ 第四页空态巡检 ================");
let bad = 0;
for (const [area, item, value] of rows) {
  if (String(value).startsWith("❌")) bad++;
  console.log(`[${area}] ${item}\n    ${value}`);
}
console.log(`\n页面报错：${errors.length}`);
for (const e of errors.slice(0, 6)) console.log(`  ! ${e.slice(0, 200)}`);
console.log(`\nRESULT: ${bad === 0 ? "ALL EMPTY" : `${bad} 处还不是空态`}`);
console.log(`截图目录：${OUT}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);

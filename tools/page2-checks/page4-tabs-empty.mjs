// 第四页三个标签（Agent 动态 / 能力 / 勋章）在"后端什么都没有"时的表现。
// ⚠️ 最左边那栏 2026-09-26 从「动态」改成「Agent 动态」：内容换成**朋友圈**那份的总览
//    （数据在 runtime 里，不是我们后端那个 /page2/feed），所以下面是空态还是真动态
//    取决于同事那份数据 —— 它只打印，不做断言。
//
// 为什么用拦截而不是直接打 8001：8001 的 profile 是空的，但它的 feed 还挂着运行记录，
// 没法把"动态也空"这条路径逼出来。这里把三个接口都拦成空，才是真正"什么都没设置"。
//
// 用法： node tools\page2-checks\page4-tabs-empty.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/page4-tabs-empty";
mkdirSync(OUT, { recursive: true });
const FILL = process.env.FILL || "用户";

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  isMobile: true,
});
const page = await context.newPage();

// —— 把"什么都没设置"的后端拦出来 ——
// 只拦读（GET）：写（PATCH）照常放行，否则保存会被挡下来、页面上多一条
// "资料没能同步到后端" 的提示，截图里就分不清是空态还是报错了。
const onlyGet = (handler) => (route) =>
  route.request().method() === "GET" ? handler(route) : route.continue();

await context.route("**/page2/profile*", onlyGet((route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      available: true, name: "", bio: "", tags: [], avatar: "", background: "",
      headline: "", level: null, daysTracked: null, credibility: null,
      identityDescribe: "", filled: false, note: "字段空就是还没设置",
    }),
  }),
));
await context.route("**/page2/feed*", onlyGet((route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ items: [], count: 0, note: "都是空的时候页面显示空态" }),
  }),
));
await context.route("**/page2/badges*", onlyGet((route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      badges: [
        { id: "first-evidence", title: "第一次成果", earned: false, progress: "已有 0 项成果" },
        { id: "five-evidence", title: "五连成果", earned: false, progress: "已有 0 项成果" },
        { id: "level-3", title: "到过 Lv.3", earned: false, progress: "最高等级 Lv.0" },
      ],
      count: 0, topLevel: 0, evidence: 0, note: "按卡片等级与成果数实时算",
    }),
  }),
));
// 理解度：后端/EMOS 什么都没算出来时返回 alignment:null。
// 这条路径决定"还没有评估 / —"那套兜底到底走不走得到。
await context.route("**/alignment*", onlyGet((route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ available: true, alignment: null, memoryCount: 0, source: "emos" }),
  }),
));

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(3000);

const rows = [];
const readTab = async (name, shot) => {
  await page
    .locator("nav.v277-profile-tabs button")
    .filter({ hasText: name })
    .first()
    .click({ timeout: 6000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${shot}`, fullPage: true });
  const body = await page.evaluate(() => {
    const el = document.querySelector(".v277-profile-body");
    return (el?.innerText || "").replace(/\n+/g, " | ");
  });
  rows.push([name, body.slice(0, 220)]);
};

await page.screenshot({ path: `${OUT}/00-profile-empty.png`, fullPage: true });
const hero = await page.evaluate(
  () => document.querySelector(".v277-profile-hero")?.innerText.replace(/\n+/g, " | ") || "",
);
rows.push(["我的 · 英雄区", hero.slice(0, 200)]);

await readTab("Agent 动态", "01-tab-agent-feed.png");
await readTab("能力", "02-tab-ability.png");
await readTab("勋章", "03-tab-honors.png");

// 设置里那一格 + 点开的面板：后端一个数都没给时的样子
await page.locator('nav button[aria-label="我的"]').first().click().catch(() => {});
await page.waitForTimeout(1200);
await page.locator('button[aria-label="个人设置"]').first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/05-settings-empty.png`, fullPage: true });
rows.push([
  "设置 · 一行",
  (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 220),
]);
await page
  // 设置页 2026-09-26 换成我们自己的分组列表：这一行现在叫「理解度」，点开是「理解与成长」弹层
  .locator("main button[class*=row]")
  .filter({ hasText: /理解度/ })
  .first()
  .click({ timeout: 6000 })
  .catch(() => {});
await page.waitForTimeout(1400);
await page.screenshot({ path: `${OUT}/06-setting-understanding.png`, fullPage: true });
rows.push([
  "设置 · 理解度面板",
  (
    await page.evaluate(
      () =>
        // 弹层类名换过几轮（.v279-setting-summary → 同事的 ConnectedSettings → 我们自己的
        // 「理解与成长」弹层），这里按"能读到内容的那个 sheet"兜底，别再写死一个选择器
        document.querySelector('[class*="sheet"]:not([class*="Backdrop"])')?.innerText.replace(/\n+/g, " | ") ||
        document.querySelector(".v279-setting-sheet")?.innerText.replace(/\n+/g, " | ") ||
        "(没打开)",
    )
  ).slice(0, 200),
]);
await page.locator('button[aria-label="关闭"]').first().click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(900);
await page.locator('button[aria-label="返回"]').first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1400);

// 勋章卡 → 荣誉勋章页（后端说三枚都没解锁时的样子）
// 从设置回来这一页会重新挂载，页签回到"Agent 动态"，所以得先切回"勋章"再点卡
await page
  .locator("nav.v277-profile-tabs button")
  .filter({ hasText: "勋章" })
  .first()
  .click({ timeout: 6000 })
  .catch(() => {});
await page.waitForTimeout(1000);
await page.locator("button").filter({ hasText: /成长勋章/ }).first().click({ timeout: 6000 }).catch(() => {});
await page.waitForTimeout(1600);
await page.screenshot({ path: `${OUT}/04-honors-page.png`, fullPage: true });
rows.push([
  "荣誉勋章页",
  (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | ").slice(0, 220),
]);

console.log("============ 第四页三个标签 · 空数据 ============");
for (const [k, v] of rows) console.log(`\n[${k}]\n    ${v}`);
console.log(`\n截图：${OUT}`);
await browser.close();

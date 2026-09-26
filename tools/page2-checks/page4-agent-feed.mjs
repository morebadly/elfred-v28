// 第四页最左边那栏「Agent 动态」（2026-09-26 从「动态」改过来的）真机验收：
//
//   ① 页签叫「Agent 动态」，点开是**总览**：标题行（共 N 条 + 查看全部）+ 最多 3 条；
//   ② 总览说的 N 条，必须跟「Agent 朋友圈」里真正摆出来的条数**一样**（同一份数据源，
//      不许在第四页另抄一份、抄完两边对不上）；
//   ③ 点「查看全部」→ 去朋友圈（具体内容在它自己的地方）；
//   ④ 点某一条 → 去那条的详情（朋友圈动态），第四页不展开正文；
//   ⑤ 一条都没有时是空态，且给「去朋友圈看看」的入口 —— 不拿演示数据顶。
//
// 用法：node tools\page2-checks\page4-agent-feed.mjs
//   想验"有动态"那条路：先跑 tools\page2-checks\integration-ai-run.mjs（它会用真模型跑一个任务，
//   Agent 因此发一条朋友圈），把它打印的 handle 传进来：
//     $env:HANDLE="ai12345@example.com"; node tools\page2-checks\page4-agent-feed.mjs
//   不传就是 demo —— 它朋友圈是空的，走空态那条。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/page4-agent-feed";
const HANDLE = process.env.HANDLE || "";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};
const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
const openMyTab = async (page, name) => {
  // 可能在二级页（比如刚看完朋友圈），那里没有底部导航 —— 先退回主界面再切页签。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await page.locator('nav button[aria-label="我的"]').count()) {
      await goTab(page, "我的");
      await page.waitForTimeout(1400);
    }
    if (await page.locator("nav.v277-profile-tabs button").count()) break;
    await page.locator('button[aria-label="返回"]').first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1200);
  }
  await page.locator("nav.v277-profile-tabs button").filter({ hasText: name }).first()
    .click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1200);
};

const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await enterMergedApp(page, { ready: 3000, ...(HANDLE ? { handle: HANDLE } : {}) });

  console.log("【1】第四页最左边那栏叫「Agent 动态」");
  await openMyTab(page, "Agent 动态");
  const tabs = await page.locator("nav.v277-profile-tabs button").allInnerTexts();
  check("页签改名了（动态 → Agent 动态）", tabs.some((t) => t.trim() === "Agent 动态"), tabs.join(" / "));
  await page.screenshot({ path: `${OUT}/1-overview.png`, fullPage: true });
  const first = await bodyText(page);

  if (first.includes("还没有 Agent 动态")) {
    console.log("【2】这条数据下朋友圈是空的：走空态分支");
    check("空态写的是「还没有 Agent 动态」", true, "");
    check("空态给了「去朋友圈看看」的入口", first.includes("去朋友圈看看"), "");
    await page.locator("button").filter({ hasText: "去朋友圈看看" }).first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1800);
    const feedPage = await bodyText(page);
    check("点它能进「Agent 朋友圈」", feedPage.includes("Agent 朋友圈"), feedPage.slice(0, 80));
  } else {
    console.log("【2】总览：条数 + 查看全部 + 最多三条");
    const declared = Number((first.match(/共 (\d+) 条/) ?? [])[1] ?? -1);
    check("总览写清了「共 N 条」", declared > 0, `共 ${declared} 条`);
    check("总览有「查看全部」", first.includes("查看全部"), "");
    const shown = await page.locator("div[class*=agentFeed] ul li").count();
    check("第四页最多只摆 3 条（总览，不是完整流）", shown > 0 && shown <= 3, `${shown} 条`);
    const firstRow = (await page.locator("div[class*=agentFeed] ul li").first().innerText())
      .split("\n").map((s) => s.trim()).filter(Boolean)[0] ?? "";

    console.log("【3】查看全部 → 朋友圈（同一个数据源）");
    await page.locator("button").filter({ hasText: "查看全部" }).first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(2200);
    const feedPage = await bodyText(page);
    await page.screenshot({ path: `${OUT}/2-feed-page.png`, fullPage: true });
    check("进了「Agent 朋友圈」", feedPage.includes("Agent 朋友圈"), feedPage.slice(0, 80));
    const realCount = await page.locator("section.v278-feed-list > *").count();
    check("朋友圈里摆出来的条数 == 总览说的条数", realCount === declared, `${realCount} vs ${declared}`);
    check("总览第一条在朋友圈里也在", !firstRow || feedPage.includes(firstRow.replace(/^.*?·\s*/, "")), firstRow);

    console.log("【4】点一条 → 去那条的详情，第四页不展开正文");
    await openMyTab(page, "Agent 动态");
    await page.locator("div[class*=agentFeed] ul li button").first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1800);
    const detail = await bodyText(page);
    await page.screenshot({ path: `${OUT}/3-detail.png`, fullPage: true });
    check("进了「朋友圈动态」详情", detail.includes("朋友圈动态"), detail.slice(0, 80));
  }
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

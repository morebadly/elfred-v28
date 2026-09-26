// 「轻量测试 + 五维动态分」全流程验收（以用户角度走一遍）。
//
// 口径（2026-09-26 用户定过，别再改回去）：
//   · 新用户进第二页，能力洞察是**空态**（有「开始测试」），**不给一张全 0 的五维图**；
//   · 答完 22 题 → 立刻有一张起点图（每一维都有值、都在及格线 60 以下）+ 一个综合分；
//   · 起点**计入综合分**：界面不出现"自评""不计入综合分"这类字样，雷达只有一种画法；
//   · 之后按真实表现动：做出成果往上走、被判错会掉下来（两个方向都真的动）。
//
// 流程：注册新账号 → 空态 → 22 题 → 起点 → 回第二页看雷达与综合分 → 用 API 造真成果
//      （1 条本人验收 → 涨一点；再加 2 条外部 → 涨上去；判错 1 条 → 掉下来）→ 复查页面
//      → **跑完把探针账号的数据清干净**（不留垃圾账号、不留假数据）。
//
// 用法：node tools\page2-checks\questionnaire-check.mjs
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const API_DIR = process.env.PAGE2_API_DIR || "C:/Users/35057/Desktop/elfred-page2-api";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/questionnaire";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};

const api = (path, handle) =>
  fetch(`${API}${path}`, { headers: { "X-Elfred-User": String(handle) } })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
const post = (path, handle, body) =>
  fetch(`${API}${path}`, {
    method: "POST",
    headers: { "X-Elfred-User": String(handle), "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const text = (page) => page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));

const browser = await chromium.launch({ channel: "msedge" });
let handle = "";
try {
  const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));

  console.log("【1】新账号：能力洞察是空态，不给全 0 的图");
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  handle = await enterMergedApp(page, { ready: 3000, register: true });
  check("注册进主界面", Boolean(handle), String(handle));
  await goTab(page, "知识");
  await page.waitForTimeout(3000);
  const empty = await text(page);
  await page.screenshot({ path: `${OUT}/1-empty.png`, fullPage: true });
  check("空态里有「开始测试」", empty.includes("开始测试") && empty.includes("还没有能力洞察"), empty.slice(0, 90));
  check("空态里没有「自评」这类字样", !empty.includes("自评"), "");

  console.log("【2】点进去答题（22 题，一次一题）");
  await page.locator("button:visible").filter({ hasText: "开始测试" }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const q1 = await text(page);
  await page.screenshot({ path: `${OUT}/2-question.png`, fullPage: true });
  check("进了「轻量测试」并且有进度", /轻量测试/.test(q1) && /第 1 \/ 22 题/.test(q1), q1.slice(0, 90));

  const total = 22;
  let answered = 0;
  for (let i = 1; i <= total; i += 1) {
    const options = page.locator("main button[aria-pressed]");
    const count = await options.count();
    if (count < 2) {
      check(`第 ${i} 题的选项渲染出来了`, false, `只找到 ${count} 个选项`);
      break;
    }
    // 都选中间那档 = 一个"不偏不倚"的作答者（反向题在中间也是中间，不会自相矛盾）
    await options.nth(Math.floor(count / 2)).click({ timeout: 6000 });
    answered += 1;
    await page.waitForTimeout(180);
    await page.locator("button:visible").filter({ hasText: i === total ? "完成" : "下一步" }).first()
      .click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(320);
  }
  await page.waitForTimeout(2500);
  const done = await text(page);
  await page.screenshot({ path: `${OUT}/3-start.png`, fullPage: true });
  check("22 题都答上了", answered === total, `${answered}/${total}`);
  check("完成页给的是「你的起点」", /你的起点/.test(done), done.slice(0, 120));
  check("完成页不提「自评」「不计入综合分」", !/自评|不计入综合分/.test(done), "");

  console.log("【3】后端：测完就有数（低起点），而且已经进综合分");
  const state1 = await api("/insight/abilities", handle);
  const axes1 = state1?.axes ?? [];
  const values1 = axes1.map((a) => a.value);
  check("五维都有值（不是未知、也不是 0）",
        axes1.length === 5 && values1.every((v) => typeof v === "number" && v > 15),
        values1.join(" / "));
  check("每一维都压在及格线（60）之下", values1.every((v) => v < 60), values1.join(" / "));
  check("综合分测完就有（起点也算）",
        typeof state1?.composite === "number" && state1.composite < 60, String(state1?.composite));
  check("五维的来源都是 baseline（起点）",
        axes1.every((a) => a.source === "baseline"),
        axes1.map((a) => a.source).join(" / "));
  check("后端认得出「做过测试」", state1?.started === true, String(state1?.started));

  console.log("【4】回第二页：雷达画出来、综合分有数，界面不再出现「自评」");
  await page.locator("button:visible").filter({ hasText: "去看看我的能力洞察" }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const back = await text(page);
  await page.screenshot({ path: `${OUT}/4-radar.png`, fullPage: true });
  check("雷达上有「起点来自那次测试」", back.includes("起点来自那次测试"), back.slice(0, 120));
  // 用户明确说过：雷达上那句「做完事会变，久了也会回落」的角标多余，删掉。
  check("雷达说明上没有那个多余角标", !/做完事会变|回落/.test(back), "");
  // 再挂一遍"起点来自测试 / 做完事并确认结果…"就是重复 —— 同一句起点说明只该出现一次。
  check("起点说明没有重复写第二遍", (back.match(/起点来自/g) ?? []).length === 1,
        `出现 ${(back.match(/起点来自/g) ?? []).length} 次`);
  check("综合分那格显示的是数字（不是未知）",
        back.includes(String(state1?.composite)) && !/综合能力[^]{0,24}未知/.test(back),
        "期望 " + state1?.composite);
  check("整页没有「自评」「不计入综合分」", !/自评|不计入综合分/.test(back), "");

  console.log("【5】真造成果：1 条本人验收 → 涨一点；再加 2 条外部 → 涨上去；判错 → 掉下来");
  const card = await post("/capabilities", handle,
    { title: "探针卡交付", copyText: "测五维动态", type: "Skill", dimension: "交付" });
  check("建出探针卡", Boolean(card?.id), String(card?.id));
  const before = (await api("/insight/abilities", handle)).axes.find((a) => a.label === "交付").value;
  // 0.8 = 本人验收（algorithms.WEIGHT.accepted）→ 人的维度分里只算 0.35 档
  await post("/evidence", handle, { title: "本人验收的成果", card_id: card.id, outcome: 90, weight: 0.8, difficulty: 1.0 });
  const one = await api("/insight/abilities", handle);
  const oneValue = one.axes.find((a) => a.label === "交付").value;
  check("一条「本人验收」只让它涨一点（不超过 55）", oneValue > before && oneValue < 55, `${before} → ${oneValue}`);
  check("这一维还在 growing（还没够 3 条）",
        one.axes.find((a) => a.label === "交付").source === "growing",
        one.axes.find((a) => a.label === "交付").source);

  await post("/evidence", handle, { title: "外部结果一", card_id: card.id, outcome: 90, weight: 1.0, difficulty: 1.0 });
  await post("/evidence", handle, { title: "外部结果二", card_id: card.id, outcome: 90, weight: 1.0, difficulty: 1.0 });
  const three = (await api("/insight/abilities", handle)).axes.find((a) => a.label === "交付");
  check("外部成果把它推上去（>65）", three.value > 65, String(three.value));
  check("够 3 条之后标 evidence", three.source === "evidence", three.source);

  const list = await api("/evidence", handle);
  const target = (list ?? []).find((row) => row.title === "外部结果二");
  await post(`/evidence/${target?.id}/verdict`, handle, { verdict: "disputed" });
  const dropped = (await api("/insight/abilities", handle)).axes.find((a) => a.label === "交付");
  check("判错会让这一维掉下来（≥5 分）", dropped.value < three.value - 5, `${three.value} → ${dropped.value}`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await goTab(page, "知识");
  await page.waitForTimeout(3500);
  const after = await text(page);
  await page.screenshot({ path: `${OUT}/5-radar-after.png`, fullPage: true });
  check("雷达说明改成「交付 已经按真实成果动过」", /已经按真实成果动过/.test(after), after.slice(0, 140));
  check("动过之后仍然没有那个角标", !/做完事会变|回落/.test(after), "");
  check("刷新之后页面没有报错", errors.length === 0, errors.join(" / "));
} finally {
  await browser.close();
}

console.log("【6】把探针账号的数据清掉（不留垃圾账号）");
let cleaned = true;
if (handle) {
  try {
    execFileSync("py", ["-3", "tools/reset_sample_data.py", "--user", String(handle), "--apply"],
      { cwd: API_DIR, stdio: "pipe" });
  } catch (error) {
    cleaned = false;
    console.log("    清库失败：" + String(error.message).slice(0, 200));
  }
  const after1 = await api("/insight/abilities", handle);
  const empty1 = (after1?.axes ?? []).every((a) => a.value === null);
  check("清理后这个账号真的回到空态", cleaned && empty1 && after1?.composite === null,
        `axes=${(after1?.axes ?? []).map((a) => a.value).join("/")} composite=${after1?.composite}`);
}

const bad = results.filter((x) => !x.ok);
console.log(`\n${bad.length ? "❌ FAILED" : "✅ ALL PASSED"}  ${results.length - bad.length}/${results.length}`);
console.log(`截图：${OUT}`);
if (bad.length) {
  bad.forEach((b) => console.log(`   - ${b.name}: ${b.detail}`));
  process.exit(1);
}

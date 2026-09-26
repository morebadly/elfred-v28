// 后端贯通专项巡检：同事那边（首页/第三页）**做完一件事并验收**之后，
// 我这边（第二/四页）到底有没有长出东西。
//
// 这是"前端融合了，后端也要融合"的验收脚本。它跑的是真链路：
//   他的 app 注册 → 建任务 → 确认 → 起跑（真模型）→ 验收 →
//   我后端把这条验收翻译成「成果」→ 卡片分/理解度/成果数跟着动
//
// 验六件事：
//   1. 验收前，我这边这个账号**什么都没有**（不然"长出来了"没有说服力）；
//   2. 验收后跑桥接，真落了 1 条成果，且标题就是他写的那句目标；
//   3. 对应的能力卡真的建出来了，分数 > 基线、成果数 1、等级 ≥1；
//   4. 再同步一次 **不重复计分**（幂等）；
//   5. 理解度 / 雷达读到这条成果（不是只在 evidence 表里躺着）；
//   6. 浏览器里登录这个账号，第二页真的画出来了（截图留证）。
//
// 用法：node tools\page2-checks\bridge-check.mjs
// 前置：3100 整合版在跑（带模型 key）+ 8000 后端在跑（带 ELFRED_BRIDGE_DB）。
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.ELFRED_BASE || "http://127.0.0.1:3100";
const API = `${BASE}/api/elfred`;
const P2 = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/bridge";
const PW = "elfred-test-2026";
const handle = `br${Date.now() % 100000}@example.com`;

mkdirSync(OUT, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};

// ── 他那边的调用（Origin + x-elfred-client + Idempotency-Key，缺一个就 403/400）──
let cookie = "", csrf = "";
async function call(path, body, extra = {}) {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json", "X-Elfred-Client": "1", Origin: BASE }),
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text: text.slice(0, 300) };
}
const command = (action, input) =>
  call("/commands", { action, input }, { "Idempotency-Key": crypto.randomUUID() });

// ── 我这边的调用（身份走 X-Elfred-User，就是登录的 handle）──
async function p2(path, init = {}) {
  const res = await fetch(`${P2}${path}`, {
    ...init,
    headers: { "X-Elfred-User": handle, ...(init.headers || {}) },
  });
  if (!res.ok) return null;
  return res.json();
}

// ── 1. 他那边：注册 → 建任务 → 确认 → 起跑 → 等产出 ──
console.log(`\n【1】他那边注册 ${handle}`);
let r = await call("/auth/register", { handle, password: PW, name: "桥接冒烟" });
if (r.status !== 200) {
  console.log(`    注册失败：${r.status} ${r.text}`);
  process.exit(1);
}
r = await call("/session");
csrf = r.json?.csrf || "";
console.log(`    csrf=${csrf ? "有" : "无"}`);

const goal = "把这段课程通知整理成三条待办，标出负责人和截止时间。";
console.log("【2】建任务 → 确认 → 起跑");
r = await command("task.create", {
  goal, system: "execute", capability_id: "execute-0", mode: "compose", review_mode: "auto", source_refs: [],
});
const taskId = r.json?.id;
if (!taskId) {
  console.log(`    建任务失败：${r.status} ${r.text}`);
  process.exit(1);
}
let version = (await call(`/objects/${taskId}`)).json?.version;
await command("task.confirm", { id: taskId, version, confirm: true, model_consent: true });
version = (await call(`/objects/${taskId}`)).json?.version;
await command("run.start", { id: taskId, version });

console.log("【3】等模型回执（最多 120 秒）");
let status = "", hasOutput = false;
for (let i = 1; i <= 40; i++) {
  await new Promise((s) => setTimeout(s, 3000));
  const snap = await call("/bootstrap");
  const task = (snap.json?.objects?.task || []).find((t) => t.id === taskId);
  status = String(task?.data?.status || "");
  const run = (snap.json?.objects?.run || []).find((x) => x.id === task?.data?.run_id);
  hasOutput = (run?.data?.receipts || []).some((x) => typeof x.output === "string" && x.output.trim());
  process.stdout.write(`\r    ${i * 3}s  任务=${status}  回执=${hasOutput ? "有" : "无"}   `);
  if (hasOutput || ["failed", "blocked", "cancelled", "completed"].includes(status)) break;
}
console.log("");
check("模型真产出了回执", hasOutput, `任务状态=${status}`);
if (!hasOutput) {
  console.log("  没有产出就不必往下验了（先查模型配置）");
  process.exit(1);
}

// ── 2. 验收**之前**：我这边必须是空的 ──
console.log("【4】验收前，我这边这个账号应该是空的");
const beforeEvidence = (await p2("/evidence")) || [];
const beforeCards = (await p2("/capabilities")) || [];
check("验收前 成果 0 条", beforeEvidence.length === 0, `${beforeEvidence.length} 条`);
check("验收前 能力卡 0 张", beforeCards.length === 0, `${beforeCards.length} 张`);

// ── 3. 他那边验收 ──
console.log("【5】他那边验收（task.accept）");
const taskNow = (await call(`/objects/${taskId}`)).json;
r = await command("task.accept", {
  id: taskId, version: taskNow?.version, accept: true, satisfaction: "satisfied",
});
check("验收成功", r.status === 200, `status=${r.status} ${r.json?.artifact_id ? "产出知识卡 " + r.json.artifact_id : r.text}`);

// ── 4. 桥接同步 ──
console.log("【6】跑桥接同步（我后端读他那本库）");
const sync1 = await fetch(`${P2}/page2/bridge/sync`, { method: "POST" }).then((x) => x.json());
check("桥接真落了 1 条", sync1.added >= 1, `看到 ${sync1.seen} 条验收 / 新落 ${sync1.added} 条`);

const evidence = (await p2("/evidence")) || [];
const cards = (await p2("/capabilities")) || [];
const detail = evidence[0] ? await p2(`/evidence/${evidence[0].id}`) : null;
check("第二页多了 1 条成果", evidence.length === 1, `${evidence.length} 条`);
check("成果标题就是他写的那句目标", evidence[0]?.title === goal, `「${evidence[0]?.title || ""}」`);
check("成果来源标的是「验收的成果」", detail?.source?.label === "验收的成果", detail?.source?.label || "");
check("成果算在「今天」", detail?.day === "今天", detail?.day || "");

const card = cards[0];
check("对应能力卡建出来了", Boolean(card), card ? `${card.title}（${card.id}）` : "没建出来");
check("卡上记了 1 项成果", card?.evidence === 1, `evidence=${card?.evidence}`);
check("卡分数高于基线 60", typeof card?.score === "number" && card.score > 60, `score=${card?.score}`);
check("卡维度来自他的系统（execute→交付）", card?.dimension === "交付", card?.dimension || "");

// ── 5. 幂等 ──
const sync2 = await fetch(`${P2}/page2/bridge/sync`, { method: "POST" }).then((x) => x.json());
const evidence2 = (await p2("/evidence")) || [];
check("再同步一次不重复计分（幂等）", sync2.added === 0 && evidence2.length === 1,
      `新落 ${sync2.added} 条 / 成果仍是 ${evidence2.length} 条`);

// ── 6. 理解度 / 雷达读到这条 ──
console.log("【7】理解度与雷达");
const insight = await p2("/insight/abilities");
const alignment = await p2("/alignment");
// ⚠️ 字段是 `axes` + `label/value`（不是 dimensions/name）——第一次写错，白报一条失败
const dims = (insight?.axes || []).map((d) => `${d.label}=${d.value}`);
// ⚠️ 断言口径改过：**1 条成果不该给维度结论**。新规则是"少于 3 条真实成果 → 不给 θ，
// 只显示样本不足"（见 services/dimensions.py 的 MIN_EVIDENCE）。所以这里验的是
// **这条成果确实进了估计**（samples=1、还差 2 条），而不是"维度必须有值"。
const delivery = (insight?.axes || []).find((d) => d.label === "交付");
check("这条成果进了「交付」的估计，但样本不足仍显示未知",
      delivery?.samples === 1 && delivery?.value === null && delivery?.missing === 2,
      `samples=${delivery?.samples} value=${delivery?.value} missing=${delivery?.missing}（全维：${dims.join(" ")}）`);
// 综合分要**至少 3 个维度有数据**才给（1/5 个维度不该报"综合能力"）。
// 新账号只有"交付"一维有值，所以这里应该**没有**综合分，而不是一个数。
check("维度不足时不给综合分（不拿 1/5 维冒充综合）",
      insight?.composite === null && insight?.outcomeCount === 1,
      `composite=${insight?.composite} outcomeCount=${insight?.outcomeCount}`);
check("理解度能读到这条成果", Boolean(alignment), alignment ? `stage=${alignment.stage}` : "读不到");

// ── 7. 浏览器里真看一眼 ──
console.log("【8】浏览器登录这个账号，看第二页画出来没有");
const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await (await browser.newContext({
    viewport: { width: 430, height: 932 }, isMobile: true,
  })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`${BASE}/v28`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const first = page.locator("input:visible").first();
  if (await first.count()) await first.fill(handle).catch(() => {});
  await page.locator("button:visible").filter({ hasText: "继续" }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const pw = page.locator("input[type=password]:visible").first();
  if (await pw.count()) await pw.fill(PW).catch(() => {});
  await page.locator("button:visible").filter({ hasText: /创建账号并继续|登录并继续/ }).first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.locator("button:visible").filter({ hasText: /稍后继续/ }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator('nav button[aria-label="知识"]').first().click({ timeout: 8000 }).catch(async () => {
    await page.locator("button:visible").filter({ hasText: /^知识$/ }).first().click({ timeout: 8000 }).catch(() => {});
  });
  await page.waitForTimeout(5000);
  const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
  await page.screenshot({ path: `${OUT}/page2-after-accept.png`, fullPage: true });
  check("第二页画出了这张卡（卡名「执行规划」）", text.includes(card?.title || "@@"), text.slice(0, 150));
  check("知识库里出现了这条成果", text.includes(goal.slice(0, 12)), "");
  check("页面没有报错", errors.length === 0, errors.join(" / "));

  // 知识库那张卡是**固定高度的一行布局**，标题/副标题都得夹住。
  // 桥接过来的标题是用户写的整句目标（比演示数据长得多），第一次跑就把它顶穿了
  // （折成三行、压在副标题上）。这里量出来，别靠肉眼看截图。
  const fit = await page.evaluate(() => {
    const card = document.querySelector(".v277-knowledge-overview .v277-progress-cards > button");
    if (!card) return null;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left),
               right: Math.round(r.right), h: Math.round(r.height),
               scrollW: el.scrollWidth, clientW: el.clientWidth,
               padRight: Math.round(parseFloat(getComputedStyle(el).paddingRight) || 0) };
    };
    return { card: box(card), title: box(card.querySelector("b")),
             note: box(card.querySelector("small")), delta: box(card.querySelector("strong")),
             titleText: card.querySelector("b")?.textContent || "" };
  });
  const fits = fit && fit.card && fit.title && fit.note
    && fit.title.bottom <= fit.note.top + 1          // 标题没压到副标题
    && fit.note.bottom <= fit.card.bottom + 1        // 副标题没顶出卡
    && fit.title.h <= 24                             // 标题真是一行
    // 标题和右边那个 "+1" 不能叠。注意 title.right 含 padding，
    // 真正会被画出来的文字停在"内容盒右边"（right − paddingRight），拿它跟数字的左边比。
    && (!fit.delta || !fit.delta.h || fit.title.right - fit.title.padRight <= fit.delta.left + 1);
  check("知识库的卡没被长标题顶穿（标题单行、没压行）", Boolean(fits),
        fit ? `卡高 ${fit.card.h} 标题 h${fit.title.h} ${fit.title.top}→${fit.title.bottom} 副标题 ${fit.note.top}→${fit.note.bottom}` : "找不到卡");
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

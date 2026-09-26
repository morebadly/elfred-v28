// 第二页（能力库 / 记忆库）+ 第四页（我的）**逐屏**扫一遍：
//   · 每一屏截图 + 抓正文
//   · 统一查几类"给用户看不该出现"的东西：
//       - 示例素材图（reference-*.png / profile-reference.png）
//       - 机械步骤名（step_1_skill_step / 步骤 1…）
//       - 演示身份（harisen / Harisen）
//       - JS 漏出来的脏值（undefined / null / NaN / [object Object]）
//   · 记录页面报错与 console error
//
// 用法： node tools\page2-checks\full-sweep-pages24.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/full-sweep";
mkdirSync(OUT, { recursive: true });
const FILL = process.env.FILL || "用户";

const BAD_ASSET = [
  "profile-reference",
  "reference-knowledge",
  "reference-memory",
  "reference-home",
  "reference-community",
  "reference-messages",
  "reference-player",
];
const BAD_TEXT = [
  { re: /step[_-]?\d+[_-]?[a-z]|skill_step/i, why: "机械步骤名" },
  { re: /步骤\s*\d+/, why: "占位步骤名" },
  { re: /harisen|Harisen/, why: "演示身份" },
  { re: /产品负责人/, why: "演示身份（记忆库那颗胶囊）" },
  { re: /\bundefined\b|\bNaN\b|\[object Object\]/, why: "JS 脏值" },
  { re: /复用 .* 的已验证 Elfred 工作流/, why: "蒸馏器模板句" },
  { re: /由\s{1,}写入|由\s+·/, why: "空署名（由　写入）" },
  { re: /《[^》]{0,40}《/, why: "书名号套书名号" },
  { re: /\*\*|^\s*[-–—]\s+\S/m, why: "裸 markdown 记号（** / 段首 -）" },
];

const browser = await chromium.launch({ channel: "msedge" });
const page = await (
  await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 160)}`);
});

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

const findings = [];
const shots = [];
let index = 0;

async function capture(name, waitMs = 1500) {
  await page.waitForTimeout(waitMs);
  index += 1;
  const file = `${String(index).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
  shots.push(file);
  const info = await page.evaluate((assets) => {
    const assetHits = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none") continue;
      for (const a of assets) if (bg.includes(a)) assetHits.push(`${el.className || el.tagName} -> ${a}`);
    }
    return {
      text: document.body.innerText.replace(/\n+/g, " | "),
      assetHits: [...new Set(assetHits)].slice(0, 6),
    };
  }, BAD_ASSET);
  const hitText = [];
  for (const rule of BAD_TEXT) {
    const m = info.text.match(rule.re);
    if (m) hitText.push(`${rule.why}：${m[0]}`);
  }
  if (info.assetHits.length || hitText.length) {
    findings.push({ screen: name, assets: info.assetHits, text: hitText });
  }
  return info.text;
}

const clickText = (re, opts = {}) =>
  page.locator("button").filter({ hasText: re }).first().click({ timeout: 6000, ...opts }).catch(() => {});
const back = () => page.locator('button[aria-label="返回"]').first().click({ timeout: 5000 }).catch(() => {});
const close = () => page.locator('button[aria-label="关闭"]').first().click({ timeout: 5000 }).catch(() => {});
const nav = (label) => page.locator(`nav button[aria-label="${label}"]`).first().click().catch(() => {});

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();

// ── 第二页 ────────────────────────────────────────────────
await nav("知识");
await capture("p2-能力库");
for (const f of ["Skill", "Mini App", "Agent", "全部"]) {
  await page.locator("button").filter({ hasText: new RegExp(`^${f}$`) }).first().click({ timeout: 5000 }).catch(() => {});
  await capture(`p2-筛选-${f}`, 900);
}
await page.locator(".v277-ability-cards > button").first().click({ timeout: 6000 }).catch(() => {});
await capture("p2-能力卡详情");
await close();
await page.locator('button[aria-label*="理解度"]').first().click({ timeout: 6000 }).catch(() => {});
await capture("p2-理解度-等级");
await clickText(/荣誉勋章/);
await capture("p2-理解度-勋章");
await close();
await clickText(/查看全部/);           // 知识库 / 成果
await capture("p2-知识库");
await page.locator("button").filter({ hasText: /跑了一次|成果/ }).first().click({ timeout: 6000 }).catch(() => {});
await capture("p2-成果详情");
await back();
await back();
await nav("知识");
await page.locator("button").filter({ hasText: /记忆库/ }).first().click({ timeout: 6000 }).catch(() => {});
await capture("p2-记忆库");
await clickText(/查看关系图/);
await capture("p2-关系图");
await back();

// ── 第四页 ────────────────────────────────────────────────
await nav("我的");
await capture("p4-我的-agent动态");
await page.locator("nav.v277-profile-tabs button").filter({ hasText: "能力" }).first().click().catch(() => {});
await capture("p4-我的-能力");
await page.locator('[class*="cardList"] li button').first().click({ timeout: 6000 }).catch(() => {});
await capture("p4-能力卡详情");
await close();
await page.locator("nav.v277-profile-tabs button").filter({ hasText: "勋章" }).first().click().catch(() => {});
await capture("p4-我的-勋章tab");
await clickText(/成长勋章/);
await capture("p4-荣誉勋章页");
await back();
await page.locator('button[aria-label="分享个人主页"]').first().click({ force: true, timeout: 6000 }).catch(() => {});
await capture("p4-分享主页");
await close();
await clickText(/编辑资料/);
await capture("p4-编辑资料");
await back();
await page.locator('button[aria-label="个人设置"]').first().click({ timeout: 6000 }).catch(() => {});
await capture("p4-设置");
await clickText(/Elfred 对我的理解/);
await capture("p4-设置-理解度");
await close();
await back();

console.log("================ 两页全量巡航 ================");
console.log(`共 ${shots.length} 屏：${shots.join("、")}`);
if (findings.length === 0) {
  console.log("\n✅ 没有发现 示例素材图 / 机械步骤名 / 演示身份 / 脏值 / 模板句");
} else {
  console.log(`\n❌ ${findings.length} 屏有问题：`);
  for (const f of findings) {
    console.log(`\n【${f.screen}】`);
    for (const a of f.assets) console.log(`   · 示例图：${a}`);
    for (const t of f.text) console.log(`   · ${t}`);
  }
}
console.log(`\n页面报错/console error：${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 8)) console.log(`   ! ${e}`);
console.log(`\n截图：${OUT}`);
await browser.close();
process.exit(findings.length === 0 && errors.length === 0 ? 0 : 1);

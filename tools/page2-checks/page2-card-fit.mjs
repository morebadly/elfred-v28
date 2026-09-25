// 量能力卡组里每张卡的"内容装不装得下"：
//   · 卡片自身 clientHeight vs scrollHeight（溢出多少）
//   · 标题 / 副文案 各自有没有被裁掉（scrollHeight > clientHeight，或 clamp 后行数不够）
//   · 每块的高度占了多少
// 用来定位"文字超出范围"到底出在哪一块，改完再跑一次做对照。
//
// 用法： node tools\page2-checks\page2-card-fit.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/card-fit";
mkdirSync(OUT, { recursive: true });
const FILL = process.env.FILL || "用户";

const browser = await chromium.launch({ channel: "msedge" });
const page = await (
  await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
).newPage();

async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await walkOnboarding();
await page.locator('nav button[aria-label="知识"]').first().click().catch(() => {});
await page.waitForTimeout(3000);
// 卡轨滑到最左，保证第一张量得准
await page.evaluate(() => {
  document.querySelectorAll(".v277-ability-cards").forEach((el) => (el.scrollLeft = 0));
});
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/cards.png`, fullPage: true });

const report = await page.evaluate(() => {
  // 把"到底哪条规则在起作用"挖出来：遍历所有样式表，看谁匹配得上
  const matched = (el, prop) => {
    const hits = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      const walk = (list, media) => {
        for (const rule of Array.from(list)) {
          if (rule.media && rule.cssRules) {
            walk(rule.cssRules, rule.conditionText || rule.media.mediaText);
            continue;
          }
          if (!rule.selectorText || !rule.style) continue;
          if (rule.style.getPropertyValue(prop) === "") continue;
          let ok = false;
          try {
            ok = el.matches(rule.selectorText);
          } catch {
            ok = false;
          }
          if (!ok) continue;
          hits.push(
            `${rule.style.getPropertyValue(prop)}${rule.style.getPropertyPriority(prop) ? "!" : ""}` +
              `  ←  ${media ? `@media ${media} ` : ""}${rule.selectorText.slice(0, 90)}`,
          );
        }
      };
      walk(rules, "");
    }
    return hits;
  };
  const out = [];
  const rail = document.querySelector(".v277-ability-cards");
  const railInfo = rail
    ? {
        height: getComputedStyle(rail).height,
        box: `${rail.clientHeight}/${rail.scrollHeight}`,
        rules: matched(rail, "height"),
      }
    : null;
  // 整页装不装得下：这一屏是"一屏放下"的设计，内容比容器高就会被底栏盖住
  const scroll = document.querySelector(".v277-library-scroll");
  const nav = document.querySelector("nav.v277-tabbar, .v277-tabbar, .v277-bottom-bar");
  const lastCard = document.querySelector(".v277-cave-section, .v277-radar-card");
  const pageFit = {
    scrollBox: scroll ? `${scroll.clientHeight}/${scroll.scrollHeight}` : "（找不到滚动区）",
    scrollOverflow: scroll ? scroll.scrollHeight - scroll.clientHeight : null,
    navTop: nav ? Math.round(nav.getBoundingClientRect().top) : null,
    lastBottom: lastCard ? Math.round(lastCard.getBoundingClientRect().bottom) : null,
  };
  for (const card of document.querySelectorAll(".v277-ability-cards > button")) {
    const cs = getComputedStyle(card);
    const row = {
      card: card.querySelector("b")?.textContent?.trim().slice(0, 24) || "(无标题)",
      cardBox: `${Math.round(card.clientHeight)} / scroll ${Math.round(card.scrollHeight)}`,
      overflowY: card.scrollHeight - card.clientHeight,
      cssHeight: cs.height,
      alignSelf: cs.alignSelf,
      heightRules: matched(card, "height"),
      pad: `${cs.paddingTop}/${cs.paddingBottom}`,
      parts: [],
    };
    for (const el of card.children) {
      const s = getComputedStyle(el);
      const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 26);
      // scrollHeight 比 clientHeight 大几像素，多半只是行盒下沿的空白（字没有少），
      // 超过 4px 才算真的把字裁掉了。否则探针会天天报假警，没人再信它。
      const cut = el.scrollHeight - el.clientHeight;
      const cutLabel =
        cut > 4 ? `✂️ 被裁 ${cut}px` : cut > 1 ? `~ 行盒余量 ${cut}px` : "✅";
      row.parts.push({
        tag: `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0].slice(0, 18)}`,
        h: Math.round(el.getBoundingClientRect().height),
        box: `${Math.round(el.clientHeight)}/${Math.round(el.scrollHeight)}`,
        lh: s.lineHeight,
        fs: s.fontSize,
        clip: s.webkitLineClamp || "-",
        cut,
        cutLabel,
        text,
      });
    }
    out.push(row);
  }
  return { railInfo, pageFit, rows: out };
});

console.log("================ 能力卡装得下吗 ================");
if (report.pageFit) {
  const f = report.pageFit;
  console.log(
    `\n【整页】滚动区 ${f.scrollBox}  →  超出 ${f.scrollOverflow}px` +
      (f.navTop !== null ? `   底栏顶 ${f.navTop}` : "") +
      (f.lastBottom !== null ? `   最后一块底 ${f.lastBottom}` : ""),
  );
}
if (report.railInfo) {
  console.log(`\n【卡轨】computed height ${report.railInfo.height}  box ${report.railInfo.box}`);
  for (const r of report.railInfo.rules) console.log(`   height: ${r}`);
}
for (const r of report.rows) {
  console.log(`\n【卡】${r.card}`);
  console.log(
    `   卡片高 ${r.cardBox}  →  竖向溢出 ${r.overflowY}px   computed ${r.cssHeight}  align-self ${r.alignSelf}  padding ${r.pad}`,
  );
  for (const h of r.heightRules) console.log(`   height: ${h}`);
  for (const p of r.parts) {
    console.log(
      `   - ${p.tag.padEnd(20)} 高 ${String(p.h).padStart(3)}  ${p.box}  fs/lh ${p.fs}/${p.lh}  clamp ${p.clip}  ${p.cutLabel}  「${p.text}」`,
    );
  }
}
const worst = report.reduce((m, r) => Math.max(m, r.overflowY), 0);
console.log(`\n最严重的一张溢出：${worst}px`);
console.log(`截图：${OUT}/cards.png`);
await browser.close();

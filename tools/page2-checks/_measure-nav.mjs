// 量一下第二页最后一块和底栏的位置关系（换了他的公共 CSS 之后要确认没被挡住）
import { chromium } from "playwright";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const browser = await chromium.launch({ channel: "msedge" });
const page = await (
  await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true })
).newPage();
await page.goto(APP, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
await enterMergedApp(page);
await goTab(page, "知识");
await page.waitForTimeout(3000);

const m = await page.evaluate(() => {
  const nav = document.querySelector("nav.v277-bottom") || document.querySelector(".v277-bottom-wrap");
  // 量**卡片本体**，不是外层 section（section 自带内边距，压到底栏也无所谓）
  const last = document.querySelector(".v277-radar-card") || document.querySelector(".v277-cave-section");
  const section = document.querySelector(".v277-cave-section");
  // 真正可见内容的最底边（排除纯留白/装饰）
  let deepest = null;
  if (section) {
    for (const el of Array.from(section.querySelectorAll("*"))) {
      const r = el.getBoundingClientRect();
      if (r.height < 8 || r.width < 8) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.opacity === "0") continue;
      if (!el.textContent?.trim() && !el.querySelector("canvas, svg, img")) continue;
      const bottom = Math.round(r.bottom);
      if (deepest === null || bottom > deepest.bottom) {
        deepest = { bottom, cls: String(el.className).slice(0, 26) || el.tagName };
      }
    }
  }
  return {
    navClass: nav ? String(nav.className) : null,
    navTop: nav ? Math.round(nav.getBoundingClientRect().top) : null,
    lastBottom: last ? Math.round(last.getBoundingClientRect().bottom) : null,
    lastIs: last ? String(last.className).slice(0, 30) : null,
    sectionBottom: section ? Math.round(section.getBoundingClientRect().bottom) : null,
    deepest,
  };
});
const gap = m.navTop !== null && m.lastBottom !== null ? m.navTop - m.lastBottom : null;
console.log(
  `底栏(${m.navClass}) top=${m.navTop}  卡片(${m.lastIs}) bottom=${m.lastBottom}  间隙=${gap}px  外层section bottom=${m.sectionBottom}`,
);
if (m.deepest) {
  const d = m.navTop - m.deepest.bottom;
  console.log(
    `最靠下的可见内容：${m.deepest.cls} bottom=${m.deepest.bottom}  →  ${d >= 0 ? `✅ 在底栏上方留 ${d}px` : `❌ 进底栏 ${-d}px`}`,
  );
}
console.log(gap === null ? "⚠️ 没量到" : gap >= 0 ? `✅ 没被挡住（留 ${gap}px）` : `❌ 被挡住 ${-gap}px`);
await browser.close();

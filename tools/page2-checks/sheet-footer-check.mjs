// 能力卡弹层的底部栏巡检：它原来是 70px 高、两列的固定网格，多塞一个子项就会
// 换行被裁在栏外（之前塞过"这次要做什么"，黑色按钮只露出一条边）。
// 这里量出来：按钮有几个、都在不在栏里、有没有被裁。
//
// 用法：node tools\page2-checks\sheet-footer-check.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/sheet-footer";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })).newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  // 用**新注册的一次性账号**并给它建一张卡：`demo` 现在是真的空态（样板数据已清），
  // 而弹层探针必须有一张卡才点得开。用一次性账号是为了不在任何账号上留测试残留。
  const handle = await enterMergedApp(page, { ready: 3500, register: true });
  const created = await fetch(`${process.env.PAGE2_API || "http://127.0.0.1:8000"}/capabilities`, {
    method: "POST",
    headers: { "X-Elfred-User": String(handle), "content-type": "application/json" },
    body: JSON.stringify({ title: "弹层探针卡", copyText: "只为验底部栏布局", type: "Skill", dimension: "交付" }),
  }).then((r) => r.json()).catch(() => null);
  check("给一次性账号建了一张卡（弹层才有得开）", Boolean(created?.id), created?.id || "建卡失败");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await goTab(page, "知识");
  await page.waitForTimeout(3000);
  await page.locator(".v277-ability-cards > button").first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/sheet.png`, fullPage: true });

  const m = await page.evaluate(() => {
    const bar = document.querySelector(".v279-capability-actions");
    const sheet = document.querySelector(".v279-capability-sheet");
    if (!bar || !sheet) return null;
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
    };
    return {
      bar: rect(bar),
      sheet: rect(sheet),
      barChildren: bar.children.length,
      buttons: [...bar.querySelectorAll("button")].map((b) => ({ text: b.textContent.trim(), ...rect(b) })),
      inputs: bar.querySelectorAll("input").length,
      blackBg: [...bar.querySelectorAll("button")].map((b) => getComputedStyle(b).backgroundColor),
    };
  });
  check("底部栏在", Boolean(m), "");
  check("栏里就是两个按钮（没有多出来的输入框）", m?.barChildren === 2 && m?.inputs === 0,
        `子项=${m?.barChildren} 输入框=${m?.inputs}`);
  const [left, right] = m?.buttons || [];
  check("左边是「使用记录」", /使用记录/.test(left?.text || ""), left?.text || "无");
  check("右边是「用它做一件事」且是黑色那个", /用它做一件事/.test(right?.text || "") && m?.blackBg?.[1] === "rgb(17, 20, 22)",
        `${right?.text || "无"} ${m?.blackBg?.[1] || ""}`);
  check("两个按钮完整落在底部栏里（没被裁）",
        Boolean(m) && left.top >= m.bar.top && right.bottom <= m.bar.bottom + 1,
        `栏 ${m?.bar.top}→${m?.bar.bottom}｜左 ${left?.top}→${left?.bottom}｜右 ${right?.top}→${right?.bottom}`);
  check("底部栏没超出弹层", Boolean(m) && m.bar.bottom <= m.sheet.bottom + 1,
        `栏底 ${m?.bar.bottom} vs 弹层底 ${m?.sheet.bottom}`);
} finally {
  await browser.close();
}

const bad = results.filter((x) => !x.ok);
console.log(`\n${bad.length ? "❌ FAILED" : "✅ ALL PASSED"}  ${results.length - bad.length}/${results.length}`);
console.log(`截图：${OUT}`);
if (bad.length) process.exit(1);

// 能力卡详情弹层（点开一张 skill 卡）到底长什么样：
//   · 「它能替你做」里是不是还写着 step_1_skill_step 这种机械名
//   · 「使用说明」里流程图的文字有没有互相叠在一起（原来是 SVG 文字不换行）
//   · 输入 / 输出有没有内容
//   · 标题长成两三行时会不会压住下面的正文
//
// 用法： node tools\page2-checks\page2-sheet-check.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/sheet-check";
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

const rows = [];
const cards = await page.locator(".v277-ability-cards > button").count();
// 全查：用户说的是"很多卡片都是这样"，只看前三张不够
const limit = Number(process.env.LIMIT || 0) || cards;
for (let i = 0; i < Math.min(cards, limit); i++) {
  const title =
    (await page.locator(".v277-ability-cards > button b").nth(i).innerText().catch(() => "")) ||
    `第 ${i + 1} 张`;
  await page.locator(".v277-ability-cards > button").nth(i).click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OUT}/sheet-${i + 1}.png`, fullPage: true });

  const info = await page.evaluate(() => {
    const sheet = document.querySelector(".v279-capability-sheet");
    if (!sheet) return null;
    const head = sheet.querySelector(".v279-capability-head");
    const body = sheet.querySelector('[class*="sheetBody"]');
    const chips = Array.from(sheet.querySelectorAll('[class*="chips"] > span')).map((el) =>
      (el.textContent || "").trim(),
    );
    const nodes = Array.from(sheet.querySelectorAll('[class*="flowNode"]')).map((el) =>
      (el.textContent || "").trim(),
    );
    // 使用说明是那张流程图：输入块 / 处理链 / 输出块
    const flowNodes = Array.from(sheet.querySelectorAll('[class*="flowText"]')).map((el) =>
      (el.textContent || "").trim(),
    );
    const flowSteps = Array.from(sheet.querySelectorAll('[class*="flowStep"]')).map((el) =>
      (el.textContent || "").trim(),
    );
    // 标题会不会盖到正文上：头的底线 vs 正文的第一条元素顶线
    const firstInBody = body?.firstElementChild?.getBoundingClientRect();
    const headRect = head?.getBoundingClientRect();
    return {
      title: (head?.querySelector("h2")?.textContent || "").trim(),
      overlap: headRect && firstInBody ? Math.round(headRect.bottom - firstInBody.top) : null,
      headBox: headRect ? `${Math.round(headRect.top)}→${Math.round(headRect.bottom)}` : null,
      h2Box: (() => {
        const r = head?.querySelector("h2")?.getBoundingClientRect();
        return r ? `${Math.round(r.top)}→${Math.round(r.bottom)} h${Math.round(r.height)}` : null;
      })(),
      copyBox: (() => {
        const r = head?.querySelector("p")?.getBoundingClientRect();
        return r ? `${Math.round(r.top)}→${Math.round(r.bottom)} h${Math.round(r.height)}` : null;
      })(),
      headClient: head ? `${head.clientHeight}/${head.scrollHeight}` : null,
      headStyle: head
        ? (() => {
            const s = getComputedStyle(head);
            const parent = getComputedStyle(head.parentElement);
            return `flex=${s.flex} h=${s.height} minH=${s.minHeight} alignSelf=${s.alignSelf} | 父 display=${parent.display} height=${parent.height} pb=${parent.paddingBottom}`;
          })()
        : null,
      chips,
      nodes,
      flowNodes,
      flowSteps,
      hasInput: /输入/.test(sheet.innerText),
      hasOutput: /输出/.test(sheet.innerText),
    };
  });
  rows.push([title, info]);
  await page.locator('button[aria-label="关闭"]').first().click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);
}

console.log("================ 能力卡详情弹层 ================");
let bad = 0;
for (const [title, info] of rows) {
  if (!info) {
    console.log(`\n【${title}】❌ 弹层没打开`);
    bad++;
    continue;
  }
  const mech = info.chips.filter((c) => /^step[_-]?\d/i.test(c) || /skill_step/.test(c));
  const stepMech = [...info.flowNodes, ...info.flowSteps].filter((s) =>
    /skill_step|^步骤\s*\d+$/.test(s),
  );
  const overlap = info.overlap ?? 0;
  if (mech.length || stepMech.length) bad++;
  if (overlap > 0) bad++;
  console.log(`\n【${info.title.slice(0, 30) || title}】`);
  console.log(
    `  机械步骤名：${mech.length || stepMech.length ? `❌ ${[...mech, ...stepMech].slice(0, 3).join(" / ")}` : "✅ 没有"}`,
  );
  console.log(`  它能替你做：${info.chips.join(" · ") || "（空）"}`);
  console.log(
    `  使用说明 · 图：块[${info.flowNodes.join(" / ") || "无"}]  处理链[${info.flowSteps.join(" → ") || "无"}]`,
  );
  console.log(`  使用说明 · 输入/输出：输入 ${info.hasInput ? "有" : "没有"} · 输出 ${info.hasOutput ? "有" : "没有"}`);
  console.log(`  标题压正文：${overlap > 0 ? `❌ 压住 ${overlap}px` : "✅ 没压住"}`);
  console.log(
    `  量出来的盒子：头 ${info.headBox}（内容 ${info.headClient}）· 标题 ${info.h2Box} · 副文案 ${info.copyBox}`,
  );
  console.log(`  头的计算样式：${info.headStyle}`);
}
console.log(`\nRESULT: ${bad === 0 ? "ALL GOOD" : `${bad} 处有问题`}`);
console.log(`截图：${OUT}`);
await browser.close();
process.exit(bad === 0 ? 0 : 1);

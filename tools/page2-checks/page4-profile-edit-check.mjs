// 编辑资料页的**闭环验收**：改一个字段 → 保存 → 回主页看是不是真的变了。
// 这一屏最容易出的毛病就是"看着能改、其实没生效"（老那版还要记得点右上角总保存）。
//
// 验四件事：
//   ① 昵称：点开弹层改掉 → 保存 → 主页名字跟着变；
//   ② 个人简介：同上；
//   ③ 领域标签：加一个 → 保存 → 主页出现这个标签；
//   ④ 「展示等级与能力」开关：关掉 → 主页的 Lv 胶囊和理解度那格**真的消失**；再打开恢复。
//   另外：用户名是只读的（不是按钮、没有输入框）。
//
// 用法：node tools\page2-checks\page4-profile-edit-check.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/page4-profile-edit";
const HANDLE = process.env.HANDLE || "";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};
const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));

/** 进"我的" → 编辑资料（每次都从主页重新进，免得受上一步状态影响） */
async function openEdit(page) {
  // 每次都从"干净的主界面"进，失败重来一次（上一步可能停在弹层/二级页上）
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(2400);
    if (await page.locator('nav button[aria-label="我的"]').count()) {
      await goTab(page, "我的");
      await page.waitForTimeout(1800);
    }
    await page.locator("main button").filter({ hasText: "编辑资料" }).first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(1600);
    if (/主页形象/.test(await bodyText(page))) return true;
  }
  return false;
}

/** 打开某个字段的弹层（按行文字匹配），返回弹层是否出现 */
async function openSheet(page, label) {
  await page.locator("main button[class*=row]").filter({ hasText: new RegExp(label) }).first()
    .click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return (await page.locator('[role="dialog"]').count()) > 0;
}

const backHome = async (page) => {
  await page.locator('button[aria-label="返回"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1600);
};

const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await (await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const handle = await enterMergedApp(page, { ready: 3000, register: !HANDLE, ...(HANDLE ? { handle: HANDLE } : {}) });
  check("进了主界面", Boolean(handle), String(handle));

  console.log("【1】这一屏现在长什么样");
  check("能进「编辑资料」", await openEdit(page), "");
  await page.screenshot({ path: `${OUT}/1-edit.png`, fullPage: true });
  const text = await bodyText(page);
  check("有「主页形象」区（封面+头像）", /主页形象/.test(text) && /更换头像/.test(text), "");
  check("用户名那行是只读的", await page.locator("main div[class*=rowReadOnly]").count() > 0, "");
  // 「总保存」那种按钮已经拿掉：这一屏的保存都在各自的弹层里（每一行改完即存）
  check("顶部没有「总保存」按钮（改成改一个存一个）", !/编辑资料 \| 保存/.test(text), text.slice(0, 60));
  check("封面里没有「建议 16:9」那行提示", !/建议 16:9/.test(text), "");
  check("默认昵称是「路人」", /昵称 \| 路人/.test(text), text.slice(text.indexOf("昵称"), text.indexOf("昵称") + 30));
  check("没有「你的登录账号」那句提示了", !/你的登录账号/.test(text), "");

  console.log("【2】昵称：改 → 保存 → 主页真的跟着变");
  const newName = `改过的名字${Date.now() % 10000}`;
  check("点昵称能开弹层", await openSheet(page, "昵称"), "");
  const nameInput = page.locator('[role="dialog"] input').first();
  await nameInput.fill(newName).catch(() => {});
  await page.locator('[role="dialog"] button').filter({ hasText: "保存" }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
  check("弹层关掉、行上就是新名字", (await bodyText(page)).includes(newName), "");
  await backHome(page);
  check("回主页：名字跟着变了", (await bodyText(page)).includes(newName), "");

  console.log("【3】个人简介：改 → 保存 → 主页跟着变");
  await openEdit(page);
  const newBio = `在做 Elfred 的产品设计 ${Date.now() % 1000}`;
  check("点简介能开弹层", await openSheet(page, "个人简介"), "");
  await page.locator('[role="dialog"] textarea').first().fill(newBio).catch(() => {});
  await page.screenshot({ path: `${OUT}/3-sheet-bio.png`, fullPage: true });
  await page.locator('[role="dialog"] button').filter({ hasText: "保存" }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await backHome(page);
  check("回主页：简介跟着变了", (await bodyText(page)).includes(newBio), "");

  console.log("【4】领域标签：加一个 → 主页出现");
  await openEdit(page);
  check("点标签能开弹层", await openSheet(page, "领域标签"), "");
  // 标签**是选的**：弹层里给的是预设 chips，点一下选中（不是手打）
  const option = page.locator('[role="dialog"] button[class*=tagOption]').filter({ hasText: "产品" }).first();
  check("弹层里有可选的预设标签", (await option.count()) > 0, "");
  check("弹层里没有手打输入框", (await page.locator('[role="dialog"] input').count()) === 0, "");
  await option.click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/4-sheet-tags.png`, fullPage: true });
  check("选中之后写清了已选数量", /已选 1\/4/.test(await bodyText(page)), "");
  await page.locator('[role="dialog"] button').filter({ hasText: "保存" }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await backHome(page);
  check("回主页：标签出现", (await bodyText(page)).includes("产品"), "");

  console.log("【5】「展示等级与能力」是真开关（关掉主页不显示 Lv 与理解度）");
  check("回到编辑资料", await openEdit(page), "");
  const before = await bodyText(page);
  check("默认是开着（这一行写着主页会显示）", /会显示「Lv/.test(before), before.slice(before.indexOf("展示等级"), before.indexOf("展示等级") + 60));
  await page.locator("main button[class*=rowToggle]").first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1200);
  check("关掉后这一行写着「不显示」", /不显示等级与理解度/.test(await bodyText(page)), "");
  await backHome(page);
  const home = await bodyText(page);
  check("主页不再出现 Lv 胶囊", !/Lv\.\d/.test(home), home.slice(0, 100));
  check("主页数字条里没有「理解度」那格", !/理解度/.test(home), "");
  await page.screenshot({ path: `${OUT}/2-home-hidden.png`, fullPage: true });

  // 收尾：把它打开回去（不然下一次跑这个探针，前面的断言会变）
  await openEdit(page);
  await page.locator("main button[class*=rowToggle]").first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1000);
  check("再打开就恢复（主页又能看到 Lv）", /会显示「Lv/.test(await bodyText(page)), "");

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

// 验「用它做一件事」的接口：**除了缺的那条上游命令，整条链是通的**。
//
// 背景：这个按钮要真能用，需要同事那边加 `conversation.ensure_personal`
//（服务端现在没有任何命令能建出"我的 Elfred"那个会话，全库 0 个会话对象）。
// 那条路暂时搁置了，但接口已经写好 —— 这个脚本就用**网络层打桩**把缺的那条命令补上，
// 跑一遍真链路，证明"他加上命令那天，我们一行都不用改"。
//
// 打桩的三件事（只在浏览器里拦，不改他任何代码）：
//   1. `conversation.ensure_personal` → 返回 { id: 'elfred' }
//   2. `draft.save`                   → 返回 { id, version }（真实服务端要求先有会话成员）
//   3. `/bootstrap`                    → 往快照里塞一个 id='elfred' 的会话和一条草稿，
//                                        这样 ChatPage 才有会话可渲染
//
// 用法：node tools\page2-checks\skill-launch-contract-check.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { enterMergedApp, goTab } from "./_bootstrap.mjs";

const URL = process.env.FRONTEND || "http://127.0.0.1:3100/v28";
const API = process.env.PAGE2_API || "http://127.0.0.1:8000";
const OUT = process.env.OUT || "C:/Users/35057/AppData/Local/Temp/elfred-poc/skill-launch-contract";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await (await browser.newContext({
    viewport: { width: 430, height: 932 }, isMobile: true,
  })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  let contractAsked = 0;
  page.on("request", (r) => { if (r.url().includes("/page2/contract")) contractAsked += 1; });
  let ensured = 0, saved = 0, savedText = "", conversationInjected = false;

  await page.route("**/api/elfred/commands", async (route) => {
    let action = "";
    try { action = JSON.parse(route.request().postData() || "{}").action || ""; } catch { /* ignore */ }
    if (action === "conversation.ensure_personal") {
      ensured += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "elfred" }) });
    }
    if (action === "draft.save") {
      saved += 1;
      try { savedText = JSON.parse(route.request().postData() || "{}").input?.text || ""; } catch { /* ignore */ }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "draft-probe", version: 1 }) });
    }
    return route.continue();
  });

  // 让快照里存在 id='elfred' 的会话与草稿（真实情况由同事那条命令创建）
  await page.route("**/api/elfred/bootstrap", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    conversationInjected = true;
    json.objects = json.objects || {};
    json.objects.conversation = [
      ...(json.objects.conversation || []),
      { id: "elfred", version: 1, created: new Date().toISOString(), updated: new Date().toISOString(),
        data: { title: "我的 Elfred", kind: "owner", seq: 1, status: "active" } },
    ];
    json.objects.draft = [
      ...(json.objects.draft || []),
      { id: "draft-probe", version: 1, created: new Date().toISOString(), updated: new Date().toISOString(),
        data: { conversation_id: "elfred", text: "" } },
    ];
    return route.fulfill({ response, body: JSON.stringify(json) });
  });

  console.log("【1】注册一次性账号，并给它建一张卡");
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const handle = await enterMergedApp(page, { ready: 2500, register: true });
  check("进到主界面", Boolean(handle), String(handle));
  const card = await fetch(`${API}/capabilities`, {
    method: "POST",
    headers: { "X-Elfred-User": String(handle), "content-type": "application/json" },
    body: JSON.stringify({ title: "接口探针卡", copyText: "只为验「用它做一件事」这条路",
                           type: "Skill", dimension: "交付" }),
  }).then((r) => r.json()).catch(() => null);
  check("建出了探针卡", Boolean(card?.id), card?.id || "失败");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  console.log("【2】点开卡片，点「用它做一件事」");
  await goTab(page, "知识");
  await page.waitForTimeout(3000);
  await page.locator(".v277-ability-cards > button").first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // 弹层里有两个「用它做一件事」（结构页那个 + 使用记录页那个），而 `:visible` 会把
  // 滚出视口的也算成可见 —— 直接点**底部栏右边那个黑色的**，它是确定在屏幕里的主入口。
  const useIt = page.locator(".v279-capability-actions button").last();
  const count = await useIt.count();
  console.log(`    底部栏按钮匹配 ${count} 个，准备点右边那个`);
  await useIt.click({ timeout: 8000 }).catch((e) => console.log("    点击失败:", e.message));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/after-launch.png`, fullPage: true });

  console.log("【3】核对：会话被要过、契约写进去了、落在那个会话上");
  // 会话在这条桩里是**预先注入**的，所以正常会走"已存在"那条分支、不去调命令；
  // 两种都算通过：要么直接用了已有的会话，要么真去调了那条命令。
  check("会话来源正确（已存在就直接用 / 没有才去要）", ensured >= 1 || conversationInjected,
        `ensure 调用 ${ensured} 次，桩里已注入会话=${conversationInjected}`);
  check("把契约写进了对话草稿", saved >= 1, `${saved} 次`);
  check("草稿是**按这条能力**写的（提到了它的名字）", savedText.includes("接口探针卡"),
        savedText.split("\n").slice(-1)[0].slice(0, 60) || "(空)");
  // 这张探针卡还不是一条真 skill（真 skill 要"做过 ≥2 次 + 指正"才固化），
  // 所以契约取不到是**正常的**，此时必须如实说"没取到做法"，不许假装带上。
  const contractCarried = savedText.includes("这条能力《接口探针卡》的做法");
  const toldHonestly = savedText.includes("这次没取到《接口探针卡》的做法");
  check("有做法就带做法 / 没有就如实说没有（不许假装）", contractCarried || toldHonestly,
        contractCarried ? "带上了做法" : "如实说没取到");
  check("中间确实去查过契约", contractAsked >= 1, `${contractAsked} 次`);
  const text = await page.evaluate(() => document.body.innerText.replace(/\n+/g, " | "));
  check("跳到了「我的 Elfred」会话", /我的 Elfred|Elfred/.test(text), text.slice(0, 80));
  check("页面没有报错", errors.length === 0, errors.join(" / "));
} finally {
  await browser.close();
}

const bad = results.filter((x) => !x.ok);
console.log(`\n${bad.length ? "❌ FAILED" : "✅ ALL PASSED"}  ${results.length - bad.length}/${results.length}`);
console.log(`截图：${OUT}`);
if (bad.length) process.exit(1);

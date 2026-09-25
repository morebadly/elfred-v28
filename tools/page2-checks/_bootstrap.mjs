// 整合版专用的入口：同事的 app 要先注册/登录，老巡检脚本是按旧 onboarding 写的。
// 这里统一提供"进到主界面"这一步，所有探针共用。
//
// 三个坑（实测）：
//   1. 必须用 127.0.0.1，不能用 localhost —— 他的服务端做 Host 校验，否则 403「无效主机」；
//   2. 密码页默认是"登录"，新账号要先点「首次使用，创建账号」，再点「创建账号并继续」；
//   3. ⚠️ **默认登录 `demo`，不再默认注册新账号**：第二/四页的数据现在按登录用户分开取
//      （头 `X-Elfred-User`），后端 `DEMO_USER_ID=demo`。注册一个新账号看到的是**空态**
//      （那是对的：新用户就该是空的），探针要看演示数据就必须登录 demo。
//      想验空态就传 `{ register: true }`。

const PW = "elfred-test-2026";
export const DEMO_HANDLE = "demo";

const bodyText = (page) => page.evaluate(() => document.body.innerText);
const clickText = (page, re, timeout = 8000) =>
  page.locator("button:visible").filter({ hasText: re }).first().click({ timeout }).catch(() => {});

async function submitCredentials(page, handle, register) {
  const first = page.locator("input:visible").first();
  if (await first.count()) await first.fill(handle).catch(() => {});
  await clickText(page, "继续");
  await page.waitForTimeout(2500);
  if (register) {
    await clickText(page, /首次使用，创建账号/, 6000);
    await page.waitForTimeout(1200);
  }
  const pw = page.locator("input[type=password]:visible").first();
  if (await pw.count()) await pw.fill(PW).catch(() => {});
  await clickText(page, /创建账号并继续|登录并继续/);
  await page.waitForTimeout(4000);
}

/**
 * 进到主界面。
 * @param page   Playwright page
 * @param ready  进主界面后再等多久（等数据拉回来）
 * @param handle 用哪个账号；默认 demo（看演示数据）
 * @param register true = 注册一个全新账号（**看到的是空态**）
 * @returns 进去用的 handle（字符串）或 false
 */
export async function enterMergedApp(page, { ready = 3000, handle = DEMO_HANDLE, register = false } = {}) {
  // 已经登录了（复用了 session）就直接返回
  if (/能力库|Agent 朋友圈|动态/.test(await bodyText(page))) return handle;

  const target = register ? `qa${Date.now() % 100000}@example.com` : handle;
  await submitCredentials(page, target, register);

  // 第一次跑、demo 账号还没建出来时，如实退回注册一个新账号（而不是假装成功）
  if (!register && !/动态|社区|能力库/.test(await bodyText(page))) {
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(2000);
    return enterMergedApp(page, { ready, register: true });
  }

  // 初始化引导可以"稍后继续"
  await clickText(page, /稍后继续/, 6000);
  await page.waitForTimeout(ready);
  return /动态|社区|能力库/.test(await bodyText(page)) ? target : false;
}

/** 底部导航：优先 aria-label，退化到文字 */
export async function goTab(page, label) {
  const byAria = page.locator(`nav button[aria-label="${label}"]`).first();
  if (await byAria.count()) return byAria.click({ timeout: 8000 }).catch(() => {});
  return page
    .locator("button:visible")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first()
    .click({ timeout: 8000 })
    .catch(() => {});
}

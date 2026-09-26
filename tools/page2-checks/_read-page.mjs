// 调研用的小工具：把任意网页**渲染后**的可见文字抓下来（很多站点是 JS 渲染的，curl 只拿到空壳）。
// 只读、不改任何东西；不写进仓库的产物（文字落到 OUT 目录）。
//
// 用法：node tools\page2-checks\_read-page.mjs <url> [名字] [等待毫秒]
//      文字写到 %TEMP%\elfred-research\<名字>.txt，图片 URL 清单写 <名字>.imgs.txt，
//      同时在终端打印最终 URL（跳转链很有用：搜狗的 /link 是 JS 跳转）与前若干行文字。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const [url, name = "page", waitMs = "4000"] = process.argv.slice(2);
if (!url) {
  console.log("用法：node _read-page.mjs <url> [名字] [等待毫秒]");
  process.exit(1);
}
const OUT = process.env.RESEARCH_OUT || "C:/Users/35057/AppData/Local/Temp/elfred-research";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await (await browser.newContext({
    viewport: { width: 430, height: 932 }, isMobile: true, locale: "zh-CN",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      + "Chrome/120 Safari/537.36",
  })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 80)));
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => null);
  await page.waitForTimeout(Number(waitMs));
  const text = await page.evaluate(() => document.body.innerText.replace(/\n{3,}/g, "\n\n"));
  const finalUrl = page.url();
  // 页面里所有 <img> 的绝对地址 —— 找"别人的截图"就靠它
  const images = await page.evaluate(() =>
    [...document.querySelectorAll("img")]
      .map((node) => node.currentSrc || node.src)
      .filter((src) => src && !src.startsWith("data:")));
  const file = `${OUT}/${name}.txt`;
  writeFileSync(file, `# ${url}\n# status=${response?.status() ?? "-"} errors=${errors.length}\n\n${text}`, "utf8");
  writeFileSync(`${OUT}/${name}.imgs.txt`, [...new Set(images)].join("\n"), "utf8");
  console.log(`status=${response?.status() ?? "-"} 长度=${text.length} 图片=${images.length}  →  ${file}`);
  console.log(`最终 URL：${finalUrl}`);
  console.log(text.slice(0, 1200));
} finally {
  await browser.close();
}

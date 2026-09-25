"""把老巡检脚本接上整合版的入口（同事的注册/登录）。

老脚本是照"旧 onboarding"写的：打开 /v28 就有页面、填几个空就能进主界面。
整合版要先用手机号/邮箱 + 密码注册一个本地账号，所以统一把每个脚本里的
`walkOnboarding()` 换成 `_bootstrap.mjs` 里的 `enterMergedApp(page)`。

用法（在仓库根目录）： py -3 tools/page2-checks/_patch-probes.py
"""

from __future__ import annotations

import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SKIP = {"_bootstrap.mjs", "_patch-probes.py"}

IMPORT_FROM_PLAYWRIGHT = 'import { chromium } from "playwright";'
IMPORT_LINE = (
    'import { chromium } from "playwright";\n'
    'import { enterMergedApp, goTab } from "./_bootstrap.mjs";\n'
    'const APP = process.env.FRONTEND || "http://127.0.0.1:3100/v28";'
)

DELEGATE = """async function walkOnboarding() {
  // 整合版：走同事的注册/登录流程进主界面（见 _bootstrap.mjs）
  await enterMergedApp(page);
  return true;
}"""


def patch(path: str) -> str:
    src = io.open(path, encoding="utf-8").read()
    before = src
    # 注意：守卫要看 import 语句本身，不能只搜 "_bootstrap.mjs" ——
    # 上一轮插进 walkOnboarding 的注释里也有这个词（踩过）
    if 'from "./_bootstrap.mjs"' not in src and IMPORT_FROM_PLAYWRIGHT in src:
        src = src.replace(IMPORT_FROM_PLAYWRIGHT, IMPORT_LINE, 1)
    # 入口地址统一走 APP（整合版在 127.0.0.1:3100，不能用 localhost）
    src = src.replace('"http://localhost:5182/v28"', "APP")
    src = re.sub(
        r"async function walkOnboarding\([^)]*\)\s*\{.*?\n\}",
        DELEGATE,
        src,
        count=1,
        flags=re.S,
    )
    # 底栏导航统一走 helper（名字带特殊符号时更稳）
    src = re.sub(
        r"const nav = \(label\) =>\s*\n\s*page\.locator\(`nav button\[aria-label=\"\$\{label\}\"\]`\)\.first\(\)\.click\(\)(?:\.catch\(\(\) => \{\}\))?;",
        "const nav = (label) => goTab(page, label);",
        src,
    )
    if src != before:
        io.open(path, "w", encoding="utf-8").write(src)
        return "patched"
    return "skip"


def main() -> None:
    for name in sorted(os.listdir(HERE)):
        if not name.endswith(".mjs") or name in SKIP:
            continue
        print(f"{patch(os.path.join(HERE, name)):>8}  {name}")


if __name__ == "__main__":
    main()

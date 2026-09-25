"""把「我这边」和「同事那份 elfred-v28」做文件级对照，用来做接轨审计。

输出四类：
  1. 只在我这边有的文件
  2. 只在他那边有的文件
  3. 两边都有、内容也一样的（合并时不用管）
  4. 两边都有、内容不同的 —— 再按「我 git 改过没有」拆成两堆：
       · 我改过          → 这块是我动的
       · 我没动过        → **他的改动落在共用文件上**，这些才是会打架的地方

用法：
    py -3 tools/integration-audit/compare-repos.py
    py -3 tools/integration-audit/compare-repos.py --theirs "D:\path\to\elfred-v28"
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

MINE = Path(__file__).resolve().parent.parent.parent
SKIP_DIRS = {
    "node_modules", ".next", ".git", ".elfred-data", "dist",
    ".sites-runtime", "build", ".vinext", ".turbo", "__pycache__",
}


def walk(root: Path) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            path = Path(base) / name
            rel = path.relative_to(root).as_posix()
            try:
                out[rel] = path.read_bytes()
            except OSError:
                continue
    return out


def changed_by_me(root: Path) -> set[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain"], cwd=root,
        capture_output=True, text=True,
    )
    names: set[str] = set()
    for line in result.stdout.splitlines():
        if len(line) < 4:
            continue
        rel = line[3:].strip().strip('"')
        if " -> " in rel:
            rel = rel.split(" -> ")[1].strip().strip('"')
        names.add(rel)
    return names


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--theirs", default=os.path.join(
        os.environ.get("TEMP", "/tmp"), "elfred-v28-colleague"))
    args = parser.parse_args()
    theirs = Path(args.theirs)
    if not theirs.exists():
        print(f"找不到同事那份：{theirs}")
        sys.exit(2)

    mine, other = walk(MINE), walk(theirs)
    only_mine = sorted(set(mine) - set(other))
    only_theirs = sorted(set(other) - set(mine))
    shared = set(mine) & set(other)
    different = sorted(r for r in shared if mine[r] != other[r])
    mine_touched = changed_by_me(MINE)

    def show(title: str, rows: list[str], limit: int = 0) -> None:
        print(f"\n=== {title}（{len(rows)}）===")
        for rel in (rows[:limit] if limit else rows):
            print(f"   {rel}")
        if limit and len(rows) > limit:
            print(f"   …还有 {len(rows) - limit} 个")

    show("只在我这边", only_mine, 30)
    show("只在他那边", only_theirs, 40)
    print(f"\n=== 两边一样、不用管（{len(shared) - len(different)}）===")

    mine_side = [r for r in different if r in mine_touched]
    his_side = [r for r in different if r not in mine_touched]
    print(f"\n=== 两边都不同 · 我改过（{len(mine_side)}）===")
    for rel in mine_side:
        print(f"   {rel:<52} 我{len(mine[rel]):>7}  他{len(other[rel]):>7}")
    print(f"\n=== 两边都不同 · 我没动过 ← 他的改动落在这些共用文件上（{len(his_side)}）===")
    for rel in his_side:
        delta = len(other[rel]) - len(mine[rel])
        print(f"   {rel:<52} 我{len(mine[rel]):>7}  他{len(other[rel]):>7}  {delta:+d}")


if __name__ == "__main__":
    main()

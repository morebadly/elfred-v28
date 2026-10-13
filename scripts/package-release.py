"""Package tracked source and a completed Next.js build for the existing server."""

import pathlib
import subprocess
import sys
import tarfile


root = pathlib.Path(__file__).resolve().parents[1]
target = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else root / "elfred-release.tar.gz").resolve()
build = root / ".next" / "BUILD_ID"
if not build.is_file():
    raise SystemExit("Missing .next/BUILD_ID; run npm run build:local first")
paths = subprocess.check_output(["git", "-c", "core.quotePath=false", "ls-files", "-z"], cwd=root).split(b"\0")
count = 0
with tarfile.open(target, "w:gz", format=tarfile.PAX_FORMAT) as archive:
    for raw in paths:
        if not raw:
            continue
        rel = pathlib.PurePosixPath(raw.decode("utf-8"))
        source = root.joinpath(*rel.parts)
        if source.is_file() and not source.is_symlink():
            archive.add(source, arcname=str(rel), recursive=False)
            count += 1
    for source in (root / ".next").rglob("*"):
        rel = source.relative_to(root).as_posix()
        if not source.is_file() or source.is_symlink() or rel.startswith((".next/cache/", ".next/dev/")) or rel.endswith(".map"):
            continue
        archive.add(source, arcname=rel, recursive=False)
        count += 1
print(f"{target} ({count} files, {target.stat().st_size} bytes)")

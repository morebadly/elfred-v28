"""Server-side atomic Elfred release switch with data backup and rollback.

Run as the server's deployment administrator:
  python3 scripts/deploy-server.py /tmp/elfred-release.tar.gz RELEASE_LABEL
"""

import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import time
import urllib.request


if len(sys.argv) != 3 or not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}", sys.argv[2]):
    raise SystemExit("Usage: deploy-server.py ABSOLUTE_ARCHIVE_PATH RELEASE_LABEL")
archive_path = pathlib.Path(sys.argv[1]).resolve(strict=True)
label = sys.argv[2]
root = pathlib.Path("/www/wwwroot/elfred-mobile").resolve(strict=True)
current = root / "current"
previous = current.resolve(strict=True)
releases = root / "releases"
assert previous.is_relative_to(releases), "Current symlink must point into releases"
release = releases / label
backup = pathlib.Path("/www/backups") / f"elfred-{label}"
lock_path = root / ".deploy.lock"


def health(url, *, host=None):
    headers = {"Host": host} if host else {}
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=3) as response:
        return json.load(response)


with lock_path.open("a+") as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    if release.exists() or backup.exists():
        raise SystemExit("Release label already exists; choose a new label")
    env = (previous / ".env.local").resolve(strict=True)
    values = {}
    for line in env.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            try:
                values[key.strip()] = json.loads(value)
            except json.JSONDecodeError:
                values[key.strip()] = value.strip().strip('"').strip("'")
    data = pathlib.Path(values["ELFRED_DATA_DIR"]).resolve(strict=True)
    assert data.is_relative_to(root / "shared"), "Data must stay in the shared directory"
    database = data / "elfred.sqlite"
    assert database.is_file()

    release.mkdir(parents=True)
    with tarfile.open(archive_path) as archive:
        for member in archive.getmembers():
            assert not member.issym() and not member.islnk()
            assert (release / member.name).resolve().is_relative_to(release)
        archive.extractall(release, filter="data")
    assert (release / ".next/BUILD_ID").is_file()
    assert (release / "server/elfred/runtime.mjs").is_file()
    new_lock = release / "package-lock.json"
    old_lock = previous / "package-lock.json"
    digest = lambda p: hashlib.sha256(p.read_bytes()).digest()
    if digest(new_lock) == digest(old_lock):
        (release / "node_modules").symlink_to((previous / "node_modules").resolve(strict=True))
    else:
        node_bin = pathlib.Path("/opt/node-v22.13.1-linux-x64/bin")
        npm_cli = pathlib.Path("/opt/node-v22.13.1-linux-x64/lib/node_modules/npm/bin/npm-cli.js")
        assert (node_bin / "node").is_file() and npm_cli.is_file(), "Server Node 22 installation is missing"
        subprocess.run(
            [str(node_bin / "node"), str(npm_cli), "ci", "--omit=dev"],
            cwd=release, check=True,
            env={**os.environ, "PATH": f"{node_bin}:{os.environ.get('PATH', '')}"},
        )
    (release / ".env.local").symlink_to(env)

    backup.mkdir(parents=True)
    shutil.copy2(env, backup / "v28.env")
    os.chmod(backup / "v28.env", 0o600)
    with sqlite3.connect(database) as old, sqlite3.connect(backup / "elfred.sqlite") as copied:
        before = old.execute("select count(*) from users").fetchone()[0]
        old.backup(copied)

    next_link = root / "current.next"
    assert not next_link.exists()
    next_link.symlink_to(release)
    subprocess.run(["pm2", "stop", "elfred-mobile"], check=True, stdout=subprocess.DEVNULL)
    os.replace(next_link, current)
    try:
        subprocess.run(["pm2", "restart", "elfred-mobile", "--update-env"], check=True, stdout=subprocess.DEVNULL)
        for _ in range(40):
            try:
                assert health("http://127.0.0.1:3001/api/elfred/health", host="111.230.26.68")["status"] == "ok"
                assert health("http://127.0.0.1:8200/health")["contract"] == "elfred-memory-v1"
                break
            except Exception:
                time.sleep(0.5)
        else:
            raise RuntimeError("Application or memory service did not become healthy")
        with sqlite3.connect(database) as connection:
            after = connection.execute("select count(*) from users").fetchone()[0]
        assert after >= before, "User count unexpectedly decreased"
        subprocess.run(["pm2", "save"], check=True, stdout=subprocess.DEVNULL)
        print(json.dumps({"release": str(release), "backup": str(backup), "users_preserved": True, "app": "healthy", "memory": "healthy"}))
    except Exception:
        subprocess.run(["pm2", "stop", "elfred-mobile"], stdout=subprocess.DEVNULL)
        rollback = root / "current.rollback"
        rollback.symlink_to(previous)
        os.replace(rollback, current)
        subprocess.run(["pm2", "restart", "elfred-mobile", "--update-env"], stdout=subprocess.DEVNULL)
        raise

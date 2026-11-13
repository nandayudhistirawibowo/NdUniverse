#!/usr/bin/env python3
"""Move public audio assets to a separate GitHub repository for jsDelivr."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_AUDIO = ROOT / "public" / "audio"
TARGET_ROOT = Path(r"D:\audio-cdn")
TARGET_AUDIO = TARGET_ROOT / "audio"
REMOTE_URL = "https://github.com/nandayudhistirawibowo/nduniverse-audio.git"
CDN_BASE = (
    "https://cdn.jsdelivr.net/gh/"
    "nandayudhistirawibowo/nduniverse-audio@main/audio/"
)
LOCAL_AUDIO_PATH = re.compile(
    r"(?<!https://cdn\.jsdelivr\.net/gh/"
    r"nandayudhistirawibowo/nduniverse-audio@main)/audio/"
)
TEXT_EXTENSIONS = {".js", ".jsx", ".astro", ".json"}
IGNORED_DIRECTORIES = {".git", ".astro", ".vercel", "dist", "node_modules"}


def update_audio_references() -> int:
    replacements = 0
    for current_dir, directories, filenames in os.walk(ROOT):
        directories[:] = [
            directory
            for directory in directories
            if directory not in IGNORED_DIRECTORIES
        ]
        for filename in filenames:
            path = Path(current_dir) / filename
            if path.is_symlink() or path.suffix.lower() not in TEXT_EXTENSIONS:
                continue

            original = path.read_bytes()
            text = original.decode("utf-8")
            updated, count = LOCAL_AUDIO_PATH.subn(CDN_BASE, text)
            if not count:
                continue
            if path.suffix.lower() == ".json":
                json.loads(updated)
            path.write_bytes(updated.encode("utf-8"))
            replacements += count

    return replacements


def update_project_gitignore() -> None:
    gitignore = ROOT / ".gitignore"
    lines = gitignore.read_text(encoding="utf-8").splitlines()
    if "public/audio/" not in lines:
        lines.append("public/audio/")
        gitignore.write_text("\n".join(lines) + "\n", encoding="utf-8")


def check_prerequisites() -> None:
    if not SOURCE_AUDIO.is_dir():
        raise FileNotFoundError(f"Audio source directory does not exist: {SOURCE_AUDIO}")
    if TARGET_ROOT.exists():
        raise FileExistsError(
            f"Migration target already exists: {TARGET_ROOT}; refusing to overwrite it."
        )

    for setting in ("user.name", "user.email"):
        result = subprocess.run(
            ["git", "config", "--global", "--get", setting],
            check=False,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0 or not result.stdout.strip():
            raise RuntimeError(f"Configure your global Git {setting} before migrating.")


def run_git(*arguments: str) -> None:
    subprocess.run(["git", *arguments], cwd=TARGET_ROOT, check=True)


def main() -> None:
    check_prerequisites()
    replacement_count = update_audio_references()
    if replacement_count == 0:
        raise RuntimeError("No local /audio/ references were found; refusing to migrate.")
    update_project_gitignore()

    TARGET_ROOT.mkdir()
    (TARGET_ROOT / ".gitignore").write_text(".git\n", encoding="utf-8")
    run_git("init")
    run_git("remote", "add", "origin", REMOTE_URL)

    shutil.move(str(SOURCE_AUDIO), str(TARGET_AUDIO))
    run_git("add", ".")
    run_git("commit", "-m", "Upload all audio assets")
    run_git("branch", "-M", "main")

    print(f"Moved {TARGET_AUDIO} and updated {replacement_count} local audio references.")
    print("No git push was performed.")


if __name__ == "__main__":
    main()

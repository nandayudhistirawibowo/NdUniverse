#!/usr/bin/env python3
"""Generate jsDelivr URLs for MP3 files already stored in the audio repository."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
SOURCE_AUDIO = Path(r"D:\audio-cdn\audio")
MANIFEST_PATH = ROOT / "manifest-cdn.json"
CDN_BASE = (
    "https://cdn.jsdelivr.net/gh/"
    "nandayudhistirawibowo/nduniverse-audio@main/audio"
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("generate-audio-cdn-manifest")


def build_manifest() -> dict[str, str]:
    if not SOURCE_AUDIO.is_dir():
        raise FileNotFoundError(f"Audio source directory does not exist: {SOURCE_AUDIO}")

    files = sorted(
        path
        for path in SOURCE_AUDIO.rglob("*")
        if path.is_file() and not path.is_symlink() and path.suffix.lower() == ".mp3"
    )
    if not files:
        raise RuntimeError(f"No MP3 files found in {SOURCE_AUDIO}")

    manifest: dict[str, str] = {}
    for index, path in enumerate(files, start=1):
        relative_path = path.relative_to(SOURCE_AUDIO).as_posix()
        encoded_path = quote(relative_path, safe="/")
        manifest[relative_path] = f"{CDN_BASE}/{encoded_path}"
        if index % 100 == 0 or index == len(files):
            LOGGER.info("Indexed %d/%d MP3 files.", index, len(files))

    return manifest


def write_manifest(manifest: dict[str, str]) -> None:
    temporary_path = MANIFEST_PATH.with_name(f"{MANIFEST_PATH.name}.tmp")
    try:
        temporary_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary_path.replace(MANIFEST_PATH)
    except OSError as error:
        raise RuntimeError(f"Unable to write manifest {MANIFEST_PATH}: {error}") from error


def main() -> int:
    try:
        manifest = build_manifest()
        write_manifest(manifest)
    except (FileNotFoundError, OSError, RuntimeError) as error:
        LOGGER.error("%s", error)
        return 1

    LOGGER.info("Wrote %d jsDelivr URLs to %s.", len(manifest), MANIFEST_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

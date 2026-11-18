#!/usr/bin/env python3
"""Audit static audio references in src/ and public/manifest-boss.json."""

from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from urllib.parse import quote, urlparse

import requests


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "src"
PUBLIC_DIR = ROOT / "public"
BOSS_MANIFEST = PUBLIC_DIR / "manifest-boss.json"
REPORT_PATH = ROOT / "audio-missing-report.txt"
CDN_BASE = "https://cdn.jsdelivr.net/gh/nandayudhistirawibowo/nduniverse-audio@main"
TIMEOUT_SECONDS = 20


@dataclass
class Audit:
    references: dict[str, set[str]] = field(default_factory=dict)
    local_files: dict[str, set[str]] = field(default_factory=dict)
    dynamic_references: set[str] = field(default_factory=set)

    def add_url(self, url: str, location: str) -> None:
        self.references.setdefault(url, set()).add(location)


def quoted_strings(source: str):
    index = 0
    while index < len(source):
        if source[index] not in ("'", '"', "`"):
            index += 1
            continue

        quote_char = source[index]
        start = index + 1
        index = start
        value: list[str] = []
        escaped = False
        while index < len(source):
            char = source[index]
            if escaped:
                value.append(char)
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote_char:
                yield start, "".join(value)
                index += 1
                break
            else:
                value.append(char)
            index += 1
        else:
            break


def resolve_reference(reference: str) -> str | None:
    value = reference.strip()
    if not value:
        return None

    if value.lower().startswith(("https://", "http://")):
        parsed = urlparse(value)
        if ".mp3" in parsed.path.lower() or Path(parsed.path).suffix:
            return value
        return None

    if ".mp3" not in value.lower():
        return None

    relative_path = value.split("?", 1)[0].split("#", 1)[0]
    normalized = PurePosixPath(relative_path.lstrip("/"))
    if ".." in normalized.parts:
        return None

    local_path = PUBLIC_DIR.joinpath(*normalized.parts)
    if local_path.is_file():
        return f"local:{normalized.as_posix()}"

    encoded_path = quote(normalized.as_posix(), safe="/@-._~")
    return f"{CDN_BASE}/{encoded_path}"


def add_reference(audit: Audit, value: str, location: str) -> None:
    if "${" in value:
        audit.dynamic_references.add(f"{location}: {value}")
        return

    resolved = resolve_reference(value)
    if resolved is None:
        return
    if resolved.startswith("local:"):
        audit.local_files.setdefault(resolved.removeprefix("local:"), set()).add(location)
        return
    audit.add_url(resolved, location)


def scan_source_files(audit: Audit) -> None:
    for path in sorted(SOURCE_DIR.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in {".js", ".jsx", ".ts", ".tsx", ".astro", ".json"}:
            continue

        content = path.read_text(encoding="utf-8", errors="replace")
        for offset, value in quoted_strings(content):
            if ".mp3" not in value.lower() and "cdn.jsdelivr.net" not in value.lower():
                continue
            line = content.count("\n", 0, offset) + 1
            add_reference(audit, value, f"{path.relative_to(ROOT).as_posix()}:{line}")


def scan_boss_manifest(audit: Audit) -> None:
    if not BOSS_MANIFEST.is_file():
        raise FileNotFoundError(f"Boss audio manifest not found: {BOSS_MANIFEST}")

    manifest = json.loads(BOSS_MANIFEST.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError(f"{BOSS_MANIFEST} must contain a JSON object.")

    for key, value in manifest.items():
        if isinstance(value, str):
            add_reference(
                audit,
                value,
                f"{BOSS_MANIFEST.relative_to(ROOT).as_posix()}[{json.dumps(key, ensure_ascii=False)}]",
            )


def request_status(url: str) -> tuple[str, str]:
    try:
        response = requests.head(url, allow_redirects=True, timeout=TIMEOUT_SECONDS)
        if response.status_code != 200:
            response.close()
            response = requests.get(
                url,
                allow_redirects=True,
                stream=True,
                timeout=TIMEOUT_SECONDS,
            )
        status = response.status_code
        response.close()
        return str(status), ""
    except requests.RequestException as error:
        return "ERROR", str(error)


def upstream_url(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.netloc != "cdn.jsdelivr.net" or "/gh/" not in parsed.path:
        return None

    repository_path = parsed.path.split("/gh/", 1)[1]
    parts = repository_path.split("/", 2)
    if len(parts) != 3 or "@" not in parts[1]:
        return None

    owner, repository = parts[0], parts[1]
    repository, revision = repository.rsplit("@", 1)
    if not repository or not revision:
        return None

    return (
        f"https://raw.githubusercontent.com/{owner}/{repository}/"
        f"{quote(revision, safe='')}/{quote(parts[2], safe='/@-._~')}"
    )


def check_url(url: str) -> tuple[str, str, str]:
    status, error = request_status(url)
    origin_status = ""
    if status != "200":
        origin = upstream_url(url)
        if origin:
            origin_status, _ = request_status(origin)
    return status, error, origin_status


def write_report(
    results: dict[str, tuple[str, str, str]],
    audit: Audit,
) -> list[str]:
    missing = [
        url
        for url, (status, _, _) in results.items()
        if status != "200"
    ]
    lines = [
        "Audio audit report",
        f"Checked HTTP URLs: {len(results)}",
        f"Existing local audio files: {len(audit.local_files)}",
        f"Unresolved dynamic references: {len(audit.dynamic_references)}",
        "",
        "URLs with status other than 200:",
    ]
    if missing:
        for url in missing:
            status, error, origin_status = results[url]
            lines.append(f"- [{status}] {url}")
            if origin_status:
                lines.append(f"  Upstream raw URL status: {origin_status}")
            for location in sorted(audit.references[url]):
                lines.append(f"  Referenced at: {location}")
            if error:
                lines.append(f"  Error: {error}")
    else:
        lines.append("- None")

    if audit.dynamic_references:
        lines.extend(["", "Dynamic audio references not checked (runtime values needed):"])
        lines.extend(f"- {reference}" for reference in sorted(audit.dynamic_references))

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return missing


def main() -> int:
    try:
        audit = Audit()
        scan_source_files(audit)
        scan_boss_manifest(audit)
        results = {
            url: check_url(url)
            for url in sorted(audit.references)
        }
        missing = write_report(results, audit)
    except (OSError, ValueError, requests.RequestException) as error:
        print(f"Audio audit failed: {error}", file=sys.stderr)
        return 2

    print(f"Checked {len(results)} unique HTTP URL(s).")
    print(f"Validated {len(audit.local_files)} local audio file(s).")
    if audit.dynamic_references:
        print(f"Skipped {len(audit.dynamic_references)} dynamic reference(s); see the report.")

    if missing:
        print("Audio URLs with status other than 200:")
        for url in missing:
            status, error, origin_status = results[url]
            print(f"- [{status}] {url}")
            if origin_status:
                print(f"  Upstream raw URL status: {origin_status}")
            if error:
                print(f"  Error: {error}")
    else:
        print("All checked HTTP audio/CDN URLs returned status 200.")

    print(f"Report saved to {REPORT_PATH.relative_to(ROOT).as_posix()}.")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())

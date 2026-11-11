#!/usr/bin/env python3
"""Generate a small, resumable batch of Everyday English lessons from German topics."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "src" / "modules" / "german" / "content" / "materi"
OUTPUT_DIR = ROOT / "src" / "modules" / "english" / "content" / "everyday"
PROGRESS_FILE = ROOT / "progress.txt"
LEVELS = ("a1", "a2", "b1", "b2", "c1", "c2")
FIELD_PATTERN = re.compile(
    r'^\s*-?\s*(german|indonesian|context|contextIndonesian):\s*("(?:\\.|[^"])*")\s*$'
)
INDEX_PATTERN = re.compile(r"^\s*(\d{4})\s*[:.)-]\s*(.*?)\s*$")

TOPIC_OVERRIDES = {
    "alltags-a1-alam.md": ("nature", "Nature"),
    "alltags-a1-angka.md": ("numbers", "Numbers"),
    "alltags-a1-arah.md": ("directions", "Directions"),
    "alltags-a1-belanja.md": ("shopping", "Shopping"),
    "alltags-a1-binatang.md": ("animals", "Animals"),
}


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def read_frontmatter(path: Path) -> tuple[str, list[dict[str, str]]]:
    title = ""
    vocab: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    in_vocab = False

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() == "vocab:":
            in_vocab = True
            continue
        if not in_vocab:
            title_match = re.match(r'^judulMateri:\s*("(?:\\.|[^"])*")\s*$', line)
            if title_match:
                title = json.loads(title_match.group(1))
            continue

        if line.strip() == "---":
            break
        if re.match(r"^\s*-\s+german:", line):
            current = {}
            vocab.append(current)
        if current is not None:
            field_match = FIELD_PATTERN.match(line)
            if field_match:
                current[field_match.group(1)] = json.loads(field_match.group(2))

    if not title:
        raise ValueError(f"{path}: frontmatter is missing judulMateri")
    if not vocab:
        raise ValueError(f"{path}: frontmatter is missing vocab entries")
    for index, item in enumerate(vocab, start=1):
        missing = {"german", "indonesian", "context"} - item.keys()
        if missing:
            raise ValueError(f"{path}: vocabulary item {index} is missing {', '.join(sorted(missing))}")
    return title, vocab


def translate_batch(
    phrases: list[str], source_language: str = "de", target_language: str = "en"
) -> list[str]:
    numbered = "\n".join(f"{index:04d}: {phrase}" for index, phrase in enumerate(phrases, start=1))
    query = urlencode(
        {"client": "gtx", "sl": source_language, "tl": target_language, "dt": "t", "q": numbered}
    )
    request = Request(
        f"https://translate.googleapis.com/translate_a/single?{query}",
        headers={"User-Agent": "EverydayEnglishContentGenerator/1.0"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        raise RuntimeError(f"Google Translate returned HTTP {error.code}") from error
    except URLError as error:
        raise RuntimeError(f"Could not reach Google Translate: {error.reason}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError("Google Translate returned invalid JSON") from error

    try:
        translated_text = "".join(part[0] for part in payload[0])
    except (IndexError, TypeError) as error:
        raise RuntimeError("Google Translate returned an unexpected response") from error

    translated: dict[int, str] = {}
    for line in translated_text.splitlines():
        match = INDEX_PATTERN.match(line)
        if match:
            translated[int(match.group(1))] = match.group(2).strip()
    if len(translated) != len(phrases):
        raise RuntimeError(
            f"Google Translate returned {len(translated)} of {len(phrases)} indexed translations"
        )
    return [translated[index] for index in range(1, len(phrases) + 1)]


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not slug:
        raise ValueError(f"Cannot create a filename from translated title: {value!r}")
    return slug


def render_lesson(level: str, title: str, vocab: list[dict[str, str]], translations: list[str]) -> str:
    translated_words = translations[: len(vocab)]
    translated_contexts = translations[len(vocab) :]
    lines = [
        "---",
        f"title: {yaml_string(title)}",
        f"description: {yaml_string(f'Learn everyday English about {title.lower()}.')}",
        'track: "Everyday English"',
        f'level: "{level.upper()}"',
        "vocab:",
    ]
    for item, word, context in zip(vocab, translated_words, translated_contexts, strict=True):
        lines.append(
            "  - { word: "
            f"{yaml_string(word)}, translation: {yaml_string(item['indonesian'])}, "
            f"context: {yaml_string(context)}, "
            f"contextIndonesian: {yaml_string(item.get('contextIndonesian', item['context']))} }}"
        )
    lines.extend(["---", "", f"# {title}", "", f"Practice useful English words about {title.lower()}.", ""])
    return "\n".join(lines)


def read_progress(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def save_progress(path: Path, completed: set[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text("".join(f"{item}\n" for item in sorted(completed)), encoding="utf-8")
    temporary_path.replace(path)


def generate(limit_per_level: int, progress_path: Path) -> int:
    completed = read_progress(progress_path)
    generated = 0

    for level in LEVELS:
        candidates = sorted(
            path
            for path in SOURCE_DIR.glob(f"alltags-{level}-*.md")
            if path.name not in completed
        )[:limit_per_level]
        for source_path in candidates:
            relative_source = source_path.relative_to(ROOT).as_posix()
            try:
                source_title, vocab = read_frontmatter(source_path)
                missing_contexts = [
                    index for index, item in enumerate(vocab) if "contextIndonesian" not in item
                ]
                if missing_contexts:
                    indonesia_contexts = translate_batch(
                        [vocab[index]["context"] for index in missing_contexts],
                        target_language="id",
                    )
                    for index, translated_context in zip(
                        missing_contexts, indonesia_contexts, strict=True
                    ):
                        vocab[index]["contextIndonesian"] = translated_context

                override = TOPIC_OVERRIDES.get(source_path.name)
                if override:
                    filename_slug, english_title = override
                else:
                    english_title = translate_batch(
                        [source_title], source_language="id"
                    )[0]
                    filename_slug = slugify(english_title)

                target_dir = OUTPUT_DIR / level
                target_path = target_dir / f"english-{level}-{filename_slug}.md"
                if target_path.exists():
                    print(f"SKIP {relative_source}: {target_path.relative_to(ROOT).as_posix()} already exists")
                else:
                    phrases = [item["german"] for item in vocab]
                    phrases.extend(item["context"] for item in vocab)
                    translations = translate_batch(phrases)
                    target_dir.mkdir(parents=True, exist_ok=True)
                    temporary_target = target_path.with_suffix(target_path.suffix + ".tmp")
                    temporary_target.write_text(
                        render_lesson(level, english_title, vocab, translations),
                        encoding="utf-8",
                    )
                    temporary_target.replace(target_path)
                    generated += 1
                    print(f"CREATED {target_path.relative_to(ROOT).as_posix()}")

                completed.add(source_path.name)
                save_progress(progress_path, completed)
            except (OSError, RuntimeError, ValueError) as error:
                print(f"ERROR {relative_source}: {error}", file=sys.stderr)
                return -1

    print(f"Generated {generated} lesson(s); progress saved to {progress_path}.")
    return generated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit-per-level",
        type=int,
        default=5,
        help="maximum number of new source topics to process per CEFR level in this run (default: 5)",
    )
    parser.add_argument(
        "--progress-file",
        type=Path,
        default=PROGRESS_FILE,
        help="path used to persist completed German source topics (default: progress.txt)",
    )
    args = parser.parse_args()
    if args.limit_per_level < 1:
        parser.error("--limit-per-level must be at least 1")
    progress_path = args.progress_file if args.progress_file.is_absolute() else ROOT / args.progress_file
    return 0 if generate(args.limit_per_level, progress_path) >= 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

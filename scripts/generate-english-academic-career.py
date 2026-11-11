#!/usr/bin/env python3
"""Generate English Academic and Career lessons from their German source collections."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
MATERI_DIR = ROOT / "src" / "modules" / "german" / "content" / "materi"
GERMAN_CAREER_DIR = ROOT / "src" / "modules" / "german" / "content" / "career"
ACADEMIC_OUTPUT_DIR = ROOT / "src" / "modules" / "english" / "content" / "academic"
CAREER_OUTPUT_DIR = ROOT / "src" / "modules" / "english" / "content" / "career"
PROGRESS_FILE = ROOT / "progress_academic_career.txt"
QUOTE_PATTERN = re.compile(r'"(?:\\.|[^"\\])*"')
FIELD_PATTERN = re.compile(
    r'^\s*-?\s*(judulMateri|deskripsi|jurusan|german|indonesian|context|contextIndonesian|'
    r'question|keywords):\s*(.*?)\s*$'
)
INDEX_PATTERN = re.compile(r"^\s*(\d{4})\s*[:.)-]\s*(.*?)\s*$")


def decode_scalar(value: str, path: Path, field: str) -> str:
    try:
        decoded = json.loads(value)
    except json.JSONDecodeError as error:
        raise ValueError(f"{path}: invalid quoted value for {field}") from error
    if not isinstance(decoded, str):
        raise ValueError(f"{path}: expected a string for {field}")
    return decoded


def parse_keywords(value: str, path: Path) -> list[str]:
    quoted_values = QUOTE_PATTERN.findall(value)
    try:
        keywords = [json.loads(item) for item in quoted_values]
    except json.JSONDecodeError as error:
        raise ValueError(f"{path}: invalid keyword in boss_questions") from error
    if not value.startswith("[") or not value.endswith("]") or not keywords:
        raise ValueError(f"{path}: boss_questions keywords must be a non-empty quoted list")
    if not all(isinstance(item, str) for item in keywords):
        raise ValueError(f"{path}: boss_questions keywords must contain strings")
    return keywords


def read_frontmatter(path: Path) -> tuple[dict[str, str], list[dict[str, str]], list[dict[str, object]]]:
    text = path.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3 or parts[0].strip():
        raise ValueError(f"{path}: missing YAML frontmatter")

    metadata: dict[str, str] = {}
    vocab: list[dict[str, str]] = []
    questions: list[dict[str, object]] = []
    section = ""
    current_vocab: dict[str, str] | None = None
    current_question: dict[str, object] | None = None

    for line in parts[1].splitlines():
        if line == "vocab:":
            section = "vocab"
            current_vocab = None
            continue
        if line == "boss_questions:":
            section = "boss_questions"
            current_question = None
            continue

        if section == "vocab":
            if line.startswith("  - {"):
                current_vocab = {}
                vocab.append(current_vocab)
                for field, raw_value in re.findall(
                    r'([A-Za-z_]+):\s*("(?:\\.|[^"\\])*")', line
                ):
                    current_vocab[field] = decode_scalar(raw_value, path, field)
                continue
            match = FIELD_PATTERN.match(line)
            if match and match.group(1) in {
                "german", "indonesian", "context", "contextIndonesian"
            }:
                field, raw_value = match.groups()
                if field == "german":
                    current_vocab = {}
                    vocab.append(current_vocab)
                if current_vocab is None:
                    raise ValueError(f"{path}: vocabulary field appears before a german item")
                current_vocab[field] = decode_scalar(raw_value, path, field)
                continue
            if line.strip() and not line.startswith("  "):
                section = ""

        if section == "boss_questions":
            if re.match(r"^\s+- question:", line):
                match = FIELD_PATTERN.match(line)
                if match is None:
                    raise ValueError(f"{path}: invalid boss question")
                current_question = {
                    "question": decode_scalar(match.group(2), path, "question"),
                    "keywords": [],
                }
                questions.append(current_question)
                continue
            match = FIELD_PATTERN.match(line)
            if match and match.group(1) == "keywords":
                if current_question is None:
                    raise ValueError(f"{path}: keywords appear before a question")
                current_question["keywords"] = parse_keywords(match.group(2), path)
                continue
            if line.strip() and not line.startswith("  "):
                section = ""

        if not section:
            match = FIELD_PATTERN.match(line)
            if match and match.group(1) in {"judulMateri", "deskripsi", "jurusan"}:
                field, raw_value = match.groups()
                metadata[field] = decode_scalar(raw_value, path, field)

    for required in ("judulMateri", "deskripsi"):
        if required not in metadata:
            raise ValueError(f"{path}: missing {required}")
    for index, item in enumerate(vocab, start=1):
        missing = {"german", "indonesian", "context"} - item.keys()
        if missing:
            raise ValueError(
                f"{path}: vocabulary item {index} is missing {', '.join(sorted(missing))}"
            )
    for index, question in enumerate(questions, start=1):
        if not question["keywords"]:
            raise ValueError(f"{path}: boss question {index} has no keywords")
    return metadata, vocab, questions


def translate_batch(
    phrases: list[str], source_language: str, target_language: str
) -> list[str]:
    translations: list[str] = []
    for offset in range(0, len(phrases), 8):
        chunk = phrases[offset : offset + 8]
        numbered = "\n".join(
            f"{index:04d}: {phrase}"
            for index, phrase in enumerate(chunk, start=offset + 1)
        )
        query = urlencode({
            "client": "gtx",
            "sl": source_language,
            "tl": target_language,
            "dt": "t",
            "q": numbered,
        })
        request = Request(
            f"https://translate.googleapis.com/translate_a/single?{query}",
            headers={"User-Agent": "AcademicCareerContentGenerator/1.0"},
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
        translated_by_index: dict[int, str] = {}
        for line in translated_text.splitlines():
            match = INDEX_PATTERN.match(line)
            if match:
                translated_by_index[int(match.group(1))] = match.group(2).strip()
        expected_indices = range(offset + 1, offset + len(chunk) + 1)
        if any(index not in translated_by_index for index in expected_indices):
            raise RuntimeError(
                f"Google Translate returned incomplete results for items "
                f"{offset + 1}-{offset + len(chunk)}"
            )
        translations.extend(
            translated_by_index[index] for index in expected_indices
        )
    return translations


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render_academic(
    title: str,
    description: str,
    jurusan: str,
    vocab: list[dict[str, str]],
    english_words: list[str],
    english_contexts: list[str],
    indonesian_contexts: list[str],
) -> str:
    lines = [
        "---",
        f"title: {yaml_string(title)}",
        f"description: {yaml_string(description)}",
        f"jurusan: {yaml_string(jurusan)}",
        "vocab:",
    ]
    for item, word, context, context_indonesian in zip(
        vocab, english_words, english_contexts, indonesian_contexts, strict=True
    ):
        lines.append(
            "  - { word: "
            f"{yaml_string(word)}, translation: {yaml_string(item['indonesian'])}, "
            f"context: {yaml_string(context)}, "
            f"contextIndonesian: {yaml_string(context_indonesian)} }}"
        )
    lines.extend(["---", "", f"# {title}", "", f"{description}", ""])
    return "\n".join(lines)


def render_career(
    title: str,
    description: str,
    vocab: list[dict[str, str]],
    english_words: list[str],
    english_contexts: list[str],
    indonesian_contexts: list[str],
    questions: list[dict[str, object]],
    english_questions: list[str],
    english_keywords: list[list[str]],
) -> str:
    lines = [
        "---",
        f"title: {yaml_string(title)}",
        f"description: {yaml_string(description)}",
        "boss_questions:",
    ]
    for question, translated_question, translated_keywords in zip(
        questions, english_questions, english_keywords, strict=True
    ):
        keywords = ", ".join(yaml_string(keyword) for keyword in translated_keywords)
        lines.extend([
            f"  - question: {yaml_string(translated_question)}",
            f"    keywords: [{keywords}]",
        ])
    lines.append("vocab:")
    for item, word, context, context_indonesian in zip(
        vocab, english_words, english_contexts, indonesian_contexts, strict=True
    ):
        lines.append(
            "  - { word: "
            f"{yaml_string(word)}, translation: {yaml_string(item['indonesian'])}, "
            f"context: {yaml_string(context)}, "
            f"contextIndonesian: {yaml_string(context_indonesian)} }}"
        )
    lines.extend(["---", "", f"# {title}", "", f"{description}", ""])
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


def atomic_write(path: Path, contents: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(contents, encoding="utf-8")
    temporary_path.replace(path)


def process_academic(source_path: Path, output_path: Path) -> None:
    metadata, vocab, _ = read_frontmatter(source_path)
    if len(vocab) != 20:
        raise ValueError(f"{source_path}: expected 20 Fachdeutsch vocabulary items, found {len(vocab)}")
    if "jurusan" not in metadata:
        raise ValueError(f"{source_path}: missing jurusan")

    title, description = translate_batch(
        [metadata["judulMateri"], metadata["deskripsi"]], "id", "en"
    )
    english_words = translate_batch([item["german"] for item in vocab], "de", "en")
    english_contexts = translate_batch([item["context"] for item in vocab], "de", "en")
    indonesian_contexts = translate_batch([item["context"] for item in vocab], "de", "id")
    atomic_write(
        output_path,
        render_academic(
            title, description, metadata["jurusan"], vocab,
            english_words, english_contexts, indonesian_contexts,
        ),
    )


def process_career(source_path: Path, output_path: Path) -> None:
    metadata, vocab, questions = read_frontmatter(source_path)
    if len(vocab) != 50 or len(questions) != 10:
        raise ValueError(
            f"{source_path}: expected 50 vocabulary items and 10 boss questions; "
            f"found {len(vocab)} and {len(questions)}"
        )

    title, description = translate_batch(
        [metadata["judulMateri"], metadata["deskripsi"]], "id", "en"
    )
    english_words = translate_batch([item["german"] for item in vocab], "de", "en")
    english_contexts = translate_batch([item["context"] for item in vocab], "de", "en")
    indonesian_contexts = translate_batch([item["context"] for item in vocab], "de", "id")
    english_questions = translate_batch(
        [str(question["question"]) for question in questions], "de", "en"
    )
    question_keywords = [
        list(question["keywords"]) for question in questions
    ]
    flat_keywords = [str(keyword) for keywords in question_keywords for keyword in keywords]
    translated_keywords = translate_batch(flat_keywords, "de", "en")
    english_keywords: list[list[str]] = []
    offset = 0
    for keywords in question_keywords:
        english_keywords.append(translated_keywords[offset : offset + len(keywords)])
        offset += len(keywords)
    atomic_write(
        output_path,
        render_career(
            title, description, vocab, english_words, english_contexts,
            indonesian_contexts, questions, english_questions, english_keywords,
        ),
    )


def run_category(
    category: str,
    sources: list[Path],
    output_dir: Path,
    completed: set[str],
    progress_path: Path,
    limit: int,
    processor: Callable[[Path, Path], None],
) -> int:
    generated = 0
    candidates = [
        source for source in sources
        if f"{category}/{source.name}" not in completed
    ][:limit]
    for source_path in candidates:
        progress_key = f"{category}/{source_path.name}"
        output_path = output_dir / (
            f"{source_path.stem.removeprefix('fachdeutsch-')}.md"
            if category == "academic"
            else source_path.name
        )
        try:
            if output_path.exists():
                print(f"SKIP {progress_key}: {output_path.relative_to(ROOT).as_posix()} already exists")
            else:
                processor(source_path, output_path)
                generated += 1
                print(f"CREATED {output_path.relative_to(ROOT).as_posix()}")
            completed.add(progress_key)
            save_progress(progress_path, completed)
        except (OSError, RuntimeError, ValueError) as error:
            print(f"ERROR {progress_key}: {error}", file=sys.stderr)
            return -1
    return generated


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit-academic",
        type=int,
        default=5,
        help="maximum number of Academic source files to process per run (default: 5)",
    )
    parser.add_argument(
        "--limit-career",
        type=int,
        default=5,
        help="maximum number of Career source files to process per run (default: 5)",
    )
    parser.add_argument(
        "--progress-file",
        type=Path,
        default=PROGRESS_FILE,
        help="progress file path (default: progress_academic_career.txt)",
    )
    args = parser.parse_args()
    if args.limit_academic < 1 or args.limit_career < 1:
        parser.error("category limits must be at least 1")
    progress_path = args.progress_file if args.progress_file.is_absolute() else ROOT / args.progress_file
    completed = read_progress(progress_path)

    academic_sources = sorted(MATERI_DIR.glob("fachdeutsch-*.md"))
    career_sources = []
    for source_path in sorted(GERMAN_CAREER_DIR.glob("*.md")):
        try:
            _, vocab, questions = read_frontmatter(source_path)
        except (OSError, ValueError) as error:
            print(f"WARNING: excluding {source_path.name}: {error}", file=sys.stderr)
            continue
        if len(vocab) == 50 and len(questions) == 10:
            career_sources.append(source_path)
        else:
            print(
                f"INFO: excluding non-profession career source {source_path.name} "
                f"({len(vocab)} vocab items, {len(questions)} questions)"
            )

    try:
        academic_count = run_category(
            "academic", academic_sources, ACADEMIC_OUTPUT_DIR, completed,
            progress_path, args.limit_academic, process_academic,
        )
        if academic_count < 0:
            return 1
        career_count = run_category(
            "career", career_sources, CAREER_OUTPUT_DIR, completed,
            progress_path, args.limit_career, process_career,
        )
        if career_count < 0:
            return 1
    except OSError as error:
        print(f"ERROR: could not read or save progress: {error}", file=sys.stderr)
        return 1

    print(
        f"Generated {academic_count} Academic and {career_count} Career lesson(s); "
        f"progress saved to {progress_path}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

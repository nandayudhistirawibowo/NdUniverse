#!/usr/bin/env python3
"""Generate resumable English career vocabulary and interview content with Groq."""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import TypedDict
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "src" / "modules" / "english" / "content" / "career"
GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "openai/gpt-oss-120b"
MAX_RATE_LIMIT_RETRIES = 3
RATE_LIMIT_DELAY_SECONDS = 65
PROFESSIONS = {
    "it": "IT and Software Engineering",
    "business": "Business and E-Commerce",
    "health": "Healthcare",
    "nutrition": "Nutrition",
}

SYSTEM_PROMPT = """Create original English career-preparation learning content.
Return one JSON object with exactly these root fields: title, description, vocab,
boss_questions.
vocab must contain exactly 50 objects. Each object must contain exactly:
word (an English career-related word or short term), translation (its natural
Indonesian meaning), context (one natural English example sentence using the word),
and contextIndonesian (a natural Indonesian translation of that sentence).
boss_questions must contain exactly 10 original English interview questions relevant
to the requested profession. Each question object must contain exactly question and
keywords. keywords must be an array of exactly 3 distinct, concise English words or
phrases that are relevant to a strong answer to that question.
Use valid JSON strings, no markdown fences, no extra fields, and do not claim the
content is official or guarantees employment."""


class VocabItem(TypedDict):
    word: str
    translation: str
    context: str
    contextIndonesian: str


class BossQuestion(TypedDict):
    question: str
    keywords: list[str]


class CareerContent(TypedDict):
    title: str
    description: str
    vocab: list[VocabItem]
    boss_questions: list[BossQuestion]


def validate_string(value: object, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{location} must be a non-empty string")
    return value.strip()


def validate_content(payload: object) -> CareerContent:
    expected_root = {"title", "description", "vocab", "boss_questions"}
    if not isinstance(payload, dict) or set(payload) != expected_root:
        raise ValueError("response must contain exactly title, description, vocab, and boss_questions")

    vocab_value = payload["vocab"]
    if not isinstance(vocab_value, list) or len(vocab_value) != 50:
        count = len(vocab_value) if isinstance(vocab_value, list) else "not an array"
        raise ValueError(f"vocab must contain exactly 50 items, got {count}")

    vocab: list[VocabItem] = []
    seen_words: set[str] = set()
    vocab_keys = {"word", "translation", "context", "contextIndonesian"}
    for index, item in enumerate(vocab_value, start=1):
        if not isinstance(item, dict) or set(item) != vocab_keys:
            raise ValueError(f"vocab[{index}] must contain word, translation, context, and contextIndonesian")
        validated: VocabItem = {
            "word": validate_string(item["word"], f"vocab[{index}].word"),
            "translation": validate_string(item["translation"], f"vocab[{index}].translation"),
            "context": validate_string(item["context"], f"vocab[{index}].context"),
            "contextIndonesian": validate_string(
                item["contextIndonesian"], f"vocab[{index}].contextIndonesian"
            ),
        }
        normalized_word = validated["word"].casefold()
        if normalized_word in seen_words:
            raise ValueError(f"vocab[{index}].word is duplicated")
        seen_words.add(normalized_word)
        vocab.append(validated)

    questions_value = payload["boss_questions"]
    if not isinstance(questions_value, list) or len(questions_value) != 10:
        count = len(questions_value) if isinstance(questions_value, list) else "not an array"
        raise ValueError(f"boss_questions must contain exactly 10 items, got {count}")

    questions: list[BossQuestion] = []
    for index, item in enumerate(questions_value, start=1):
        if not isinstance(item, dict) or set(item) != {"question", "keywords"}:
            raise ValueError(f"boss_questions[{index}] must contain question and keywords")
        question = validate_string(item["question"], f"boss_questions[{index}].question")
        keywords_value = item["keywords"]
        if (
            not isinstance(keywords_value, list)
            or len(keywords_value) != 3
            or not all(isinstance(keyword, str) and keyword.strip() for keyword in keywords_value)
        ):
            raise ValueError(f"boss_questions[{index}].keywords must contain exactly 3 non-empty strings")
        keywords = [keyword.strip() for keyword in keywords_value]
        if len({keyword.casefold() for keyword in keywords}) != 3:
            raise ValueError(f"boss_questions[{index}].keywords must be distinct")
        questions.append({"question": question, "keywords": keywords})

    return CareerContent(
        title=validate_string(payload["title"], "title"),
        description=validate_string(payload["description"], "description"),
        vocab=vocab,
        boss_questions=questions,
    )


def request_content(api_key: str, profession: str) -> object:
    payload = {
        "model": MODEL,
        "temperature": 0.6,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Create the content for the {profession} career-preparation module. "
                    "Keep all interview questions relevant to this profession and write "
                    "the vocabulary examples in practical workplace English."
                ),
            },
        ],
    }

    retries = 0
    while True:
        request = Request(
            GROQ_ENDPOINT,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=120) as response:
                result = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            if error.code == 429 and retries < MAX_RATE_LIMIT_RETRIES:
                retries += 1
                print(
                    f"Rate limited for {profession}; retry {retries}/{MAX_RATE_LIMIT_RETRIES} "
                    f"in {RATE_LIMIT_DELAY_SECONDS} seconds.",
                    file=sys.stderr,
                )
                time.sleep(RATE_LIMIT_DELAY_SECONDS)
                continue
            raise RuntimeError(f"Groq returned HTTP {error.code}: {detail[:500]}") from error
        except URLError as error:
            raise RuntimeError(f"Could not reach Groq: {error.reason}") from error
        except json.JSONDecodeError as error:
            raise RuntimeError("Groq returned invalid JSON") from error

    try:
        content = result["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("Groq response did not contain a chat completion") from error
    if not isinstance(content, str):
        raise RuntimeError("Groq response content must be a string")

    response_text = content.strip()
    if response_text.startswith("```"):
        response_text = response_text.split("\n", 1)[-1]
        if response_text.rstrip().endswith("```"):
            response_text = response_text.rstrip()[:-3].rstrip()
    try:
        return json.loads(response_text)
    except json.JSONDecodeError as error:
        raise ValueError("Groq response content was not valid JSON") from error


def yaml_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render_markdown(content: CareerContent) -> str:
    lines = [
        "---",
        f"title: {yaml_string(str(content['title']))}",
        f"description: {yaml_string(str(content['description']))}",
        "boss_questions:",
    ]
    for question in content["boss_questions"]:
        keywords = ", ".join(yaml_string(keyword) for keyword in question["keywords"])
        lines.extend([
            f"  - question: {yaml_string(question['question'])}",
            f"    keywords: [{keywords}]",
        ])

    lines.append("vocab:")
    for item in content["vocab"]:
        lines.append(
            "  - { word: "
            f"{yaml_string(item['word'])}, translation: {yaml_string(item['translation'])}, "
            f"context: {yaml_string(item['context'])}, "
            f"contextIndonesian: {yaml_string(item['contextIndonesian'])} }}"
        )
    lines.extend(["---", "", f"# {content['title']}", "", str(content["description"]), ""])
    return "\n".join(lines)


def atomic_write(path: Path, contents: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(contents, encoding="utf-8")
    temporary_path.replace(path)


def main() -> int:
    pending = [
        (slug, profession, OUTPUT_DIR / f"{slug}.md")
        for slug, profession in PROFESSIONS.items()
        if not (OUTPUT_DIR / f"{slug}.md").exists()
    ]
    for slug in PROFESSIONS:
        output_path = OUTPUT_DIR / f"{slug}.md"
        if output_path.exists():
            print(f"SKIP {output_path.relative_to(ROOT).as_posix()}: already exists")

    if not pending:
        print("All four English career content files already exist.")
        return 0

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        print("ERROR: Set GROQ_API_KEY before generating missing career content.", file=sys.stderr)
        return 1

    failures = 0
    for slug, profession, output_path in pending:
        try:
            content = validate_content(request_content(api_key, profession))
            atomic_write(output_path, render_markdown(content))
            print(f"CREATED {output_path.relative_to(ROOT).as_posix()}")
        except (OSError, RuntimeError, ValueError) as error:
            failures += 1
            print(f"ERROR {slug}: {error}", file=sys.stderr)
    if failures:
        print(f"Generation finished with {failures} failure(s).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Generate resumable IELTS and TOEFL mock exam content with the Groq API."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import yaml


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "src" / "modules" / "english" / "content" / "exam"
EXAM_TYPES = ("ielts", "toefl")
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
DEFAULT_MODEL = "openai/gpt-oss-120b"
GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = """You write original, high-quality English mock exam material for language learners.
Return a single JSON object only, with exactly these keys:
exam_type (string), level (string), reading (array), listening (array), writing (string),
speaking (object).
Each reading object has exactly: passage (string), question (string), options (array of
strings), answer (string). Each listening object has exactly: transcript (string), question
(string), options (array of strings), answer (string). The speaking object has exactly:
question (string), keywords (array of exactly 3 strings).
Create 5 reading questions and 5 listening questions. Make the correct answer exactly match
one option. Keep every listening transcript short, natural, and entirely in basic, common
English words that are likely to have individual local audio files. Avoid proper names,
contractions, numbers, abbreviations, and punctuation in transcripts. Do not include
audio_text or any extra keys. Make content original and suitable for the requested exam and
CEFR level. Do not claim this is official exam content."""

ADVANCED_SYSTEM_PROMPT = """You write original English mock exam material for CEFR levels B1-C2.
Return a JSON object with exactly these root keys: exam_type, level, reading, listening,
writing, speaking. Each nested question has question, options (strings), and answer (exactly
one of its options).
IELTS: reading has exactly two passage groups, each with a passage and five questions;
listening has exactly two transcript groups, each with a transcript and five questions;
writing has task1 and task2 string prompts; speaking has exactly three parts, each with part,
question, and exactly three keywords.
TOEFL: reading has one passage group with ten questions; listening has one lecture group with
five questions; writing has integrated and academic_discussion string prompts; speaking has
one opinion question and exactly three keywords.
For TOEFL, the `reading` field MUST be an array containing EXACTLY 1 object (a single long
passage) with exactly 10 questions. Do NOT return multiple passages or split them into
separate groups.
The speaking field MUST be a JSON object, not a string. For IELTS B1-C2, it must be an object
with a parts array containing exactly 3 objects. For TOEFL B1-C2, it must be an object with
question and keywords.
Use original, appropriately challenging academic content, inference and detail questions, and
natural lecture/conversation transcripts. Do not add root or nested keys or claim this is
official exam content."""


def validate_string(value: object, location: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{location} must be a non-empty string")
    return value.strip()


def validate_question_items(value: object, field: str, text_field: str) -> list[dict[str, object]]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"{field} must be a non-empty array")

    validated: list[dict[str, object]] = []
    expected_keys = {text_field, "question", "options", "answer"}
    for index, item in enumerate(value, start=1):
        location = f"{field}[{index}]"
        if not isinstance(item, dict) or set(item) != expected_keys:
            raise ValueError(f"{location} must contain exactly {', '.join(sorted(expected_keys))}")
        options = item["options"]
        if (
            not isinstance(options, list)
            or len(options) < 2
            or not all(isinstance(option, str) and option.strip() for option in options)
        ):
            raise ValueError(f"{location}.options must contain at least two non-empty strings")
        answer = validate_string(item["answer"], f"{location}.answer")
        normalized_options = [option.strip() for option in options]
        if answer not in normalized_options:
            raise ValueError(f"{location}.answer must exactly match one of its options")
        validated.append({
            text_field: validate_string(item[text_field], f"{location}.{text_field}"),
            "question": validate_string(item["question"], f"{location}.question"),
            "options": normalized_options,
            "answer": answer,
        })
    return validated


def validate_question_groups(
    value: object,
    field: str,
    content_field: str,
    group_count: int,
    questions_per_group: int,
) -> list[dict[str, object]]:
    if not isinstance(value, list) or len(value) != group_count:
        raise ValueError(f"{field} must contain exactly {group_count} group(s)")

    groups: list[dict[str, object]] = []
    for index, group in enumerate(value, start=1):
        location = f"{field}[{index}]"
        if not isinstance(group, dict) or set(group) != {content_field, "questions"}:
            raise ValueError(f"{location} must contain exactly {content_field} and questions")
        questions = group["questions"]
        if not isinstance(questions, list) or len(questions) != questions_per_group:
            raise ValueError(
                f"{location}.questions must contain exactly {questions_per_group} item(s)"
            )
        groups.append({
            content_field: validate_string(group[content_field], f"{location}.{content_field}"),
            "questions": validate_question_items(questions, f"{location}.questions", "question"),
        })
    return groups


def validate_speaking(value: object, exam_type: str, level: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError("speaking must be an object")

    if exam_type == "ielts" and level not in {"A1", "A2"}:
        parts_value = value.get("parts")
        if set(value) != {"parts"} or not isinstance(parts_value, list) or len(parts_value) != 3:
            raise ValueError("IELTS speaking must contain exactly three parts")
        parts: list[dict[str, object]] = []
        for index, part in enumerate(parts_value, start=1):
            if not isinstance(part, dict) or set(part) != {"part", "question", "keywords"}:
                raise ValueError(f"speaking.parts[{index}] must contain part, question, and keywords")
            keywords = part["keywords"]
            if (
                not isinstance(keywords, list)
                or len(keywords) != 3
                or not all(isinstance(keyword, str) and keyword.strip() for keyword in keywords)
            ):
                raise ValueError(
                    f"speaking.parts[{index}].keywords must contain exactly three strings"
                )
            parts.append({
                "part": validate_string(part["part"], f"speaking.parts[{index}].part"),
                "question": validate_string(part["question"], f"speaking.parts[{index}].question"),
                "keywords": [keyword.strip() for keyword in keywords],
            })
        return {"parts": parts}

    if set(value) != {"question", "keywords"}:
        raise ValueError("speaking must contain exactly question and keywords")
    keywords = value["keywords"]
    if (
        not isinstance(keywords, list)
        or len(keywords) != 3
        or not all(isinstance(keyword, str) and keyword.strip() for keyword in keywords)
    ):
        raise ValueError("speaking.keywords must contain exactly three non-empty strings")
    return {
        "question": validate_string(value["question"], "speaking.question"),
        "keywords": [keyword.strip() for keyword in keywords],
    }


def parse_model_response(raw_response: str) -> object:
    response = raw_response.strip()
    if response.startswith("```"):
        response = response.split("\n", 1)[-1]
        if response.rstrip().endswith("```"):
            response = response.rstrip()[:-3].rstrip()

    decoder = json.JSONDecoder()
    for index, character in enumerate(response):
        if character != "{":
            continue
        try:
            payload, _ = decoder.raw_decode(response[index:])
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload
    raise ValueError("Groq response did not contain a valid JSON object")


def normalize_model_payload(payload: object) -> object:
    if not isinstance(payload, dict):
        return payload

    normalized = dict(payload)
    for plural, singular in (
        ("readings", "reading"),
        ("listenings", "listening"),
        ("writings", "writing"),
        ("speakings", "speaking"),
    ):
        if singular not in normalized and plural in normalized:
            normalized[singular] = normalized[plural]
        normalized.pop(plural, None)

    exam_type = normalized.get("exam_type")
    if isinstance(exam_type, str):
        lowered_exam_type = exam_type.strip().lower()
        if "ielts" in lowered_exam_type:
            normalized["exam_type"] = "ielts"
        elif "toefl" in lowered_exam_type:
            normalized["exam_type"] = "toefl"

    level = normalized.get("level")
    if isinstance(level, str):
        normalized["level"] = level.strip().upper()
    return normalized


def validate_payload(payload: object, exam_type: str, level: str) -> dict[str, object]:
    expected_keys = {"exam_type", "level", "reading", "listening", "writing", "speaking"}
    if not isinstance(payload, dict):
        raise ValueError("response must be a JSON object")
    missing_keys = expected_keys - payload.keys()
    if missing_keys:
        raise ValueError(f"response is missing required fields: {', '.join(sorted(missing_keys))}")
    if payload["exam_type"] != exam_type or payload["level"] != level:
        raise ValueError(f"response exam_type and level must be {exam_type} and {level}")

    if level in {"A1", "A2"}:
        reading = validate_question_items(payload["reading"], "reading", "passage")
        listening = validate_question_items(payload["listening"], "listening", "transcript")
        writing: str | dict[str, str] = validate_string(payload["writing"], "writing")
    elif exam_type == "ielts":
        reading = validate_question_groups(payload["reading"], "reading", "passage", 2, 5)
        listening = validate_question_groups(payload["listening"], "listening", "transcript", 2, 5)
        writing_value = payload["writing"]
        if not isinstance(writing_value, dict) or set(writing_value) != {"task1", "task2"}:
            raise ValueError("IELTS writing must contain task1 and task2")
        writing = {
            "task1": validate_string(writing_value["task1"], "writing.task1"),
            "task2": validate_string(writing_value["task2"], "writing.task2"),
        }
    else:
        reading_value = payload["reading"]
        if not isinstance(reading_value, list) or not reading_value:
            raise ValueError("TOEFL reading must contain at least one passage group")
        questions_per_group = 10
        if len(reading_value) > 1:
            merged_passage = None
            merged_questions = []
            for index, group in enumerate(reading_value, start=1):
                if not isinstance(group, dict) or set(group) != {"passage", "questions"}:
                    raise ValueError(
                        f"reading[{index}] must contain exactly passage and questions"
                    )
                if merged_passage is None:
                    merged_passage = group["passage"]
                questions = group["questions"]
                if not isinstance(questions, list):
                    raise ValueError(f"reading[{index}].questions must be an array")
                merged_questions.extend(questions)
            reading_value = [{
                "passage": merged_passage,
                "questions": merged_questions,
            }]
            questions_per_group = len(merged_questions)
        reading = validate_question_groups(
            reading_value,
            "reading",
            "passage",
            1,
            questions_per_group,
        )
        listening = validate_question_groups(payload["listening"], "listening", "transcript", 1, 5)
        writing_value = payload["writing"]
        if not isinstance(writing_value, dict) or set(writing_value) != {
            "integrated", "academic_discussion"
        }:
            raise ValueError("TOEFL writing must contain integrated and academic_discussion")
        writing = {
            "integrated": validate_string(writing_value["integrated"], "writing.integrated"),
            "academic_discussion": validate_string(
                writing_value["academic_discussion"], "writing.academic_discussion"
            ),
        }

    return {
        "exam_type": exam_type,
        "level": level,
        "reading": reading,
        "listening": listening,
        "writing": writing,
        "speaking": validate_speaking(payload["speaking"], exam_type, level),
    }


def request_exam(api_key: str, model: str, exam_type: str, level: str) -> dict[str, object]:
    if level in {"A1", "A2"}:
        prompt = (
            f"Create one original {exam_type.upper()} mock exam for CEFR level {level}. "
            "Use an appropriate challenge for the level. Listening transcripts must use simple "
            "words likely present as individual files in the local English audio library."
        )
        system_prompt = SYSTEM_PROMPT
    else:
        prompt = f"Create an original {exam_type.upper()} mock exam for CEFR level {level}."
        system_prompt = ADVANCED_SYSTEM_PROMPT

    body = json.dumps({
        "model": model,
        "temperature": 0.6,
        "max_tokens": 6000,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
    }).encode("utf-8")
    request = Request(
        GROQ_ENDPOINT,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    max_retries = 3
    for retry in range(max_retries + 1):
        try:
            with urlopen(request, timeout=120) as response:
                response_body = json.loads(response.read().decode("utf-8"))
            break
        except HTTPError as error:
            details = error.read().decode("utf-8", errors="replace")
            if error.code == 429 and retry < max_retries:
                print(
                    f"Groq rate limit reached for {exam_type.upper()} {level}; "
                    f"retry {retry + 1}/{max_retries} in 65 seconds.",
                    file=sys.stderr,
                )
                time.sleep(65)
                continue
            raise RuntimeError(f"Groq returned HTTP {error.code}: {details[:500]}") from error
        except URLError as error:
            raise RuntimeError(f"Could not reach Groq: {error.reason}") from error
        except json.JSONDecodeError as error:
            raise RuntimeError("Groq returned invalid JSON") from error

    try:
        content = response_body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as error:
        raise RuntimeError("Groq returned an unexpected or invalid exam response") from error

    if not isinstance(content, str):
        raise RuntimeError("Groq returned a non-text exam response")

    try:
        payload = parse_model_response(content)
    except ValueError as error:
        raise RuntimeError(str(error)) from error

    payload = normalize_model_payload(payload)
    required_keys = {"exam_type", "level", "reading", "listening", "writing", "speaking"}
    missing_keys = required_keys - payload.keys() if isinstance(payload, dict) else required_keys
    if missing_keys:
        print(
            f"Groq response missing fields for {exam_type.upper()} {level}: "
            f"{', '.join(sorted(missing_keys))}",
            file=sys.stderr,
        )

    if isinstance(payload, dict):
        payload = dict(payload)
    return validate_payload(payload, exam_type, level)


def atomic_write(path: Path, contents: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(contents, encoding="utf-8")
    temporary_path.replace(path)


def render_exam(payload: dict[str, object]) -> str:
    frontmatter = yaml.safe_dump(
        payload,
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
        width=100,
    )
    return f"---\n{frontmatter}---\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exam-type", choices=EXAM_TYPES, help="generate one exam type (default: both)")
    parser.add_argument("--level", choices=LEVELS, help="generate one level (default: all A1-C2 levels)")
    args = parser.parse_args()

    exam_types = (args.exam_type,) if args.exam_type else EXAM_TYPES
    levels = (args.level,) if args.level else LEVELS
    pending = [
        (exam_type, level, OUTPUT_DIR / exam_type / f"{exam_type}-{level.lower()}-mock.md")
        for exam_type in exam_types
        for level in levels
        if not (OUTPUT_DIR / exam_type / f"{exam_type}-{level.lower()}-mock.md").exists()
    ]
    for exam_type in exam_types:
        for level in levels:
            path = OUTPUT_DIR / exam_type / f"{exam_type}-{level.lower()}-mock.md"
            if path.exists():
                print(f"SKIP {path.relative_to(ROOT).as_posix()}: already exists")

    if not pending:
        print("All requested exam files already exist.")
        return 0

    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        print("ERROR: Set GROQ_API_KEY in the environment before generating content.", file=sys.stderr)
        return 1
    model = os.environ.get("GROQ_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL

    generated = 0
    failure_count = 0
    for index, (exam_type, level, path) in enumerate(pending):
        try:
            payload = request_exam(api_key, model, exam_type, level)
            atomic_write(path, render_exam(payload))
        except (OSError, RuntimeError, ValueError, yaml.YAMLError) as error:
            print(f"ERROR {exam_type.upper()} {level}: {error}", file=sys.stderr)
            failure_count += 1
        else:
            generated += 1
            print(f"CREATED {path.relative_to(ROOT).as_posix()}")
        if index < len(pending) - 1:
            time.sleep(10)

    print(f"Generated {generated} exam file(s); {failure_count} failure(s).")
    return 1 if failure_count else 0


if __name__ == "__main__":
    raise SystemExit(main())

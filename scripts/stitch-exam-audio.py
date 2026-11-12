#!/usr/bin/env python3
"""Assemble exam listening MP3 files from the repository's sentence audio."""

from __future__ import annotations

import json
import logging
import re
import shutil
import sys
import unicodedata
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
EXAM_DIR = ROOT / "src" / "modules" / "english" / "content" / "exam"
PUBLIC_DIR = ROOT / "public"
OUTPUT_DIR = PUBLIC_DIR / "audio" / "exam-listening"
ERROR_LOG_PATH = ROOT / "error_log.txt"
LOCALE_BY_EXAM = {"toefl": "us", "ielts": "gb"}
SILENCE_MS = 2000

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("stitch-exam-audio")


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).lower()
    normalized = re.sub(r"[\W_]+", " ", normalized, flags=re.UNICODE)
    return " ".join(normalized.split())


def display_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def read_frontmatter(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3 or parts[0].strip():
        raise ValueError(f"{path}: missing YAML frontmatter")
    payload = yaml.safe_load(parts[1])
    if not isinstance(payload, dict):
        raise ValueError(f"{path}: frontmatter must be a YAML object")

    exam_type = payload.get("exam_type")
    level = payload.get("level")
    listening = payload.get("listening")
    if exam_type not in LOCALE_BY_EXAM:
        raise ValueError(f"{path}: exam_type must be ielts or toefl")
    if not isinstance(level, str) or not re.fullmatch(r"A[1-2]|B[1-2]|C[1-2]", level):
        raise ValueError(f"{path}: invalid exam level")
    if not isinstance(listening, list):
        raise ValueError(f"{path}: listening must be an array")
    for index, item in enumerate(listening, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"{path}: listening item {index} must be an object")
        transcript = item.get("transcript")
        if transcript is None:
            transcript = item.get("audio_text")
        if not isinstance(transcript, str) or not transcript.strip():
            raise ValueError(f"{path}: listening item {index} is missing transcript")
        item["transcript"] = transcript
    return payload


def split_sentences(transcript: str) -> list[str]:
    return [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", transcript.strip())
        if sentence.strip()
    ]


def load_sentence_audio_map(locale: str) -> dict[str, Path]:
    manifest_path = PUBLIC_DIR / "audio" / f"tts-en-{locale}" / f"manifest-en-{locale}.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Could not read audio manifest {manifest_path}: {error}") from error
    if not isinstance(manifest, dict):
        raise RuntimeError(f"{manifest_path}: expected a text-to-audio mapping")

    audio_root = (PUBLIC_DIR / "audio" / f"tts-en-{locale}").resolve()
    sentence_audio: dict[str, Path] = {}
    for phrase, public_path in manifest.items():
        normalized_phrase = normalize_text(phrase)
        if not normalized_phrase or not isinstance(public_path, str):
            continue
        if not public_path.startswith(f"/audio/tts-en-{locale}/"):
            continue
        audio_path = (PUBLIC_DIR / public_path.lstrip("/")).resolve()
        if audio_root not in audio_path.parents:
            LOGGER.warning("Ignoring audio manifest path outside %s: %s", audio_root, public_path)
            continue
        if audio_path.is_file():
            sentence_audio.setdefault(normalized_phrase, audio_path)
    return sentence_audio


def load_audio_segment(audio_path: Path):
    try:
        from pydub import AudioSegment
    except ImportError as error:
        raise RuntimeError(
            "pydub could not be imported. Install it with "
            '`python -m pip install "pydub>=0.25.1" audioop-lts`.'
        ) from error

    from pydub.exceptions import CouldntDecodeError

    try:
        return AudioSegment.from_mp3(str(audio_path))
    except (CouldntDecodeError, OSError) as error:
        raise ValueError(f"Could not decode {audio_path}: {error}") from error


def stitch_exam(
    path: Path,
    audio_segment_type: Any,
    exam: dict[str, Any] | None = None,
) -> Path | None:
    if exam is None:
        exam = read_frontmatter(path)
    exam_type = str(exam["exam_type"])
    level = str(exam["level"])
    locale = LOCALE_BY_EXAM[exam_type]
    sentence_audio = load_sentence_audio_map(locale)

    silence = audio_segment_type.silent(duration=SILENCE_MS)
    segments = []
    missing_count = 0
    sentence_count = 0
    for item_index, item in enumerate(exam["listening"], start=1):
        for sentence in split_sentences(item["transcript"]):
            audio_path = sentence_audio.get(normalize_text(sentence))
            if audio_path is None:
                message = (
                    f"{exam_type.upper()} {level} listening[{item_index}]: "
                    f"no {locale} MP3 for sentence {sentence!r}; skipping it."
                )
                LOGGER.error(message)
                with ERROR_LOG_PATH.open("a", encoding="utf-8") as error_log:
                    error_log.write(message + "\n")
                missing_count += 1
                continue
            try:
                segment = load_audio_segment(audio_path)
            except ValueError as error:
                LOGGER.warning(
                    "%s %s: %s; skipping sentence %r.",
                    exam_type.upper(),
                    level,
                    error,
                    sentence,
                )
                missing_count += 1
                continue
            if segments:
                segments.append(silence)
            segments.append(segment)
            sentence_count += 1

    if not segments:
        LOGGER.error(
            "%s %s produced no audio segments; no output file was written "
            "(%d sentence(s) unavailable).",
            exam_type.upper(),
            level,
            missing_count,
        )
        return None

    combined = audio_segment_type.empty()
    for segment in segments:
        combined += segment

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / f"{exam_type}-{level.lower()}.mp3"
    temporary_path = OUTPUT_DIR / f"{exam_type}-{level.lower()}.tmp.mp3"
    try:
        combined.export(str(temporary_path), format="mp3")
        temporary_path.replace(output_path)
    finally:
        temporary_path.unlink(missing_ok=True)

    LOGGER.info(
        "Created %s from %d sentence(s); skipped %d unavailable sentence(s).",
        display_path(output_path),
        sentence_count,
        missing_count,
    )
    return output_path


def main() -> int:
    try:
        from pydub import AudioSegment
    except ImportError as error:
        LOGGER.error(
            "pydub could not be imported. Install it with "
            '`python -m pip install "pydub>=0.25.1" audioop-lts`.'
        )
        LOGGER.debug("Import error: %s", error)
        return 1

    if shutil.which("ffmpeg") is None:
        LOGGER.error(
            "FFmpeg was not found on PATH. Install FFmpeg and open a new terminal "
            "before running this script."
        )
        return 1

    markdown_files = sorted(EXAM_DIR.rglob("*.md"))
    if not markdown_files:
        LOGGER.error("No exam Markdown files found under %s.", EXAM_DIR)
        return 1

    exam_groups: dict[tuple[str, str], list[tuple[Path, dict[str, Any]]]] = {}
    failed = False
    for path in markdown_files:
        try:
            exam = read_frontmatter(path)
        except (OSError, ValueError, yaml.YAMLError) as error:
            LOGGER.error("%s: %s", path.relative_to(ROOT).as_posix(), error)
            failed = True
            continue
        key = (str(exam["exam_type"]), str(exam["level"]))
        exam_groups.setdefault(key, []).append((path, exam))

    generated = 0
    for (exam_type, level), entries in exam_groups.items():
        mock_name = f"{exam_type}-{level.lower()}-mock.md"
        selected = next((entry for entry in entries if entry[0].name == mock_name), None)
        if selected is None and len(entries) > 1:
            LOGGER.error(
                "%s %s has multiple Markdown files and no -mock.md file to select.",
                exam_type.upper(),
                level,
            )
            failed = True
            continue
        selected = selected or entries[0]
        if len(entries) > 1:
            LOGGER.info(
                "Using %s for %s %s; skipping %d non-mock example file(s).",
                selected[0].name,
                exam_type.upper(),
                level,
                len(entries) - 1,
            )
        try:
            if stitch_exam(selected[0], AudioSegment, selected[1]) is not None:
                generated += 1
            elif selected[0].name == mock_name:
                failed = True
        except (OSError, RuntimeError, ValueError) as error:
            LOGGER.error("%s: %s", selected[0].relative_to(ROOT).as_posix(), error)
            failed = True

    LOGGER.info("Created %d exam listening audio file(s).", generated)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

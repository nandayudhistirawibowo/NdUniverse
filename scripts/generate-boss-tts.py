import argparse
import asyncio
import hashlib
import json
import os
from pathlib import Path

import edge_tts
import yaml


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "src" / "modules"
PUBLIC_AUDIO_ROOT = ROOT / "public" / "audio" / "boss"
MANIFEST_PATHS = (ROOT / "manifest-boss.json", ROOT / "public" / "manifest-boss.json")
CDN_AUDIO_BASE = (
    "https://cdn.jsdelivr.net/gh/"
    "nandayudhistirawibowo/nduniverse-audio@main/audio/boss"
)
PROFESSIONS = ("it.md", "business.md", "health.md", "nutrition.md")
LANGUAGES = {
    "en": {"voice": "en-US-GuyNeural"},
    "de": {"voice": "de-DE-ConradNeural"},
}
MAX_CONCURRENT_AUDIO = 4
MAX_ATTEMPTS = 3


def read_frontmatter(path):
    source = path.read_text(encoding="utf-8")
    if not source.startswith("---\n") and not source.startswith("---\r\n"):
        raise ValueError(f"Missing YAML frontmatter: {path}")
    parts = source.split("---", 2)
    if len(parts) < 3:
        raise ValueError(f"Unterminated YAML frontmatter: {path}")
    frontmatter = yaml.safe_load(parts[1])
    if not isinstance(frontmatter, dict):
        raise ValueError(f"Frontmatter must be a YAML mapping: {path}")
    return frontmatter


def collect_spoken_texts(language):
    texts = set()
    content_directory = CONTENT_ROOT / ("english" if language == "en" else "german") / "content" / "career"

    for filename in PROFESSIONS:
        path = content_directory / filename
        if not path.is_file():
            raise FileNotFoundError(f"Missing career content: {path}")
        frontmatter = read_frontmatter(path)

        intro = frontmatter.get("boss_intro", [])
        if not isinstance(intro, list):
            raise ValueError(f"boss_intro must be a list: {path}")
        for event in intro:
            if isinstance(event, dict):
                dialog = event.get("dialog")
                if isinstance(dialog, str) and dialog.strip():
                    texts.add(dialog.strip())

        questions = frontmatter.get("boss_questions", [])
        if not isinstance(questions, list):
            raise ValueError(f"boss_questions must be a list: {path}")
        for question in questions:
            if isinstance(question, dict):
                text = question.get("question")
                if isinstance(text, str) and text.strip():
                    texts.add(text.strip())

    return sorted(texts)


def audio_filename(text):
    return f"{hashlib.md5(text.encode('utf-8')).hexdigest()}.mp3"


async def generate_audio(text, output_path, voice, semaphore):
    async with semaphore:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            temporary_path = output_path.with_name(
                f"{output_path.stem}.{os.getpid()}.{attempt}.tmp.mp3"
            )
            try:
                await edge_tts.Communicate(text, voice).save(str(temporary_path))
                if not temporary_path.is_file() or temporary_path.stat().st_size == 0:
                    raise RuntimeError(f"edge-tts did not create audio: {temporary_path}")
                temporary_path.replace(output_path)
                return
            except Exception:
                temporary_path.unlink(missing_ok=True)
                if attempt == MAX_ATTEMPTS:
                    raise
                await asyncio.sleep(attempt * 2)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(f".json.{os.getpid()}.tmp")
    temporary_path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(path)


async def generate_language(language, settings, dry_run, limit):
    texts = collect_spoken_texts(language)
    output_directory = PUBLIC_AUDIO_ROOT / language
    pending = [
        text for text in texts
        if not (output_directory / audio_filename(text)).is_file()
        or (output_directory / audio_filename(text)).stat().st_size == 0
    ]
    if limit is not None:
        pending = pending[:limit]

    print(
        f"{language.upper()}: {len(texts)} unique line(s), "
        f"voice {settings['voice']}, {len(pending)} MP3 file(s) to generate."
    )
    if dry_run:
        return {}

    output_directory.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_AUDIO)
    await asyncio.gather(*(
        generate_audio(
            text,
            output_directory / audio_filename(text),
            settings["voice"],
            semaphore,
        )
        for text in pending
    ))

    manifest = {}
    for text in texts:
        filename = audio_filename(text)
        if (output_directory / filename).is_file():
            manifest[text] = f"{CDN_AUDIO_BASE}/{language}/{filename}"
    return manifest


async def main(dry_run, limit):
    combined_manifest = {}
    for language, settings in LANGUAGES.items():
        combined_manifest.update(
            await generate_language(language, settings, dry_run, limit)
        )

    if dry_run:
        print("Dry run complete; no audio or manifest files were written.")
        return

    for path in MANIFEST_PATHS:
        write_json(path, combined_manifest)
    print(
        f"Wrote {len(combined_manifest)} text-to-audio mapping(s) to "
        "manifest-boss.json and public/manifest-boss.json."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate English and German Boss Fight voice audio.")
    parser.add_argument("--dry-run", action="store_true", help="List audio files without generating them.")
    parser.add_argument(
        "--limit",
        type=int,
        help="Limit the number of missing MP3 files generated per language.",
    )
    arguments = parser.parse_args()
    if arguments.limit is not None and arguments.limit < 0:
        parser.error("--limit must be zero or greater")
    asyncio.run(main(arguments.dry_run, arguments.limit))

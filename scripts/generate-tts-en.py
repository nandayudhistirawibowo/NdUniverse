import argparse
import asyncio
import hashlib
import json
import os
import re
import time
from pathlib import Path

import edge_tts
import yaml

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None


ROOT = Path(__file__).resolve().parents[1]
CONTENT_ROOT = ROOT / "src" / "modules" / "english" / "content"
OUTPUTS = {
    "us": {
        "voice": os.environ.get("EDGE_TTS_EN_US_VOICE", "en-US-AriaNeural"),
        "directory": ROOT / "public" / "audio" / "tts-en-us",
        "manifest": "manifest-en-us.json",
    },
    "gb": {
        "voice": os.environ.get("EDGE_TTS_EN_GB_VOICE", "en-GB-SoniaNeural"),
        "directory": ROOT / "public" / "audio" / "tts-en-gb",
        "manifest": "manifest-en-gb.json",
    },
}
SPOKEN_FIELDS = {
    "word",
    "context",
    "reading_text",
    "listening_audio",
    "audio_text",
    "speaking_question",
}
MAX_ATTEMPTS = 3
INITIAL_RETRY_DELAY = 5


def get_frontmatter(path):
    source = path.read_text(encoding="utf-8")
    if not source.startswith("---\n") and not source.startswith("---\r\n"):
        raise ValueError(f"Missing YAML frontmatter: {path}")
    parts = source.split("---", 2)
    if len(parts) < 3:
        raise ValueError(f"Unterminated YAML frontmatter: {path}")
    return yaml.safe_load(parts[1]) or {}


def collect_spoken_texts(value, texts):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in SPOKEN_FIELDS and isinstance(child, str) and child.strip():
                texts.add(child.strip())
            else:
                collect_spoken_texts(child, texts)
    elif isinstance(value, list):
        for child in value:
            collect_spoken_texts(child, texts)


def collect_exam_transcript_words(exam, texts):
    listening = exam.get("listening", []) if isinstance(exam, dict) else []
    if not isinstance(listening, list):
        return

    for item in listening:
        if not isinstance(item, dict):
            continue
        transcript = item.get("transcript")
        if not isinstance(transcript, str):
            transcript = item.get("audio_text")
        if isinstance(transcript, str) and transcript.strip():
            normalized = re.sub(r"[^\w\s]|_", " ", transcript.lower(), flags=re.UNICODE)
            texts.update(normalized.split())


def content_groups():
    groups = {"us": set(), "gb": set()}
    for path in sorted(CONTENT_ROOT.rglob("*.md")):
        relative = path.relative_to(CONTENT_ROOT)
        accent = "gb" if relative.parts[:2] == ("exam", "ielts") else "us"
        content = get_frontmatter(path)
        collect_spoken_texts(content, groups[accent])
        if relative.parts and relative.parts[0] == "exam":
            collect_exam_transcript_words(content, groups[accent])
    return groups


def audio_filename(text):
    return f"{hashlib.sha256(text.encode('utf-8')).hexdigest()}.mp3"


async def generate_audio(text, output_path, voice):
    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        temporary_path = output_path.with_name(
            f"{output_path.stem}.{os.getpid()}.{attempt}.tmp.mp3"
        )
        try:
            communicator = edge_tts.Communicate(text, voice)
            await communicator.save(str(temporary_path))
            if not temporary_path.is_file() or temporary_path.stat().st_size == 0:
                raise RuntimeError(f"edge-tts did not create audio: {temporary_path}")
            temporary_path.replace(output_path)
            return None
        except Exception as error:
            last_error = error
            if attempt < MAX_ATTEMPTS:
                delay = INITIAL_RETRY_DELAY * (2 ** (attempt - 1))
                print(f"Attempt {attempt}/{MAX_ATTEMPTS} failed; retrying in {delay}s: {error}")
                await asyncio.sleep(delay)
        finally:
            temporary_path.unlink(missing_ok=True)
    return last_error


def write_manifest(path, manifest):
    temporary_path = path.with_suffix(f".json.{os.getpid()}.tmp")
    temporary_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(path)


def log_failure(accent, text, error):
    log_path = ROOT / "error_log.txt"
    with log_path.open("a", encoding="utf-8") as error_log:
        error_log.write(f"[{accent.upper()}] {text}\n  {error!r}\n")


async def main(dry_run, limit):
    groups = content_groups()
    attempts = 0
    if dry_run:
        missing_count = 0
        for accent, settings in OUTPUTS.items():
            texts = sorted(groups[accent])
            print(f"{accent.upper()}: {len(texts)} unique text(s), voice {settings['voice']}.")
            directory = settings["directory"]
            missing_count += sum(
                not (directory / audio_filename(text)).is_file()
                or (directory / audio_filename(text)).stat().st_size == 0
                for text in texts
            )
        planned_count = missing_count if limit is None else min(missing_count, limit)
        print(f"Dry run: would attempt {planned_count} missing MP3 file(s); no audio generated.")
        return

    for accent, settings in OUTPUTS.items():
        texts = sorted(groups[accent])
        print(f"{accent.upper()}: {len(texts)} unique text(s), voice {settings['voice']}.")

        directory = settings["directory"]
        directory.mkdir(parents=True, exist_ok=True)
        manifest_path = directory / settings["manifest"]
        if manifest_path.is_file():
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not isinstance(manifest, dict):
                raise ValueError(f"Manifest must be a text-to-audio mapping: {manifest_path}")
        else:
            manifest = {}

        pending_texts = []
        for text in texts:
            filename = audio_filename(text)
            output_path = directory / filename
            audio_path = f"/audio/{directory.name}/{filename}"
            if output_path.is_file() and output_path.stat().st_size > 0:
                manifest[text] = audio_path
            else:
                pending_texts.append(text)

        remaining = None if limit is None else max(limit - attempts, 0)
        if remaining is not None and len(pending_texts) > remaining:
            pending_texts = pending_texts[:remaining]
        elif remaining == 0 and limit is not None:
            print(f"Batch limit reached after {attempts} attempted download(s).")

        progress = tqdm(pending_texts, desc="Downloading TTS", unit="file") if tqdm else pending_texts
        for index, text in enumerate(progress, start=1):
            filename = audio_filename(text)
            output_path = directory / filename
            audio_path = f"/audio/{directory.name}/{filename}"
            attempts += 1
            error = await generate_audio(text, output_path, settings["voice"])
            if error is not None:
                log_failure(accent, text, error)
                manifest.pop(text, None)
                print(f"Skipping failed {accent.upper()} text; logged to error_log.txt.")
            else:
                manifest[text] = audio_path
                time.sleep(0.01)
            if tqdm is None and (index % 100 == 0 or index == len(pending_texts)):
                print(f"Downloading TTS: {index}/{len(pending_texts)} files.")

        write_manifest(manifest_path, manifest)

    print(f"Run complete: {attempts} missing MP3 file(s) attempted.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate static English TTS audio.")
    parser.add_argument("--dry-run", action="store_true", help="List voice/text totals without generating audio.")
    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of missing MP3 files to attempt in this run.",
    )
    arguments = parser.parse_args()
    if arguments.limit is not None and arguments.limit < 0:
        parser.error("--limit must be zero or greater")
    # TODO: Proxy/User-Agent rotation
    asyncio.run(main(arguments.dry_run, arguments.limit))
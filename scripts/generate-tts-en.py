import argparse
import asyncio
import hashlib
import json
import os
import re
from pathlib import Path

import edge_tts
import yaml

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None


ROOT = Path(__file__).resolve().parents[1]
MODULES_ROOT = ROOT / "src" / "modules"
CDN_MANIFEST_PATH = ROOT / "manifest-cdn.json"
CDN_AUDIO_BASE = (
    "https://cdn.jsdelivr.net/gh/"
    "nandayudhistirawibowo/nduniverse-audio@main/audio"
)
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
    "de": {
        "voice": os.environ.get("EDGE_TTS_DE_VOICE", "de-DE-ConradNeural"),
        "directory": ROOT / "public" / "audio" / "tts",
        "manifest": "manifest-de.json",
    },
}
ENGLISH_SPOKEN_FIELDS = {
    "word",
    "context",
    "reading_text",
    "reading_question",
    "listening_audio",
    "audio_text",
    "speaking_question",
    "question",
    "dialog",
    "transcript",
    "passage",
    "writing_instruction",
    "writing",
    "task1",
    "task2",
    "integrated",
    "academic_discussion",
}
GERMAN_SPOKEN_FIELDS = {
    "german",
    "context",
    "lesen_teks",
    "lesen_pertanyaan",
    "hoeren_audio",
    "schreiben_instruksi",
    "sprechen_pertanyaan",
    "word",
    "question",
    "dialog",
    "prompt",
    "transcript",
}
MAX_ATTEMPTS = 3
INITIAL_RETRY_DELAY = 5
MAX_CONCURRENT_DOWNLOADS = 10


def get_frontmatter(path):
    source = path.read_text(encoding="utf-8")
    if not source.startswith("---\n") and not source.startswith("---\r\n"):
        raise ValueError(f"Missing YAML frontmatter: {path}")
    parts = source.split("---", 2)
    if len(parts) < 3:
        raise ValueError(f"Unterminated YAML frontmatter: {path}")
    return yaml.safe_load(parts[1]) or {}


def collect_spoken_texts(value, texts, spoken_fields):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in spoken_fields and isinstance(child, str) and child.strip():
                texts.add(child.strip())
            else:
                collect_spoken_texts(child, texts, spoken_fields)
    elif isinstance(value, list):
        for child in value:
            collect_spoken_texts(child, texts, spoken_fields)


def split_exam_transcript_sentences(transcript):
    normalized = re.sub(r"\s+", " ", transcript).strip()
    if not normalized:
        return []

    return [
        sentence.strip()
        for sentence in re.split(
            r"(?<=[.!?])\s+(?=[\"'“‘(\[]*[A-Z0-9])",
            normalized,
        )
        if sentence.strip()
    ]


def collect_exam_transcript_sentences(exam, texts):
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
            normalized = re.sub(r"\s+", " ", transcript).strip()
            texts.add(normalized)
            texts.update(split_exam_transcript_sentences(normalized))


def content_groups(language):
    texts = set()
    content_root = MODULES_ROOT / language / "content"
    if not content_root.is_dir():
        raise FileNotFoundError(f"Content directory does not exist: {content_root}")
    spoken_fields = ENGLISH_SPOKEN_FIELDS if language == "english" else GERMAN_SPOKEN_FIELDS
    for path in sorted(content_root.rglob("*.md")):
        content = get_frontmatter(path)
        collect_spoken_texts(content, texts, spoken_fields)
        if language == "english" and "exam" in path.relative_to(content_root).parts:
            collect_exam_transcript_sentences(content, texts)
    if language == "english":
        return {accent: set(texts) for accent in ("us", "gb")}
    return {"de": texts}


def audio_filename(text, accent):
    normalized_text = re.sub(r"\s+", " ", text).strip()
    text_hash = hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()
    return f"{text_hash}.mp3" if accent == "de" else f"{text_hash}-{accent}.mp3"


def audio_cdn_path(directory, filename):
    return f"{directory.name}/{filename}"


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
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    temporary_path.replace(path)


def read_cdn_manifest():
    if not CDN_MANIFEST_PATH.is_file():
        return {}

    manifest = json.loads(CDN_MANIFEST_PATH.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError(f"CDN manifest must be a path-to-URL mapping: {CDN_MANIFEST_PATH}")
    return manifest


def log_failure(accent, text, error):
    log_path = ROOT / "error_log.txt"
    with log_path.open("a", encoding="utf-8") as error_log:
        error_log.write(f"[{accent.upper()}] {text}\n  {error!r}\n")


async def main(dry_run, limit):
    groups = {
        **content_groups("english"),
        **content_groups("german"),
    }
    attempts = 0
    files_generated = set()
    if dry_run:
        missing_count = 0
        for accent, settings in OUTPUTS.items():
            texts = sorted(groups[accent])
            print(f"{accent.upper()}: {len(texts)} unique text(s), voice {settings['voice']}.")
            directory = settings["directory"]
            missing = [
                text
                for text in texts
                if not (directory / audio_filename(text, accent)).is_file()
                or (directory / audio_filename(text, accent)).stat().st_size == 0
            ]
            remaining = None if limit is None else max(limit - missing_count, 0)
            if remaining is not None:
                missing = missing[:remaining]
            missing_count += len(missing)
            print(f"Files to generate locally ({len(missing)}):")
            for text in missing:
                print(f"- public/audio/{audio_cdn_path(directory, audio_filename(text, accent))}")
        print(f"Dry run: {missing_count} missing MP3 file(s); no audio generated.")
        return

    cdn_manifest = read_cdn_manifest()
    for accent, settings in OUTPUTS.items():
        texts = sorted(groups[accent])
        print(
            f"{accent.upper()}: {len(texts)} unique text(s), "
            f"voice {settings['voice']}."
        )

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
            filename = audio_filename(text, accent)
            output_path = directory / filename
            relative_audio_path = audio_cdn_path(directory, filename)
            cdn_url = f"{CDN_AUDIO_BASE}/{relative_audio_path}"
            if output_path.is_file() and output_path.stat().st_size > 0:
                manifest[text] = f"/audio/{relative_audio_path}"
                cdn_manifest[relative_audio_path] = cdn_url
            else:
                pending_texts.append(text)

        remaining = None if limit is None else max(limit - attempts, 0)
        if remaining is not None and len(pending_texts) > remaining:
            pending_texts = pending_texts[:remaining]
        elif remaining == 0 and limit is not None:
            print(f"Batch limit reached after {attempts} attempted download(s).")

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)

        async def download_one(text):
            filename = audio_filename(text, accent)
            output_path = directory / filename
            async with semaphore:
                error = await generate_audio(text, output_path, settings["voice"])
            return text, filename, error

        progress = tqdm(
            total=len(pending_texts),
            desc="Downloading TTS",
            unit="file",
        ) if tqdm else None
        try:
            for start in range(0, len(pending_texts), MAX_CONCURRENT_DOWNLOADS):
                batch = pending_texts[start:start + MAX_CONCURRENT_DOWNLOADS]
                results = await asyncio.gather(*(download_one(text) for text in batch))
                attempts += len(batch)

                for text, filename, error in results:
                    if error is not None:
                        log_failure(accent, text, error)
                        print(f"Skipping failed {accent.upper()} text; logged to error_log.txt.")
                    else:
                        relative_audio_path = audio_cdn_path(directory, filename)
                        manifest[text] = f"/audio/{relative_audio_path}"
                        cdn_manifest[relative_audio_path] = (
                            f"{CDN_AUDIO_BASE}/{relative_audio_path}"
                        )
                        files_generated.add(relative_audio_path)
                        print(f"Generated {relative_audio_path}")

                if progress:
                    progress.update(len(batch))
                elif batch:
                    completed = start + len(batch)
                    if completed % 100 == 0 or completed == len(pending_texts):
                        print(f"Downloading TTS: {completed}/{len(pending_texts)} files.")
        finally:
            if progress:
                progress.close()

        write_manifest(manifest_path, manifest)

    write_manifest(CDN_MANIFEST_PATH, cdn_manifest)
    print(f"Run complete: {attempts} missing MP3 file(s) attempted.")
    print("MP3 files generated locally (sync these with nduniverse-audio if needed):")
    if files_generated:
        for relative_path in sorted(files_generated):
            print(f"- {relative_path}")
    else:
        print("- None")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Audit content and generate static English and German TTS audio."
    )
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
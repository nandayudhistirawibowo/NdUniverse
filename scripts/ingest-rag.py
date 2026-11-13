#!/usr/bin/env python3
"""Chunk Markdown learning materials, embed them, and store them in Supabase."""

from __future__ import annotations

import hashlib
import logging
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = {
    "german": ROOT / "src" / "modules" / "german" / "content",
    "english": ROOT / "src" / "modules" / "english" / "content",
}
EMBEDDING_MODEL = "@cf/baai/bge-small-en-v1.5"
EMBEDDING_DIMENSIONS = 384
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBEDDING_BATCH_SIZE = 10

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("ingest-rag")


@dataclass
class MarkdownDocument:
    source_file: str
    language: str
    content_hash: str
    chunks: list[str]
    embeddings: list[list[float] | None]


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> list[str]:
    if chunk_size <= 0 or overlap < 0 or overlap >= chunk_size:
        raise ValueError("chunk_size must be positive and overlap must be smaller than chunk_size")

    text = text.strip()
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            boundary = max(text.rfind("\n", start, end), text.rfind(" ", start, end))
            if boundary > start + chunk_size // 2:
                end = boundary + 1

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)

    return chunks


def collect_documents() -> list[MarkdownDocument]:
    documents: list[MarkdownDocument] = []
    markdown_files = [
        (language, path)
        for language, source_root in SOURCE_ROOTS.items()
        for path in sorted(source_root.rglob("*.md"))
    ]
    if not markdown_files:
        raise RuntimeError("No Markdown files found in the German or English content directories.")

    for language, path in markdown_files:
        source_file = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8")
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        chunks = chunk_text(text)
        if not chunks:
            LOGGER.info("Skipping empty Markdown file %s.", source_file)
            continue

        documents.append(
            MarkdownDocument(
                source_file=source_file,
                language=language,
                content_hash=content_hash,
                chunks=chunks,
                embeddings=[None] * len(chunks),
            )
        )

    if not documents:
        raise RuntimeError("No non-empty Markdown documents were found to ingest.")
    return documents


def embed_documents(
    api_url: str,
    api_token: str,
    documents: list[MarkdownDocument],
) -> None:
    chunk_references = [
        (document, chunk_index)
        for document in documents
        for chunk_index in range(len(document.chunks))
    ]

    for batch_start in range(0, len(chunk_references), EMBEDDING_BATCH_SIZE):
        batch_references = chunk_references[batch_start:batch_start + EMBEDDING_BATCH_SIZE]
        batch_text = [
            document.chunks[chunk_index]
            for document, chunk_index in batch_references
        ]
        try:
            response = requests.post(
                api_url,
                headers={
                    "Authorization": f"Bearer {api_token}",
                    "Content-Type": "application/json",
                },
                json={"text": batch_text},
                timeout=60,
            )
            response.raise_for_status()
            payload = response.json()
        except ValueError as error:
            LOGGER.error("Cloudflare returned invalid JSON.")
            raise RuntimeError("Cloudflare returned invalid JSON.") from error
        except requests.RequestException as error:
            LOGGER.error("Cloudflare embedding request failed: %s", error)
            raise RuntimeError("Cloudflare embedding request failed.") from error

        result = payload.get("result") if isinstance(payload, dict) else None
        embeddings = result.get("data") if isinstance(result, dict) else None
        if not isinstance(embeddings, list) or len(embeddings) != len(batch_references):
            raise RuntimeError("Cloudflare returned an incomplete embedding batch.")

        for batch_index, (document, chunk_index) in enumerate(batch_references):
            embedding = embeddings[batch_index]
            if (
                not isinstance(embedding, list)
                or len(embedding) != EMBEDDING_DIMENSIONS
                or any(
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(value)
                    for value in embedding
                )
            ):
                raise RuntimeError(
                    f"Expected a {EMBEDDING_DIMENSIONS}-dimension embedding "
                    f"for {document.source_file} chunk {chunk_index + 1}."
                )
            document.embeddings[chunk_index] = [float(value) for value in embedding]

        LOGGER.info(
            "Embedded %d of %d chunks with Cloudflare Workers AI.",
            min(batch_start + len(batch_references), len(chunk_references)),
            len(chunk_references),
        )


def insert_documents(supabase: Any, documents: list[MarkdownDocument]) -> int:
    rows_by_file: list[tuple[str, list[dict[str, Any]]]] = []
    for document in documents:
        rows = []
        for chunk_index, (content, embedding) in enumerate(
            zip(document.chunks, document.embeddings, strict=True),
            start=1,
        ):
            if embedding is None:
                raise RuntimeError(
                    f"Missing embedding for {document.source_file} chunk {chunk_index}."
                )
            rows.append(
                {
                    "content": content,
                    "metadata": {
                        "source_file": document.source_file,
                        "language": document.language,
                        "content_hash": document.content_hash,
                        "chunk_index": chunk_index,
                        "chunk_count": len(document.chunks),
                    },
                    "embedding": embedding,
                }
            )
        rows_by_file.append((document.source_file, rows))

    LOGGER.warning("Deleting all existing rows from public.documents before full re-ingestion.")
    supabase.table("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    for source_file, rows in rows_by_file:
        supabase.table("documents").insert(rows).execute()
        LOGGER.info("Ingested %s (%d chunks).", source_file, len(rows))

    return len(rows_by_file)


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Re-ingest NdUniverse RAG documents.")
    parser.add_argument(
        "--replace-all",
        action="store_true",
        help="Delete all existing rows in documents before inserting the re-embedded corpus.",
    )
    args = parser.parse_args()
    if not args.replace_all:
        parser.error("full re-ingestion is destructive; pass --replace-all to continue")

    try:
        from dotenv import load_dotenv
        from supabase import create_client
    except ImportError as error:
        LOGGER.error(
            "Missing RAG dependency. Install with: "
            "python -m pip install -r requirements-rag.txt"
        )
        LOGGER.debug("Import error: %s", error)
        return 1

    load_dotenv(ROOT / ".env")
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("PUBLIC_SUPABASE_URL")
    cloudflare_account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    cloudflare_api_token = os.getenv("CLOUDFLARE_API_TOKEN")
    missing_variables = [
        name
        for name, value in (
            ("SUPABASE_URL (or PUBLIC_SUPABASE_URL)", supabase_url),
            ("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY")),
            ("CLOUDFLARE_ACCOUNT_ID", cloudflare_account_id),
            ("CLOUDFLARE_API_TOKEN", cloudflare_api_token),
        )
        if not value
    ]
    if missing_variables:
        LOGGER.error("Missing required .env variable(s): %s", ", ".join(missing_variables))
        return 1

    supabase = create_client(
        supabase_url,
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    documents = collect_documents()

    chunk_count = sum(len(document.chunks) for document in documents)
    LOGGER.info(
        "Preparing a full re-ingestion of %d file(s) with %d chunk(s) using %s.",
        len(documents),
        chunk_count,
        EMBEDDING_MODEL,
    )

    api_url = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{cloudflare_account_id}/ai/run/{EMBEDDING_MODEL}"
    )
    embed_documents(api_url, cloudflare_api_token, documents)
    inserted = insert_documents(supabase, documents)
    LOGGER.info(
        "RAG ingestion complete: %d file(s) indexed.",
        inserted,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

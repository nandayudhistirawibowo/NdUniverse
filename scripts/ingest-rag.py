#!/usr/bin/env python3
"""Chunk Markdown learning materials, embed them, and store them in Supabase."""

from __future__ import annotations

import hashlib
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = {
    "german": ROOT / "src" / "modules" / "german" / "content",
    "english": ROOT / "src" / "modules" / "english" / "content",
}
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIMENSIONS = 384
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBEDDING_BATCH_SIZE = 64

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
LOGGER = logging.getLogger("ingest-rag")


@dataclass
class MarkdownDocument:
    source_file: str
    language: str
    content_hash: str
    chunks: list[str]
    replace_existing: bool
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


def find_existing_documents(supabase: Any, source_file: str) -> list[dict[str, Any]]:
    response = (
        supabase.table("documents")
        .select("metadata")
        .contains("metadata", {"source_file": source_file})
        .limit(1)
        .execute()
    )
    return response.data or []


def collect_documents(supabase: Any) -> tuple[list[MarkdownDocument], int]:
    pending: list[MarkdownDocument] = []
    skipped = 0
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
            skipped += 1
            continue

        existing = find_existing_documents(supabase, source_file)
        if existing:
            metadata = existing[0].get("metadata") or {}
            if metadata.get("content_hash") == content_hash:
                LOGGER.info("Already ingested; skipping %s.", source_file)
                skipped += 1
                continue
            LOGGER.info("Content changed; replacing indexed chunks for %s.", source_file)

        pending.append(
            MarkdownDocument(
                source_file=source_file,
                language=language,
                content_hash=content_hash,
                chunks=chunks,
                replace_existing=bool(existing),
                embeddings=[None] * len(chunks),
            )
        )

    return pending, skipped


def embed_documents(model: Any, documents: list[MarkdownDocument]) -> None:
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
        embeddings = model.encode(batch_text).tolist()
        if len(embeddings) != len(batch_references):
            raise RuntimeError("The local embedding model returned an incomplete batch.")

        for batch_index, (document, chunk_index) in enumerate(batch_references):
            embedding = embeddings[batch_index]
            if embedding is None or len(embedding) != EMBEDDING_DIMENSIONS:
                raise RuntimeError(
                    f"Expected a {EMBEDDING_DIMENSIONS}-dimension embedding "
                    f"for {document.source_file} chunk {chunk_index + 1}."
                )
            document.embeddings[chunk_index] = embedding

        LOGGER.info(
            "Embedded %d of %d chunks.",
            min(batch_start + len(batch_references), len(chunk_references)),
            len(chunk_references),
        )


def insert_documents(supabase: Any, documents: list[MarkdownDocument]) -> int:
    inserted_files = 0
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

        if document.replace_existing:
            (
                supabase.table("documents")
                .delete()
                .contains("metadata", {"source_file": document.source_file})
                .execute()
            )

        supabase.table("documents").insert(rows).execute()
        inserted_files += 1
        LOGGER.info("Ingested %s (%d chunks).", document.source_file, len(rows))

    return inserted_files


def main() -> int:
    try:
        from dotenv import load_dotenv
        from sentence_transformers import SentenceTransformer
        from supabase import create_client
    except ImportError as error:
        LOGGER.error(
            "Missing RAG dependency. Install with: "
            "python -m pip install -r requirements-rag.txt"
        )
        LOGGER.debug("Import error: %s", error)
        return 1

    load_dotenv(ROOT / ".env")
    required_variables = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    missing_variables = [name for name in required_variables if not os.getenv(name)]
    if missing_variables:
        LOGGER.error("Missing required .env variable(s): %s", ", ".join(missing_variables))
        return 1

    supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    documents, skipped = collect_documents(supabase)
    if not documents:
        LOGGER.info("No new or changed Markdown files to ingest; skipped %d file(s).", skipped)
        return 0

    chunk_count = sum(len(document.chunks) for document in documents)
    LOGGER.info(
        "Preparing %d file(s) with %d chunk(s) using %s; skipped %d file(s).",
        len(documents),
        chunk_count,
        EMBEDDING_MODEL,
        skipped,
    )
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embed_documents(model, documents)
    inserted = insert_documents(supabase, documents)
    LOGGER.info(
        "RAG ingestion complete: %d file(s) indexed, %d file(s) skipped.",
        inserted,
        skipped,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

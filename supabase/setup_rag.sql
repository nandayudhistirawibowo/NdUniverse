create extension if not exists vector;

drop function if exists public.match_documents(vector(1536), double precision, integer, jsonb);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(384) not null
);

alter table public.documents enable row level security;

do $$
begin
  if exists (
    select 1
    from public.documents
    where vector_dims(embedding) <> 384
    limit 1
  ) then
    raise exception 'Existing document embeddings are not 384-dimensional; re-ingest them before changing the vector dimension.';
  end if;
end;
$$;

drop index if exists public.documents_embedding_hnsw_idx;

alter table public.documents
  alter column embedding type vector(384)
  using embedding::vector(384);

create index if not exists documents_embedding_hnsw_idx
  on public.documents
  using hnsw (embedding vector_cosine_ops);

create or replace function public.match_documents(
  query_embedding vector(384),
  match_threshold double precision default 0.7,
  match_count integer default 5,
  filter jsonb default '{}'::jsonb
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  score double precision
)
language sql
stable
as $$
  select
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as score
  from public.documents
  where documents.metadata @> filter
    and 1 - (documents.embedding <=> query_embedding) >= match_threshold
  order by documents.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 5), 1), 100);
$$;

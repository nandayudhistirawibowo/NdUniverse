create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  material_slug text not null,
  language_code varchar not null default 'de',
  xp integer not null default 0 check (xp >= 0),
  -- Backward-compatible JSON array; values may be numeric legacy session IDs or
  -- CEFR pillar strings: reading, listening, writing, speaking.
  sessions_passed jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sessions_passed) = 'array'),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  constraint user_progress_user_material_language_key
    unique (user_id, material_slug, language_code)
);

alter table public.user_progress
  add column if not exists language_code varchar not null default 'de';

alter table public.user_progress
  drop constraint if exists user_progress_user_material_key;

-- If the table already exists, add the upsert key if it is not present yet.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where contype = 'p'
      and conrelid = 'public.user_progress'::regclass
  ) then
    alter table public.user_progress
      add constraint user_progress_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_progress_user_id_fkey'
      and conrelid = 'public.user_progress'::regclass
  ) then
    alter table public.user_progress
      add constraint user_progress_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_progress_user_material_language_key'
      and conrelid = 'public.user_progress'::regclass
  ) then
    alter table public.user_progress
      add constraint user_progress_user_material_language_key
      unique (user_id, material_slug, language_code);
  end if;
end
$$;

alter table public.user_progress alter column id set default gen_random_uuid();
alter table public.user_progress alter column xp set default 0;
alter table public.user_progress alter column sessions_passed set default '[]'::jsonb;
alter table public.user_progress alter column notes set default '';
alter table public.user_progress alter column updated_at set default now();

alter table public.user_progress enable row level security;

grant select, insert, update on table public.user_progress to authenticated;

drop policy if exists "Users can read own progress" on public.user_progress;
create policy "Users can read own progress"
  on public.user_progress for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own progress" on public.user_progress;
create policy "Users can insert own progress"
  on public.user_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on public.user_progress;
create policy "Users can update own progress"
  on public.user_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.profiles
  add column if not exists current_level text;

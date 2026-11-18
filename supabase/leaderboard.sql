create or replace function public.get_leaderboard()
returns table (
  id uuid,
  name text,
  level text,
  xp bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    profile.id,
    coalesce(nullif(btrim(profile.nama_lengkap), ''), 'Pengguna') as name,
    coalesce(nullif(btrim(profile.current_level), ''), 'A1') as level,
    coalesce(sum(progress.xp), 0)::bigint as xp
  from public.profiles as profile
  left join public.user_progress as progress
    on progress.user_id = profile.id
  group by profile.id, profile.nama_lengkap, profile.current_level
  order by level desc, xp desc, profile.id
  limit 100;
$$;

revoke all on function public.get_leaderboard() from public, anon, authenticated;
grant execute on function public.get_leaderboard() to service_role;

drop function if exists public.get_leaderboard();

create or replace function public.get_leaderboard(p_lang text)
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
  with language_progress as (
    select
      progress.user_id,
      progress.xp,
      progress.material_slug,
      coalesce(sessions.passed, array[]::text[]) as passed,
      case
        when p_lang = 'en' and progress.material_slug like 'a1/english-a1-%' then 10
        when p_lang = 'en' and progress.material_slug like 'a2/english-a2-%' then 20
        when p_lang = 'en' and progress.material_slug like 'b1/english-b1-%' then 30
        when p_lang = 'en' and progress.material_slug like 'b2/english-b2-%' then 40
        when p_lang = 'en' and progress.material_slug like 'c1/english-c1-%' then 50
        when p_lang = 'en' and progress.material_slug like 'c2/english-c2-%' then 60
        when p_lang = 'de' and progress.material_slug like 'alltags-a1-%' then 10
        when p_lang = 'de' and progress.material_slug like 'alltags-a2-%' then 20
        when p_lang = 'de' and progress.material_slug like 'alltags-b1-%' then 30
        when p_lang = 'de' and progress.material_slug like 'alltags-b2-%' then 40
        when p_lang = 'de' and progress.material_slug like 'alltags-c1-%' then 50
        when p_lang = 'de' and progress.material_slug like 'alltags-c2-%' then 60
        else 0
      end as level_points
    from public.user_progress as progress
    cross join lateral (
      select array_agg(item.value) as passed
      from jsonb_array_elements_text(progress.sessions_passed) as item(value)
    ) as sessions
    where progress.language_code = p_lang
      and p_lang in ('en', 'de')
  ),
  completed_progress as (
    select
      progress.user_id,
      progress.xp,
      progress.level_points,
      (
        progress.passed @> array['reading', 'listening', 'writing', 'speaking']::text[]
        or progress.passed @> array['1', '2', '3', '4']::text[]
        or progress.passed @> array['Sesi 4']::text[]
        or progress.passed @> array['Sesi 4 Lulus']::text[]
        or exists (
          select 1
          from unnest(progress.passed) as pillar(value)
          where pillar.value ~ '^s[0-9]+-reading$'
            and progress.passed @> array[
              pillar.value,
              regexp_replace(pillar.value, '-reading$', '-listening'),
              regexp_replace(pillar.value, '-reading$', '-writing'),
              regexp_replace(pillar.value, '-reading$', '-speaking')
            ]::text[]
        )
      ) as is_complete
    from language_progress as progress
  ),
  user_totals as (
    select
      progress.user_id,
      sum(progress.xp)::bigint as xp,
      sum(case when progress.is_complete then progress.level_points else 0 end)::bigint as level_points
    from completed_progress as progress
    group by progress.user_id
  ),
  leaderboard_rows as (
    select
      profile.id,
      coalesce(nullif(btrim(profile.nama_lengkap), ''), 'Pengguna') as name,
      coalesce(totals.xp, 0)::bigint as xp,
      coalesce(totals.level_points, 0)::bigint as level_points,
      case
        when coalesce(totals.level_points, 0) >= 2200 then 'C2 (Mahir)'
        when coalesce(totals.level_points, 0) >= 1800 then 'C1'
        when coalesce(totals.level_points, 0) >= 1400 then 'B2'
        when coalesce(totals.level_points, 0) >= 1000 then 'B1'
        when coalesce(totals.level_points, 0) >= 700 then 'A2 Lanjutan'
        when coalesce(totals.level_points, 0) >= 400 then 'A2 Pemula'
        when coalesce(totals.level_points, 0) >= 200 then 'A1 Lanjutan'
        else 'A1 Pemula'
      end as level,
      case
        when coalesce(totals.level_points, 0) >= 2200 then 8
        when coalesce(totals.level_points, 0) >= 1800 then 7
        when coalesce(totals.level_points, 0) >= 1400 then 6
        when coalesce(totals.level_points, 0) >= 1000 then 5
        when coalesce(totals.level_points, 0) >= 700 then 4
        when coalesce(totals.level_points, 0) >= 400 then 3
        when coalesce(totals.level_points, 0) >= 200 then 2
        else 1
      end as level_order
    from public.profiles as profile
    left join user_totals as totals
      on totals.user_id = profile.id
  )
  select
    leaderboard.id,
    leaderboard.name,
    leaderboard.level,
    leaderboard.xp
  from leaderboard_rows as leaderboard
  where p_lang in ('en', 'de')
  order by leaderboard.level_order desc, leaderboard.xp desc, leaderboard.id
  limit 100;
$$;

revoke all on function public.get_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_leaderboard(text) to service_role;

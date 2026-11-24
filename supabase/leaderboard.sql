drop function if exists public.get_leaderboard(text);

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
  with valid_lang as (
    select case when p_lang in ('en', 'de') then p_lang else null end as lang
  ),
  language_progress as (
    select
      progress.user_id,
      coalesce(progress.xp, 0)::bigint as xp,
      coalesce(progress.material_slug, '') as material_slug,
      coalesce(passed.items, array[]::text[]) as passed_items,
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
    join valid_lang on valid_lang.lang = progress.language_code
    left join lateral (
      select coalesce(array_agg(lower(btrim(elem.value))), array[]::text[]) as items
      from jsonb_array_elements_text(coalesce(progress.sessions_passed, '[]'::jsonb)) as elem(value)
    ) as passed on true
  ),
  completed_progress as (
    select
      language_progress.user_id,
      language_progress.xp,
      language_progress.level_points,
      (
        -- Legacy/full-material completion markers
        language_progress.passed_items @> array['reading', 'listening', 'writing', 'speaking']::text[]
        or language_progress.passed_items @> array['1', '2', '3', '4']::text[]
        or language_progress.passed_items @> array['sesi 4']::text[]
        or language_progress.passed_items @> array['sesi 4 lulus']::text[]
        -- Any session with all 4 pillars passed (sessions_passed items like s1-reading)
        or exists (
          select 1
          from unnest(language_progress.passed_items) as item(value)
          where item.value ~ '^s[0-9]+-reading$'
            and language_progress.passed_items @> array[
              item.value,
              regexp_replace(item.value, '-reading$', '-listening'),
              regexp_replace(item.value, '-reading$', '-writing'),
              regexp_replace(item.value, '-reading$', '-speaking')
            ]::text[]
        )
      ) as is_complete
    from language_progress
  ),
  user_totals as (
    select
      completed_progress.user_id,
      sum(completed_progress.xp)::bigint as total_xp,
      sum(case when completed_progress.is_complete then completed_progress.level_points else 0 end)::bigint as total_level_points
    from completed_progress
    group by completed_progress.user_id
  ),
  leaderboard_rows as (
    select
      profile.id,
      coalesce(nullif(btrim(profile.nama_lengkap), ''), 'Pengguna') as name,
      coalesce(totals.total_xp, 0)::bigint as xp,
      coalesce(totals.total_level_points, 0)::bigint as level_points,
      case
        when coalesce(totals.total_level_points, 0) >= 2200 then 'C2 (Mahir)'
        when coalesce(totals.total_level_points, 0) >= 1800 then 'C1'
        when coalesce(totals.total_level_points, 0) >= 1400 then 'B2'
        when coalesce(totals.total_level_points, 0) >= 1000 then 'B1'
        when coalesce(totals.total_level_points, 0) >= 700 then 'A2 Lanjutan'
        when coalesce(totals.total_level_points, 0) >= 400 then 'A2 Pemula'
        when coalesce(totals.total_level_points, 0) >= 200 then 'A1 Lanjutan'
        else 'A1 Pemula'
      end as level,
      case
        when coalesce(totals.total_level_points, 0) >= 2200 then 8
        when coalesce(totals.total_level_points, 0) >= 1800 then 7
        when coalesce(totals.total_level_points, 0) >= 1400 then 6
        when coalesce(totals.total_level_points, 0) >= 1000 then 5
        when coalesce(totals.total_level_points, 0) >= 700 then 4
        when coalesce(totals.total_level_points, 0) >= 400 then 3
        when coalesce(totals.total_level_points, 0) >= 200 then 2
        else 1
      end as level_order
    from public.profiles as profile
    left join user_totals as totals
      on totals.user_id = profile.id
    where p_lang in ('en', 'de')
      and coalesce(totals.total_xp, 0) > 0
      and position('admin' in lower(coalesce(profile.nama_lengkap, ''))) = 0
      and position('admin' in lower(coalesce(profile.nim, ''))) = 0
  )
  select
    leaderboard_rows.id,
    leaderboard_rows.name,
    leaderboard_rows.level,
    leaderboard_rows.xp
  from leaderboard_rows
  order by leaderboard_rows.level_order desc, leaderboard_rows.xp desc, leaderboard_rows.id
  limit 100;
$$;

revoke all on function public.get_leaderboard(text) from public, anon, authenticated;
grant execute on function public.get_leaderboard(text) to anon, authenticated, service_role;

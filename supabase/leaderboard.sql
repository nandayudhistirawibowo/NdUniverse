drop function if exists public.get_leaderboard(text);

create function public.get_leaderboard(p_lang text)
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
  with valid_language as (
    select p_lang as language_code
    where p_lang in ('en', 'de')
  ),
  -- Keep these counts aligned with the published Everyday English and Alltagsdeutsch content.
  material_level_counts(language_code, level_code, material_count, level_order) as (
    values
      ('en', 'A1', 27, 1),
      ('en', 'A2', 52, 2),
      ('en', 'B1', 103, 3),
      ('en', 'B2', 52, 4),
      ('en', 'C1', 52, 5),
      ('en', 'C2', 105, 6),
      ('de', 'A1', 25, 1),
      ('de', 'A2', 52, 2),
      ('de', 'B1', 103, 3),
      ('de', 'B2', 52, 4),
      ('de', 'C1', 52, 5),
      ('de', 'C2', 127, 6)
  ),
  cumulative_level_targets as (
    select
      counts.language_code,
      counts.level_code,
      counts.level_order,
      sum(counts.material_count * 800) over (
        partition by counts.language_code
        order by counts.level_order
      )::bigint as cumulative_xp_target
    from material_level_counts as counts
  ),
  language_progress as (
    select
      progress.user_id,
      least(greatest(coalesce(progress.xp, 0), 0), 800)::bigint as capped_xp,
      case
        when progress.language_code = 'en' and progress.material_slug like 'a1/english-a1-%' then 'A1'
        when progress.language_code = 'en' and progress.material_slug like 'a2/english-a2-%' then 'A2'
        when progress.language_code = 'en' and progress.material_slug like 'b1/english-b1-%' then 'B1'
        when progress.language_code = 'en' and progress.material_slug like 'b2/english-b2-%' then 'B2'
        when progress.language_code = 'en' and progress.material_slug like 'c1/english-c1-%' then 'C1'
        when progress.language_code = 'en' and progress.material_slug like 'c2/english-c2-%' then 'C2'
        when progress.language_code = 'de' and progress.material_slug like 'alltags-a1-%' then 'A1'
        when progress.language_code = 'de' and progress.material_slug like 'alltags-a2-%' then 'A2'
        when progress.language_code = 'de' and progress.material_slug like 'alltags-b1-%' then 'B1'
        when progress.language_code = 'de' and progress.material_slug like 'alltags-b2-%' then 'B2'
        when progress.language_code = 'de' and progress.material_slug like 'alltags-c1-%' then 'C1'
        when progress.language_code = 'de' and progress.material_slug like 'alltags-c2-%' then 'C2'
        else null
      end as cefr_level
    from public.user_progress as progress
    join valid_language
      on valid_language.language_code = progress.language_code
  ),
  user_totals as (
    select
      progress.user_id,
      sum(progress.capped_xp)::bigint as total_xp,
      sum(progress.capped_xp) filter (where progress.cefr_level is not null)::bigint as cefr_xp
    from language_progress as progress
    group by progress.user_id
  ),
  leaderboard_rows as (
    select
      profile.id,
      coalesce(nullif(btrim(profile.nama_lengkap), ''), 'Pengguna') as name,
      coalesce(totals.total_xp, 0)::bigint as xp,
      coalesce((
        select target.level_code
        from cumulative_level_targets as target
        where target.language_code = p_lang
          and coalesce(totals.cefr_xp, 0) < target.cumulative_xp_target
        order by target.level_order
        limit 1
      ), 'C2') as level,
      coalesce((
        select target.level_order
        from cumulative_level_targets as target
        where target.language_code = p_lang
          and coalesce(totals.cefr_xp, 0) < target.cumulative_xp_target
        order by target.level_order
        limit 1
      ), 6) as level_order
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

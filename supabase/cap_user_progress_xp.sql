update public.user_progress
set xp = 800,
    updated_at = now()
where xp > 800;

update storage.buckets
set public = false
where id = 'avatars';

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'avatars') then
    raise exception 'Storage bucket "avatars" does not exist.';
  end if;
end;
$$;

-- Before running, remove any older permissive SELECT policies for this bucket;
-- Supabase combines permissive policies with OR.
drop policy if exists "Avatar owners can upload files" on storage.objects;
create policy "Avatar owners can upload files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar owners can update files" on storage.objects;
create policy "Avatar owners can update files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar owners and admins can view files" on storage.objects;
create policy "Avatar owners and admins can view files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.profiles
        where profiles.id = auth.uid()
          and lower(trim(profiles.nim)) in ('admin', '000000')
      )
    )
  );

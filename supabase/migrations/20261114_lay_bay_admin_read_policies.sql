-- LBM LAY-BAY: administrator read access required by lay-bay-admin.js
-- Review before running in Supabase SQL Editor.
-- This does not grant customers access to other customers' records.
-- Only authenticated users listed in public.admin_users receive access.

drop policy if exists "LBM admins can view Lay-Bay plans"
on public.lay_bay_plans;

create policy "LBM admins can view Lay-Bay plans"
on public.lay_bay_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "LBM admins can view Lay-Bay profiles"
on public.lay_bay_profiles;

create policy "LBM admins can view Lay-Bay profiles"
on public.lay_bay_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_users a
    where a.user_id = (select auth.uid())
  )
);

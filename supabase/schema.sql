-- Run in a dedicated Supabase project for Yomi. Each signed-in user owns one JSON document.
create table if not exists public.yomi_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint payload_is_object check (jsonb_typeof(payload) = 'object')
);
alter table public.yomi_state enable row level security;
revoke all on public.yomi_state from anon;
grant select, insert, update, delete on public.yomi_state to authenticated;
create policy "Read own planner" on public.yomi_state for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Create own planner" on public.yomi_state for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own planner" on public.yomi_state for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own planner" on public.yomi_state for delete to authenticated
  using ((select auth.uid()) = user_id);

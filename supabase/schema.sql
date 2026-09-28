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

-- Keep both versions of a sync conflict so they can be restored from either device.
create table if not exists public.yomi_conflict_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conflict_key text not null,
  device_copy jsonb not null check (jsonb_typeof(device_copy) = 'object'),
  account_copy jsonb not null check (jsonb_typeof(account_copy) = 'object'),
  created_at timestamptz not null default now(),
  constraint yomi_conflict_backups_unique unique (user_id, conflict_key)
);
create index if not exists yomi_conflict_backups_user_created
  on public.yomi_conflict_backups (user_id, created_at desc);
alter table public.yomi_conflict_backups enable row level security;
revoke all on public.yomi_conflict_backups from anon, public;
grant select, insert on public.yomi_conflict_backups to authenticated;
create policy "Read own conflict backups"
  on public.yomi_conflict_backups for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Save own conflict backups"
  on public.yomi_conflict_backups for insert to authenticated
  with check ((select auth.uid()) = user_id);

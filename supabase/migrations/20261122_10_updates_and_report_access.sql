-- 1) issue reports: give the api roles explicit access to the table.
--    projects that don't auto-expose new tables to the api refuse inserts
--    otherwise ("permission denied"), which made reports fail to send.
grant select, insert, update, delete on table public.issue_reports to authenticated;
grant all on table public.issue_reports to service_role;
revoke all on table public.issue_reports from anon;

-- 2) what each user has already seen: release notes ("release:<id>") and
--    new-feature notes ("note:<id>"). kept in the database so it follows
--    the user across devices.
create table if not exists public.user_seen (
  user_id uuid not null,
  key text not null,
  seen_at timestamptz not null default now(),
  constraint user_seen_pkey primary key (user_id, key),
  constraint user_seen_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint user_seen_key_check check (key ~ '^(release|note):[a-z0-9-]{1,80}$')
);

alter table public.user_seen enable row level security;

drop policy if exists user_seen_select_own on public.user_seen;
create policy user_seen_select_own on public.user_seen as permissive for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_seen_insert_own on public.user_seen;
create policy user_seen_insert_own on public.user_seen as permissive for insert to authenticated
  with check (user_id = auth.uid());

grant select, insert on table public.user_seen to authenticated;
grant all on table public.user_seen to service_role;
revoke all on table public.user_seen from anon;

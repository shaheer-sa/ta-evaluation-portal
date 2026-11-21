-- push notifications: one row per device/browser that turned them on
create table if not exists public.push_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_pkey primary key (id),
  constraint push_subscriptions_endpoint_key unique (endpoint),
  constraint push_subscriptions_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade,
  constraint push_subscriptions_endpoint_check check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  constraint push_subscriptions_keys_check check (char_length(p256dh) <= 200 and char_length(auth) <= 100)
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions as permissive for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions as permissive for delete to authenticated
  using (user_id = auth.uid());

-- saving a subscription is done by the server (it may move a device from one
-- account to another when someone else signs in on it)
grant select, delete on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;
revoke all on table public.push_subscriptions from anon;

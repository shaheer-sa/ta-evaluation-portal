-- daily email digest support
-- 1) notifications remember when they were included in an email, so a
--    student is never emailed about the same marks twice
alter table public.notifications
  add column if not exists emailed_at timestamptz;

create index if not exists idx_notifications_digest
  on public.notifications (type, emailed_at)
  where emailed_at is null;

-- 2) user_seen can also record "mail:<release id>" (release note emailed),
--    so each student gets at most one email per release
alter table public.user_seen drop constraint if exists user_seen_key_check;
alter table public.user_seen
  add constraint user_seen_key_check check (key ~ '^(release|note|mail):[a-z0-9-]{1,80}$');

-- 3) students can choose to get the daily "new marks" email (off by default)
alter table public.profiles
  add column if not exists marks_email boolean not null default false;

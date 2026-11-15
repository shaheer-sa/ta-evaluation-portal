-- students can report problems with the site ("Report an issue" button).
-- the ta gets an email + bell notification and can mark a report fixed.

create table if not exists public.issue_reports (
  id uuid not null default gen_random_uuid(),
  reporter_id uuid not null,
  category text not null,
  message text not null,
  page_url text,
  user_agent text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint issue_reports_pkey primary key (id),
  constraint issue_reports_reporter_id_fkey foreign key (reporter_id) references public.profiles(id) on delete cascade,
  constraint issue_reports_category_check check (category in ('bug', 'display', 'login', 'suggestion', 'other')),
  constraint issue_reports_message_check check (char_length(message) between 10 and 2000),
  constraint issue_reports_page_url_check check (page_url is null or char_length(page_url) <= 500),
  constraint issue_reports_user_agent_check check (user_agent is null or char_length(user_agent) <= 500),
  constraint issue_reports_status_check check (status in ('open', 'fixed'))
);

create index if not exists idx_issue_reports_created on public.issue_reports (created_at desc);
create index if not exists idx_issue_reports_reporter on public.issue_reports (reporter_id);

alter table public.issue_reports enable row level security;

drop policy if exists issue_reports_student_insert_own on public.issue_reports;
create policy issue_reports_student_insert_own on public.issue_reports as permissive for insert to public
  with check ((reporter_id = auth.uid()) and (status = 'open') and (resolved_at is null) and is_active_student());

drop policy if exists issue_reports_student_select_own on public.issue_reports;
create policy issue_reports_student_select_own on public.issue_reports as permissive for select to public
  using ((reporter_id = auth.uid()) and is_active_student());

drop policy if exists issue_reports_ta_all on public.issue_reports;
create policy issue_reports_ta_all on public.issue_reports as permissive for all to public
  using (is_ta())
  with check (is_ta());

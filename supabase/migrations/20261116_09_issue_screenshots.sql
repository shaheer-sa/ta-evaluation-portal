-- screenshots on issue reports: up to 3 images per report, kept in a private
-- storage bucket. only the server (service role) reads/writes the bucket; the
-- ta sees them through short-lived signed links.

alter table public.issue_reports
  add column if not exists screenshot_paths text[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'issue_reports_screenshots_check'
  ) then
    alter table public.issue_reports
      add constraint issue_reports_screenshots_check check (cardinality(screenshot_paths) <= 3);
  end if;
end $$;

-- a student can only attach files from their own folder (<their id>/...)
drop policy if exists issue_reports_student_insert_own on public.issue_reports;
create policy issue_reports_student_insert_own on public.issue_reports as permissive for insert to public
  with check (
    (reporter_id = auth.uid())
    and (status = 'open')
    and (resolved_at is null)
    and is_active_student()
    and not exists (
      select 1 from unnest(screenshot_paths) as p(path)
      where p.path not like (auth.uid()::text || '/%')
    )
  );

-- private bucket, 2 MB per image, images only
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-screenshots', 'issue-screenshots', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

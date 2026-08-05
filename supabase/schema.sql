-- ============================================================================
-- TAMS — Teaching Assistant Management System
-- Complete database schema, Row Level Security policies, functions, triggers.
--
-- Run this once against a fresh Supabase project:
--   Supabase Dashboard -> SQL Editor -> paste -> Run
--
-- WHY THIS FILE EXISTS
-- The application depended on all of this already being present in one
-- particular Supabase project, but none of it was in the repository. README
-- step 3 said "apply the database schema" with no schema to apply, so the
-- project could not be run by anyone else, and the access-control rules that
-- keep one student from reading another's grades were invisible and
-- unreviewable. Both problems are fixed by keeping the schema in source
-- control alongside the code that assumes it.
-- ============================================================================

-- ── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type user_role as enum ('ta', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assessment_type as enum
    ('assignment', 'quiz', 'mid', 'final', 'project', 'cp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type query_status as enum
    ('pending', 'in_review', 'resolved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type query_priority as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  role        user_role not null default 'student',
  roll_number text unique,
  must_change_password boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists terms (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one active term at a time. activate_term() below flips this
-- atomically; a plain UPDATE that would create a second active term fails.
create unique index if not exists terms_single_active_idx
  on terms (is_active) where is_active;

create table if not exists courses (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  name               text not null,
  enable_cp          boolean not null default true,
  enable_assignments boolean not null default true,
  enable_quizzes     boolean not null default true,
  enable_reeval      boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists sections (
  id         uuid primary key default gen_random_uuid(),
  term_id    uuid not null references terms(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_id, name)
);

create table if not exists section_courses (
  id         uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id) on delete cascade,
  course_id  uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (section_id, course_id)
);

create table if not exists enrollments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  section_id uuid not null references sections(id) on delete cascade,
  course_id  uuid not null references courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- The sync and CSV import both rely on this to detect "already enrolled"
  -- via error code 23505 rather than duplicating rows on every run.
  unique (student_id, section_id, course_id)
);

create table if not exists assessments (
  id                uuid primary key default gen_random_uuid(),
  section_course_id uuid not null references section_courses(id) on delete cascade,
  type              assessment_type not null,
  title             text not null,
  max_marks         numeric not null check (max_marks > 0),
  weight            numeric not null default 0 check (weight >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists marks (
  id                 uuid primary key default gen_random_uuid(),
  enrollment_id      uuid not null references enrollments(id) on delete cascade,
  assessment_id      uuid not null references assessments(id) on delete cascade,
  score              numeric check (score >= 0),
  -- Last value written to (or read from) the Google Sheet. The sync engine
  -- compares score against this to work out which side changed.
  sheet_synced_score numeric,
  updated_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Required by the batched upsert in /api/grading and by the sync engine.
  unique (enrollment_id, assessment_id)
);

create table if not exists queries (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references profiles(id) on delete cascade,
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  assessment_id uuid references assessments(id) on delete set null,
  title         text not null,
  description   text not null,
  priority      query_priority not null default 'medium',
  status        query_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists replies (
  id         uuid primary key default gen_random_uuid(),
  query_id   uuid not null references queries(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  message    text not null,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  related_id   uuid,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists activity_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles(id) on delete set null,
  action     text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes for the app's hot paths ─────────────────────────────────────────

create index if not exists enrollments_student_idx  on enrollments (student_id);
create index if not exists enrollments_section_idx  on enrollments (section_id, course_id);
create index if not exists marks_enrollment_idx     on marks (enrollment_id);
create index if not exists marks_assessment_idx     on marks (assessment_id);
create index if not exists queries_student_idx      on queries (student_id);
create index if not exists queries_status_idx       on queries (status);
create index if not exists replies_query_idx        on replies (query_id);
create index if not exists notifications_recipient_idx
  on notifications (recipient_id, is_read);
create index if not exists assessments_sc_idx       on assessments (section_course_id);

-- ── Helper: is the current user a TA? ───────────────────────────────────────
-- SECURITY DEFINER so it can read profiles without tripping the profiles
-- policies, which would otherwise recurse infinitely when a policy on
-- another table calls this to check the caller's role.

create or replace function is_ta()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'ta'
  );
$$;

-- ── Trigger: create a profile row for every new auth user ───────────────────

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name, role, roll_number)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'student'),
    nullif(new.raw_user_meta_data->>'roll_number', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Function: class average for one assessment ──────────────────────────────
-- Called per-assessment from the student course page. SECURITY DEFINER so a
-- student can see the class average without being able to read classmates'
-- individual marks.

create or replace function get_class_average(p_assessment_id uuid)
returns numeric
language sql
security definer
set search_path = public
stable
as $$
  select round(avg(score)::numeric, 2)
  from marks
  where assessment_id = p_assessment_id
    and score is not null;
$$;

-- ── Function: activate a term atomically ────────────────────────────────────
-- Deactivating the old term and activating the new one must happen in one
-- statement pair, or the unique partial index above rejects the intermediate
-- state where two terms are briefly active.

create or replace function activate_term(p_term_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_ta() then
    raise exception 'Only teaching assistants can activate a term';
  end if;

  update terms set is_active = false, updated_at = now() where is_active;
  update terms set is_active = true,  updated_at = now() where id = p_term_id;

  insert into activity_logs (actor_id, action, detail)
  values (auth.uid(), 'term_activated', jsonb_build_object('term_id', p_term_id));
end;
$$;

-- ── Trigger: keep updated_at honest ─────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','terms','courses','sections','assessments','marks','queries'
  ] loop
    execute format('drop trigger if exists touch_%1$s on %1$s', t);
    execute format(
      'create trigger touch_%1$s before update on %1$s
       for each row execute function touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================================
-- ROW LEVEL SECURITY
--
-- This is the layer that actually stops a student reading another student's
-- marks. The API routes now carry their own role and ownership checks too,
-- but those only protect the paths the app itself calls; anyone holding an
-- anon key can query PostgREST directly, and only RLS stands in the way.
-- ============================================================================

alter table profiles        enable row level security;
alter table terms           enable row level security;
alter table courses         enable row level security;
alter table sections        enable row level security;
alter table section_courses enable row level security;
alter table enrollments     enable row level security;
alter table assessments     enable row level security;
alter table marks           enable row level security;
alter table queries         enable row level security;
alter table replies         enable row level security;
alter table notifications   enable row level security;
alter table activity_logs   enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select
  using (id = auth.uid() or is_ta());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles for update
  using (id = auth.uid())
  -- A student must not be able to promote themselves to 'ta'.
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

drop policy if exists profiles_ta_all on profiles;
create policy profiles_ta_all on profiles for all
  using (is_ta()) with check (is_ta());

-- Reference data: readable by any signed-in user, writable by TAs only.
-- Students need to read these to see their own course and section names.
do $$
declare t text;
begin
  foreach t in array array['terms','courses','sections','section_courses','assessments']
  loop
    execute format('drop policy if exists %1$s_read on %1$s', t);
    execute format(
      'create policy %1$s_read on %1$s for select to authenticated using (true)', t);
    execute format('drop policy if exists %1$s_ta_write on %1$s', t);
    execute format(
      'create policy %1$s_ta_write on %1$s for all using (is_ta()) with check (is_ta())', t);
  end loop;
end $$;

-- enrollments ---------------------------------------------------------------
drop policy if exists enrollments_select on enrollments;
create policy enrollments_select on enrollments for select
  using (student_id = auth.uid() or is_ta());

drop policy if exists enrollments_ta_write on enrollments;
create policy enrollments_ta_write on enrollments for all
  using (is_ta()) with check (is_ta());

-- marks ---------------------------------------------------------------------
-- The core confidentiality rule: a student sees only marks attached to their
-- own enrollments. TAs see everything.
drop policy if exists marks_select on marks;
create policy marks_select on marks for select
  using (
    is_ta()
    or exists (
      select 1 from enrollments e
      where e.id = marks.enrollment_id and e.student_id = auth.uid()
    )
  );

drop policy if exists marks_ta_write on marks;
create policy marks_ta_write on marks for all
  using (is_ta()) with check (is_ta());

-- queries -------------------------------------------------------------------
drop policy if exists queries_select on queries;
create policy queries_select on queries for select
  using (student_id = auth.uid() or is_ta());

drop policy if exists queries_student_insert on queries;
create policy queries_student_insert on queries for insert
  with check (
    student_id = auth.uid()
    and exists (
      select 1 from enrollments e
      where e.id = enrollment_id and e.student_id = auth.uid()
    )
  );

drop policy if exists queries_ta_update on queries;
create policy queries_ta_update on queries for update
  using (is_ta()) with check (is_ta());

drop policy if exists queries_ta_delete on queries;
create policy queries_ta_delete on queries for delete using (is_ta());

-- replies -------------------------------------------------------------------
drop policy if exists replies_select on replies;
create policy replies_select on replies for select
  using (
    is_ta()
    or exists (
      select 1 from queries q
      where q.id = replies.query_id and q.student_id = auth.uid()
    )
  );

drop policy if exists replies_insert on replies;
create policy replies_insert on replies for insert
  with check (
    sender_id = auth.uid()
    and (
      is_ta()
      or exists (
        select 1 from queries q
        where q.id = query_id and q.student_id = auth.uid()
      )
    )
  );

-- notifications -------------------------------------------------------------
drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select
  using (recipient_id = auth.uid());

drop policy if exists notifications_update_own on notifications;
create policy notifications_update_own on notifications for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- Any signed-in user can create a notification, but only addressed to
-- someone else as a side effect of an action they were allowed to take.
drop policy if exists notifications_insert on notifications;
create policy notifications_insert on notifications for insert
  to authenticated with check (true);

-- activity_logs -------------------------------------------------------------
drop policy if exists activity_logs_ta_read on activity_logs;
create policy activity_logs_ta_read on activity_logs for select using (is_ta());

-- ============================================================================
-- SEEDING YOUR FIRST TA
--
-- Everything above defaults new accounts to 'student', so the first TA has to
-- be promoted by hand. Create the account through the Supabase Auth dashboard
-- (or the app's sign-up flow), then run:
--
--   update profiles set role = 'ta' where email = 'you@university.edu';
--
-- ============================================================================

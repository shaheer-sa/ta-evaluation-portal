-- ============================================================================
-- TAMS database schema
--
-- Matches the live production database as of 2026-10-23
-- (rebuilt from the live catalog + migrations 01-06 in supabase/migrations).
--
-- Use this ONLY to set up a brand new, empty Supabase project.
-- NEVER run it against the live database: it is not idempotent and will fail
-- or create duplicates. Changes to the live database go in small files under
-- supabase/migrations/ and are run one at a time in the SQL Editor.
--
-- After running it on a new project, create your TA account in the Supabase
-- Auth dashboard and then run:
--   update public.profiles set role = 'ta' where email = 'you@university.edu';
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid not null,
  email text not null,
  full_name text not null,
  must_change_password boolean not null default true,
  role text not null,
  roll_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_pkey PRIMARY KEY (id),
  constraint profiles_email_key UNIQUE (email),
  constraint profiles_roll_number_key UNIQUE (roll_number),
  constraint profiles_role_check CHECK ((role = ANY (ARRAY['ta'::text, 'student'::text]))),
  constraint student_must_have_roll_number CHECK (((role = 'ta'::text) OR (roll_number IS NOT NULL))),
  constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

create table public.terms (
  id uuid not null default gen_random_uuid(),
  is_active boolean not null default false,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terms_pkey PRIMARY KEY (id),
  constraint terms_name_key UNIQUE (name)
);

create table public.courses (
  id uuid not null default gen_random_uuid(),
  code text not null,
  enable_assignments boolean not null default true,
  enable_cp boolean not null default true,
  enable_quizzes boolean not null default true,
  enable_reeval boolean not null default true,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_pkey PRIMARY KEY (id),
  constraint courses_code_key UNIQUE (code)
);

create table public.sections (
  id uuid not null default gen_random_uuid(),
  name text not null,
  term_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sections_pkey PRIMARY KEY (id),
  constraint sections_term_id_name_key UNIQUE (term_id, name),
  constraint sections_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE
);

create table public.section_courses (
  id uuid not null default gen_random_uuid(),
  best_of_assignments integer,
  best_of_quizzes integer,
  quiz_total_weight numeric,
  assignment_total_weight numeric,
  course_id uuid not null,
  section_id uuid not null,
  created_at timestamptz not null default now(),
  constraint section_courses_pkey PRIMARY KEY (id),
  constraint section_courses_section_id_course_id_key UNIQUE (section_id, course_id),
  constraint section_courses_best_of_assignments_check CHECK ((best_of_assignments IS NULL) OR (best_of_assignments > 0)),
  constraint section_courses_best_of_quizzes_check CHECK ((best_of_quizzes IS NULL) OR (best_of_quizzes > 0)),
  constraint section_courses_quiz_total_weight_check CHECK ((quiz_total_weight IS NULL) OR ((quiz_total_weight > 0) AND (quiz_total_weight <= 100))),
  constraint section_courses_assignment_total_weight_check CHECK ((assignment_total_weight IS NULL) OR ((assignment_total_weight > 0) AND (assignment_total_weight <= 100))),
  constraint section_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT,
  constraint section_courses_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

create table public.enrollments (
  id uuid not null default gen_random_uuid(),
  course_id uuid not null,
  section_id uuid not null,
  status text not null default 'active'::text,
  student_id uuid not null,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  constraint enrollments_pkey PRIMARY KEY (id),
  constraint enrollments_student_id_section_id_course_id_key UNIQUE (student_id, section_id, course_id),
  constraint enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'withdrawn'::text]))),
  constraint enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  constraint enrollments_section_id_fkey FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  constraint enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE
);

create table public.assessments (
  id uuid not null default gen_random_uuid(),
  max_marks numeric not null,
  section_course_id uuid not null,
  title text not null,
  type text not null,
  weight numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assessments_pkey PRIMARY KEY (id),
  constraint assessments_max_marks_check CHECK ((max_marks > (0)::numeric)),
  constraint assessments_type_check CHECK ((type = ANY (ARRAY['assignment'::text, 'quiz'::text, 'mid'::text, 'final'::text, 'project'::text, 'cp'::text]))),
  constraint assessments_weight_check CHECK (((weight >= (0)::numeric) AND (weight <= (100)::numeric))),
  constraint assessments_section_course_id_fkey FOREIGN KEY (section_course_id) REFERENCES section_courses(id) ON DELETE CASCADE
);

create table public.marks (
  id uuid not null default gen_random_uuid(),
  assessment_id uuid not null,
  enrollment_id uuid not null,
  score numeric default 0,
  sheet_synced_score numeric,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marks_pkey PRIMARY KEY (id),
  constraint marks_enrollment_id_assessment_id_key UNIQUE (enrollment_id, assessment_id),
  constraint marks_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
  constraint marks_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  constraint marks_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id)
);

create table public.queries (
  id uuid not null default gen_random_uuid(),
  assessment_id uuid,
  description text not null,
  enrollment_id uuid not null,
  priority text not null default 'medium'::text,
  status text not null default 'pending'::text,
  student_id uuid not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint queries_pkey PRIMARY KEY (id),
  constraint queries_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
  constraint queries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_review'::text, 'resolved'::text, 'rejected'::text]))),
  constraint queries_assessment_id_fkey FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE SET NULL,
  constraint queries_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE,
  constraint queries_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE
);

create table public.replies (
  id uuid not null default gen_random_uuid(),
  message text not null,
  query_id uuid not null,
  sender_id uuid not null,
  created_at timestamptz not null default now(),
  constraint replies_pkey PRIMARY KEY (id),
  constraint replies_query_id_fkey FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE,
  constraint replies_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id)
);

create table public.notifications (
  id uuid not null default gen_random_uuid(),
  body text,
  is_read boolean not null default false,
  recipient_id uuid not null,
  related_id uuid,
  title text not null,
  type text not null,
  created_at timestamptz not null default now(),
  constraint notifications_pkey PRIMARY KEY (id),
  constraint notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE
);

create table public.activity_logs (
  id uuid not null default gen_random_uuid(),
  action text not null,
  actor_id uuid,
  entity_id uuid,
  entity_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint activity_logs_pkey PRIMARY KEY (id),
  constraint activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id)
);

create table public.announcements (
  id uuid not null default gen_random_uuid(),
  body text not null,
  created_by uuid not null,
  section_course_id uuid not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_pkey PRIMARY KEY (id),
  constraint announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id),
  constraint announcements_section_course_id_fkey FOREIGN KEY (section_course_id) REFERENCES section_courses(id) ON DELETE CASCADE
);

create table public.query_attachments (
  id uuid not null default gen_random_uuid(),
  file_name text,
  file_url text not null,
  query_id uuid not null,
  created_at timestamptz not null default now(),
  constraint query_attachments_pkey PRIMARY KEY (id),
  constraint query_attachments_query_id_fkey FOREIGN KEY (query_id) REFERENCES queries(id) ON DELETE CASCADE
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX idx_activity_logs_actor ON public.activity_logs USING btree (actor_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_announcements_section_course ON public.announcements USING btree (section_course_id);
CREATE UNIQUE INDEX assessments_unique_title_per_sc ON public.assessments USING btree (section_course_id, lower(TRIM(BOTH FROM title)));
CREATE INDEX idx_assessments_section_course ON public.assessments USING btree (section_course_id);
CREATE INDEX enrollments_status_idx ON public.enrollments USING btree (section_id, course_id, status);
CREATE INDEX idx_enrollments_course ON public.enrollments USING btree (course_id);
CREATE INDEX idx_enrollments_section ON public.enrollments USING btree (section_id);
CREATE INDEX idx_enrollments_student ON public.enrollments USING btree (student_id);
CREATE INDEX idx_marks_assessment ON public.marks USING btree (assessment_id);
CREATE INDEX idx_marks_enrollment ON public.marks USING btree (enrollment_id);
CREATE INDEX idx_notifications_recipient_unread ON public.notifications USING btree (recipient_id, is_read);
CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX idx_queries_enrollment ON public.queries USING btree (enrollment_id);
CREATE INDEX idx_queries_status ON public.queries USING btree (status);
CREATE INDEX idx_queries_student ON public.queries USING btree (student_id);
CREATE INDEX idx_replies_query ON public.replies USING btree (query_id);
CREATE INDEX idx_section_courses_course ON public.section_courses USING btree (course_id);
CREATE INDEX idx_section_courses_section ON public.section_courses USING btree (section_id);
CREATE INDEX idx_sections_term ON public.sections USING btree (term_id);
CREATE UNIQUE INDEX one_active_term_only ON public.terms USING btree (is_active) WHERE is_active;

-- ── Functions ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.activate_term(p_term_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_ta() then
    raise exception 'Only a TA can activate a term';
  end if;

  update public.terms set is_active = false where is_active = true;
  update public.terms set is_active = true where id = p_term_id;

  insert into public.activity_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'term.activate', 'terms', p_term_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.active_student_count(p_section_ids uuid[])
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(distinct student_id) from enrollments
  where section_id = any(p_section_ids) and status = 'active';
$function$;

create or replace function public.analytics_for_section_course(p_sc_id uuid)
returns json
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_students json;
  v_assessments json;
  v_marks json;
begin
  if not is_ta() then
    raise exception 'forbidden';
  end if;

  with sc as (
    select id, section_id, course_id, best_of_quizzes, best_of_assignments
    from section_courses
    where id = p_sc_id
  ),
  enr as (
    select e.id, e.student_id, p.full_name, p.roll_number
    from enrollments e
    join profiles p on p.id = e.student_id
    where e.section_id = (select section_id from sc)
      and e.course_id  = (select course_id  from sc)
      and e.status = 'active'
  ),
  ranked as (
    select
      m.enrollment_id,
      m.score,
      a.max_marks,
      a.weight,
      a.type,
      row_number() over (
        partition by m.enrollment_id, a.type
        order by (m.score / nullif(a.max_marks, 0)) desc nulls last, a.created_at, a.id
      ) as rn
    from marks m
    join assessments a on a.id = m.assessment_id
    where a.section_course_id = p_sc_id
      and m.score is not null
      and m.enrollment_id in (select id from enr)
  ),
  counted as (
    select r.*
    from ranked r
    where case r.type
            when 'quiz' then (select best_of_quizzes from sc)
            when 'assignment' then (select best_of_assignments from sc)
          end is null
       or r.rn <= case r.type
            when 'quiz' then (select best_of_quizzes from sc)
            when 'assignment' then (select best_of_assignments from sc)
          end
  ),
  scored as (
    select
      enr.id,
      enr.full_name,
      enr.roll_number,
      (select count(*) from ranked r where r.enrollment_id = enr.id) as graded,
      coalesce((select sum((c.score / nullif(c.max_marks, 0)) * c.weight)
                from counted c where c.enrollment_id = enr.id), 0) as obtained,
      coalesce((select sum(c.weight)
                from counted c where c.enrollment_id = enr.id), 0) as total_weight
    from enr
  )
  select coalesce(json_agg(row_to_json(x) order by x.percentage desc nulls last), '[]'::json)
  into v_students
  from (
    select
      full_name,
      roll_number,
      graded,
      round(obtained::numeric, 2) as obtained,
      round(total_weight::numeric, 2) as total_weight,
      case when total_weight > 0
        then round((obtained / total_weight * 100)::numeric, 1)
        else null
      end as percentage
    from scored
  ) x;

  select coalesce(json_agg(row_to_json(y)), '[]'::json)
  into v_assessments
  from (
    select
      a.id,
      a.title,
      a.type,
      a.created_at,
      a.max_marks as total_marks,
      a.weight,
      round(avg(m.score)::numeric, 2) as avg,
      max(m.score) as high,
      min(m.score) as low,
      count(m.score) as graded
    from assessments a
    left join marks m on m.assessment_id = a.id
    left join enrollments e on e.id = m.enrollment_id and e.status = 'active'
    where a.section_course_id = p_sc_id
      and (m.id is null or e.id is not null)
    group by a.id, a.title, a.type, a.created_at, a.max_marks, a.weight
  ) y;

  with sc as (
    select id, section_id, course_id, best_of_quizzes, best_of_assignments
    from section_courses where id = p_sc_id
  ),
  ranked as (
    select
      m.id as mark_id,
      a.type,
      row_number() over (
        partition by m.enrollment_id, a.type
        order by (m.score / nullif(a.max_marks, 0)) desc nulls last, a.created_at, a.id
      ) as rn
    from marks m
    join assessments a on a.id = m.assessment_id
    where a.section_course_id = p_sc_id
      and m.score is not null
  )
  select coalesce(json_agg(row_to_json(z)), '[]'::json)
  into v_marks
  from (
    select
      p.roll_number,
      m.assessment_id,
      m.score,
      case
        when m.score is null then false
        when (case a.type when 'quiz' then s.best_of_quizzes
                          when 'assignment' then s.best_of_assignments end) is null then true
        else r.rn <= (case a.type when 'quiz' then s.best_of_quizzes
                                  when 'assignment' then s.best_of_assignments end)
      end as counted
    from marks m
    join enrollments e on e.id = m.enrollment_id
    join profiles p on p.id = e.student_id
    join assessments a on a.id = m.assessment_id
    join sc s on true
    left join ranked r on r.mark_id = m.id
    where a.section_course_id = p_sc_id
      and e.status = 'active'
      and e.section_id = s.section_id
      and e.course_id = s.course_id
  ) z;

  return json_build_object(
    'students', v_students,
    'assessments', v_assessments,
    'marks', v_marks
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.class_averages_for_section_course(p_sc_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(json_object_agg(a.id, json_build_object(
           'avg',  a.avg_score,
           'high', a.high_score,
           'low',  a.low_score
         )), '{}'::json)
  from (
    select a.id,
           round(avg(m.score)::numeric, 2) as avg_score,
           max(m.score) as high_score,
           min(m.score) as low_score
    from assessments a
    left join marks m on m.assessment_id = a.id
    left join enrollments e on e.id = m.enrollment_id and e.status = 'active'
    where a.section_course_id = p_sc_id
      and (m.id is null or e.id is not null)
    group by a.id
  ) a;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ select role::text from profiles where id = auth.uid() $function$;

CREATE OR REPLACE FUNCTION public.enforce_assessment_type_enabled()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_course public.courses%rowtype;
begin
  select c.* into v_course
  from public.section_courses sc
  join public.courses c on c.id = sc.course_id
  where sc.id = new.section_course_id;

  if new.type = 'cp' and not v_course.enable_cp then
    raise exception 'Class participation is disabled for %', v_course.name;
  elsif new.type = 'assignment' and not v_course.enable_assignments then
    raise exception 'Assignments are disabled for %', v_course.name;
  elsif new.type = 'quiz' and not v_course.enable_quizzes then
    raise exception 'Quizzes are disabled for %', v_course.name;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_marks_validity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_max numeric;
  v_match boolean;
begin
  select max_marks into v_max from public.assessments where id = new.assessment_id;

  if new.score < 0 or new.score > v_max then
    raise exception 'Score % is out of bounds for this assessment (0 - %)', new.score, v_max;
  end if;

  select exists (
    select 1
    from public.enrollments e
    join public.section_courses sc
      on sc.section_id = e.section_id and sc.course_id = e.course_id
    join public.assessments a on a.section_course_id = sc.id
    where e.id = new.enrollment_id and a.id = new.assessment_id
  ) into v_match;

  if not v_match then
    raise exception 'Enrollment % does not belong to the course/section of assessment %', new.enrollment_id, new.assessment_id;
  end if;

  return new;
end;
$function$;

create or replace function public.enrollments_before_insert_check()
returns trigger
language plpgsql
as $function$
declare
  v_new_term_id uuid;
  v_conflicting_section text;
begin
  if not exists (
    select 1 from public.profiles where id = new.student_id and role = 'student'
  ) then
    raise exception 'Only student accounts can be enrolled';
  end if;

  if not exists (
    select 1 from public.section_courses
    where section_id = new.section_id and course_id = new.course_id
  ) then
    raise exception 'This course is not linked to that section';
  end if;

  select term_id into v_new_term_id from public.sections where id = new.section_id;

  select s.name into v_conflicting_section
  from public.enrollments e
  join public.sections s on s.id = e.section_id
  where e.student_id = new.student_id
    and s.term_id = v_new_term_id
    and e.section_id <> new.section_id
    and e.status = 'active'
  limit 1;

  if v_conflicting_section is not null then
    raise exception 'Already enrolled in section % this term. Withdraw them there first.', v_conflicting_section;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_class_average(p_assessment_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_authorized boolean;
  v_avg numeric;
begin
  select exists (
    select 1
    from public.assessments a
    join public.section_courses sc on sc.id = a.section_course_id
    join public.enrollments e on e.section_id = sc.section_id and e.course_id = sc.course_id
    where a.id = p_assessment_id and e.student_id = auth.uid()
  ) into v_authorized;

  if not (v_authorized or public.is_ta()) then
    raise exception 'Not authorized to view this assessment';
  end if;

  select round(avg(score), 2) into v_avg
  from public.marks
  where assessment_id = p_assessment_id;

  return v_avg;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_deletion_impact(p_type text, p_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_students bigint := 0;
  v_marks bigint := 0;
begin
  -- SECURITY DEFINER bypasses RLS, so gate it explicitly.
  if not is_ta() then
    raise exception 'forbidden';
  end if;

  if p_type = 'section' then
    select count(*) into v_students from enrollments where section_id = p_id;
    select count(*) into v_marks from marks
      where enrollment_id in (select id from enrollments where section_id = p_id);
  elsif p_type = 'course' then
    select count(*) into v_students from enrollments where course_id = p_id;
    select count(*) into v_marks from marks
      where enrollment_id in (select id from enrollments where course_id = p_id);
  elsif p_type = 'section_course' then
    select count(*) into v_students from enrollments
      where (section_id, course_id) =
        (select section_id, course_id from section_courses where id = p_id limit 1);
    select count(*) into v_marks from marks
      where enrollment_id in (
        select id from enrollments where (section_id, course_id) =
          (select section_id, course_id from section_courses where id = p_id limit 1)
      );
  else
    raise exception 'invalid type';
  end if;

  return json_build_object('students', v_students, 'marks', v_marks);
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_ta_contacts()
 RETURNS TABLE(id uuid, full_name text, email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, full_name, email from profiles where role = 'ta';
$function$;

CREATE OR REPLACE FUNCTION public.get_tas()
 RETURNS TABLE(id uuid, full_name text, role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, full_name, role::text from profiles where role = 'ta';
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, role, roll_number, full_name, email)
  values (
    new.id,
    'student',
    new.raw_user_meta_data->>'roll_number',
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_active_student()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.enrollments e
    join public.sections s on s.id = e.section_id
    join public.terms t on t.id = s.term_id
    where e.student_id = auth.uid() and t.is_active = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_ta()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'ta'
  );
$function$;

CREATE OR REPLACE FUNCTION public.marks_within_max()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare v_max numeric;
begin
  if new.score is null then return new; end if;
  select max_marks into v_max from assessments where id = new.assessment_id;
  if v_max is not null and new.score > v_max then
    raise exception 'score % exceeds max_marks % for assessment %',
      new.score, v_max, new.assessment_id;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- category total weights (migration 07)

create or replace function public.recalc_category_weights(p_sc_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_sc section_courses%rowtype;
  v_course courses%rowtype;
  v_type text;
  v_total numeric;
  v_best int;
  v_count int;
  v_weight numeric;
begin
  if p_sc_id is null then
    return;
  end if;

  select * into v_sc from section_courses where id = p_sc_id;
  if not found then
    return;
  end if;

  select * into v_course from courses where id = v_sc.course_id;

  foreach v_type in array array['quiz', 'assignment'] loop
    if v_type = 'quiz' then
      v_total := v_sc.quiz_total_weight;
      v_best := v_sc.best_of_quizzes;
    else
      v_total := v_sc.assignment_total_weight;
      v_best := v_sc.best_of_assignments;
    end if;

    continue when v_total is null;
    -- type turned off for this course: leave those rows alone
    continue when v_type = 'quiz' and not coalesce(v_course.enable_quizzes, true);
    continue when v_type = 'assignment' and not coalesce(v_course.enable_assignments, true);

    select count(*) into v_count
    from assessments
    where section_course_id = p_sc_id and type = v_type;

    continue when v_count = 0;

    v_weight := round(v_total / (case when v_best is not null and v_best < v_count
                                      then v_best else v_count end), 4);

    update assessments
    set weight = v_weight
    where section_course_id = p_sc_id
      and type = v_type
      and weight is distinct from v_weight;
  end loop;
end;
$function$;

create or replace function public.assessments_recalc_weights()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    perform recalc_category_weights(new.section_course_id);
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    if tg_op = 'DELETE' or old.section_course_id is distinct from new.section_course_id then
      perform recalc_category_weights(old.section_course_id);
    end if;
  end if;
  return null;
end;
$function$;

create or replace function public.section_courses_recalc_weights()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform recalc_category_weights(new.id);
  return null;
end;
$function$;

-- ── Function access: only logged in users (migration 03) ────────────────────

revoke execute on all functions in schema public from public, anon;

grant execute on function
  public.is_ta(),
  public.is_active_student(),
  public.current_user_role(),
  public.get_tas(),
  public.get_ta_contacts(),
  public.active_student_count(uuid[]),
  public.activate_term(uuid),
  public.analytics_for_section_course(uuid),
  public.class_averages_for_section_course(uuid),
  public.get_deletion_impact(text, uuid),
  public.get_class_average(uuid)
to authenticated, service_role;

alter default privileges in schema public revoke execute on functions from public, anon;

-- trigger-only helpers, nobody calls these directly
revoke all on function public.recalc_category_weights(uuid) from public, anon, authenticated;
revoke all on function public.assessments_recalc_weights() from public, anon, authenticated;
revoke all on function public.section_courses_recalc_weights() from public, anon, authenticated;

-- ── Triggers ────────────────────────────────────────────────────────────────
-- (marks has two max-score checks: marks_max_check and trg_marks_validity. Both exist in production.)

CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assessments_type_check BEFORE INSERT OR UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION enforce_assessment_type_enabled();
CREATE TRIGGER trg_assessments_updated_at BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_enrollments_before_insert BEFORE INSERT ON public.enrollments FOR EACH ROW EXECUTE FUNCTION enrollments_before_insert_check();
CREATE TRIGGER marks_max_check BEFORE INSERT OR UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION marks_within_max();
CREATE TRIGGER trg_marks_updated_at BEFORE UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_marks_validity BEFORE INSERT OR UPDATE ON public.marks FOR EACH ROW EXECUTE FUNCTION enforce_marks_validity();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_queries_updated_at BEFORE UPDATE ON public.queries FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sections_updated_at BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assessments_recalc_weights
  after insert or delete or update of type, section_course_id, weight on public.assessments
  for each row execute function public.assessments_recalc_weights();
CREATE TRIGGER trg_section_courses_recalc_weights
  after update of quiz_total_weight, assignment_total_weight, best_of_quizzes, best_of_assignments
  on public.section_courses
  for each row execute function public.section_courses_recalc_weights();
CREATE TRIGGER trg_terms_updated_at BEFORE UPDATE ON public.terms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_handle_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.terms enable row level security;
alter table public.courses enable row level security;
alter table public.sections enable row level security;
alter table public.section_courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.assessments enable row level security;
alter table public.marks enable row level security;
alter table public.queries enable row level security;
alter table public.replies enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.announcements enable row level security;
alter table public.query_attachments enable row level security;

-- activity_logs
create policy activity_logs_ta_all on public.activity_logs as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- announcements
create policy announcements_student_select_own on public.announcements as permissive for select to public
  using ((is_active_student() AND (section_course_id IN ( SELECT sc.id
   FROM (section_courses sc
     JOIN enrollments e ON (((e.section_id = sc.section_id) AND (e.course_id = sc.course_id))))
  WHERE (e.student_id = auth.uid())))));
create policy announcements_ta_all on public.announcements as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- assessments
create policy assessments_student_select_own on public.assessments as permissive for select to public
  using ((is_active_student() AND (section_course_id IN ( SELECT sc.id
   FROM (section_courses sc
     JOIN enrollments e ON (((e.section_id = sc.section_id) AND (e.course_id = sc.course_id))))
  WHERE (e.student_id = auth.uid())))));
create policy assessments_ta_all on public.assessments as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- courses
create policy courses_student_select_own on public.courses as permissive for select to public
  using ((is_active_student() AND (id IN ( SELECT enrollments.course_id
   FROM enrollments
  WHERE (enrollments.student_id = auth.uid())))));
create policy courses_ta_all on public.courses as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- enrollments
create policy enrollments_student_select_own on public.enrollments as permissive for select to public
  using (((student_id = auth.uid()) AND is_active_student()));
create policy enrollments_ta_all on public.enrollments as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- marks
create policy marks_student_select_own on public.marks as permissive for select to public
  using ((is_active_student() AND (enrollment_id IN ( SELECT enrollments.id
   FROM enrollments
  WHERE (enrollments.student_id = auth.uid())))));
create policy marks_ta_all on public.marks as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- notifications
create policy notifications_insert on public.notifications as permissive for insert to authenticated
  with check ((is_ta() OR (recipient_id IN ( SELECT get_tas.id
   FROM get_tas() get_tas(id, full_name, role)))));
create policy notifications_student_select_own on public.notifications as permissive for select to public
  using ((recipient_id = auth.uid()));
create policy notifications_student_update_own on public.notifications as permissive for update to public
  using ((recipient_id = auth.uid()))
  with check ((recipient_id = auth.uid()));
create policy notifications_ta_all on public.notifications as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- profiles
create policy profiles_student_select_self on public.profiles as permissive for select to public
  using ((id = auth.uid()));
create policy profiles_ta_all on public.profiles as permissive for all to public
  using (is_ta())
  with check (is_ta());
create policy profiles_update_own on public.profiles as permissive for update to public
  using ((id = auth.uid()))
  with check (((id = auth.uid()) AND (role = current_user_role()) AND (email = ( SELECT profiles_1.email
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid()))) AND (NOT (roll_number IS DISTINCT FROM ( SELECT profiles_1.roll_number
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))) AND (must_change_password = ( SELECT profiles_1.must_change_password
   FROM profiles profiles_1
  WHERE (profiles_1.id = auth.uid())))));

-- queries
create policy queries_student_insert_own on public.queries as permissive for insert to public
  with check (((student_id = auth.uid()) AND is_active_student() AND (enrollment_id IN ( SELECT enrollments.id
   FROM enrollments
  WHERE (enrollments.student_id = auth.uid())))));
create policy queries_student_select_own on public.queries as permissive for select to public
  using (((student_id = auth.uid()) AND is_active_student()));
create policy queries_ta_all on public.queries as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- query_attachments
create policy query_attachments_student_insert_own on public.query_attachments as permissive for insert to public
  with check ((query_id IN ( SELECT queries.id
   FROM queries
  WHERE ((queries.student_id = auth.uid()) AND is_active_student()))));
create policy query_attachments_student_select_own on public.query_attachments as permissive for select to public
  using ((query_id IN ( SELECT queries.id
   FROM queries
  WHERE (queries.student_id = auth.uid()))));
create policy query_attachments_ta_all on public.query_attachments as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- replies
create policy replies_student_insert_own on public.replies as permissive for insert to public
  with check (((sender_id = auth.uid()) AND is_active_student() AND (query_id IN ( SELECT queries.id
   FROM queries
  WHERE (queries.student_id = auth.uid())))));
create policy replies_student_select_own on public.replies as permissive for select to public
  using ((query_id IN ( SELECT queries.id
   FROM queries
  WHERE (queries.student_id = auth.uid()))));
create policy replies_ta_all on public.replies as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- section_courses
create policy section_courses_student_select_own on public.section_courses as permissive for select to public
  using ((is_active_student() AND (section_id IN ( SELECT enrollments.section_id
   FROM enrollments
  WHERE (enrollments.student_id = auth.uid())))));
create policy section_courses_ta_all on public.section_courses as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- sections
create policy sections_student_select_own on public.sections as permissive for select to public
  using ((is_active_student() AND (id IN ( SELECT enrollments.section_id
   FROM enrollments
  WHERE (enrollments.student_id = auth.uid())))));
create policy sections_ta_all on public.sections as permissive for all to public
  using (is_ta())
  with check (is_ta());

-- terms
create policy terms_student_select_own on public.terms as permissive for select to public
  using ((is_active_student() AND (id IN ( SELECT s.term_id
   FROM (sections s
     JOIN enrollments e ON ((e.section_id = s.id)))
  WHERE (e.student_id = auth.uid())))));
create policy terms_ta_all on public.terms as permissive for all to public
  using (is_ta())
  with check (is_ta());

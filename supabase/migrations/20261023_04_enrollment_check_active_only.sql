-- withdrawn enrollments shouldnt block enrolling a student in another section
-- also gives a readable error instead of raw ids
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

-- total weight per category (quizzes / assignments), set per class.
-- when a total is set, every quiz (or assignment) of that class gets
--   weight = total / (best_of if set and smaller than the count, else the count)
-- and this is recalculated automatically whenever assessments or the
-- settings change. null total = weights stay manual like before.

alter table public.section_courses
  add column if not exists quiz_total_weight numeric
    check (quiz_total_weight is null or (quiz_total_weight > 0 and quiz_total_weight <= 100)),
  add column if not exists assignment_total_weight numeric
    check (assignment_total_weight is null or (assignment_total_weight > 0 and assignment_total_weight <= 100));

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

revoke all on function public.recalc_category_weights(uuid) from public, anon, authenticated;

-- assessment added, removed, moved, retyped or its weight edited by hand
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

drop trigger if exists trg_assessments_recalc_weights on public.assessments;
create trigger trg_assessments_recalc_weights
  after insert or delete or update of type, section_course_id, weight on public.assessments
  for each row execute function public.assessments_recalc_weights();

-- totals or best-of changed for a class
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

drop trigger if exists trg_section_courses_recalc_weights on public.section_courses;
create trigger trg_section_courses_recalc_weights
  after update of quiz_total_weight, assignment_total_weight, best_of_quizzes, best_of_assignments
  on public.section_courses
  for each row execute function public.section_courses_recalc_weights();

revoke all on function public.assessments_recalc_weights() from public, anon, authenticated;
revoke all on function public.section_courses_recalc_weights() from public, anon, authenticated;

-- best of n: per class, only a student's n best quizzes / assignments count
-- (null = all count, same as before)
alter table public.section_courses
  add column if not exists best_of_quizzes integer
    check (best_of_quizzes is null or best_of_quizzes > 0),
  add column if not exists best_of_assignments integer
    check (best_of_assignments is null or best_of_assignments > 0);

-- analytics now only counts each student's best n per type, and tells the
-- page which marks were counted
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

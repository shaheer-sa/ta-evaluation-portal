-- analytics: a cleared mark (score null) shouldnt count toward total weight
-- only change from the live version is the "filter (where m.score is not null)" on total_weight
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
    select id, section_id, course_id
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
  asmt as (
    select id, max_marks, weight
    from assessments
    where section_course_id = p_sc_id
  ),
  scored as (
    select
      enr.id,
      enr.full_name,
      enr.roll_number,
      count(m.score) as graded,
      coalesce(sum((m.score / nullif(asmt.max_marks, 0)) * asmt.weight), 0) as obtained,
      coalesce(sum(asmt.weight) filter (where m.score is not null), 0) as total_weight
    from enr
    left join marks m on m.enrollment_id = enr.id
    left join asmt on asmt.id = m.assessment_id
    group by enr.id, enr.full_name, enr.roll_number
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

  select coalesce(json_agg(row_to_json(z)), '[]'::json)
  into v_marks
  from (
    select p.roll_number, m.assessment_id, m.score
    from marks m
    join enrollments e on e.id = m.enrollment_id
    join profiles p on p.id = e.student_id
    join assessments a on a.id = m.assessment_id
    join section_courses s on s.id = p_sc_id
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

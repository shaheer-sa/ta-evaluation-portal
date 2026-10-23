-- only logged in users can call our database functions
-- (before this, signed out visitors could call things like get_ta_contacts directly)
begin;

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

-- new functions made later shouldnt be open to signed out visitors either
alter default privileges in schema public revoke execute on functions from public, anon;

commit;

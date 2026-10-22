-- users can always read their own profile, even outside the active term
begin;
drop policy if exists profiles_student_select_self on public.profiles;
create policy profiles_student_select_self on public.profiles
  for select to public
  using (id = auth.uid());
commit;

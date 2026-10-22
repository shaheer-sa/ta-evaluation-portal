-- new users always start as student, role from signup data is ignored
-- to add a TA later: create the user, then run
-- update public.profiles set role = 'ta' where email = '...';
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

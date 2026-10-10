-- Do not block signup while the institution's branch catalog is empty or a
-- student's self-reported branch code needs administrator verification.
alter table public.profiles
  add column requested_branch_code text;

create or replace function public.provision_student_registration_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := new.raw_user_meta_data;
  branch uuid;
  requested_semester smallint;
  requested_name text;
  requested_usn text;
  requested_branch_code text;
begin
  if coalesce((metadata->>'tusva_signup_request')::boolean, false) is not true then
    return new;
  end if;

  requested_name := trim(coalesce(metadata->>'full_name', ''));
  requested_usn := upper(trim(coalesce(metadata->>'usn', '')));
  requested_branch_code := upper(trim(coalesce(metadata->>'branch_code', '')));

  if new.email is null or requested_name !~ '^.{2,160}$' then
    raise exception 'A valid name and email are required for student registration.';
  end if;
  if requested_usn !~ '^[A-Z0-9/-]{3,32}$' then
    raise exception 'A valid USN is required for student registration.';
  end if;
  if coalesce(metadata->>'semester', '') !~ '^[1-9][0-2]?$' then
    raise exception 'A valid semester is required for student registration.';
  end if;
  requested_semester := (metadata->>'semester')::smallint;
  if requested_semester > 12 then
    raise exception 'Semester must be between 1 and 12.';
  end if;
  if trim(coalesce(metadata->>'academic_year', '')) !~ '^.{4,20}$' then
    raise exception 'A valid academic year is required for student registration.';
  end if;

  select b.id into branch
  from public.branches as b
  where upper(b.code) = requested_branch_code and b.active
  limit 1;

  insert into public.profiles(
    id, role, full_name, institutional_email, usn, branch_id,
    requested_branch_code, semester, academic_year, active
  ) values (
    new.id, 'student', requested_name, lower(new.email), requested_usn,
    branch, nullif(requested_branch_code, ''), requested_semester,
    trim(metadata->>'academic_year'), false
  );
  return new;
end;
$$;

revoke all on function public.provision_student_registration_request() from public, anon, authenticated;

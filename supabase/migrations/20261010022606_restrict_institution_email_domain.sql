-- Limit every Supabase Auth account, including dashboard and admin-created
-- accounts, to the single institution's email domain.
create or replace function public.enforce_institution_email_domain()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.email is null or right(lower(trim(new.email)), length('@jainuniversity.ac.in')) <> '@jainuniversity.ac.in' then
    raise exception 'Use your @jainuniversity.ac.in email address.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_institution_email_domain() from public, anon, authenticated;

create trigger enforce_institution_email_domain
  before insert or update of email on auth.users
  for each row execute function public.enforce_institution_email_domain();

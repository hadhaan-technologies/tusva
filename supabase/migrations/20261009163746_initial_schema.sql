create extension if not exists pgcrypto;

create type public.app_role as enum ('student', 'faculty', 'admin');
create type public.question_type as enum ('single_select', 'multiple_select', 'true_false', 'numerical', 'short_answer');
create type public.attempt_status as enum ('in_progress', 'submitted', 'terminated', 'graded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  full_name text not null,
  institutional_email text not null unique,
  usn text unique,
  branch_id uuid,
  semester smallint check (semester between 1 and 12),
  academic_year text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'student' and usn is not null) or role <> 'student')
);
create table public.branches (id uuid primary key default gen_random_uuid(), name text not null unique, code text not null unique, active boolean not null default true);
alter table public.profiles add constraint profiles_branch_fk foreign key (branch_id) references public.branches(id);
create table public.courses (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, branch_id uuid references public.branches(id), semester smallint check(semester between 1 and 12), academic_year text, active boolean not null default true);
create table public.student_courses (student_id uuid not null references public.profiles(id) on delete cascade, course_id uuid not null references public.courses(id), enrolled_at timestamptz not null default now(), primary key(student_id,course_id));

create table public.question_banks (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), title text not null,
  subject text, created_at timestamptz not null default now()
);
create table public.media_assets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id),
  storage_path text not null unique, mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check(byte_size between 1 and 10485760), width integer, height integer,
  alt_text text, created_at timestamptz not null default now()
);
create table public.questions (
  id uuid primary key default gen_random_uuid(), bank_id uuid not null references public.question_banks(id) on delete cascade,
  author_id uuid not null references public.profiles(id), type public.question_type not null,
  statement jsonb not null, explanation jsonb, marks numeric(8,2) not null check(marks >= 0),
  negative_marks numeric(8,2) not null default 0 check(negative_marks >= 0),
  difficulty text not null check(difficulty in ('easy','medium','hard')), subject text, topics text[] not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(jsonb_typeof(statement->'blocks') = 'array')
);
create table public.question_options (
  id uuid primary key default gen_random_uuid(), question_id uuid not null references public.questions(id) on delete cascade,
  content jsonb not null, position smallint not null check(position >= 0), unique(question_id, position),
  check(jsonb_typeof(content->'blocks') = 'array')
);
-- Keys are deliberately isolated from student-readable question/option rows.
create table public.question_answer_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct_option_ids uuid[] not null default '{}', numerical_answer numeric, numerical_tolerance numeric,
  accepted_text_answers text[] not null default '{}', updated_at timestamptz not null default now()
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(), created_by uuid not null references public.profiles(id),
  title text not null, description text, status text not null default 'draft' check(status in ('draft','scheduled','published','closed')),
  starts_at timestamptz, ends_at timestamptz, duration_seconds integer not null check(duration_seconds > 0),
  max_marks numeric(8,2) not null check(max_marks >= 0), max_attempts smallint not null default 1 check(max_attempts > 0), negative_marking boolean not null default false,
  results_released_at timestamptz,
  randomize_questions boolean not null default false, randomize_options boolean not null default false,
  result_visibility text not null default 'after_release' check(result_visibility in ('hidden','after_submission','after_release')),
  third_violation_action text not null default 'submit' check(third_violation_action in ('submit','terminate')),
  check(status <> 'published' or (starts_at is not null and ends_at is not null and ends_at > starts_at)),
  created_at timestamptz not null default now()
);
create table public.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id), position smallint not null check(position >= 0),
  primary key(quiz_id, question_id), unique(quiz_id, position)
);
create table public.quiz_assignments (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id) on delete cascade,
  branch_id uuid references public.branches(id), course_id uuid references public.courses(id),
  semester smallint check(semester between 1 and 12), academic_year text
);
create table public.attempts (
  id uuid primary key default gen_random_uuid(), quiz_id uuid not null references public.quizzes(id),
  student_id uuid not null references public.profiles(id), attempt_no smallint not null check(attempt_no > 0),
  student_snapshot jsonb not null default '{}'::jsonb, question_order uuid[] not null default '{}', option_orders jsonb not null default '{}'::jsonb,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(), deadline_at timestamptz not null,
  submitted_at timestamptz, marks_obtained numeric(8,2), grading_status text not null default 'pending' check(grading_status in ('pending','in_review','graded')),
  violation_count integer not null default 0 check(violation_count >= 0), review_status text not null default 'clear' check(review_status in ('clear','flagged','reviewed')),
  unique(quiz_id, student_id, attempt_no)
);
create table public.attempt_answers (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id), answer jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(), primary key(attempt_id, question_id)
);
create table public.attempt_events (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade,
  event_type text not null, occurred_at timestamptz not null default now(), details jsonb not null default '{}'::jsonb
);
create table public.evaluation_notes (
  id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.attempts(id) on delete cascade,
  faculty_id uuid not null references public.profiles(id), note text not null, created_at timestamptz not null default now()
);
create table public.question_evaluations (
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id), faculty_id uuid not null references public.profiles(id),
  marks_awarded numeric(8,2) not null check(marks_awarded >= 0), note text not null default '', created_at timestamptz not null default now(),
  primary key(attempt_id,question_id)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null,
  target_type text not null, target_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create function public.audit_record_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid; record_type text; operation text;
begin
  operation:=lower(tg_op);
  record_type:=tg_table_name;
  target:=case when tg_op='DELETE' then old.id else new.id end;
  insert into public.audit_logs(actor_id,action,target_type,target_id,details)
    values((select auth.uid()),record_type||'_'||operation,record_type,target,jsonb_build_object('operation',operation));
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.audit_record_change() from public,anon,authenticated;
create trigger audit_question_changes after insert or update or delete on public.questions for each row execute function public.audit_record_change();
create trigger audit_quiz_changes after insert or update or delete on public.quizzes for each row execute function public.audit_record_change();
create trigger audit_branch_changes after insert or update or delete on public.branches for each row execute function public.audit_record_change();
create trigger audit_course_changes after insert or update or delete on public.courses for each row execute function public.audit_record_change();

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
create function private.current_role() returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.active = true
$$;
revoke all on function private.current_role() from public, anon;
grant execute on function private.current_role() to authenticated, service_role;
create function public.is_faculty_or_admin() returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce((select private.current_role()) in ('faculty','admin'), false)
$$;
create function public.student_is_assigned_to_quiz(p_quiz_id uuid) returns boolean language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.quiz_assignments qa join public.profiles p on p.id=(select auth.uid())
    where qa.quiz_id=p_quiz_id and p.role='student' and p.active
    and (qa.branch_id is null or qa.branch_id=p.branch_id)
    and (qa.semester is null or qa.semester=p.semester)
    and (qa.academic_year is null or qa.academic_year=p.academic_year)
    and (qa.course_id is null or exists(select 1 from public.student_courses sc where sc.student_id=p.id and sc.course_id=qa.course_id)))
$$;
create function public.content_assets_belong_to_owner(p_content jsonb,p_owner uuid) returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_typeof(p_content->'blocks')='array',false) and not exists(
    select 1 from jsonb_array_elements(p_content->'blocks') as blocks(value)
    where blocks.value->>'type'='image' and not case
      when coalesce(blocks.value->>'assetId','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then exists(select 1 from public.media_assets m where m.id=(blocks.value->>'assetId')::uuid and m.owner_id=p_owner)
      else false end
  )
$$;
revoke all on function public.content_assets_belong_to_owner(jsonb,uuid) from public,anon;
grant execute on function public.content_assets_belong_to_owner(jsonb,uuid) to authenticated,service_role;
alter table public.questions add constraint questions_assets_owned check(
  public.content_assets_belong_to_owner(statement,author_id) and (explanation is null or public.content_assets_belong_to_owner(explanation,author_id))
);
create function public.validate_question_option_assets() returns trigger language plpgsql security invoker set search_path = '' as $$
declare owner uuid;
begin
  select author_id into owner from public.questions where id=new.question_id;
  if owner is null or not public.content_assets_belong_to_owner(new.content,owner) then raise exception 'option image assets must belong to the question author'; end if;
  return new;
end $$;
create trigger question_option_asset_owner before insert or update on public.question_options for each row execute function public.validate_question_option_assets();
revoke all on function public.validate_question_option_assets() from public,anon,authenticated;

create function public.validate_question_bank_owner() returns trigger language plpgsql security invoker set search_path = '' as $$
declare bank_owner uuid;
begin
  select owner_id into bank_owner from public.question_banks where id=new.bank_id;
  if bank_owner is null or (bank_owner<>new.author_id and (select private.current_role())<>'admin') then raise exception 'question bank is not owned by this author'; end if;
  return new;
end $$;
create trigger question_bank_owner before insert or update of bank_id,author_id on public.questions for each row execute function public.validate_question_bank_owner();
revoke all on function public.validate_question_bank_owner() from public,anon,authenticated;

create function public.prevent_used_question_changes() returns trigger language plpgsql security invoker set search_path = '' as $$
declare qid uuid;
begin
  qid:=case when tg_op='DELETE' then old.id else new.id end;
  if exists(select 1 from public.quiz_questions qq join public.quizzes z on z.id=qq.quiz_id where qq.question_id=qid and z.status<>'draft')
    or exists(select 1 from public.quiz_questions qq join public.attempts a on a.quiz_id=qq.quiz_id where qq.question_id=qid) then
    raise exception 'questions used by published examinations or attempts are locked';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger protect_question_changes before update or delete on public.questions for each row execute function public.prevent_used_question_changes();
create function public.prevent_used_answer_changes() returns trigger language plpgsql security invoker set search_path = '' as $$
declare qid uuid;
begin
  qid:=case when tg_op='DELETE' then old.question_id else new.question_id end;
  if exists(select 1 from public.quiz_questions qq join public.quizzes z on z.id=qq.quiz_id where qq.question_id=qid and z.status<>'draft')
    or exists(select 1 from public.quiz_questions qq join public.attempts a on a.quiz_id=qq.quiz_id where qq.question_id=qid) then
    raise exception 'question content and keys are locked after publication';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger protect_option_changes before insert or update or delete on public.question_options for each row execute function public.prevent_used_answer_changes();
create trigger protect_answer_key_changes before insert or update or delete on public.question_answer_keys for each row execute function public.prevent_used_answer_changes();
revoke all on function public.prevent_used_question_changes() from public,anon,authenticated;
revoke all on function public.prevent_used_answer_changes() from public,anon,authenticated;

create function public.save_question(
  p_question_id uuid,p_bank_id uuid,p_type public.question_type,p_statement jsonb,p_explanation jsonb,
  p_marks numeric,p_negative_marks numeric,p_difficulty text,p_subject text,p_topics text[],p_options jsonb,
  p_correct_option_ids uuid[],p_numerical_answer numeric,p_numerical_tolerance numeric
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_id uuid; option_row record; option_ids uuid[]; correct_ids uuid[];
begin
  if (select auth.uid()) is null or private.current_role() not in ('faculty','admin') then raise exception 'faculty access required'; end if;
  if p_marks is null or p_marks<=0 or coalesce(p_negative_marks,0)<0 then raise exception 'invalid marks'; end if;
  if p_difficulty not in ('easy','medium','hard') or jsonb_typeof(p_options)<>'array' then raise exception 'invalid question data'; end if;
  if p_type in ('single_select','multiple_select','true_false') and jsonb_array_length(p_options)<2 then raise exception 'MCQ needs at least two options'; end if;
  if p_type='true_false' and (jsonb_array_length(p_options)<>2 or cardinality(coalesce(p_correct_option_ids,'{}'::uuid[]))<>1) then raise exception 'true/false questions need two options and one correct option'; end if;
  if p_type='single_select' and cardinality(coalesce(p_correct_option_ids,'{}'::uuid[]))<>1 then raise exception 'single select needs one correct option'; end if;
  if p_type in ('multiple_select','true_false') and cardinality(coalesce(p_correct_option_ids,'{}'::uuid[]))<1 then raise exception 'select the correct option'; end if;
  if p_type='numerical' and (p_numerical_answer is null or coalesce(p_numerical_tolerance,0)<0) then raise exception 'numerical answer and valid tolerance required'; end if;
  if p_type not in ('single_select','multiple_select','true_false') and cardinality(coalesce(p_correct_option_ids,'{}'::uuid[]))>0 then raise exception 'option keys do not apply to this type'; end if;
  if p_type<>'numerical' and p_numerical_answer is not null then raise exception 'numerical key does not apply to this type'; end if;
  if p_question_id is null then
    insert into public.questions(bank_id,author_id,type,statement,explanation,marks,negative_marks,difficulty,subject,topics)
      values(p_bank_id,(select auth.uid()),p_type,p_statement,p_explanation,p_marks,coalesce(p_negative_marks,0),p_difficulty,nullif(p_subject,''),coalesce(p_topics,'{}')) returning id into saved_id;
  else
    update public.questions set bank_id=p_bank_id,type=p_type,statement=p_statement,explanation=p_explanation,marks=p_marks,negative_marks=coalesce(p_negative_marks,0),difficulty=p_difficulty,subject=nullif(p_subject,''),topics=coalesce(p_topics,'{}'),updated_at=now()
      where id=p_question_id returning id into saved_id;
    if saved_id is null then raise exception 'question not found or not authorized'; end if;
  end if;
  select coalesce(array_agg((items.value->>'id')::uuid),'{}'::uuid[]) into option_ids from jsonb_array_elements(p_options) as items(value);
  if cardinality(option_ids)<>(select count(distinct item_id) from unnest(option_ids) as items(item_id)) then raise exception 'duplicate option id'; end if;
  correct_ids:=coalesce(p_correct_option_ids,'{}'::uuid[]);
  if cardinality(correct_ids)<>(select count(distinct item_id) from unnest(correct_ids) as items(item_id)) then raise exception 'duplicate correct option'; end if;
  if exists(select 1 from unnest(correct_ids) as items(item_id) where not item_id=any(option_ids)) then raise exception 'correct option is not part of the question'; end if;
  delete from public.question_options where question_id=saved_id;
  for option_row in select item,ordinality from jsonb_array_elements(p_options) with ordinality as t(item,ordinality) loop
    insert into public.question_options(id,question_id,content,position) values((option_row.item->>'id')::uuid,saved_id,option_row.item->'content',(option_row.ordinality-1)::smallint);
  end loop;
  if cardinality(correct_ids)>0 or p_numerical_answer is not null then
    insert into public.question_answer_keys(question_id,correct_option_ids,numerical_answer,numerical_tolerance)
      values(saved_id,correct_ids,p_numerical_answer,case when p_type='numerical' then coalesce(p_numerical_tolerance,0) else null end)
      on conflict(question_id) do update set correct_option_ids=excluded.correct_option_ids,numerical_answer=excluded.numerical_answer,numerical_tolerance=excluded.numerical_tolerance,updated_at=now();
  else delete from public.question_answer_keys where question_id=saved_id; end if;
  return saved_id;
end $$;
revoke all on function public.save_question(uuid,uuid,public.question_type,jsonb,jsonb,numeric,numeric,text,text,text[],jsonb,uuid[],numeric,numeric) from public,anon;
grant execute on function public.save_question(uuid,uuid,public.question_type,jsonb,jsonb,numeric,numeric,text,text,text[],jsonb,uuid[],numeric,numeric) to authenticated;

create function public.save_quiz(
  p_quiz_id uuid,p_title text,p_description text,p_status text,p_starts_at timestamptz,p_ends_at timestamptz,p_duration_seconds integer,
  p_max_attempts smallint,p_negative_marking boolean,p_max_marks numeric,p_randomize_questions boolean,p_randomize_options boolean,
  p_result_visibility text,p_results_released_at timestamptz,p_third_violation_action text,p_question_ids uuid[],
  p_branch_id uuid,p_course_id uuid,p_semester smallint,p_academic_year text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved_quiz_id uuid; expected_marks numeric; distinct_count integer; existing_status text;
begin
  if (select auth.uid()) is null or (select private.current_role()) not in ('faculty','admin') then raise exception 'faculty access required'; end if;
  if nullif(trim(p_title),'') is null or p_status not in ('draft','published') or p_duration_seconds<1 or p_max_attempts<1 or p_max_marks<0 then raise exception 'invalid examination configuration'; end if;
  if p_status='published' and (p_starts_at is null or p_ends_at is null or p_ends_at<=p_starts_at) then raise exception 'published examinations need a valid schedule'; end if;
  if p_result_visibility not in ('hidden','after_submission','after_release') or p_third_violation_action not in ('submit','terminate') then raise exception 'invalid examination settings'; end if;
  if cardinality(coalesce(p_question_ids,'{}'::uuid[]))=0 then raise exception 'select at least one question'; end if;
  select count(distinct item_id)::integer into distinct_count from unnest(p_question_ids) as items(item_id);
  if distinct_count<>cardinality(p_question_ids) then raise exception 'duplicate examination question'; end if;
  select coalesce(sum(marks),0) into expected_marks from public.questions where id=any(p_question_ids) and (author_id=(select auth.uid()) or (select private.current_role())='admin');
  if expected_marks=0 or expected_marks<>p_max_marks or (select count(*) from public.questions where id=any(p_question_ids) and (author_id=(select auth.uid()) or (select private.current_role())='admin'))<>cardinality(p_question_ids) then raise exception 'question marks or access do not match'; end if;
  if p_quiz_id is null then
    insert into public.quizzes(created_by,title,description,status,starts_at,ends_at,duration_seconds,max_marks,max_attempts,negative_marking,randomize_questions,randomize_options,result_visibility,results_released_at,third_violation_action)
      values((select auth.uid()),trim(p_title),nullif(trim(coalesce(p_description,'')),''),'draft',p_starts_at,p_ends_at,p_duration_seconds,p_max_attempts,p_negative_marking,p_randomize_questions,p_randomize_options,p_result_visibility,p_results_released_at,p_third_violation_action)
      returning id into saved_quiz_id;
  else
    select status into existing_status from public.quizzes where id=p_quiz_id for update;
    if not found or existing_status<>'draft' or exists(select 1 from public.attempts a where a.quiz_id=p_quiz_id) then raise exception 'only draft examinations without attempts can be edited'; end if;
    update public.quizzes set title=trim(p_title),description=nullif(trim(coalesce(p_description,'')),''),status='draft',starts_at=p_starts_at,ends_at=p_ends_at,duration_seconds=p_duration_seconds,max_attempts=p_max_attempts,negative_marking=p_negative_marking,max_marks=p_max_marks,randomize_questions=p_randomize_questions,randomize_options=p_randomize_options,result_visibility=p_result_visibility,results_released_at=p_results_released_at,third_violation_action=p_third_violation_action where id=p_quiz_id returning id into saved_quiz_id;
    delete from public.quiz_questions where quiz_id=saved_quiz_id;
    delete from public.quiz_assignments where quiz_id=saved_quiz_id;
  end if;
  insert into public.quiz_questions(quiz_id,question_id,position) select saved_quiz_id,item_id,(ord-1)::smallint from unnest(p_question_ids) with ordinality as items(item_id,ord);
  insert into public.quiz_assignments(quiz_id,branch_id,course_id,semester,academic_year) values(saved_quiz_id,p_branch_id,p_course_id,p_semester,nullif(trim(coalesce(p_academic_year,'')),''));
  update public.quizzes set status=p_status where id=saved_quiz_id;
  return saved_quiz_id;
end $$;
revoke all on function public.save_quiz(uuid,text,text,text,timestamptz,timestamptz,integer,smallint,boolean,numeric,boolean,boolean,text,timestamptz,text,uuid[],uuid,uuid,smallint,text) from public,anon;
grant execute on function public.save_quiz(uuid,text,text,text,timestamptz,timestamptz,integer,smallint,boolean,numeric,boolean,boolean,text,timestamptz,text,uuid[],uuid,uuid,smallint,text) to authenticated;

create function public.prevent_live_quiz_child_changes() returns trigger language plpgsql security invoker set search_path = '' as $$
declare z_id uuid;
begin
  z_id:=case when tg_op='DELETE' then old.quiz_id else new.quiz_id end;
  if exists(select 1 from public.quizzes z where z.id=z_id and z.status<>'draft') or exists(select 1 from public.attempts a where a.quiz_id=z_id) then raise exception 'published examination assignments and question list are locked'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger protect_quiz_questions before insert or update or delete on public.quiz_questions for each row execute function public.prevent_live_quiz_child_changes();
create trigger protect_quiz_assignments before insert or update or delete on public.quiz_assignments for each row execute function public.prevent_live_quiz_child_changes();
create function public.prevent_attempted_quiz_settings() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.attempts a where a.quiz_id=old.id) and
    (new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.duration_seconds is distinct from old.duration_seconds or new.max_marks is distinct from old.max_marks or new.max_attempts is distinct from old.max_attempts or new.negative_marking is distinct from old.negative_marking or new.randomize_questions is distinct from old.randomize_questions or new.randomize_options is distinct from old.randomize_options or new.third_violation_action is distinct from old.third_violation_action) then
    raise exception 'examination timing and grading settings are locked after an attempt starts';
  end if;
  return new;
end $$;
create trigger protect_attempted_quiz_settings before update on public.quizzes for each row execute function public.prevent_attempted_quiz_settings();
revoke all on function public.prevent_live_quiz_child_changes() from public,anon,authenticated;
revoke all on function public.prevent_attempted_quiz_settings() from public,anon,authenticated;

create index profiles_branch_id_idx on public.profiles(branch_id);
create index courses_branch_id_idx on public.courses(branch_id);
create index student_courses_course_id_idx on public.student_courses(course_id);
create index question_banks_owner_id_idx on public.question_banks(owner_id);
create index media_assets_owner_id_idx on public.media_assets(owner_id);
create index quizzes_created_by_idx on public.quizzes(created_by);
create index questions_author_id_idx on public.questions(author_id);
create index questions_bank_id_idx on public.questions(bank_id);
create index quiz_questions_question_id_idx on public.quiz_questions(question_id);
create index quiz_assignments_quiz_id_idx on public.quiz_assignments(quiz_id);
create index quiz_assignments_branch_id_idx on public.quiz_assignments(branch_id);
create index quiz_assignments_course_id_idx on public.quiz_assignments(course_id);
create index attempts_student_started_idx on public.attempts(student_id,started_at desc);
create index attempt_answers_question_id_idx on public.attempt_answers(question_id);
create index attempt_events_attempt_id_idx on public.attempt_events(attempt_id);
create index evaluation_notes_faculty_id_idx on public.evaluation_notes(faculty_id);
create index evaluation_notes_attempt_id_idx on public.evaluation_notes(attempt_id);
create index question_evaluations_question_id_idx on public.question_evaluations(question_id);
create index question_evaluations_faculty_id_idx on public.question_evaluations(faculty_id);
create index audit_logs_actor_created_idx on public.audit_logs(actor_id,created_at desc);
create index audit_logs_target_idx on public.audit_logs(target_type,target_id);

do $$ declare t text; begin
  foreach t in array array['profiles','branches','courses','student_courses','question_banks','media_assets','questions','question_options','question_answer_keys','quizzes','quiz_questions','quiz_assignments','attempts','attempt_answers','attempt_events','evaluation_notes','question_evaluations','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy "profile select self or admin" on public.profiles for select to authenticated using(id = (select auth.uid()) or (select private.current_role()) = 'admin');
create policy "profile self update safe fields" on public.profiles for update to authenticated using(id = (select auth.uid())) with check(id = (select auth.uid()) and role = (select private.current_role()));
create policy "admin manage profiles" on public.profiles for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "authenticated read branches" on public.branches for select to authenticated using(active or (select private.current_role()) = 'admin');
create policy "admin manage branches" on public.branches for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "authenticated read courses" on public.courses for select to authenticated using(active or (select private.current_role()) = 'admin');
create policy "admin manage courses" on public.courses for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "student reads own enrollments" on public.student_courses for select to authenticated using(student_id=(select auth.uid()));
create policy "admin manages enrollments" on public.student_courses for all to authenticated using((select private.current_role())='admin') with check((select private.current_role())='admin');
create policy "faculty manage own banks" on public.question_banks for all to authenticated using(owner_id = (select auth.uid()) and public.is_faculty_or_admin()) with check(owner_id = (select auth.uid()) and public.is_faculty_or_admin());
create policy "admin manages all banks" on public.question_banks for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "owner or admin access media metadata" on public.media_assets for select to authenticated using(owner_id = (select auth.uid()) or (select private.current_role()) = 'admin');
create policy "faculty update own media" on public.media_assets for update to authenticated using(owner_id = (select auth.uid()) and public.is_faculty_or_admin()) with check(owner_id = (select auth.uid()) and public.is_faculty_or_admin());
create policy "author manage questions" on public.questions for all to authenticated using(author_id = (select auth.uid()) and public.is_faculty_or_admin()) with check(author_id = (select auth.uid()) and public.is_faculty_or_admin());
create policy "admin manages all questions" on public.questions for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "author manage options" on public.question_options for all to authenticated using(exists(select 1 from public.questions q where q.id=question_id and q.author_id=(select auth.uid())) and public.is_faculty_or_admin()) with check(exists(select 1 from public.questions q where q.id=question_id and q.author_id=(select auth.uid())) and public.is_faculty_or_admin());
create policy "admin manages all options" on public.question_options for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "faculty manage answer keys" on public.question_answer_keys for all to authenticated using(exists(select 1 from public.questions q where q.id=question_id and q.author_id=(select auth.uid())) and public.is_faculty_or_admin()) with check(exists(select 1 from public.questions q where q.id=question_id and q.author_id=(select auth.uid())) and public.is_faculty_or_admin());
create policy "admin manages all answer keys" on public.question_answer_keys for all to authenticated using((select private.current_role())='admin') with check((select private.current_role())='admin');
create policy "faculty manage quizzes" on public.quizzes for all to authenticated using(created_by=(select auth.uid()) and public.is_faculty_or_admin()) with check(created_by=(select auth.uid()) and public.is_faculty_or_admin());
create policy "admin manages all quizzes" on public.quizzes for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "student reads assigned published quizzes" on public.quizzes for select to authenticated using(status='published' and public.student_is_assigned_to_quiz(id));
create policy "faculty manage quiz questions" on public.quiz_questions for all to authenticated using(exists(select 1 from public.quizzes z where z.id=quiz_id and z.created_by=(select auth.uid())) and public.is_faculty_or_admin()) with check(exists(select 1 from public.quizzes z where z.id=quiz_id and z.created_by=(select auth.uid())) and public.is_faculty_or_admin());
create policy "admin manages quiz questions" on public.quiz_questions for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "student reads assigned quiz question links" on public.quiz_questions for select to authenticated using(exists(select 1 from public.quizzes z where z.id=quiz_id and z.status='published' and z.starts_at <= now() and z.ends_at >= now()) and public.student_is_assigned_to_quiz(quiz_id));
create policy "faculty manage assignments" on public.quiz_assignments for all to authenticated using(exists(select 1 from public.quizzes z where z.id=quiz_id and z.created_by=(select auth.uid())) and public.is_faculty_or_admin()) with check(exists(select 1 from public.quizzes z where z.id=quiz_id and z.created_by=(select auth.uid())) and public.is_faculty_or_admin());
create policy "admin manages assignments" on public.quiz_assignments for all to authenticated using((select private.current_role()) = 'admin') with check((select private.current_role()) = 'admin');
create policy "student reads own quiz assignments" on public.quiz_assignments for select to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and (branch_id is null or branch_id=p.branch_id) and (semester is null or semester=p.semester) and (academic_year is null or academic_year=p.academic_year) and (course_id is null or exists(select 1 from public.student_courses sc where sc.student_id=p.id and sc.course_id=quiz_assignments.course_id))));
-- Students receive only the exam endpoint's filtered payload; direct reads would
-- expose explanation content and make the question schema easier to enumerate.
create policy "faculty or admin read attempts" on public.attempts for select to authenticated using(exists(select 1 from public.quizzes z where z.id=quiz_id and z.created_by=(select auth.uid()) and (select public.is_faculty_or_admin())) or (select private.current_role())='admin');
-- Students read attempt state/results through the authorized attempt server function so
-- RLS cannot expose marks before the configured result release time.
create policy "quiz faculty reads answers" on public.attempt_answers for select to authenticated using(exists(select 1 from public.attempts a join public.quizzes z on z.id=a.quiz_id where a.id=attempt_id and z.created_by=(select auth.uid()) and public.is_faculty_or_admin()));
create policy "quiz faculty reads events" on public.attempt_events for select to authenticated using(exists(select 1 from public.attempts a join public.quizzes z on z.id=a.quiz_id where a.id=attempt_id and z.created_by=(select auth.uid()) and public.is_faculty_or_admin()));
create policy "faculty reviews notes" on public.evaluation_notes for select to authenticated using((select public.is_faculty_or_admin()) and (faculty_id=(select auth.uid()) or exists(select 1 from public.attempts a join public.quizzes z on z.id=a.quiz_id where a.id=attempt_id and z.created_by=(select auth.uid()))) or (select private.current_role())='admin');
create policy "faculty records notes" on public.evaluation_notes for insert to authenticated with check(faculty_id=(select auth.uid()) and public.is_faculty_or_admin());
create policy "faculty reads question evaluations" on public.question_evaluations for select to authenticated using((select public.is_faculty_or_admin()) and (faculty_id=(select auth.uid()) or exists(select 1 from public.attempts a join public.quizzes z on z.id=a.quiz_id where a.id=attempt_id and z.created_by=(select auth.uid()))) or (select private.current_role())='admin');
create policy "faculty records question evaluations" on public.question_evaluations for insert to authenticated with check(faculty_id=(select auth.uid()) and exists(select 1 from public.attempts a join public.quizzes z on z.id=a.quiz_id where a.id=attempt_id and z.created_by=(select auth.uid()) and public.is_faculty_or_admin()));
create policy "faculty updates question evaluations" on public.question_evaluations for update to authenticated using(faculty_id=(select auth.uid()) and public.is_faculty_or_admin() and exists(select 1 from public.attempts a join public.quizzes z on z.id=a.quiz_id where a.id=attempt_id and z.created_by=(select auth.uid()))) with check(faculty_id=(select auth.uid()) and public.is_faculty_or_admin() and exists(select 1 from public.attempts a join public.quizzes z on z.id=a.quiz_id where a.id=attempt_id and z.created_by=(select auth.uid())));
create policy "admin reads audit logs" on public.audit_logs for select to authenticated using((select private.current_role())='admin');

create function public.record_attempt_violation(p_attempt_id uuid, p_event_type text) returns integer
language plpgsql security invoker set search_path = '' as $$
declare new_count integer;
begin
  if p_event_type not in ('visibility_hidden','fullscreen_exit') then raise exception 'invalid violation type'; end if;
  update public.attempts set violation_count=violation_count+1, review_status='flagged'
    where id=p_attempt_id and status='in_progress' returning violation_count into new_count;
  if new_count is null then raise exception 'attempt is not active'; end if;
  insert into public.attempt_events(attempt_id,event_type) values(p_attempt_id,p_event_type);
  return new_count;
end $$;
revoke all on function public.record_attempt_violation(uuid,text) from public, anon, authenticated;
grant execute on function public.record_attempt_violation(uuid,text) to service_role;

-- Client roles receive read access where RLS governs it. Writes that affect exam state,
-- answer keys, grading, role assignment, or audit records are reserved for trusted server code.
grant select on public.profiles, public.branches, public.courses, public.student_courses, public.question_banks, public.media_assets,
  public.questions, public.question_options, public.quizzes, public.quiz_questions, public.quiz_assignments,
  public.attempts, public.attempt_answers, public.attempt_events, public.evaluation_notes, public.question_evaluations, public.audit_logs to authenticated;
grant insert, update, delete on public.branches, public.courses to authenticated;
grant insert, delete on public.student_courses to authenticated;
grant select, insert, update, delete on public.question_banks, public.media_assets, public.questions, public.question_options,
  public.question_answer_keys, public.quizzes, public.quiz_questions, public.quiz_assignments to authenticated;
revoke insert, update, delete on public.media_assets from authenticated;
revoke insert, update, delete on public.question_evaluations from authenticated;
grant update (full_name) on public.profiles to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('question-media','question-media',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "faculty upload question media" on storage.objects for insert to authenticated
with check(bucket_id='question-media' and (storage.foldername(name))[1]=(select auth.uid())::text and public.is_faculty_or_admin());
create policy "faculty read own media" on storage.objects for select to authenticated
using(bucket_id='question-media' and (storage.foldername(name))[1]=(select auth.uid())::text and public.is_faculty_or_admin());

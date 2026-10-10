create or replace function public.save_quiz(
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
      values((select auth.uid()),trim(p_title),nullif(trim(coalesce(p_description,'')),''),'draft',p_starts_at,p_ends_at,p_duration_seconds,p_max_marks,p_max_attempts,p_negative_marking,p_randomize_questions,p_randomize_options,p_result_visibility,p_results_released_at,p_third_violation_action)
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

create or replace function public.publish_quiz(p_quiz_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare quiz_row public.quizzes%rowtype; question_total integer; accessible_question_total integer; expected_marks numeric;
begin
  if (select auth.uid()) is null or (select private.current_role()) not in ('faculty','admin') then raise exception 'faculty access required'; end if;
  select * into quiz_row from public.quizzes where id=p_quiz_id and ((created_by=(select auth.uid()) and (select private.current_role())='faculty') or (select private.current_role())='admin') for update;
  if not found then raise exception 'examination not found or access denied'; end if;
  if quiz_row.status<>'draft' then raise exception 'only draft examinations can be published'; end if;
  if quiz_row.starts_at is null or quiz_row.ends_at is null or quiz_row.ends_at<=now() or quiz_row.ends_at<=quiz_row.starts_at then raise exception 'set a valid start time and an end time in the future before publishing'; end if;
  select count(*)::integer into question_total from public.quiz_questions where quiz_id=p_quiz_id;
  select count(*)::integer,coalesce(sum(q.marks),0) into accessible_question_total,expected_marks from public.quiz_questions qq join public.questions q on q.id=qq.question_id where qq.quiz_id=p_quiz_id and (q.author_id=(select auth.uid()) or (select private.current_role())='admin');
  if question_total=0 or question_total<>accessible_question_total or expected_marks<>quiz_row.max_marks then raise exception 'the examination questions are missing, inaccessible, or their marks have changed'; end if;
  update public.quizzes set status='published' where id=p_quiz_id;
end $$;
revoke all on function public.publish_quiz(uuid) from public,anon;
grant execute on function public.publish_quiz(uuid) to authenticated;

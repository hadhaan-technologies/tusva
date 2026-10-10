import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

describe('initial schema and row-level security', () => {
  it('applies and keeps answer keys, marks, and roles out of student access', async () => {
    const db = new PGlite()
    try {
      await db.exec(`
        create role anon; create role authenticated; create role service_role;
        create schema auth;
        create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
        create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
        grant usage on schema auth to authenticated;
        grant execute on function auth.uid() to authenticated;
        create schema storage;
        create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
        alter table storage.objects enable row level security;
        create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
      `)
      const migration = readFileSync(new URL('../migrations/20261009163746_initial_schema.sql', import.meta.url), 'utf8').replace('create extension if not exists pgcrypto;', '')
      await db.exec(migration)
      await db.exec(readFileSync(new URL('../migrations/20261010020324_student_registration_requests.sql', import.meta.url), 'utf8'))
      await db.exec(readFileSync(new URL('../migrations/20261010024448_allow_pending_signup_without_branch.sql', import.meta.url), 'utf8'))
      await db.exec(readFileSync(new URL('../migrations/20261010032633_add_otp_activation_state.sql', import.meta.url), 'utf8'))
      await db.exec(`
        insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002'), ('00000000-0000-4000-8000-000000000003');
        insert into public.profiles(id,role,full_name,institutional_email,usn) values
          ('00000000-0000-4000-8000-000000000001','student','Student A','a@example.edu','USN001'),
          ('00000000-0000-4000-8000-000000000002','student','Student B','b@example.edu','USN002'),
          ('00000000-0000-4000-8000-000000000003','faculty','Faculty','f@example.edu',null);
        insert into public.question_banks(id,owner_id,title) values ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Physics');
        insert into public.questions(id,bank_id,author_id,type,statement,marks,difficulty) values
          ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','single_select','{"blocks":[{"type":"text","text":"Q"}]}',2,'easy');
        insert into public.question_options(id,question_id,content,position) values
          ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"blocks":[{"type":"text","text":"A"}]}',0);
        insert into public.question_answer_keys(question_id,correct_option_ids) values ('20000000-0000-4000-8000-000000000001',array['30000000-0000-4000-8000-000000000001'::uuid]);
        insert into public.quizzes(id,created_by,title,status,starts_at,ends_at,duration_seconds,max_marks) values
          ('40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003','Exam','draft',now()-interval '1 minute',now()+interval '1 hour',3600,2);
        insert into public.quiz_questions(quiz_id,question_id,position) values ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',0);
        insert into public.quiz_assignments(quiz_id) values ('40000000-0000-4000-8000-000000000001');
        update public.quizzes set status='published' where id='40000000-0000-4000-8000-000000000001';
        insert into public.attempts(id,quiz_id,student_id,attempt_no,deadline_at,marks_obtained,status) values
          ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',1,now()+interval '1 hour',2,'graded');
        insert into storage.objects(bucket_id,name) values ('question-media','00000000-0000-4000-8000-000000000001/image.png');
        grant usage on schema storage to authenticated;
        grant select,insert on storage.objects to authenticated;
      `)
      await db.query(`insert into public.attempt_answers(attempt_id,question_id,answer) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"optionIds":[]}')`)
      await db.query(`insert into public.attempt_answers(attempt_id,question_id,answer) values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','{"optionIds":["30000000-0000-4000-8000-000000000001"]}') on conflict(attempt_id,question_id) do update set answer=excluded.answer,saved_at=now()`)
      const autosaved = await db.query('select answer from public.attempt_answers where attempt_id=$1', ['50000000-0000-4000-8000-000000000001'])
      expect(autosaved.rows).toHaveLength(1)
      expect(autosaved.rows[0].answer.optionIds).toEqual(['30000000-0000-4000-8000-000000000001'])
      await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)`, [
        '00000000-0000-4000-8000-000000000004', 'student@jainuniversity.ac.in',
        JSON.stringify({tusva_signup_request:true,full_name:'Pending Student',usn:'4GH26CS004',branch_code:'CSE',semester:4,academic_year:'2026-27'}),
      ])
      const pending = await db.query('select active,branch_id,requested_branch_code,signup_activation_pending from public.profiles where id=$1', ['00000000-0000-4000-8000-000000000004'])
      expect(pending.rows).toEqual([{active:false,branch_id:null,requested_branch_code:'CSE',signup_activation_pending:true}])
      await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);`)
      const keys = await db.query('select * from public.question_answer_keys')
      const attempts = await db.query('select * from public.attempts')
      const profiles = await db.query('select * from public.profiles')
      const otherStudent = await db.query("select * from public.profiles where id='00000000-0000-4000-8000-000000000002'")
      const questions = await db.query('select * from public.questions')
      const role = await db.query('select private.current_role() as role')
      const assigned = await db.query("select public.student_is_assigned_to_quiz('40000000-0000-4000-8000-000000000001') as assigned")
      const availableQuiz = await db.query('select id,status,starts_at,ends_at,now() as now from public.quizzes')
      expect(keys.rows).toHaveLength(0)
      expect(attempts.rows).toHaveLength(0)
      expect(profiles.rows).toHaveLength(1)
      expect(otherStudent.rows).toHaveLength(0)
      expect(role.rows[0].role).toBe('student')
      expect(assigned.rows[0].assigned).toBe(true)
      expect(availableQuiz.rows).toHaveLength(1)
      expect(questions.rows).toHaveLength(0)
      await expect(db.query("update public.profiles set role='admin' where id='00000000-0000-4000-8000-000000000001'")).rejects.toThrow()
      await expect(db.query("insert into storage.objects(bucket_id,name) values ('question-media','00000000-0000-4000-8000-000000000001/new.png')")).rejects.toThrow(/row-level security policy/)
    } finally {
      await db.close()
    }
  })
})

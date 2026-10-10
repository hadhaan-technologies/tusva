import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { canSeeResult, computeDeadline, gradeObjective, isTerminal, validateAnswer } from '../_shared/exam-domain.ts'

const corsHeaders = { 'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const respond = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
type AnyRow = Record<string, any>
const shuffle = <T,>(values: T[]) => { const a = [...values]; for (let i=a.length-1;i>0;i--) { const j=crypto.getRandomValues(new Uint32Array(1))[0] % (i+1); [a[i],a[j]]=[a[j],a[i]] } return a }
const blocks = (content: any) => content && Array.isArray(content.blocks) ? content.blocks : []
function imageIds(content: any): string[] { return blocks(content).filter((b: any) => b.type === 'image' && typeof b.assetId === 'string').map((b: any) => b.assetId) }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed' }, 405)
  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')!
  const publishable = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!
  if (!token || !url || !publishable || !secret) return respond({ error: 'Unauthorized' }, 401)
  const caller = createClient(url, publishable, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user }, error: authError } = await caller.auth.getUser(token)
  if (authError || !user) return respond({ error: 'Unauthorized' }, 401)
  const admin = createClient(url, secret, { auth: { persistSession: false } })
  const { data: profile } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile?.active || profile.role !== 'student') return respond({ error: 'Active student access required' }, 403)
  const body = await request.json().catch(() => null)
  if (!body || typeof body.action !== 'string') return respond({ error: 'Invalid request' }, 400)
  const now = new Date()

  async function assigned(quizId: string) {
    const { data: quiz } = await admin.from('quizzes').select('*').eq('id',quizId).maybeSingle()
    if (!quiz || quiz.status !== 'published') return null
    const { data: matches } = await admin.from('quiz_assignments').select('*').eq('quiz_id',quizId)
    const {data:enrollments}=await admin.from('student_courses').select('course_id').eq('student_id',user.id)
    if (!(matches ?? []).some((a: AnyRow) => (!a.branch_id || a.branch_id === profile.branch_id) && (!a.course_id || (enrollments??[]).some((e:AnyRow)=>e.course_id===a.course_id)) && (!a.semester || a.semester === profile.semester) && (!a.academic_year || a.academic_year === profile.academic_year))) return null
    return quiz
  }
  async function currentAttempt(attemptId: string) {
    const { data } = await admin.from('attempts').select('*').eq('id',attemptId).eq('student_id',user.id).maybeSingle()
    return data
  }
  async function preparePayload(quiz: AnyRow, attempt: AnyRow) {
    const { data: links } = await admin.from('quiz_questions').select('question_id, position').eq('quiz_id',quiz.id)
    const orderedIds = attempt.question_order?.length ? attempt.question_order : (links ?? []).sort((a: AnyRow,b: AnyRow)=>a.position-b.position).map((x: AnyRow)=>x.question_id)
    const { data: questionRows } = orderedIds.length ? await admin.from('questions').select('id,type,statement,marks,negative_marks,difficulty,subject,topics,author_id').in('id',orderedIds) : { data: [] }
    const { data: savedAnswers } = await admin.from('attempt_answers').select('question_id,answer,saved_at').eq('attempt_id',attempt.id)
    const answerMap = new Map((savedAnswers ?? []).map((a: AnyRow)=>[a.question_id,a]))
    const questions = [] as AnyRow[]
    const referencedAssets = new Map<string,string>()
    for (const questionId of orderedIds) {
      const q = (questionRows ?? []).find((item: AnyRow)=>item.id===questionId)
      if (!q) continue
      const { data: optionRows } = await admin.from('question_options').select('id,content,position').eq('question_id',q.id).order('position')
      const optionOrder = attempt.option_orders?.[q.id] as string[] | undefined
      const options = optionOrder?.length ? optionOrder.map((id) => (optionRows ?? []).find((o: AnyRow)=>o.id===id)).filter(Boolean) : (optionRows ?? [])
      imageIds(q.statement).forEach((id)=>referencedAssets.set(id,q.author_id))
      options.forEach((o: AnyRow)=>imageIds(o.content).forEach((id)=>referencedAssets.set(id,q.author_id)))
      questions.push({ id:q.id,type:q.type,statement:q.statement,marks:q.marks,negativeMarks:q.negative_marks,options,answer:answerMap.get(q.id)?.answer ?? null })
    }
    const imageUrls: Record<string,string> = {}
    for (const [assetId,ownerId] of referencedAssets) {
      const { data: asset } = await admin.from('media_assets').select('owner_id,storage_path').eq('id',assetId).maybeSingle()
      if (!asset || asset.owner_id !== ownerId) throw new Error('A question image is unavailable or not authorized for this examination.')
      const remaining = Math.max(300, Math.ceil((new Date(attempt.deadline_at).getTime()-Date.now())/1000)+300)
      const { data: signed, error } = await admin.storage.from('question-media').createSignedUrl(asset.storage_path,Math.min(604800,remaining))
      if (error || !signed) throw new Error('An examination image could not be loaded securely.')
      imageUrls[assetId] = signed.signedUrl
    }
    return { attemptId:attempt.id,status:attempt.status,attemptNo:attempt.attempt_no,startedAt:attempt.started_at,deadlineAt:attempt.deadline_at,serverTime:new Date().toISOString(),violationCount:attempt.violation_count,questions,imageUrls }
  }
  async function finish(attempt: AnyRow, quiz: AnyRow, terminalStatus: 'submitted'|'terminated'='submitted') {
    if (isTerminal(attempt.status)) return attempt
    if (terminalStatus === 'terminated') {
      const { data } = await admin.from('attempts').update({status:'terminated',submitted_at:new Date().toISOString(),grading_status:'in_review',review_status:'flagged'}).eq('id',attempt.id).eq('status','in_progress').select('*').maybeSingle()
      return data ?? await currentAttempt(attempt.id) ?? attempt
    }
    const { data: links } = await admin.from('quiz_questions').select('question_id').eq('quiz_id',quiz.id)
    let score = 0
    let manualReview = false
    for (const link of links ?? []) {
      const { data: q } = await admin.from('questions').select('id,type,marks,negative_marks').eq('id',link.question_id).maybeSingle()
      const { data: answerRow } = await admin.from('attempt_answers').select('answer').eq('attempt_id',attempt.id).eq('question_id',link.question_id).maybeSingle()
      if (!q) continue
      if (q.type === 'short_answer') { manualReview = true; continue }
      if (!answerRow?.answer) continue
      const { data: key } = await admin.from('question_answer_keys').select('correct_option_ids,numerical_answer,numerical_tolerance').eq('question_id',q.id).maybeSingle()
      score += gradeObjective(q.type,Number(q.marks),Number(q.negative_marks),answerRow.answer,{correctOptionIds:key?.correct_option_ids,numericalAnswer:key?.numerical_answer===null?null:Number(key?.numerical_answer),numericalTolerance:key?.numerical_tolerance===null?null:Number(key?.numerical_tolerance)},!!quiz.negative_marking).score
    }
    score = Math.max(0,Math.min(Number(quiz.max_marks),score))
    const { data } = await admin.from('attempts').update({status:manualReview?'submitted':'graded',submitted_at:new Date().toISOString(),marks_obtained:score,grading_status:manualReview?'in_review':'graded'}).eq('id',attempt.id).eq('status','in_progress').select('*').maybeSingle()
    return data ?? await currentAttempt(attempt.id) ?? attempt
  }

  if (body.action === 'list') {
    const { data: attempts } = await admin.from('attempts').select('*').eq('student_id',user.id).order('started_at',{ascending:false})
    const quizIds = [...new Set((attempts ?? []).map((a:AnyRow)=>a.quiz_id))]
    const { data: quizzes } = quizIds.length ? await admin.from('quizzes').select('id,title,result_visibility,results_released_at,max_marks').in('id',quizIds) : { data: [] }
    return respond((attempts ?? []).map((a:AnyRow)=>{const quiz=(quizzes??[]).find((q:AnyRow)=>q.id===a.quiz_id);const released=quiz&&canSeeResult(quiz.result_visibility,quiz.results_released_at,a.status,now);return {id:a.id,quizId:a.quiz_id,quizName:quiz?.title,attemptNo:a.attempt_no,startedAt:a.started_at,submittedAt:a.submitted_at,status:a.status,gradingStatus:a.grading_status,marks:released?a.marks_obtained:null,maxMarks:released?quiz.max_marks:null,resultReleased:!!released,violationCount:a.violation_count,reviewStatus:a.review_status,student:a.student_snapshot}}))
  }

  if (body.action === 'resume') {
    if (typeof body.attemptId !== 'string') return respond({error:'Attempt ID required'},400)
    const existing=await currentAttempt(body.attemptId)
    if(!existing)return respond({error:'Attempt not found'},404)
    const {data:quiz}=await admin.from('quizzes').select('*').eq('id',existing.quiz_id).maybeSingle()
    if(!quiz)return respond({error:'Examination not found'},404)
    if(existing.status==='in_progress'&&new Date(existing.deadline_at)<=now){const done=await finish(existing,quiz);return respond({attemptId:done.id,status:done.status,deadlineAt:done.deadline_at,serverTime:now.toISOString()})}
    return respond(await preparePayload(quiz,existing))
  }

  if (body.action === 'start') {
    if (typeof body.quizId !== 'string') return respond({error:'Quiz ID required'},400)
    const quiz = await assigned(body.quizId)
    if (!quiz || !quiz.starts_at || !quiz.ends_at || new Date(quiz.starts_at)>now || new Date(quiz.ends_at)<=now) return respond({error:'This examination is not currently available to your account.'},403)
    const { data: oldAttempts } = await admin.from('attempts').select('*').eq('quiz_id',quiz.id).eq('student_id',user.id).order('attempt_no',{ascending:false})
    const active = oldAttempts?.find((a:AnyRow)=>a.status==='in_progress')
    if (active) {
      if (new Date(active.deadline_at)<=now) await finish(active,quiz)
      else return respond(await preparePayload(quiz,active))
    }
    if ((oldAttempts?.length ?? 0) >= quiz.max_attempts) return respond({error:'You have used all allowed attempts for this examination.'},403)
    const { data: links } = await admin.from('quiz_questions').select('question_id,position').eq('quiz_id',quiz.id).order('position')
    if (!links?.length) return respond({error:'This examination has no questions.'},409)
    const questionIds = quiz.randomize_questions ? shuffle(links.map((x:AnyRow)=>x.question_id)) : links.map((x:AnyRow)=>x.question_id)
    const optionOrders: Record<string,string[]> = {}
    for (const qid of questionIds) { const {data:opts}=await admin.from('question_options').select('id,position').eq('question_id',qid).order('position'); if (opts?.length) optionOrders[qid]=quiz.randomize_options?shuffle(opts.map((o:AnyRow)=>o.id)):opts.map((o:AnyRow)=>o.id) }
    const started = new Date()
    const deadline = computeDeadline(started,Number(quiz.duration_seconds),new Date(quiz.ends_at))
    const {data:branch}=profile.branch_id?await admin.from('branches').select('name,code').eq('id',profile.branch_id).maybeSingle():{data:null}
    const {data:attempt,error}=await admin.from('attempts').insert({quiz_id:quiz.id,student_id:user.id,attempt_no:(oldAttempts?.length??0)+1,student_snapshot:{full_name:profile.full_name,usn:profile.usn,branch_id:profile.branch_id,branch_name:branch?.name,branch_code:branch?.code,semester:profile.semester,academic_year:profile.academic_year},started_at:started.toISOString(),deadline_at:deadline.toISOString(),question_order:questionIds,option_orders:optionOrders}).select('*').single()
    if(error||!attempt)return respond({error:'Could not begin this examination. Please retry.'},409)
    await admin.from('audit_logs').insert({actor_id:user.id,action:'attempt_started',target_type:'attempt',target_id:attempt.id,details:{quiz_id:quiz.id}})
    return respond(await preparePayload(quiz,attempt),201)
  }

  if (typeof body.attemptId !== 'string') return respond({error:'Attempt ID required'},400)
  const attempt = await currentAttempt(body.attemptId)
  if (!attempt) return respond({error:'Attempt not found'},404)
  const { data: quiz } = await admin.from('quizzes').select('*').eq('id',attempt.quiz_id).maybeSingle()
  if (!quiz) return respond({error:'Examination not found'},404)
  if (body.action === 'state') {
    if (attempt.status === 'in_progress' && new Date(attempt.deadline_at)<=now) { const done=await finish(attempt,quiz); return respond({attemptId:done.id,status:done.status,serverTime:now.toISOString(),deadlineAt:done.deadline_at}) }
    const released=canSeeResult(quiz.result_visibility,quiz.results_released_at,attempt.status,now)
    return respond({attemptId:attempt.id,status:attempt.status,serverTime:now.toISOString(),deadlineAt:attempt.deadline_at,violationCount:attempt.violation_count,marks:released?attempt.marks_obtained:null,resultReleased:!!released})
  }
  if (body.action === 'answer') {
    if (attempt.status!=='in_progress') return respond({error:'This attempt is no longer accepting answers.'},409)
    if (new Date(attempt.deadline_at)<=now) { await finish(attempt,quiz); return respond({error:'The examination deadline has passed.'},409) }
    if (typeof body.questionId!=='string' || !attempt.question_order.includes(body.questionId)) return respond({error:'Question is not part of this attempt.'},403)
    const {data:q}=await admin.from('questions').select('type').eq('id',body.questionId).maybeSingle()
    const {data:options}=await admin.from('question_options').select('id').eq('question_id',body.questionId)
    const answer=validateAnswer(q?.type,body.answer,(options??[]).map((o:AnyRow)=>o.id))
    if(!answer)return respond({error:'Answer is invalid for this question.'},400)
    const {error}=await admin.from('attempt_answers').upsert({attempt_id:attempt.id,question_id:body.questionId,answer,saved_at:now.toISOString()})
    if(error)return respond({error:'Answer could not be saved. Retry when your connection is available.'},503)
    return respond({savedAt:now.toISOString(),serverTime:now.toISOString()})
  }
  if (body.action === 'violation') {
    if (attempt.status!=='in_progress') return respond({error:'Attempt is no longer active.'},409)
    if (!['visibility_hidden','fullscreen_exit'].includes(body.eventType)) return respond({error:'Invalid event type.'},400)
    const {data:count,error}=await admin.rpc('record_attempt_violation',{p_attempt_id:attempt.id,p_event_type:body.eventType})
    if(error)return respond({error:'The exam monitor could not record this event.'},503)
    if(Number(count)>=3) {
      const done=await finish({...attempt,violation_count:Number(count)},quiz,quiz.third_violation_action==='terminate'?'terminated':'submitted')
      return respond({violationCount:Number(count),status:done.status,action:quiz.third_violation_action})
    }
    return respond({violationCount:Number(count),status:attempt.status,warning:true})
  }
  if (body.action === 'submit') {
    const done=await finish(attempt,quiz)
    const released=canSeeResult(quiz.result_visibility,quiz.results_released_at,done.status,now)
    return respond({attemptId:done.id,status:done.status,submittedAt:done.submitted_at,gradingStatus:done.grading_status,marks:released?done.marks_obtained:null,maxMarks:released?quiz.max_marks:null,resultReleased:!!released})
  }
  return respond({error:'Unsupported action'},400)
})

import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
const cors={ 'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')??'*','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' }
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}})
type AccountInput={fullName:string;email:string;role:'student'|'faculty'|'admin';usn?:string;branchId?:string;semester?:number;academicYear?:string;courseIds?:string[]}
function validate(row:any):string|null {
  if(!row||typeof row!=='object')return 'Invalid account row.'
  if(typeof row.fullName!=='string'||row.fullName.trim().length<2||row.fullName.length>160)return 'Name must contain 2–160 characters.'
  if(typeof row.email!=='string'||row.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))return 'Enter a valid institutional email.'
  const domain=(Deno.env.get('INSTITUTION_EMAIL_DOMAIN')??'jainuniversity.ac.in').toLowerCase().replace(/^@/,'')
  if(row.email.toLowerCase().split('@')[1]!==domain)return `Email must use the @${domain} domain.`
  if(!['student','faculty','admin'].includes(row.role))return 'Role must be student, faculty, or admin.'
  if(row.role==='student'&&(typeof row.usn!=='string'||row.usn.trim().length<3||row.usn.length>32))return 'Student accounts need a valid USN.'
  if(row.semester!==undefined&&(!Number.isInteger(Number(row.semester))||Number(row.semester)<1||Number(row.semester)>12))return 'Semester must be between 1 and 12.'
  if(row.courseIds!==undefined&&(!Array.isArray(row.courseIds)||row.courseIds.some((x:any)=>typeof x!=='string')))return 'Course assignments are invalid.'
  return null
}
Deno.serve(async(request)=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(request.method!=='POST')return json({error:'Method not allowed'},405)
  const token=(request.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'')
  const url=Deno.env.get('SUPABASE_URL')!,publishable=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??Deno.env.get('SUPABASE_SECRET_KEY')!
  if(!token)return json({error:'Unauthorized'},401)
  const caller=createClient(url,publishable,{auth:{persistSession:false}})
  const {data:{user},error:authError}=await caller.auth.getUser(token)
  if(authError||!user)return json({error:'Unauthorized'},401)
  const admin=createClient(url,secret,{auth:{persistSession:false}})
  const {data:actor}=await admin.from('profiles').select('role,active').eq('id',user.id).maybeSingle()
  if(actor?.role!=='admin'||!actor.active)return json({error:'Active administrator access required'},403)
  const body=await request.json().catch(()=>null)
  if(!body)return json({error:'Invalid request body'},400)
  if(body.action==='update'){
    if(typeof body.id!=='string'||!['student','faculty','admin'].includes(body.role)||typeof body.active!=='boolean')return json({error:'A valid account, role, and status are required.'},400)
    if(body.branchId!==undefined&&body.branchId!==null&&typeof body.branchId!=='string')return json({error:'Choose a valid branch.'},400)
    const {data:target}=await admin.from('profiles').select('id,role,active').eq('id',body.id).maybeSingle()
    if(!target)return json({error:'Account not found.'},404)
    if(body.branchId){const {data:branch}=await admin.from('branches').select('id').eq('id',body.branchId).eq('active',true).maybeSingle();if(!branch)return json({error:'Choose an active branch.'},400)}
    if(target.role==='admin'&&(body.role!=='admin'||!body.active)){
      const {count}=await admin.from('profiles').select('id',{count:'exact',head:true}).eq('role','admin').eq('active',true)
      if((count??0)<=1)return json({error:'The last active administrator cannot be removed or deactivated.'},409)
    }
    const {error}=await admin.from('profiles').update({role:body.role,active:body.active,...(body.branchId!==undefined?{branch_id:body.branchId}:{} )}).eq('id',body.id)
    if(error)return json({error:'Account could not be updated.'},500)
    await admin.from('audit_logs').insert({actor_id:user.id,action:'account_access_updated',target_type:'profile',target_id:body.id,details:{role:body.role,active:body.active}})
    return json({ok:true})
  }
  const rows:AccountInput[]=body.action==='import'&&Array.isArray(body.rows)?body.rows:body.action==='create'?[body.account]:[]
  if(!rows.length||rows.length>200)return json({error:'Provide between 1 and 200 account rows.'},400)
  const seenEmails=new Set<string>(),seenUsns=new Set<string>()
  for(let i=0;i<rows.length;i++){
    const message=validate(rows[i]);if(message)return json({error:`Row ${i+1}: ${message}`},400)
    const email=rows[i].email.trim().toLowerCase(),usn=rows[i].usn?.trim().toUpperCase()
    if(seenEmails.has(email))return json({error:`Row ${i+1}: duplicate email in this import.`},400);seenEmails.add(email)
    if(usn&&seenUsns.has(usn))return json({error:`Row ${i+1}: duplicate USN in this import.`},400);if(usn)seenUsns.add(usn)
  }
  const {data:branches}=await admin.from('branches').select('id')
  const branchIds=new Set((branches??[]).map((x:any)=>x.id))
  const {data:courses}=await admin.from('courses').select('id')
  const courseIds=new Set((courses??[]).map((x:any)=>x.id))
  for(let i=0;i<rows.length;i++){
    const r=rows[i];if(r.branchId&&!branchIds.has(r.branchId))return json({error:`Row ${i+1}: unknown branch.`},400)
    if((r.courseIds??[]).some((id)=>!courseIds.has(id)))return json({error:`Row ${i+1}: unknown course.`},400)
  }
  const results=[]
  for(let i=0;i<rows.length;i++){
    const row=rows[i],email=row.email.trim().toLowerCase()
    const {data:invited,error:inviteError}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:row.fullName}})
    if(inviteError||!invited.user){results.push({row:i+1,email,ok:false,error:'Invitation could not be sent. Check that the email is not already registered.'});continue}
    const {error:profileError}=await admin.from('profiles').insert({id:invited.user.id,role:row.role,full_name:row.fullName.trim(),institutional_email:email,usn:row.role==='student'?row.usn?.trim().toUpperCase()??null:null,branch_id:row.branchId??null,semester:row.semester??null,academic_year:row.academicYear??null})
    if(profileError){await admin.auth.admin.deleteUser(invited.user.id);results.push({row:i+1,email,ok:false,error:'Profile could not be created. No account was kept.'});continue}
    if(row.courseIds?.length){const {error:enrollmentError}=await admin.from('student_courses').insert(row.courseIds.map((course_id)=>({student_id:invited.user!.id,course_id})));if(enrollmentError){await admin.from('profiles').delete().eq('id',invited.user.id);await admin.auth.admin.deleteUser(invited.user.id);results.push({row:i+1,email,ok:false,error:'Course enrollment failed. No account was kept.'});continue}}
    await admin.from('audit_logs').insert({actor_id:user.id,action:'account_invited',target_type:'profile',target_id:invited.user.id,details:{email,role:row.role}})
    results.push({row:i+1,email,ok:true})
  }
  return json({results,created:results.filter((r)=>r.ok).length,failed:results.filter((r)=>!r.ok).length})
})

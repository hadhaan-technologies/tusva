import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, ClipboardList, FileText, GraduationCap, LayoutDashboard, LogOut, Plus, ShieldCheck, Users } from 'lucide-react'
import type { Profile } from '../lib/types'
import { supabase } from '../lib/supabase'
import ExamRunner from './ExamRunner'
import QuizBuilder from './QuizBuilder'
import AdminPanel from './AdminPanel'
import ResultsPanel from './ResultsPanel'
import QuestionBank from './QuestionBank'
import BrandLogo from './BrandLogo'

type Props = { profile: Profile; onSignOut: () => void }
type Section = 'overview'|'questions'|'quizzes'|'results'|'admin'
const nav: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'questions', label: 'Question bank', icon: BookOpen },
  { id: 'quizzes', label: 'Examinations', icon: ClipboardList }, { id: 'results', label: 'Results', icon: FileText }, { id: 'admin', label: 'Administration', icon: Users },
]
export default function Workspace({ profile, onSignOut }: Props) {
  const [section, setSection] = useState<Section>('overview')
  const [message, setMessage] = useState('')
  const [examSelection, setExamSelection] = useState<{quizId:string;title:string;attemptId?:string}|null>(null)
  const items = profile.role === 'student' ? nav.filter((x) => ['overview','quizzes','results'].includes(x.id)) : profile.role === 'faculty' ? nav.filter((x) => ['overview','questions','quizzes','results'].includes(x.id)) : nav.filter((x) => ['overview','admin','results'].includes(x.id))

  if (examSelection) return <ExamRunner quizId={examSelection.quizId} quizTitle={examSelection.title} attemptId={examSelection.attemptId} onClose={()=>setExamSelection(null)}/>

  return <main className="workspace-shell">
    <aside className="workspace-sidebar"><a className="brand" href="#home"><BrandLogo className="brand-mark"/><span>TUSVA</span></a><div className="workspace-institution"><span className="institution-mark">TC</span><span><b>TUSVA College</b><small>Institutional workspace</small></span></div>
      <div className="nav-caption">WORKSPACE</div><nav>{items.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? 'active' : ''} onClick={() => { setSection(id); setMessage('') }}><Icon size={17}/>{label}{section === id && <i/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="user-mini"><div className="avatar">{profile.full_name.slice(0,1).toUpperCase()}</div><span><b>{profile.full_name}</b><small>{profile.role}</small></span><button aria-label="Sign out" onClick={onSignOut}><LogOut size={16}/></button></div></div>
    </aside>
    <section className="workspace-content"><header className="workspace-topbar"><div><span className="breadcrumb">TUSVA <i>/</i> {items.find((x) => x.id === section)?.label}</span><h1>{sectionTitle(section, profile.role)}</h1></div><div className="topbar-right"><span className="term-label"><span/> Academic workspace</span><button className="mobile-signout" onClick={onSignOut}><LogOut size={15}/></button></div></header>
      {message && <div className="workspace-flash" role="status">{message}</div>}
      {section === 'overview' && <Overview profile={profile} onNavigate={setSection}/>}
      {section === 'questions' && profile.role === 'faculty' && <QuestionBank profile={profile}/>}
      {section === 'quizzes' && <QuizList profile={profile} onStart={(quizId,title,attemptId)=>setExamSelection({quizId,title,attemptId})}/>}
      {section === 'results' && <ResultsPanel profile={profile}/>}
      {section === 'admin' && <AdminPanel/>}
      <footer className="app-footer"><span>© 2026 TUSVA College</span><span>Product by <a href="https://www.hadhaan.com" target="_blank" rel="noreferrer">Hadhaan Technologies</a></span></footer>
    </section>
  </main>
}

function sectionTitle(section: Section, role: Profile['role']) {
  if (section === 'overview') return `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${role === 'student' ? 'student' : role === 'faculty' ? 'faculty' : 'administrator'}`
  return ({questions:'Question bank',quizzes:'Examinations',results:'Results and reporting',admin:'Administration'} as Record<Exclude<Section,'overview'>,string>)[section]
}
function Overview({ profile, onNavigate }: { profile: Profile; onNavigate: (section: Section)=>void }) {
  return <div className="overview-page"><div className="welcome-strip"><div><div className="eyebrow">YOUR INSTITUTIONAL WORKSPACE</div><h2>{profile.full_name}</h2><p>{profile.role === 'faculty' ? 'Create assessments with rich questions and track student progress.' : profile.role === 'student' ? 'Your assigned examinations and released results will appear here.' : 'Manage institutional access, academic structure and examination oversight.'}</p></div><div className="welcome-seal"><GraduationCap size={30}/><span>TC</span></div></div>
    <div className="stat-grid"><Stat label={profile.role==='student'?'Assigned exams':'Active examinations'} value="—" icon={<ClipboardList size={17}/>}/><Stat label={profile.role==='faculty'?'Question bank':'Completed assessments'} value="—" icon={<BookOpen size={17}/>}/><Stat label="Results ready" value="—" icon={<FileText size={17}/>}/></div>
    <div className="section-header"><div><h3>Quick access</h3><p>Continue where you need to be.</p></div></div><div className="quick-grid">{(profile.role==='faculty'?[['questions','Create questions','Build text, image and equation-rich questions.'],['quizzes','Set up an examination','Schedule and assign an assessment.']]:profile.role==='student'?[['quizzes','View examinations','See upcoming and completed assessments.'],['results','Review results','Check marks and released feedback.']]:[['admin','Manage accounts','Review access, roles and student records.'],['results','Reports and audit','Browse examination reporting.']]).map(([id,title,desc])=><button key={id} onClick={()=>onNavigate(id as Section)}><span className="quick-icon"><Plus size={16}/></span><b>{title}</b><small>{desc}</small><i>Open workspace ↗</i></button>)}</div>
    <div className="security-note"><ShieldCheck size={18}/><span><b>Assessment integrity</b><small>Browser restrictions are deterrents. Examination records and grading are enforced on the server.</small></span></div>
  </div>
}
function Stat({label,value,icon}:{label:string;value:string;icon:React.ReactNode}) {return <div className="stat-card"><span>{icon}</span><small>{label}</small><b>{value}</b></div>}
function QuizList({profile,onStart}:{profile:Profile;onStart:(quizId:string,title:string,attemptId?:string)=>void}) { const [rows,setRows]=useState<Record<string,any>[]>([]);const[attempts,setAttempts]=useState<Record<string,any>[]>([]);const[busy,setBusy]=useState(true);const[error,setError]=useState('');const[creating,setCreating]=useState(false);const[editingId,setEditingId]=useState<string|null>(null);const[revision,setRevision]=useState(0);
  useEffect(()=>{const client=supabase;if(!client)return;let live=true;const load=async()=>{const table=profile.role==='faculty'?client.from('quizzes').select('id,title,status,starts_at,ends_at,duration_seconds,max_marks').eq('created_by',profile.id).order('created_at',{ascending:false}):client.from('quizzes').select('id,title,status,starts_at,ends_at,duration_seconds,max_marks,max_attempts').eq('status','published').order('starts_at');const [{data,error:e},attemptResult]=await Promise.all([table,profile.role==='student'?client.functions.invoke('exam-attempt',{body:{action:'list'}}):Promise.resolve({data:[],error:null})]);if(!live)return;if(e||attemptResult.error)setError('Examinations could not be loaded.');setRows(data??[]);setAttempts(Array.isArray(attemptResult.data)?attemptResult.data:[]);setBusy(false)};void load();return()=>{live=false}},[profile.id,profile.role,revision]);
  if(creating||editingId)return <QuizBuilder profile={profile} quizId={editingId??undefined} onCancel={()=>{setCreating(false);setEditingId(null)}} onSaved={()=>{setCreating(false);setEditingId(null);setRevision((x)=>x+1)}}/>
  const closeQuiz=async(id:string)=>{if(!supabase)return;setError('');const {error:closeError}=await supabase.from('quizzes').update({status:'closed'}).eq('id',id);if(closeError)setError('The examination could not be closed.');else setRevision((x)=>x+1)}
  return <div className="data-panel"><div className="panel-title"><div><h3>{profile.role==='faculty'?'Your examinations':'Assigned examinations'}</h3><p>{profile.role==='student'?'Start or resume an examination. Your server deadline remains fixed after a refresh.':'Examination availability and attempt controls are governed by the server.'}</p></div>{profile.role==='faculty'&&<button className="primary-button" onClick={()=>setCreating(true)}><Plus size={15}/> Create exam</button>}</div>{busy?<p className="empty-state">Loading examinations…</p>:error?<p className="empty-state">{error}</p>:rows.length===0?<p className="empty-state">No examinations found.</p>:profile.role==='student'?<div className="student-exam-list">{rows.map((r)=>{const previous=attempts.filter((a)=>a.quizId===r.id).sort((a,b)=>Number(b.attemptNo)-Number(a.attemptNo));const active=previous.find((a)=>a.status==='in_progress');const done=previous[0];const canStart=active||!done||Number(done.attemptNo)<Number(r.max_attempts??1);return <article className="student-exam-card" key={r.id}><div className="exam-card-icon"><ClipboardList size={18}/></div><div className="exam-card-body"><div className="exam-card-top"><h3>{String(r.title)}</h3><span className={`badge ${String(r.status)}`}>{active?'In progress':done?.status==='graded'||done?.status==='submitted'?'Attempted':'Upcoming'}</span></div><p>{Math.round(Number(r.duration_seconds)/60)} minutes <i>·</i> {String(r.max_marks)} marks <i>·</i> Attempt {active?active.attemptNo:Math.min((done?.attemptNo??0)+1,Number(r.max_attempts??1))} of {r.max_attempts??1}</p><small>Starts {r.starts_at?new Date(String(r.starts_at)).toLocaleString():'when scheduled'}</small></div><button className="exam-card-action" disabled={!canStart} onClick={()=>onStart(r.id,r.title,active?.id)}>{active?'Resume':canStart?'View details':'Completed'} <ArrowRight size={14}/></button></article>})}</div>:<div className="table-wrap"><table><thead><tr><th>Examination</th><th>Status</th><th>Duration</th><th>Maximum marks</th><th>Schedule</th>{profile.role==='faculty'&&<th>Actions</th>}</tr></thead><tbody>{rows.map((r)=><tr key={String(r.id)}><td><b>{String(r.title)}</b><small className="row-id">{String(r.id).slice(0,8).toUpperCase()}</small></td><td><span className={`badge ${String(r.status)}`}>{String(r.status)}</span></td><td>{Math.round(Number(r.duration_seconds)/60)} min</td><td>{String(r.max_marks)}</td><td>{r.starts_at?new Date(String(r.starts_at)).toLocaleString():'Unscheduled'}</td>{profile.role==='faculty'&&<td><div className="quiz-actions">{r.status==='draft'&&<button onClick={()=>setEditingId(r.id)}>Edit draft</button>}{['published','scheduled'].includes(r.status)&&<button className="close-quiz" onClick={()=>void closeQuiz(r.id)}>Close exam</button>}</div></td>}</tr>)}</tbody></table></div>}</div>
}

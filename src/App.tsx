import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, BookOpenCheck, CalendarDays, Check, ChevronRight, CircleHelp, Clock3, GraduationCap, LockKeyhole, ShieldCheck } from 'lucide-react'
import { supabase } from './lib/supabase'
import type { Profile, Role } from './lib/types'
import Workspace from './components/Workspace'
import DemoWorkspace from './components/DemoWorkspace'
import BrandLogo from './components/BrandLogo'
import SignupOtpForm from './components/SignupOtpForm'
import { institutionEmailError, isInstitutionEmail } from './lib/institution-email'
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle, Input } from './components/ui'
import './styles.css'
import './clean.css'

type Page = 'home' | 'auth' | 'demo'
type AuthMode = 'signin' | 'signup' | 'demo' | 'reset' | 'verify'
const demoPeople: Record<Role, Profile> = import.meta.env.DEV ? {
  student: { id: 'demo-student', role: 'student', full_name: 'Ananya Rao', institutional_email: 'ananya.rao@jainuniversity.ac.in', active: true, usn: '4GH22CS042', semester: 6, academic_year: '2026–27' },
  faculty: { id: 'demo-faculty', role: 'faculty', full_name: 'Dr. Meera Nair', institutional_email: 'meera.nair@jainuniversity.ac.in', active: true },
  admin: { id: 'demo-admin', role: 'admin', full_name: 'Arjun Menon', institutional_email: 'arjun.menon@jainuniversity.ac.in', active: true },
} : {} as Record<Role, Profile>

export default function App() {
  const [page, setPage] = useState<Page>('home')
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [checkingSession, setCheckingSession] = useState(Boolean(supabase))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [demoProfile, setDemoProfile] = useState<Profile>(demoPeople.student)
  const [verificationEmail, setVerificationEmail] = useState('')

  useEffect(() => {
    const client = supabase
    if (!client) return
    let live = true
    const loadProfile = async (userId: string | null) => {
      if (!userId) { if (live) { setProfile(null); setCheckingSession(false) }; return }
      const { data, error: profileError } = await client.from('profiles').select('id,role,full_name,institutional_email,active,usn,branch_id,semester,academic_year').eq('id', userId).maybeSingle()
      if (!live) return
      if (profileError || !data || !data.active) {
        await client.auth.signOut()
        setProfile(null)
        setPage('auth')
        setAuthMode('signin')
        setError(data && !data.active ? 'This account is inactive. Verify your university email or contact TUSVA support.' : 'Your account has not been provisioned yet. Contact TUSVA support.')
      } else {
        setProfile(data as Profile)
        setPage('home')
        setError('')
      }
      setCheckingSession(false)
    }
    void client.auth.getUser().then(({ data }) => loadProfile(data.user?.id ?? null))
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void loadProfile(session?.user.id ?? null) }, 0)
    })
    return () => { live = false; subscription.unsubscribe() }
  }, [])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) { setError('Live sign-in is unavailable. Choose a demo account to explore the dashboards.'); return }
    setBusy(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')
    if (!isInstitutionEmail(email)) { setError(institutionEmailError); setBusy(false); return }
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !data.user) { setError(signInError?.message ?? 'We could not sign you in. Check your details and try again.'); setBusy(false); return }
    const { data: account, error: accountError } = await supabase.from('profiles').select('id,role,full_name,institutional_email,active,usn,branch_id,semester,academic_year').eq('id', data.user.id).maybeSingle()
    if (accountError || !account || !account.active) {
      await supabase.auth.signOut()
      setError(account && !account.active ? 'This account is inactive. Verify your university email or contact TUSVA support.' : 'This account is not set up for TUSVA yet. Contact TUSVA support.')
    } else { setProfile(account as Profile); setPage('home'); setError('') }
    setBusy(false)
  }

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) { setError('Live registration is not configured. Use the demo workspace instead.'); return }
    const form = new FormData(event.currentTarget)
    const fullName = String(form.get('fullName') ?? '').trim()
    const email = String(form.get('email') ?? '').trim().toLowerCase()
    const password = String(form.get('password') ?? '')
    const usn = String(form.get('usn') ?? '').trim().toUpperCase()
    const branchCode = String(form.get('branchCode') ?? '').trim().toUpperCase()
    const semester = Number(form.get('semester'))
    const academicYear = String(form.get('academicYear') ?? '').trim()
    if (!isInstitutionEmail(email)) { setError(institutionEmailError); return }
    if (password.length < 8) { setError('Choose a password with at least 8 characters.'); return }
    setBusy(true); setError(''); setNotice('')
    const { error: signupError } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { tusva_signup_request: true, full_name: fullName, usn, branch_code: branchCode, semester, academic_year: academicYear },
      },
    })
    if (signupError) setError(signupError.message)
    else { setVerificationEmail(email); setAuthMode('verify'); setNotice('') }
    setBusy(false)
  }

  const verifySignupOtp = async (token: string) => {
    if (!supabase || !verificationEmail) return
    setBusy(true); setError(''); setNotice('')
    const { data: verification, error: verifyError } = await supabase.auth.verifyOtp({ email: verificationEmail, token, type: 'signup' })
    if (verifyError) setError(verifyError.message)
    else if (!verification.user) setError('Email verification succeeded but no account was returned. Try signing in or request a new code.')
    else {
      const { data: activation, error: activationError } = await supabase.functions.invoke('complete-signup')
      if (activationError || activation?.error) {
        await supabase.auth.signOut()
        setError(activation?.error ?? activationError?.message ?? 'Your email is verified, but the account could not be activated. Please try again.')
      } else {
        const { data: account, error: accountError } = await supabase.from('profiles').select('id,role,full_name,institutional_email,active,usn,branch_id,semester,academic_year').eq('id', verification.user.id).maybeSingle()
        if (accountError || !account?.active) {
          await supabase.auth.signOut()
          setError('Your email is verified, but the account is still inactive. Please try again.')
        } else { setProfile(account as Profile); setPage('home'); setNotice(''); setError('') }
      }
    }
    setBusy(false)
  }

  const resendSignupOtp = async () => {
    if (!supabase || !verificationEmail) return
    setBusy(true); setError(''); setNotice('')
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: verificationEmail })
    if (resendError) setError(resendError.message)
    else setNotice('A new verification code has been sent if the address has a pending registration.')
    setBusy(false)
  }

  const resetPassword = async (email: string) => {
    if (!supabase) return
    if (!isInstitutionEmail(email)) { setError(institutionEmailError); return }
    setBusy(true); setError(''); setNotice('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (resetError) setError(resetError.message)
    else setNotice('If this account exists, a password reset link has been sent.')
    setBusy(false)
  }

  const startDemo = (role: Role, localProfile?: Profile) => {
    if (!import.meta.env.DEV) return
    setDemoProfile(localProfile ?? demoPeople[role])
    setPage('demo'); setError(''); setNotice('')
  }
  const signOut = async () => {
    if (page === 'demo') { setPage('home'); return }
    if (supabase) await supabase.auth.signOut()
    setProfile(null); setPage('home'); setAuthMode('signin')
  }

  if (checkingSession) return <main className="loading-screen"><BrandLogo className="brand-mark"/><span>Loading your secure workspace</span></main>
  if (profile) return <Workspace profile={profile} onSignOut={signOut} />
  if (page === 'demo' && import.meta.env.DEV) return <DemoWorkspace profile={demoProfile} onSignOut={signOut} />
  if (page === 'auth') return <AuthScreen mode={authMode} setMode={setAuthMode} onHome={() => { setPage('home'); setError(''); setNotice('') }} onSignIn={signIn} onSignUp={signUp} onVerifyOtp={verifySignupOtp} onResendOtp={resendSignupOtp} verificationEmail={verificationEmail} onDemo={startDemo} onReset={resetPassword} error={error} notice={notice} busy={busy} />
  return <Landing onSignIn={() => { setAuthMode('signin'); setPage('auth') }} onSignUp={() => { setAuthMode('signup'); setPage('auth') }} onDemo={() => setAuthModeAndPage(setAuthMode, setPage)} />
}

function setAuthModeAndPage(setMode: (mode: AuthMode) => void, setPage: (page: Page) => void) { setMode('demo'); setPage('auth') }

function Brand({ light = false }: { light?: boolean }) {
  return <a className={`brand-lockup ${light ? 'brand-light' : ''}`} href="#home"><BrandLogo/><span className="brand-word">TUSVA</span><span className="brand-divider"/><span className="brand-caption">COLLEGE ASSESSMENT</span></a>
}

function Landing({ onSignIn, onSignUp, onDemo }: { onSignIn: () => void; onSignUp: () => void; onDemo: () => void }) {
  return <main className="public-site" id="home">
    <header className="public-header"><Brand/><nav className="public-nav"><a href="#how-it-works">How it works</a><a href="#for-everyone">For your campus</a></nav><div className="public-actions"><Button variant="ghost" onClick={onSignIn}>Sign in</Button><Button onClick={onSignUp}>Create account <ArrowRight size={15}/></Button></div><button className="mobile-auth-link" onClick={onSignIn}>Sign in</button></header>
    <section className="landing-hero">
      <div className="hero-copy"><Badge className="hero-tag"><span/> TUSVA COLLEGE · ASSESSMENT PLATFORM</Badge><h1>Exams, results and<br/><span>academic workflows.</span></h1><p>A secure college platform for assessment, from question authoring and exam delivery to results and reporting.</p><div className="hero-actions"><Button size="default" onClick={onSignIn}>Institutional sign in <ArrowRight size={16}/></Button>{import.meta.env.DEV&&<Button variant="outline" onClick={onDemo}>Explore the demo</Button>}</div><div className="hero-proof"><div className="proof-avatars"><span>AR</span><span>MN</span><span>AM</span></div><div><b>One platform for your campus</b><small>Student · Faculty · Administration</small></div></div></div>
      <div className="hero-visual"><div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/><div className="hero-note"><span className="note-icon"><CalendarDays size={16}/></span><span><small>NEXT ASSESSMENT</small><b>Signals & Systems</b><em>Today, 10:30 AM</em></span><span className="note-dot"/></div><div className="preview-window"><div className="preview-top"><span className="preview-brand"><span>T</span> TUSVA</span><span className="preview-user"><i/> Ananya R.</span></div><div className="preview-body"><div className="preview-label">STUDENT WORKSPACE <span>•••</span></div><h3>Good morning,<br/>Ananya</h3><p>Your semester is right on track.</p><div className="preview-stats"><div><small>UPCOMING</small><b>03</b></div><div><small>COMPLETED</small><b>08</b></div><div><small>AVG. SCORE</small><b>86<span>%</span></b></div></div><div className="preview-exam"><div className="preview-exam-icon"><BookOpenCheck size={15}/></div><span><b>Signals & Systems</b><small>Today · 10:30 AM · 45 min</small></span><span className="preview-open"><ChevronRight size={15}/></span></div><div className="preview-exam secondary"><div className="preview-exam-icon"><GraduationCap size={15}/></div><span><b>Engineering Mathematics</b><small>Friday · 2:00 PM · 60 min</small></span><span className="preview-open"><ChevronRight size={15}/></span></div></div></div><div className="visual-caption"><span className="caption-line"/> A focused space for learning and assessment</div></div>
    </section>
    <section className="trust-row" id="for-everyone"><span>ONE CAMPUS. THREE CONNECTED SPACES.</span><div><span><GraduationCap size={17}/> Students</span><span><BookOpenCheck size={16}/> Faculty</span><span><ShieldCheck size={16}/> Administrators</span></div></section>
    <section className="public-feature" id="how-it-works"><div><span className="section-kicker">TUSVA COLLEGE</span><h2>Assessment from<br/><span>start to finish.</span></h2></div><div className="feature-cards"><Feature icon={<Clock3 size={18}/>} title="Exam delivery" description="Scheduled exams with an authoritative timer, saved responses and clear submission status."/><Feature icon={<BookOpenCheck size={18}/>} title="Question authoring" description="Create reusable questions with formatted text, equations, images and mixed answer options."/><Feature icon={<LockKeyhole size={18}/>} title="Managed access" description="Student, faculty and administrator permissions follow institutional roles."/></div></section>
    <footer className="public-footer"><Brand/><span>© 2026 TUSVA College · A considered space for assessment</span><span className="product-credit">Product by <a href="https://www.hadhaan.com" target="_blank" rel="noreferrer">Hadhaan Technologies</a></span><button onClick={onSignIn}>Institutional sign in <ArrowRight size={14}/></button></footer>
  </main>
}

function Feature({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <Card className="feature-card"><span className="feature-icon">{icon}</span><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></Card>
}

function AuthScreen({ mode, setMode, onHome, onSignIn, onSignUp, onVerifyOtp, onResendOtp, verificationEmail, onDemo, onReset, error, notice, busy }: {
  mode: AuthMode; setMode: (mode: AuthMode) => void; onHome: () => void; onSignIn: (event: FormEvent<HTMLFormElement>) => void; onSignUp: (event: FormEvent<HTMLFormElement>) => void; onVerifyOtp: (token: string) => void; onResendOtp: () => void; verificationEmail: string; onDemo: (role: Role, profile?: Profile) => void; onReset: (email: string) => void; error: string; notice: string; busy: boolean
}) {
  const [demoName, setDemoName] = useState('')
  const [demoEmail, setDemoEmail] = useState('')
  const [demoError, setDemoError] = useState('')
  const createLocalDemo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!demoName.trim() || !isInstitutionEmail(demoEmail)) { setDemoError(`Enter a name and a ${institutionEmailError.toLowerCase()}`); return }
    const local: Profile = { id: `demo-${Date.now()}`, role: 'student', full_name: demoName.trim(), institutional_email: demoEmail.trim().toLowerCase(), active: true, usn: '4GH26CS001', semester: 4, academic_year: '2026–27' }
    try { window.localStorage.setItem('tusva-demo-profile', JSON.stringify(local)) } catch { /* demo still works for this visit */ }
    onDemo('student', local)
  }
  return <main className="auth-page"><header className="auth-header"><button className="brand-home" onClick={onHome}><Brand/></button><div><span>Need help?</span><CircleHelp size={16}/></div></header><div className="auth-layout"><aside className="auth-aside"><Badge className="hero-tag"><span/> TUSVA COLLEGE</Badge><h1>Your college’s<br/>examination<br/><span>workspace.</span></h1><p>Sign in to access scheduled assessments, course results and institutional tools.</p><div className="auth-aside-detail"><ShieldCheck size={17}/><span><b>Private to your institution</b><small>University email OTP verification for student accounts.</small></span></div><div className="auth-aside-footer">TUSVA College · Examination services · Product by <a href="https://www.hadhaan.com" target="_blank" rel="noreferrer">Hadhaan Technologies</a></div></aside>
    <section className="auth-panel"><div className="auth-card-wrap">{!['reset','verify'].includes(mode)&&<div className="auth-tabs" role="tablist"><button role="tab" aria-selected={mode==='signin'} className={mode==='signin'?'active':''} onClick={()=>setMode('signin')}>Sign in</button><button role="tab" aria-selected={mode==='signup'} className={mode==='signup'?'active':''} onClick={()=>setMode('signup')}>Create an account</button>{import.meta.env.DEV&&<button role="tab" aria-selected={mode==='demo'} className={mode==='demo'?'active':''} onClick={()=>setMode('demo')}>Explore demo</button>}</div>}
      {mode==='verify'&&<SignupOtpForm email={verificationEmail} busy={busy} error={error} notice={notice} onVerify={onVerifyOtp} onResend={onResendOtp} onBack={()=>setMode('signup')}/>}
      {mode==='reset'&&<><CardHeader className="auth-heading"><CardTitle>Reset your password</CardTitle><CardDescription>We’ll email a secure reset link to your university address.</CardDescription></CardHeader>{error&&<div className="form-alert error" role="alert">{error}</div>}{notice&&<div className="form-alert success" role="status"><Check size={16}/>{notice}</div>}<form className="auth-form" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);onReset(String(data.get('resetEmail')??'').trim().toLowerCase())}}><label htmlFor="reset-email">University email</label><Input id="reset-email" name="resetEmail" type="email" placeholder="name@jainuniversity.ac.in" pattern=".+@jainuniversity\.ac\.in" autoComplete="email" required disabled={!supabase||busy}/><Button type="submit" className="auth-submit" disabled={!supabase||busy}>{busy?'Sending…':'Send reset link'} <ArrowRight size={16}/></Button></form><button className="auth-back-link" onClick={()=>setMode('signin')}>← Back to sign in</button></>}
      {mode==='signin'&&<><CardHeader className="auth-heading"><CardTitle>Welcome back</CardTitle><CardDescription>Sign in with your institutional account to continue.</CardDescription></CardHeader>{error&&<div className="form-alert error" role="alert">{error}</div>}{notice&&<div className="form-alert success" role="status"><Check size={16}/>{notice}</div>}<form className="auth-form" onSubmit={onSignIn}><label htmlFor="login-email">University email</label><Input id="login-email" name="email" type="email" placeholder="name@jainuniversity.ac.in" pattern=".+@jainuniversity\.ac\.in" autoComplete="username" required disabled={!supabase||busy}/><div className="password-label"><label htmlFor="login-password">Password</label><button type="button" onClick={()=>setMode('reset')} disabled={!supabase}>Forgot password?</button></div><Input id="login-password" name="password" type="password" placeholder="Enter your password" autoComplete="current-password" required disabled={!supabase||busy}/><Button type="submit" className="auth-submit" disabled={!supabase||busy}>{busy?'Signing in…':'Sign in'} <ArrowRight size={16}/></Button></form><div className="auth-footnote"><LockKeyhole size={14}/> Protected by your institution’s sign-in</div></>}
      {mode==='signup'&&<><CardHeader className="auth-heading"><CardTitle>Create a student account</CardTitle><CardDescription>Verify your Jain University email with a one-time code. No manual approval is required.</CardDescription></CardHeader>{error&&<div className="form-alert error" role="alert">{error}</div>}{notice&&<div className="form-alert success" role="status"><Check size={16}/>{notice}</div>}<form className="auth-form signup-form" onSubmit={onSignUp}><label htmlFor="signup-name">Full name</label><Input id="signup-name" name="fullName" placeholder="Your name as it appears in college records" autoComplete="name" required disabled={!supabase||busy}/><label htmlFor="signup-email">University email</label><Input id="signup-email" name="email" type="email" placeholder="name@jainuniversity.ac.in" pattern=".+@jainuniversity\.ac\.in" autoComplete="email" required disabled={!supabase||busy}/><div className="form-two-col"><div><label htmlFor="signup-usn">USN</label><Input id="signup-usn" name="usn" placeholder="4GH26CS001" required disabled={!supabase||busy}/></div><div><label htmlFor="signup-branch">Branch code (if known)</label><Input id="signup-branch" name="branchCode" placeholder="e.g. CSE" disabled={!supabase||busy}/></div></div><div className="form-two-col"><div><label htmlFor="signup-semester">Semester</label><select id="signup-semester" name="semester" className="ui-input" defaultValue="" required disabled={!supabase||busy}><option value="" disabled>Select</option>{Array.from({length:8},(_,i)=><option key={i+1} value={i+1}>{i+1}{['st','nd','rd'][i]??'th'}</option>)}</select></div><div><label htmlFor="signup-year">Academic year</label><Input id="signup-year" name="academicYear" placeholder="2026–27" required disabled={!supabase||busy}/></div></div><label htmlFor="signup-password">Create a password</label><Input id="signup-password" name="password" type="password" placeholder="At least 8 characters" minLength={8} autoComplete="new-password" required disabled={!supabase||busy}/><Button type="submit" className="auth-submit" disabled={!supabase||busy}>{busy?'Sending code…':'Create account' } <ArrowRight size={16}/></Button></form><p className="auth-smallprint">The code confirms access to the university email address, not the claimed name or USN. A branch can be assigned later.</p></>}
      {mode==='demo'&&import.meta.env.DEV&&<><CardHeader className="auth-heading"><CardTitle>Explore the demo</CardTitle><CardDescription>Choose a role to preview its dashboard. Demo data stays in this browser.</CardDescription></CardHeader><div className="demo-role-list">{(['student','faculty','admin'] as const).map((role)=><button className="demo-role-card" key={role} onClick={()=>onDemo(role)}><span className={`demo-role-icon ${role}`}>{role==='student'?<GraduationCap size={19}/>:role==='faculty'?<BookOpenCheck size={18}/>:<ShieldCheck size={18}/>}</span><span><b>{demoPeople[role].full_name}</b><small>{role==='admin'?'Administrator workspace':role==='faculty'?'Faculty workspace':'Student workspace'}</small></span><ChevronRight size={17}/></button>)}</div><div className="demo-divider"><span/> OR CREATE A LOCAL STUDENT <span/></div>{demoError&&<div className="form-alert error">{demoError}</div>}<form className="auth-form local-demo-form" onSubmit={createLocalDemo}><label htmlFor="demo-name">Your name</label><Input id="demo-name" value={demoName} onChange={e=>setDemoName(e.target.value)} placeholder="e.g. Sam Patel" required/><label htmlFor="demo-email">University email for the demo profile</label><Input id="demo-email" type="email" pattern=".+@jainuniversity\.ac\.in" placeholder="name@jainuniversity.ac.in" value={demoEmail} onChange={e=>setDemoEmail(e.target.value)} required/><Button variant="outline" type="submit" className="auth-submit">Create demo student <ArrowRight size={16}/></Button></form><p className="auth-smallprint">Demo accounts do not sign in to Supabase or create institutional records.</p></>}
      <button className="auth-back-link" onClick={onHome}>← Back to TUSVA</button>
    </div></section></div></main>
}

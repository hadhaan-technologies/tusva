import { useState } from 'react'
import { ArrowRight, RotateCw } from 'lucide-react'
import { Button, Input } from './ui'

export default function SignupOtpForm({ email, busy, error, notice, onVerify, onResend, onBack }: {
  email: string; busy: boolean; error: string; notice: string
  onVerify: (token: string) => void; onResend: () => void; onBack: () => void
}) {
  const [token, setToken] = useState('')
  return <section aria-labelledby="otp-title">
    <header className="ui-card-header auth-heading"><h2 className="ui-card-title" id="otp-title">Verify your university email</h2><p className="ui-card-description">Enter the six digit code sent to <strong>{email}</strong>. Once verified, your student account is created automatically.</p></header>
    {error && <div className="form-alert error" role="alert">{error}</div>}{notice && <div className="form-alert success" role="status">{notice}</div>}
    <form className="auth-form" onSubmit={event => { event.preventDefault(); onVerify(token) }}>
      <label htmlFor="signup-otp">Email verification code</label>
      <Input id="signup-otp" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={token} onChange={event => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} required disabled={busy} />
      <Button type="submit" className="auth-submit" disabled={busy || token.length !== 6}>{busy ? 'Verifying…' : 'Verify email'} <ArrowRight size={16}/></Button>
    </form>
    <div className="otp-actions"><button className="auth-back-link" type="button" onClick={onResend} disabled={busy}>Resend code <RotateCw size={14}/></button><button className="auth-back-link" type="button" onClick={onBack}>Use a different email</button></div>
    <p className="auth-smallprint">If your email contains a confirmation link instead, open it in this browser to complete verification. Six digit codes are controlled by the institution’s Supabase email template.</p>
  </section>
}

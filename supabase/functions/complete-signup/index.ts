import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { canActivateVerifiedSignup } from '../_shared/registration-domain.ts'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Verify your university email before activating this account.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const publishable = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!
  const caller = createClient(url, publishable, { auth: { persistSession: false } })
  const { data: { user }, error: authError } = await caller.auth.getUser(token)
  if (authError || !user) return json({ error: 'Your verification session is invalid. Request a new code.' }, 401)

  const admin = createClient(url, secret, { auth: { persistSession: false } })
  const { data: profile, error: profileError } = await admin.from('profiles').select('id,role,active,signup_activation_pending').eq('id', user.id).maybeSingle()
  if (profileError) return json({ error: 'Student account could not be loaded.' }, 500)
  if (profile?.active && profile.role === 'student') return json({ ok: true })
  if (!profile || !canActivateVerifiedSignup({
    emailConfirmedAt: user.email_confirmed_at,
    signupActivationPending: profile.signup_activation_pending,
    role: profile.role,
  })) return json({ error: 'This verified account is not eligible for student signup activation.' }, 403)
  const { error: updateError } = await admin.from('profiles').update({ active: true, signup_activation_pending: false }).eq('id', user.id).eq('role', 'student').eq('signup_activation_pending', true).eq('active', false)
  if (updateError) return json({ error: 'Student account could not be activated. Please try again.' }, 500)
  return json({ ok: true })
})

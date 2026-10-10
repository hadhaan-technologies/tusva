import { createClient } from 'npm:@supabase/supabase-js@2.57.4'
import { sniffImageMime } from '../_shared/exam-domain.ts'

const cors = { 'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const authorization = request.headers.get('Authorization') ?? ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  const url = Deno.env.get('SUPABASE_URL')!
  const publishable = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!
  if (!token || !secret || !publishable) return json({ error: 'Unauthorized' }, 401)
  const caller = createClient(url, publishable, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
  const { data: { user }, error: authError } = await caller.auth.getUser(token)
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)
  const { data: profile } = await caller.from('profiles').select('role, active').eq('id', user.id).maybeSingle()
  if (!profile?.active || !['faculty','admin'].includes(profile.role)) return json({ error: 'Faculty access required' }, 403)
  const payload = await request.json().catch(() => null)
  if (!payload || typeof payload.assetId !== 'string' || typeof payload.path !== 'string' || typeof payload.altText !== 'string') return json({ error: 'Invalid request' }, 400)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.assetId) || !new RegExp(`^${user.id}/${payload.assetId}\\.(jpg|png|webp)$`, 'i').test(payload.path)) return json({ error: 'Invalid asset path' }, 400)
  const admin = createClient(url, secret, { auth: { persistSession: false } })
  const { data: object, error: downloadError } = await admin.storage.from('question-media').download(payload.path)
  if (downloadError || !object) return json({ error: 'Uploaded image not found' }, 404)
  if (object.size === 0 || object.size > 10 * 1024 * 1024) {
    await admin.storage.from('question-media').remove([payload.path])
    return json({ error: 'Images must be smaller than 10 MB' }, 413)
  }
  const bytes = new Uint8Array(await object.arrayBuffer())
  const mime = sniffImageMime(bytes)
  const expectedExtension = mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp'
  if (!mime || !payload.path.toLowerCase().endsWith(`.${expectedExtension}`)) {
    await admin.storage.from('question-media').remove([payload.path])
    return json({ error: 'Only valid JPEG, PNG, and WebP images are accepted' }, 415)
  }
  const { error: insertError } = await admin.from('media_assets').insert({ id: payload.assetId, owner_id: user.id, storage_path: payload.path, mime_type: mime, byte_size: bytes.byteLength, alt_text: payload.altText.slice(0, 500) })
  if (insertError) {
    await admin.storage.from('question-media').remove([payload.path])
    return json({ error: 'Could not register validated image' }, 500)
  }
  return json({ assetId: payload.assetId, mimeType: mime, byteSize: bytes.byteLength })
})

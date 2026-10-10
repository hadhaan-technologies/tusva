import type { SupabaseClient } from '@supabase/supabase-js'
import { sniffImageMime } from '../../supabase/functions/_shared/exam-domain'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const allowed = new Set(['image/jpeg','image/png','image/webp'])
export { sniffImageMime }
export async function uploadQuestionImage(client: SupabaseClient, file: File, progress: (percent: number) => void) {
  if (!allowed.has(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.')
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) throw new Error('Images must be smaller than 10 MB.')
  const detectedType = sniffImageMime(new Uint8Array(await file.slice(0, 12).arrayBuffer()))
  if (detectedType !== file.type) throw new Error('The file contents do not match a supported image type.')
  const { data: { session } } = await client.auth.getSession()
  if (!session) throw new Error('Your session expired. Sign in again to upload an image.')
  const assetId = crypto.randomUUID()
  const ext = detectedType === 'image/jpeg' ? 'jpg' : detectedType === 'image/png' ? 'png' : 'webp'
  const path = `${session.user.id}/${assetId}.${ext}`
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/question-media/${path.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY)
    xhr.setRequestHeader('Content-Type', detectedType)
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)) }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? 'Image exceeds the storage size limit.' : 'Image upload was rejected. Check your faculty access and try again.'))
    xhr.onerror = () => reject(new Error('Network issue while uploading. Check your connection and retry.'))
    xhr.send(file)
  })
  const { error: metadataError } = await client.functions.invoke('register-question-media', { body: { assetId, path, altText: file.name } })
  if (metadataError) {
    throw new Error('The image could not be validated by the server. Please retry.')
  }
  const { data: signed, error: signedError } = await client.storage.from('question-media').createSignedUrl(path, 3600)
  if (signedError || !signed) throw new Error('Image is stored, but its preview could not be opened. Reload the editor to retry.')
  progress(100)
  return { assetId, url: signed.signedUrl }
}

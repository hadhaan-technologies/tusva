import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
// Supabase's current dashboard issues `sb_publishable_` keys. Keep the
// legacy anon variable as a fallback for existing deployments.
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && publishableKey ? createClient(url, publishableKey) : null

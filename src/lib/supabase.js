import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://byglymeulgeomoldhrrh.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_N7Es1GU_4yUNpun4qQDkWQ_4Lhl-6Ii'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Cache do rep_id
let cachedRepId = null

export async function getRepId() {
  if (cachedRepId) return cachedRepId

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('representantes')
    .select('id')
    .eq('email', user.email)
    .single()

  cachedRepId = data?.id || null
  return cachedRepId
}

export function clearRepIdCache() {
  cachedRepId = null
}

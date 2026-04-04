import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://byglymeulgeomoldhrrh.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_N7Es1GU_4yUNpun4qQDkWQ_4Lhl-6Ii'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Cache do rep_id
let cachedRepId = null

export async function getRepId() {
  if (cachedRepId) {
    console.log('[getRepId] Retornando do cache:', cachedRepId)
    return cachedRepId
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  console.log('[getRepId] User:', user, 'Error:', userError)

  if (!user) {
    console.log('[getRepId] Usuário não autenticado')
    return null
  }

  const { data, error } = await supabase
    .from('representantes')
    .select('id')
    .eq('email', user.email)
    .single()

  console.log('[getRepId] Query representantes:', { email: user.email, data, error })

  cachedRepId = data?.id || null
  return cachedRepId
}

export function clearRepIdCache() {
  cachedRepId = null
}

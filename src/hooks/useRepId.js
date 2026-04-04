import { useState, useEffect } from 'react'
import { getRepId, clearRepIdCache } from '../lib/supabase'

export function useRepId() {
  const [repId, setRepId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[useRepId] Iniciando busca do repId...')
    getRepId()
      .then(id => {
        console.log('[useRepId] repId obtido:', id)
        setRepId(id)
        setLoading(false)
      })
      .catch(err => {
        console.error('[useRepId] Erro:', err)
        setLoading(false)
      })
  }, [])

  return { repId, loading, clearCache: clearRepIdCache }
}

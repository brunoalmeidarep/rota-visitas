import { useState, useEffect } from 'react'
import { getRepId, clearRepIdCache } from '../lib/supabase'

export function useRepId() {
  const [repId, setRepId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRepId().then(id => {
      setRepId(id)
      setLoading(false)
    })
  }, [])

  return { repId, loading, clearCache: clearRepIdCache }
}

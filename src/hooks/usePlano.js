import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRepId } from './useRepId'

export function usePlano() {
  const { repId } = useRepId()
  const [plano, setPlano] = useState('starter')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!repId) return

    async function fetchPlano() {
      const { data } = await supabase
        .from('representantes')
        .select('plano')
        .eq('id', repId)
        .single()

      setPlano(data?.plano || 'starter')
      setLoading(false)
    }

    fetchPlano()
  }, [repId])

  const isPro = plano === 'pro' || plano === 'enterprise'
  const isEnterprise = plano === 'enterprise'

  return { plano, isPro, isEnterprise, loading }
}

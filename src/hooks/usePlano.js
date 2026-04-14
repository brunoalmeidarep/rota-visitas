import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export function usePlano() {
  const [plano, setPlano] = useState('starter')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregarPlano = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }

        const { data } = await supabase
          .from('representantes')
          .select('plano')
          .eq('auth_id', user.id)
          .single()

        setPlano(data?.plano || 'starter')
      } catch(e) {
        setPlano('starter')
      } finally {
        setLoading(false)
      }
    }

    carregarPlano()
  }, [])

  return {
    plano,
    loading,
    isPro: plano === 'pro' || plano === 'enterprise',
    isEnterprise: plano === 'enterprise',
    isStarter: plano === 'starter'
  }
}

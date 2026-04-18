import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export function usePlano() {
  const [plano, setPlano] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregarPlano = async () => {
      localStorage.removeItem('plano_usuario')
      localStorage.removeItem('user_plano')
      localStorage.removeItem('cached_plano')

      console.log('[usePlano] Carregando plano do banco...')

      try {
        const { data: { user } } = await supabase.auth.getUser()
        console.log('[usePlano] Usuario:', user?.id, user?.email)

        if (!user) {
          console.log('[usePlano] Sem usuario logado')
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('representantes')
          .select('plano')
          .eq('auth_id', user.id)
          .single()

        console.log('[usePlano] Resposta do banco:', { data, error })

        const planoFinal = (data?.plano || 'starter').toLowerCase()
        console.log('[usePlano] Plano definido:', planoFinal)
        setPlano(planoFinal)
      } catch(e) {
        console.error('[usePlano] Erro ao carregar plano:', e)
        setPlano('starter')
      } finally {
        setLoading(false)
      }
    }

    carregarPlano()
  }, [])

  return {
    plano: plano || 'starter',
    loading,
    isPro: plano === 'pro' || plano === 'enterprise',
    isEnterprise: plano === 'enterprise',
    isStarter: plano === 'starter' || plano === null
  }
}

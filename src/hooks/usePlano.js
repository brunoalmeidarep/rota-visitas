import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export function usePlano() {
  const [plano, setPlano] = useState('starter')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const carregarPlano = async () => {
      // Limpar qualquer cache antigo de plano
      localStorage.removeItem('plano_usuario')
      localStorage.removeItem('user_plano')
      localStorage.removeItem('cached_plano')

      console.log('[usePlano] Carregando plano do banco (sem cache)...')

      try {
        const { data: { user } } = await supabase.auth.getUser()
        console.log('[usePlano] Usuário:', user?.id, user?.email)

        if (!user) {
          console.log('[usePlano] Sem usuário logado')
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('representantes')
          .select('plano')
          .eq('auth_id', user.id)
          .single()

        console.log('[usePlano] Resposta do banco:', { data, error })

        const planoFinal = data?.plano || 'starter'
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

  const isPro = plano === 'pro' || plano === 'enterprise'
  const isEnterprise = plano === 'enterprise'
  const isStarter = plano === 'starter'

  return {
    plano,
    loading,
    isPro,
    isEnterprise,
    isStarter
  }
}

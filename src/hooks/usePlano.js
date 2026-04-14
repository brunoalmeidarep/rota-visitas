import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRepId } from './useRepId'

// Mock para desenvolvimento — trocar por RevenueCat em produção
const PLANO_MOCK = 'starter' // 'starter' | 'pro' | 'enterprise'
const USE_MOCK = true // Setar false para usar plano do banco

export function usePlano() {
  const { repId } = useRepId()
  const [plano, setPlano] = useState(USE_MOCK ? PLANO_MOCK : 'starter')
  const [loading, setLoading] = useState(!USE_MOCK)

  useEffect(() => {
    if (USE_MOCK || !repId) return

    async function fetchPlano() {
      // TODO produção: integrar RevenueCat SDK
      // const { customerInfo } = await Purchases.getCustomerInfo()
      // const planoAtivo = customerInfo.entitlements.active['pro'] ? 'pro' : 'starter'

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
  const isStarter = plano === 'starter'

  return { plano, isPro, isEnterprise, isStarter, loading }
}

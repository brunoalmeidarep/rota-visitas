import { useRepresentada } from '../contexts/RepresentadaContext'

export function usePlano() {
  const { representadaSelecionada, loading } = useRepresentada()

  const plano = (representadaSelecionada?.plano || 'starter').toLowerCase()

  return {
    plano,
    loading,
    isPro: plano === 'pro' || plano === 'enterprise',
    isEnterprise: plano === 'enterprise',
    isStarter: plano === 'starter'
  }
}

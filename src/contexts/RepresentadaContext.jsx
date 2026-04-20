import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRepId } from '../hooks/useRepId'

const RepresentadaContext = createContext(null)

export function RepresentadaProvider({ children }) {
  const { repId } = useRepId()
  const [representadas, setRepresentadas] = useState([])
  const [representadaSelecionada, setRepresentadaSelecionada] = useState(null)
  const [loading, setLoading] = useState(true)

  // Carregar representadas (PRO) e vínculos enterprise
  useEffect(() => {
    if (!repId) return

    async function fetchRepresentadas() {
      setLoading(true)

      try {
        // 1. Buscar representadas manuais do rep (plano PRO)
        const { data: representadasPro, error: errorPro } = await supabase
          .from('representadas')
          .select('*')
          .eq('rep_id', repId)
          .order('nome')

        if (errorPro) {
          console.error('[RepresentadaContext] Erro representadas PRO:', errorPro)
        }

        // Adicionar tipo/plano às representadas PRO
        const proList = (representadasPro || []).map(r => ({
          ...r,
          tipo: 'representada',
          plano: 'pro'
        }))

        // 2. Buscar vínculos enterprise (representante_empresas JOIN empresas)
        const { data: vinculosEnterprise, error: errorEnterprise } = await supabase
          .from('representante_empresas')
          .select(`
            rep_id,
            empresa_id,
            plano,
            codigo,
            empresas (
              id,
              nome,
              logo_url,
              cor_primaria
            )
          `)
          .eq('rep_id', repId)
          .eq('ativo', true)

        if (errorEnterprise) {
          console.error('[RepresentadaContext] Erro vínculos Enterprise:', errorEnterprise)
        }

        // Transformar vínculos enterprise em formato compatível
        const enterpriseList = (vinculosEnterprise || [])
          .filter(v => v.empresas) // Só incluir se a empresa existe
          .map(v => ({
            id: v.empresa_id,
            nome: v.empresas.nome,
            logo_url: v.empresas.logo_url,
            cor_primaria: v.empresas.cor_primaria,
            tipo: 'empresa',
            plano: v.plano || 'enterprise',
            empresa_id: v.empresa_id
          }))

        // 3. Unificar as duas listas
        const todasRepresentadas = [...proList, ...enterpriseList]
        console.log('[RepresentadaContext] PRO:', proList.length, 'Enterprise:', enterpriseList.length)

        setRepresentadas(todasRepresentadas)

        // Restaurar selecionada do localStorage ou usar a primeira
        const salvaId = localStorage.getItem('representada_selecionada')
        if (salvaId && todasRepresentadas.find(r => r.id === salvaId)) {
          setRepresentadaSelecionada(todasRepresentadas.find(r => r.id === salvaId))
        } else if (todasRepresentadas.length > 0) {
          setRepresentadaSelecionada(todasRepresentadas[0])
          localStorage.setItem('representada_selecionada', todasRepresentadas[0].id)
        }
      } catch (err) {
        console.error('[RepresentadaContext] Erro geral:', err)
      }

      setLoading(false)
    }

    fetchRepresentadas()
  }, [repId])

  // Funcao para trocar representada
  function trocarRepresentada(representada) {
    setRepresentadaSelecionada(representada)
    localStorage.setItem('representada_selecionada', representada.id)
  }

  // Funcao para recarregar representadas
  async function recarregarRepresentadas() {
    if (!repId) return

    // 1. Representadas PRO
    const { data: representadasPro } = await supabase
      .from('representadas')
      .select('*')
      .eq('rep_id', repId)
      .order('nome')

    const proList = (representadasPro || []).map(r => ({
      ...r,
      tipo: 'representada',
      plano: 'pro'
    }))

    // 2. Vínculos Enterprise
    const { data: vinculosEnterprise } = await supabase
      .from('representante_empresas')
      .select(`
        rep_id,
        empresa_id,
        plano,
        codigo,
        empresas (
          id,
          nome,
          logo_url,
          cor_primaria
        )
      `)
      .eq('rep_id', repId)
      .eq('ativo', true)

    const enterpriseList = (vinculosEnterprise || [])
      .filter(v => v.empresas)
      .map(v => ({
        id: v.empresa_id,
        nome: v.empresas.nome,
        logo_url: v.empresas.logo_url,
        cor_primaria: v.empresas.cor_primaria,
        tipo: 'empresa',
        plano: v.plano || 'enterprise',
        empresa_id: v.empresa_id
      }))

    const todasRepresentadas = [...proList, ...enterpriseList]
    setRepresentadas(todasRepresentadas)

    // Se a selecionada nao existe mais, selecionar a primeira
    if (representadaSelecionada && !todasRepresentadas.find(r => r.id === representadaSelecionada.id)) {
      if (todasRepresentadas.length > 0) {
        setRepresentadaSelecionada(todasRepresentadas[0])
        localStorage.setItem('representada_selecionada', todasRepresentadas[0].id)
      } else {
        setRepresentadaSelecionada(null)
        localStorage.removeItem('representada_selecionada')
      }
    }
  }

  // Helper para verificar se a selecionada é enterprise
  const isEnterprise = representadaSelecionada?.plano === 'enterprise'

  return (
    <RepresentadaContext.Provider value={{
      representadas,
      representadaSelecionada,
      trocarRepresentada,
      recarregarRepresentadas,
      loading,
      isEnterprise
    }}>
      {children}
    </RepresentadaContext.Provider>
  )
}

export function useRepresentada() {
  const context = useContext(RepresentadaContext)
  if (!context) {
    throw new Error('useRepresentada deve ser usado dentro de RepresentadaProvider')
  }
  return context
}

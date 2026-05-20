import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRepId } from '../hooks/useRepId'
import { useSync } from '../hooks/useSync'

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
        // 1. Buscar representadas manuais do rep
        const { data: representadasPro, error: errorPro } = await supabase
          .from('representadas')
          .select('*')
          .eq('rep_id', repId)
          .order('nome')

        if (errorPro) {
          console.error('[RepresentadaContext] Erro representadas PRO:', errorPro)
        }

        // Adicionar tipo/plano às representadas manuais (PRO por padrão)
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
            codigo,
            empresas (
              id,
              nome,
              logo_url,
              cor_primaria,
              plano,
              plano_ativo
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
            plano: v.empresas?.plano_ativo === false
              ? 'starter'
              : (v.empresas?.plano || 'enterprise'),
            empresa_id: v.empresa_id
          }))

        // Debug logs
        console.log('[Enterprise] repId:', repId)
        console.log('[Enterprise] vinculosEnterprise:', vinculosEnterprise)
        console.log('[Enterprise] errorEnterprise:', errorEnterprise)
        console.log('[Enterprise] enterpriseList:', enterpriseList)

        // 3. Deduplicar: se Enterprise já cobre uma empresa (mesmo nome),
        // remove da lista PRO. Enterprise tem prioridade.
        const nomesEnterprise = new Set(
          enterpriseList.map(e => e.nome.toLowerCase().trim())
        )
        const proListFiltrada = proList.filter(p =>
          !nomesEnterprise.has(p.nome.toLowerCase().trim())
        )

        // 4. Unificar: Enterprise primeiro, depois PRO filtrada
        const todasRepresentadas = [...enterpriseList, ...proListFiltrada]
        console.log('[RepresentadaContext] Enterprise:', enterpriseList.length, 'PRO:', proListFiltrada.length)

        setRepresentadas(todasRepresentadas)

        // Restaurar selecionada do localStorage com validação
        const salvaId = localStorage.getItem('representada_selecionada')
        const encontrada = todasRepresentadas.find(r => r.id === salvaId)
        if (encontrada) {
          setRepresentadaSelecionada(encontrada)
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
    if (!representada) return
    setRepresentadaSelecionada(representada)
    localStorage.setItem('representada_selecionada', representada.id)
    // Dispara sync da nova empresa em background
    const novoEmpresaId = representada.plano === 'enterprise' ? representada.empresa_id : representada.id
    if (sync && sync.sincronizar && novoEmpresaId) {
      sync.sincronizar(true).catch(err => {
        console.warn('[RepresentadaContext] Erro ao sincronizar após troca:', err)
      })
    }
  }

  // Funcao para recarregar representadas
  async function recarregarRepresentadas() {
    if (!repId) return

    // 1. Representadas manuais
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
        codigo,
        empresas (
          id,
          nome,
          logo_url,
          cor_primaria,
          plano,
          plano_ativo
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
        plano: v.empresas?.plano_ativo === false
              ? 'starter'
              : (v.empresas?.plano || 'enterprise'),
        empresa_id: v.empresa_id
      }))

    // Deduplicar: Enterprise tem prioridade sobre PRO com mesmo nome
    const nomesEnterprise = new Set(
      enterpriseList.map(e => e.nome.toLowerCase().trim())
    )
    const proListFiltrada = proList.filter(p =>
      !nomesEnterprise.has(p.nome.toLowerCase().trim())
    )

    const todasRepresentadas = [...enterpriseList, ...proListFiltrada]
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

  // Determina qual ID usar pra sincronização
  // Enterprise: usa empresa_id. PRO: usa id da representada (a representada PRO É a empresa do rep no schema)
  const empresaIdParaSync = representadaSelecionada
    ? (representadaSelecionada.plano === 'enterprise'
        ? representadaSelecionada.empresa_id
        : representadaSelecionada.id)
    : null

  const sync = useSync(empresaIdParaSync)

  return (
    <RepresentadaContext.Provider value={{
      representadas,
      representadaSelecionada,
      trocarRepresentada,
      recarregarRepresentadas,
      loading,
      isEnterprise,
      sync
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

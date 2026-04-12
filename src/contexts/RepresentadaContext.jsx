import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRepId } from '../hooks/useRepId'

const RepresentadaContext = createContext(null)

export function RepresentadaProvider({ children }) {
  const { repId } = useRepId()
  const [representadas, setRepresentadas] = useState([])
  const [representadaSelecionada, setRepresentadaSelecionada] = useState(null)
  const [loading, setLoading] = useState(true)

  // Carregar representadas do banco
  useEffect(() => {
    if (!repId) return

    async function fetchRepresentadas() {
      setLoading(true)
      const { data, error } = await supabase
        .from('representadas')
        .select('*')
        .eq('rep_id', repId)
        .order('nome')

      if (error) {
        console.error('[RepresentadaContext] Erro:', error)
      } else {
        setRepresentadas(data || [])

        // Restaurar selecionada do localStorage ou usar a primeira
        const salvaId = localStorage.getItem('representada_selecionada')
        if (salvaId && data?.find(r => r.id === salvaId)) {
          setRepresentadaSelecionada(data.find(r => r.id === salvaId))
        } else if (data && data.length > 0) {
          setRepresentadaSelecionada(data[0])
          localStorage.setItem('representada_selecionada', data[0].id)
        }
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

    const { data } = await supabase
      .from('representadas')
      .select('*')
      .eq('rep_id', repId)
      .order('nome')

    if (data) {
      setRepresentadas(data)
      // Se a selecionada nao existe mais, selecionar a primeira
      if (representadaSelecionada && !data.find(r => r.id === representadaSelecionada.id)) {
        if (data.length > 0) {
          setRepresentadaSelecionada(data[0])
          localStorage.setItem('representada_selecionada', data[0].id)
        } else {
          setRepresentadaSelecionada(null)
          localStorage.removeItem('representada_selecionada')
        }
      }
    }
  }

  return (
    <RepresentadaContext.Provider value={{
      representadas,
      representadaSelecionada,
      trocarRepresentada,
      recarregarRepresentadas,
      loading
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

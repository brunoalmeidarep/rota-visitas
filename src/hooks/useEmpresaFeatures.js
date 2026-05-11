import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRepresentada } from '../contexts/RepresentadaContext'

export function useEmpresaFeatures() {
  const { representadaSelecionada } = useRepresentada()
  const [features, setFeatures] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!representadaSelecionada) {
      setFeatures({})
      setLoading(false)
      return
    }

    const empresaId = representadaSelecionada.empresa_id

    if (!empresaId) {
      setFeatures({})
      setLoading(false)
      return
    }

    async function fetchFeatures() {
      setLoading(true)

      const { data, error } = await supabase
        .from('empresas')
        .select('features')
        .eq('id', empresaId)
        .single()

      if (error) {
        console.error('[useEmpresaFeatures] Erro:', error)
        setFeatures({})
      } else {
        setFeatures(data?.features || {})
      }

      setLoading(false)
    }

    fetchFeatures()
  }, [representadaSelecionada?.empresa_id])

  return { features, loading }
}

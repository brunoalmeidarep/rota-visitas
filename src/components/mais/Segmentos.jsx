import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './Segmentos.css'

function Segmentos() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()

  const [segmentos, setSegmentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Carregar segmentos
  useEffect(() => {
    if (!repId) return

    async function fetchSegmentos() {
      setLoading(true)
      const { data, error } = await supabase
        .from('segmentos')
        .select('*')
        .eq('rep_id', repId)
        .order('nome')

      if (error) {
        console.error('[Segmentos] Erro:', error)
      } else {
        setSegmentos(data || [])
      }
      setLoading(false)
    }

    fetchSegmentos()
  }, [repId])

  async function adicionarSegmento() {
    if (!novoNome.trim()) return

    setSalvando(true)

    try {
      const { data, error } = await supabase
        .from('segmentos')
        .insert({
          rep_id: repId,
          nome: novoNome.trim()
        })
        .select()
        .single()

      if (error) {
        console.error('[Segmentos] Erro ao adicionar:', error)
        alert('Erro ao adicionar segmento')
      } else {
        setSegmentos([...segmentos, data].sort((a, b) => a.nome.localeCompare(b.nome)))
        setNovoNome('')
      }
    } catch (err) {
      console.error('[Segmentos] Excecao:', err)
      alert('Erro ao adicionar')
    }

    setSalvando(false)
  }

  async function excluirSegmento(id) {
    if (!confirm('Deseja excluir este segmento?')) return

    try {
      const { error } = await supabase
        .from('segmentos')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[Segmentos] Erro ao excluir:', error)
        alert('Erro ao excluir')
      } else {
        setSegmentos(segmentos.filter(s => s.id !== id))
      }
    } catch (err) {
      console.error('[Segmentos] Excecao:', err)
      alert('Erro ao excluir')
    }
  }

  if (loadingRep || loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="segmentos">
      <header className="seg-header">
        <button className="seg-voltar" onClick={() => navigate('/mais')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Segmentos</h1>
        <div style={{ width: 36 }}></div>
      </header>

      <div className="seg-content">
        {/* Campo para adicionar */}
        <div className="seg-add">
          <input
            type="text"
            placeholder="Nome do segmento"
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && adicionarSegmento()}
          />
          <button onClick={adicionarSegmento} disabled={salvando || !novoNome.trim()}>
            {salvando ? '...' : 'Salvar'}
          </button>
        </div>

        {/* Lista */}
        {segmentos.length === 0 && (
          <p className="seg-vazio">Nenhum segmento cadastrado</p>
        )}

        <div className="seg-lista">
          {segmentos.map((seg) => (
            <div key={seg.id} className="seg-item">
              <span>{seg.nome}</span>
              <button onClick={() => excluirSegmento(seg.id)}>X</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Segmentos

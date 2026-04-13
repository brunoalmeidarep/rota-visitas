import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './Tarefas.css'

function Tarefas() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()

  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const [novaTarefa, setNovaTarefa] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [toast, setToast] = useState('')

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 2000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    if (!repId) return
    fetchTarefas()
  }, [repId])

  async function fetchTarefas() {
    setLoading(true)

    const { data, error } = await supabase
      .from('tarefas')
      .select('*')
      .eq('rep_id', repId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Tarefas] Erro ao carregar:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
    }

    setTarefas(data || [])
    setLoading(false)
  }

  async function handleToggle(tarefa) {
    const novaConcluida = !tarefa.concluida

    // Atualiza otimisticamente
    setTarefas(prev => prev.map(t =>
      t.id === tarefa.id ? { ...t, concluida: novaConcluida } : t
    ))

    const { error } = await supabase
      .from('tarefas')
      .update({ concluida: novaConcluida })
      .eq('id', tarefa.id)

    if (error) {
      console.error('[Tarefas] Erro ao atualizar:', error)
      // Reverter se falhou
      setTarefas(prev => prev.map(t =>
        t.id === tarefa.id ? { ...t, concluida: !novaConcluida } : t
      ))
    }
  }

  async function handleAdd() {
    if (!novaTarefa.trim()) {
      alert('Digite o texto da tarefa')
      return
    }

    if (!repId) {
      alert('Erro: rep_id não encontrado. Faça login novamente.')
      console.error('[Tarefas] repId não disponível')
      return
    }

    setSalvando(true)

    const registro = {
      rep_id: repId,
      texto: novaTarefa.trim(),
      concluida: false
    }

    console.log('[Tarefas] Inserindo tarefa:', JSON.stringify(registro, null, 2))

    const { data, error } = await supabase
      .from('tarefas')
      .insert(registro)
      .select()
      .single()

    if (error) {
      console.error('[Tarefas] Erro Supabase:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      alert(`Erro ao salvar: ${error.message || error.details || 'Erro desconhecido'}`)
      setSalvando(false)
      return
    }

    console.log('[Tarefas] Tarefa salva com sucesso:', data)

    // Adicionar à lista local
    setTarefas(prev => [data, ...prev])
    setNovaTarefa('')
    setMostrarForm(false)
    setToast('Tarefa adicionada!')
    setSalvando(false)
  }

  async function handleDelete(id) {
    const confirma = confirm('Excluir esta tarefa?')
    if (!confirma) return

    // Remove otimisticamente
    const tarefaRemovida = tarefas.find(t => t.id === id)
    setTarefas(prev => prev.filter(t => t.id !== id))

    const { error } = await supabase
      .from('tarefas')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Tarefas] Erro ao excluir:', error)
      // Reverter se falhou
      if (tarefaRemovida) {
        setTarefas(prev => [...prev, tarefaRemovida])
      }
    }
  }

  // Separar pendentes e concluídas
  const pendentes = tarefas.filter(t => !t.concluida)
  const concluidas = tarefas.filter(t => t.concluida)

  if (loadingRep) {
    return <div className="tarefas"><div className="tarefas-loading">Carregando...</div></div>
  }

  return (
    <div className="tarefas">
      {/* Header */}
      <header className="tarefas-header">
        <button className="tarefas-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Tarefas</h1>
        <button className="tarefas-add-btn" onClick={() => setMostrarForm(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </header>

      <div className="tarefas-content">
        {loading ? (
          <div className="tarefas-loading">Carregando...</div>
        ) : tarefas.length === 0 && !mostrarForm ? (
          <div className="tarefas-vazio">
            <span className="tarefas-vazio-icon">☑️</span>
            <p>Nenhuma tarefa</p>
            <button onClick={() => setMostrarForm(true)}>+ Adicionar tarefa</button>
          </div>
        ) : (
          <>
            {/* Form nova tarefa */}
            {mostrarForm && (
              <div className="tarefas-form">
                <input
                  type="text"
                  placeholder="O que precisa fazer?"
                  value={novaTarefa}
                  onChange={(e) => setNovaTarefa(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                  autoFocus
                />
                <div className="tarefas-form-actions">
                  <button className="btn-cancelar" onClick={() => {
                    setMostrarForm(false)
                    setNovaTarefa('')
                  }}>
                    Cancelar
                  </button>
                  <button
                    className="btn-salvar"
                    onClick={handleAdd}
                    disabled={salvando}
                  >
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            )}

            {/* Pendentes */}
            {pendentes.length > 0 && (
              <section className="tarefas-grupo">
                <h2 className="tarefas-grupo-titulo">
                  Pendentes ({pendentes.length})
                </h2>
                <div className="tarefas-lista">
                  {pendentes.map(tarefa => (
                    <div key={tarefa.id} className="tarefa-item">
                      <button
                        className="tarefa-check"
                        onClick={() => handleToggle(tarefa)}
                      >
                        <span className="tarefa-check-box"></span>
                      </button>
                      <div className="tarefa-info">
                        <span className="tarefa-texto">{tarefa.texto}</span>
                      </div>
                      <button className="tarefa-delete" onClick={() => handleDelete(tarefa.id)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Concluídas */}
            {concluidas.length > 0 && (
              <section className="tarefas-grupo">
                <h2 className="tarefas-grupo-titulo concluidas">
                  Concluídas ({concluidas.length})
                </h2>
                <div className="tarefas-lista">
                  {concluidas.map(tarefa => (
                    <div key={tarefa.id} className="tarefa-item concluida">
                      <button
                        className="tarefa-check checked"
                        onClick={() => handleToggle(tarefa)}
                      >
                        <span className="tarefa-check-box">✓</span>
                      </button>
                      <div className="tarefa-info">
                        <span className="tarefa-texto">{tarefa.texto}</span>
                      </div>
                      <button className="tarefa-delete" onClick={() => handleDelete(tarefa.id)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="tarefas-toast">{toast}</div>
      )}
    </div>
  )
}

export default Tarefas

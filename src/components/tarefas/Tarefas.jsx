import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './Tarefas.css'

function Tarefas() {
  const navigate = useNavigate()
  const { repId } = useRepId()

  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const [novaTarefa, setNovaTarefa] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [dataVencimento, setDataVencimento] = useState('')

  useEffect(() => {
    if (!repId) return
    fetchTarefas()
  }, [repId])

  async function fetchTarefas() {
    setLoading(true)
    const { data } = await supabase
      .from('tarefas')
      .select('*')
      .eq('rep_id', repId)
      .order('data', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    setTarefas(data || [])
    setLoading(false)
  }

  async function handleToggle(tarefa) {
    const novaConcluida = !tarefa.concluida

    // Atualiza otimisticamente
    setTarefas(prev => prev.map(t =>
      t.id === tarefa.id ? { ...t, concluida: novaConcluida } : t
    ))

    await supabase
      .from('tarefas')
      .update({ concluida: novaConcluida })
      .eq('id', tarefa.id)
  }

  async function handleAdd() {
    if (!novaTarefa.trim()) return

    const nova = {
      rep_id: repId,
      titulo: novaTarefa.trim(),
      data: dataVencimento || null,
      concluida: false
    }

    const { data } = await supabase
      .from('tarefas')
      .insert(nova)
      .select()
      .single()

    if (data) {
      setTarefas(prev => [data, ...prev])
    }

    setNovaTarefa('')
    setDataVencimento('')
    setMostrarForm(false)
  }

  async function handleDelete(id) {
    const confirma = confirm('Excluir esta tarefa?')
    if (!confirma) return

    setTarefas(prev => prev.filter(t => t.id !== id))

    await supabase
      .from('tarefas')
      .delete()
      .eq('id', id)
  }

  // Agrupar tarefas
  const hoje = new Date().toISOString().split('T')[0]

  const atrasadas = tarefas.filter(t => !t.concluida && t.data && t.data < hoje)
  const paraHoje = tarefas.filter(t => !t.concluida && t.data === hoje)
  const semData = tarefas.filter(t => !t.concluida && !t.data)
  const proximas = tarefas.filter(t => !t.concluida && t.data && t.data > hoje)
  const concluidas = tarefas.filter(t => t.concluida)

  function formatarData(data) {
    if (!data) return ''
    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}`
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
                  placeholder="Nova tarefa..."
                  value={novaTarefa}
                  onChange={(e) => setNovaTarefa(e.target.value)}
                  autoFocus
                />
                <input
                  type="date"
                  value={dataVencimento}
                  onChange={(e) => setDataVencimento(e.target.value)}
                  placeholder="Data (opcional)"
                />
                <div className="tarefas-form-actions">
                  <button className="btn-cancelar" onClick={() => {
                    setMostrarForm(false)
                    setNovaTarefa('')
                    setDataVencimento('')
                  }}>
                    Cancelar
                  </button>
                  <button className="btn-salvar" onClick={handleAdd}>
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            {/* Atrasadas */}
            {atrasadas.length > 0 && (
              <section className="tarefas-grupo">
                <h2 className="tarefas-grupo-titulo atrasada">
                  Atrasadas ({atrasadas.length})
                </h2>
                <div className="tarefas-lista">
                  {atrasadas.map(tarefa => (
                    <div key={tarefa.id} className="tarefa-item atrasada">
                      <button
                        className="tarefa-check"
                        onClick={() => handleToggle(tarefa)}
                      >
                        <span className="tarefa-check-box"></span>
                      </button>
                      <div className="tarefa-info">
                        <span className="tarefa-titulo">{tarefa.titulo}</span>
                        <span className="tarefa-data atrasada">{formatarData(tarefa.data)}</span>
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

            {/* Hoje */}
            {paraHoje.length > 0 && (
              <section className="tarefas-grupo">
                <h2 className="tarefas-grupo-titulo hoje">
                  Hoje ({paraHoje.length})
                </h2>
                <div className="tarefas-lista">
                  {paraHoje.map(tarefa => (
                    <div key={tarefa.id} className="tarefa-item">
                      <button
                        className="tarefa-check"
                        onClick={() => handleToggle(tarefa)}
                      >
                        <span className="tarefa-check-box"></span>
                      </button>
                      <div className="tarefa-info">
                        <span className="tarefa-titulo">{tarefa.titulo}</span>
                        <span className="tarefa-data hoje">Hoje</span>
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

            {/* Sem data */}
            {semData.length > 0 && (
              <section className="tarefas-grupo">
                <h2 className="tarefas-grupo-titulo">
                  Sem data ({semData.length})
                </h2>
                <div className="tarefas-lista">
                  {semData.map(tarefa => (
                    <div key={tarefa.id} className="tarefa-item">
                      <button
                        className="tarefa-check"
                        onClick={() => handleToggle(tarefa)}
                      >
                        <span className="tarefa-check-box"></span>
                      </button>
                      <div className="tarefa-info">
                        <span className="tarefa-titulo">{tarefa.titulo}</span>
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

            {/* Próximas */}
            {proximas.length > 0 && (
              <section className="tarefas-grupo">
                <h2 className="tarefas-grupo-titulo">
                  Proximas ({proximas.length})
                </h2>
                <div className="tarefas-lista">
                  {proximas.map(tarefa => (
                    <div key={tarefa.id} className="tarefa-item">
                      <button
                        className="tarefa-check"
                        onClick={() => handleToggle(tarefa)}
                      >
                        <span className="tarefa-check-box"></span>
                      </button>
                      <div className="tarefa-info">
                        <span className="tarefa-titulo">{tarefa.titulo}</span>
                        <span className="tarefa-data">{formatarData(tarefa.data)}</span>
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
                  Concluidas ({concluidas.length})
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
                        <span className="tarefa-titulo">{tarefa.titulo}</span>
                        {tarefa.data && (
                          <span className="tarefa-data">{formatarData(tarefa.data)}</span>
                        )}
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
    </div>
  )
}

export default Tarefas

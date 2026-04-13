import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './VisitasRelatorio.css'

function VisitasRelatorio() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const [isDark, setIsDark] = useState(false)

  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('semana') // hoje, semana, mes, custom
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [mostrarCustom, setMostrarCustom] = useState(false)

  const [visitas, setVisitas] = useState([])
  const [totalVisitas, setTotalVisitas] = useState(0)
  const [clientesVisitados, setClientesVisitados] = useState(0)
  const [mediaPorDia, setMediaPorDia] = useState(0)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!repId) return
    fetchVisitas()
  }, [repId, filtro, dataInicio, dataFim])

  function getPeriodo() {
    const hoje = new Date()
    let inicio, fim

    if (filtro === 'hoje') {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
      fim = hoje
    } else if (filtro === 'semana') {
      const diaSemana = hoje.getDay()
      const diff = diaSemana === 0 ? 6 : diaSemana - 1
      inicio = new Date(hoje)
      inicio.setDate(hoje.getDate() - diff)
      inicio.setHours(0, 0, 0, 0)
      fim = hoje
    } else if (filtro === 'mes') {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      fim = hoje
    } else if (filtro === 'custom' && dataInicio && dataFim) {
      inicio = new Date(dataInicio)
      fim = new Date(dataFim)
    } else {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 7)
      fim = hoje
    }

    return { inicio, fim }
  }

  async function fetchVisitas() {
    setLoading(true)

    const { inicio, fim } = getPeriodo()

    const { data } = await supabase
      .from('visitas')
      .select('*')
      .eq('rep_id', repId)
      .gte('data', inicio.toISOString().split('T')[0])
      .lte('data', fim.toISOString().split('T')[0])
      .order('data', { ascending: false })
      .order('created_at', { ascending: false })

    const visitasData = data || []

    // Calcular stats
    const total = visitasData.length
    const clientesUnicos = new Set(visitasData.map(v => v.cliente_id)).size

    // Calcular dias no periodo
    const diffTime = Math.abs(fim - inicio)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1
    const media = total / diffDays

    setVisitas(visitasData)
    setTotalVisitas(total)
    setClientesVisitados(clientesUnicos)
    setMediaPorDia(media)
    setLoading(false)
  }

  function agruparPorData(items) {
    const grupos = {}
    items.forEach(item => {
      const data = item.data || 'sem-data'
      if (!grupos[data]) {
        grupos[data] = []
      }
      grupos[data].push(item)
    })
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([data, items]) => ({
        data,
        label: formatarDataGrupo(data),
        items
      }))
  }

  function formatarDataGrupo(dataStr) {
    if (dataStr === 'sem-data') return 'Sem data'
    const hoje = new Date().toISOString().split('T')[0]
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    if (dataStr === hoje) return 'Hoje'
    if (dataStr === ontem) return 'Ontem'

    const d = new Date(dataStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })
  }

  function formatarHora(dataStr) {
    if (!dataStr) return ''
    const d = new Date(dataStr)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  function aplicarCustom() {
    if (dataInicio && dataFim) {
      setFiltro('custom')
      setMostrarCustom(false)
    }
  }

  const grupos = agruparPorData(visitas)

  return (
    <div className={`visitas-relatorio ${isDark ? 'dark' : 'light'}`}>
      <header className="vr-header">
        <button className="vr-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Relatorio de Visitas</h1>
        <button className="vr-export" onClick={() => alert('Exportar - em desenvolvimento')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </header>

      {/* Filtros */}
      <div className="vr-filtros">
        <button
          className={`vr-filtro ${filtro === 'hoje' ? 'active' : ''}`}
          onClick={() => setFiltro('hoje')}
        >
          Hoje
        </button>
        <button
          className={`vr-filtro ${filtro === 'semana' ? 'active' : ''}`}
          onClick={() => setFiltro('semana')}
        >
          Semana
        </button>
        <button
          className={`vr-filtro ${filtro === 'mes' ? 'active' : ''}`}
          onClick={() => setFiltro('mes')}
        >
          Mes
        </button>
        <button
          className={`vr-filtro ${filtro === 'custom' ? 'active' : ''}`}
          onClick={() => setMostrarCustom(true)}
        >
          Custom
        </button>
      </div>

      <div className="vr-content">
        {loading ? (
          <div className="vr-loading">Carregando...</div>
        ) : (
          <>
            {/* Stats */}
            <div className="vr-stats">
              <div className="vr-stat">
                <span className="vr-stat-valor">{totalVisitas}</span>
                <span className="vr-stat-label">visitas</span>
              </div>
              <div className="vr-stat">
                <span className="vr-stat-valor">{clientesVisitados}</span>
                <span className="vr-stat-label">clientes</span>
              </div>
              <div className="vr-stat">
                <span className="vr-stat-valor">{mediaPorDia.toFixed(1)}</span>
                <span className="vr-stat-label">media/dia</span>
              </div>
            </div>

            {/* Lista */}
            {visitas.length === 0 ? (
              <div className="vr-vazio">
                <span className="vr-vazio-icon">✅</span>
                <p>Nenhuma visita no periodo</p>
              </div>
            ) : (
              <div className="vr-lista">
                {grupos.map((grupo, idx) => (
                  <div key={idx} className="vr-grupo">
                    <div className="vr-grupo-header">
                      <span className="vr-grupo-data">{grupo.label}</span>
                      <span className="vr-grupo-count">{grupo.items.length}</span>
                    </div>
                    {grupo.items.map(visita => (
                      <div
                        key={visita.id}
                        className="vr-item"
                        onClick={() => navigate(`/clientes/${visita.cliente_id}`)}
                      >
                        <div className="vr-item-info">
                          <span className="vr-item-nome">{visita.cliente_nome || 'Cliente'}</span>
                          <span className="vr-item-meta">
                            {visita.cliente_cidade || '-'}
                            {visita.created_at && ` • ${formatarHora(visita.created_at)}`}
                          </span>
                          {visita.observacao && (
                            <span className="vr-item-obs">
                              {visita.observacao.length > 60
                                ? visita.observacao.substring(0, 60) + '...'
                                : visita.observacao}
                            </span>
                          )}
                        </div>
                        <div className="vr-item-right">
                          <span className={`vr-item-canal ${visita.canal || 'presencial'}`}>
                            {visita.canal === 'whatsapp' ? '💬' : '✅'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal personalizado */}
      {mostrarCustom && (
        <div className="vr-modal-overlay" onClick={() => setMostrarCustom(false)}>
          <div className="vr-modal" onClick={e => e.stopPropagation()}>
            <h3>Periodo personalizado</h3>
            <div className="vr-modal-campo">
              <label>Data inicio</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
              />
            </div>
            <div className="vr-modal-campo">
              <label>Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
              />
            </div>
            <div className="vr-modal-acoes">
              <button className="vr-modal-cancelar" onClick={() => setMostrarCustom(false)}>
                Cancelar
              </button>
              <button className="vr-modal-aplicar" onClick={aplicarCustom}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VisitasRelatorio

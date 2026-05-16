import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { dataLocal, dataOntem } from '../../lib/data'
import { useRepId } from '../../hooks/useRepId'
import './VisitasRelatorio.css'

function VisitasRelatorio() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const [isDark, setIsDark] = useState(false)

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [filtro, setFiltro] = useState('semana') // hoje, semana, mes, custom
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [mostrarCustom, setMostrarCustom] = useState(false)

  const [visitas, setVisitas] = useState([])
  const [totalVisitas, setTotalVisitas] = useState(0)
  const [clientesVisitados, setClientesVisitados] = useState(0)
  const [mediaPorDia, setMediaPorDia] = useState(0)
  const [nomeRep, setNomeRep] = useState('')

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
    fetchNomeRep()
  }, [repId, filtro, dataInicio, dataFim])

  async function fetchNomeRep() {
    const { data } = await supabase
      .from('representantes')
      .select('nome')
      .eq('id', repId)
      .single()
    if (data?.nome) setNomeRep(data.nome)
  }

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
    setErro(null)

    // Timeout de 10 segundos
    const timeout = setTimeout(() => {
      setLoading(false)
      setErro('Tempo esgotado. Tente novamente.')
    }, 10000)

    try {
      const { inicio, fim } = getPeriodo()

      console.log('[VisitasRelatorio] Buscando visitas:', {
        rep_id: repId,
        data_inicio: inicio.toISOString().split('T')[0],
        data_fim: fim.toISOString().split('T')[0]
      })

      const inicioStr = inicio.toISOString().split('T')[0]
      const fimStr = fim.toISOString().split('T')[0]

      const todas = await db.visitas.where('rep_id').equals(repId).toArray()
      const data = todas
        .filter(v => v.data >= inicioStr && v.data <= fimStr)
        .sort((a, b) => {
          const cmpData = (b.data || '').localeCompare(a.data || '')
          if (cmpData !== 0) return cmpData
          return (b.criado_em || '').localeCompare(a.criado_em || '')
        })

      clearTimeout(timeout)

      console.log('[VisitasRelatorio] Visitas encontradas:', data?.length || 0)

      const visitasData = data || []

      // Calcular stats — uma visita = um cliente único por dia
      const visitasUnicasPorClienteDia = new Set(
        visitasData.map(v => `${v.data || 'sem-data'}|${v.cliente_id || v.id}`)
      )
      const total = visitasUnicasPorClienteDia.size
      const clientesUnicos = new Set(visitasData.map(v => v.cliente_id)).size

      // Calcular dias no período
      const diffTime = Math.abs(fim - inicio)
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1
      const media = total / diffDays

      setVisitas(visitasData)
      setTotalVisitas(total)
      setClientesVisitados(clientesUnicos)
      setMediaPorDia(media)
      setLoading(false)
    } catch (err) {
      clearTimeout(timeout)
      console.error('[VisitasRelatorio] Exceção:', err)
      setErro('Erro ao processar dados')
      setLoading(false)
    }
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

    // Para cada dia, deduplica por cliente (mantém apenas 1 visita por cliente/dia)
    // Como as visitas já vêm ordenadas por created_at desc, pegamos a mais recente.
    // Se preferir a primeira do dia, inverter ordem do array antes do dedupe.
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([data, itensDoDia]) => {
        const vistosClientes = new Set()
        const itensDeduplicados = []
        for (const visita of itensDoDia) {
          const chave = visita.cliente_id || visita.id
          if (!vistosClientes.has(chave)) {
            vistosClientes.add(chave)
            itensDeduplicados.push(visita)
          }
        }
        return {
          data,
          label: formatarDataGrupo(data),
          items: itensDeduplicados
        }
      })
  }

  function formatarDataGrupo(dataStr) {
    if (dataStr === 'sem-data') return 'Sem data'
    const hoje = dataLocal()
    const ontem = dataOntem()

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

  function getPeriodoLabel() {
    if (filtro === 'hoje') return 'Hoje'
    if (filtro === 'semana') return 'Semana atual'
    if (filtro === 'mes') return 'Mes atual'
    if (filtro === 'custom' && dataInicio && dataFim) {
      return `${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`
    }
    return ''
  }

  function exportarPDF() {
    if (visitas.length === 0) {
      alert('Nenhum dado para exportar')
      return
    }

    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')

    navigate('/relatorios/pdf', {
      state: {
        tipo: 'visitas',
        dados: {
          visitas,
          totalVisitas,
          clientesVisitados,
          mediaPorDia,
          nomeRep,
          periodo: getPeriodoLabel()
        },
        nomeArquivo: `visitas-${hoje}.pdf`,
        titulo: 'Relatório de Visitas'
      }
    })
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
        <h1>Relatório de Visitas</h1>
        <button className="vr-export" onClick={exportarPDF} disabled={loading || visitas.length === 0}>
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
        ) : erro ? (
          <div className="vr-vazio">
            <span className="vr-vazio-icon">⚠️</span>
            <p>{erro}</p>
            <button onClick={fetchVisitas} style={{ marginTop: 12, padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
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
                <p>Nenhuma visita no período</p>
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
                          <span className="vr-item-nome">{visita.nome_cliente || visita.cliente_nome || 'Cliente'}</span>
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

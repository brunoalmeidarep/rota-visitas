import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import './ResumoVendas.css'

function ResumoVendas() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { representadas, representadaSelecionada } = useRepresentada()
  const [isDark, setIsDark] = useState(false)

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [filtro, setFiltro] = useState('atual') // atual, anterior, custom
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [mostrarCustom, setMostrarCustom] = useState(false)

  const [totalVendido, setTotalVendido] = useState(0)
  const [qtdPedidos, setQtdPedidos] = useState(0)
  const [qtdItens, setQtdItens] = useState(0)
  const [ticketMedio, setTicketMedio] = useState(0)
  const [porRepresentada, setPorRepresentada] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [nomeRep, setNomeRep] = useState('')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!repId || !representadaSelecionada) return
    fetchResumo()
    fetchNomeRep()
  }, [repId, representadaSelecionada, filtro, dataInicio, dataFim])

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

    if (filtro === 'atual') {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    } else if (filtro === 'anterior') {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
      fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0)
    } else if (filtro === 'custom' && dataInicio && dataFim) {
      inicio = new Date(dataInicio)
      fim = new Date(dataFim)
    } else {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    }

    return { inicio, fim }
  }

  async function fetchResumo() {
    setLoading(true)
    setErro(null)

    const timeout = setTimeout(() => {
      setLoading(false)
      setErro('Tempo esgotado. Tente novamente.')
    }, 10000)

    try {
      const { inicio, fim } = getPeriodo()

      console.log('[ResumoVendas] Buscando pedidos:', {
        rep_id: repId,
        representada: representadaSelecionada,
        data_inicio: inicio.toISOString(),
        data_fim: fim.toISOString()
      })

      let query = supabase
        .from('pedidos')
        .select('*')
        .eq('rep_id', repId)
        .eq('status', 'pedido')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString() + 'T23:59:59')

      // Filtrar por representada ou empresa conforme o tipo selecionado
      if (representadaSelecionada.tipo === 'empresa') {
        query = query.eq('empresa_id', representadaSelecionada.empresa_id)
      } else {
        query = query.eq('representada_id', representadaSelecionada.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      clearTimeout(timeout)

      if (error) {
        console.error('[ResumoVendas] Erro:', error)
        setErro('Erro ao carregar dados')
        setLoading(false)
        return
      }

      console.log('[ResumoVendas] Pedidos encontrados:', data?.length || 0)

      const pedidosData = data || []

    // Calcular totais
    const total = pedidosData.reduce((sum, p) => sum + (p.valor_total || 0), 0)
    const qtd = pedidosData.length
    const itens = pedidosData.reduce((sum, p) => {
      const items = p.itens || []
      return sum + items.reduce((s, i) => s + (i.quantidade || 1), 0)
    }, 0)
    const ticket = qtd > 0 ? total / qtd : 0

    setTotalVendido(total)
    setQtdPedidos(qtd)
    setQtdItens(itens)
    setTicketMedio(ticket)
    setPedidos(pedidosData.slice(0, 20)) // Limitar a 20 pedidos

    // Agrupar por representada
    const porRep = {}
    pedidosData.forEach(p => {
      const repId = p.representada_id || 'sem-rep'
      if (!porRep[repId]) {
        porRep[repId] = {
          id: repId,
          nome: p.representada_nome || 'Sem representada',
          valor: 0,
          pedidos: 0
        }
      }
      porRep[repId].valor += p.valor_total || 0
      porRep[repId].pedidos += 1
    })

    const repOrdenadas = Object.values(porRep)
      .sort((a, b) => b.valor - a.valor)
      .map(r => ({
        ...r,
        percentual: total > 0 ? (r.valor / total) * 100 : 0
      }))

    setPorRepresentada(repOrdenadas)
    setLoading(false)
    } catch (err) {
      clearTimeout(timeout)
      console.error('[ResumoVendas] Exceção:', err)
      setErro('Erro ao processar dados')
      setLoading(false)
    }
  }

  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr)
    return d.toLocaleDateString('pt-BR')
  }

  function aplicarCustom() {
    if (dataInicio && dataFim) {
      setFiltro('custom')
      setMostrarCustom(false)
    }
  }

  function getPeriodoLabel() {
    if (filtro === 'atual') return 'Mes atual'
    if (filtro === 'anterior') return 'Mes anterior'
    if (filtro === 'custom' && dataInicio && dataFim) {
      return `${new Date(dataInicio).toLocaleDateString('pt-BR')} a ${new Date(dataFim).toLocaleDateString('pt-BR')}`
    }
    return ''
  }

  function exportarPDF() {
    if (pedidos.length === 0) {
      alert('Nenhum dado para exportar')
      return
    }

    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')

    navigate('/relatorios/pdf', {
      state: {
        tipo: 'resumo-vendas',
        dados: {
          totalVendido,
          qtdPedidos,
          ticketMedio,
          porRepresentada,
          pedidos,
          nomeRep,
          periodo: getPeriodoLabel()
        },
        nomeArquivo: `resumo-vendas-${hoje}.pdf`,
        titulo: 'Resumo de Vendas'
      }
    })
  }

  return (
    <div className={`resumo-vendas ${isDark ? 'dark' : 'light'}`}>
      <header className="rv-header">
        <button className="rv-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Resumo de Vendas</h1>
        <button className="rv-export" onClick={exportarPDF} disabled={loading || pedidos.length === 0}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </header>

      {/* Filtros */}
      <div className="rv-filtros">
        <button
          className={`rv-filtro ${filtro === 'atual' ? 'active' : ''}`}
          onClick={() => setFiltro('atual')}
        >
          Mes atual
        </button>
        <button
          className={`rv-filtro ${filtro === 'anterior' ? 'active' : ''}`}
          onClick={() => setFiltro('anterior')}
        >
          Mes anterior
        </button>
        <button
          className={`rv-filtro ${filtro === 'custom' ? 'active' : ''}`}
          onClick={() => setMostrarCustom(true)}
        >
          Personalizado
        </button>
      </div>

      <div className="rv-content">
        {loading ? (
          <div className="rv-loading">Carregando...</div>
        ) : erro ? (
          <div className="rv-vazio">
            <span className="rv-vazio-icon">⚠️</span>
            <p>{erro}</p>
            <button onClick={fetchResumo} style={{ marginTop: 12, padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="rv-stats">
              <div className="rv-stat principal">
                <span className="rv-stat-label">Total vendido</span>
                <span className="rv-stat-valor">{formatarValor(totalVendido)}</span>
              </div>
              <div className="rv-stats-row">
                <div className="rv-stat">
                  <span className="rv-stat-valor small">{qtdPedidos}</span>
                  <span className="rv-stat-label">pedidos</span>
                </div>
                <div className="rv-stat">
                  <span className="rv-stat-valor small">{qtdItens}</span>
                  <span className="rv-stat-label">itens</span>
                </div>
                <div className="rv-stat">
                  <span className="rv-stat-valor small">{formatarValor(ticketMedio)}</span>
                  <span className="rv-stat-label">ticket medio</span>
                </div>
              </div>
            </div>

            {/* Por representada */}
            {porRepresentada.length > 0 && (
              <div className="rv-secao">
                <h3>Por representada</h3>
                <div className="rv-representadas">
                  {porRepresentada.map(rep => (
                    <div key={rep.id} className="rv-rep-item">
                      <div className="rv-rep-info">
                        <span className="rv-rep-nome">{rep.nome}</span>
                        <span className="rv-rep-pedidos">{rep.pedidos} pedido{rep.pedidos > 1 ? 's' : ''}</span>
                      </div>
                      <div className="rv-rep-right">
                        <span className="rv-rep-valor">{formatarValor(rep.valor)}</span>
                        <div className="rv-rep-bar-container">
                          <div className="rv-rep-bar">
                            <div
                              className="rv-rep-bar-fill"
                              style={{ width: `${rep.percentual}%` }}
                            />
                          </div>
                          <span className="rv-rep-percent">{rep.percentual.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de pedidos */}
            {pedidos.length > 0 && (
              <div className="rv-secao">
                <h3>Pedidos do periodo</h3>
                <div className="rv-pedidos">
                  {pedidos.map(p => (
                    <div
                      key={p.id}
                      className="rv-pedido-item"
                      onClick={() => navigate(`/pedidos/${p.id}`)}
                    >
                      <div className="rv-pedido-info">
                        <span className="rv-pedido-cliente">{p.cliente_nome || 'Cliente'}</span>
                        <span className="rv-pedido-meta">
                          {formatarData(p.created_at)} • {p.representada_nome || '-'}
                        </span>
                      </div>
                      <div className="rv-pedido-right">
                        <span className="rv-pedido-valor">{formatarValor(p.valor_total)}</span>
                        <span className="rv-pedido-itens">
                          {(p.itens || []).length} itens
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pedidos.length === 0 && (
              <div className="rv-vazio">
                <span className="rv-vazio-icon">📊</span>
                <p>Nenhum pedido no periodo</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal personalizado */}
      {mostrarCustom && (
        <div className="rv-modal-overlay" onClick={() => setMostrarCustom(false)}>
          <div className="rv-modal" onClick={e => e.stopPropagation()}>
            <h3>Periodo personalizado</h3>
            <div className="rv-modal-campo">
              <label>Data inicio</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
              />
            </div>
            <div className="rv-modal-campo">
              <label>Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
              />
            </div>
            <div className="rv-modal-acoes">
              <button className="rv-modal-cancelar" onClick={() => setMostrarCustom(false)}>
                Cancelar
              </button>
              <button className="rv-modal-aplicar" onClick={aplicarCustom}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResumoVendas

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import './RankingClientes.css'

function RankingClientes() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { representadaSelecionada } = useRepresentada()
  const [isDark, setIsDark] = useState(false)

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [periodo, setPeriodo] = useState(90)
  const [ranking, setRanking] = useState([])
  const [totalGeral, setTotalGeral] = useState(0)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!repId) return
    fetchRanking()
  }, [repId, periodo, representadaSelecionada])

  async function fetchRanking() {
    setLoading(true)
    setErro(null)

    // Timeout de 10 segundos
    const timeout = setTimeout(() => {
      setLoading(false)
      setErro('Tempo esgotado. Tente novamente.')
    }, 10000)

    try {
      const dataLimite = new Date()
      dataLimite.setDate(dataLimite.getDate() - periodo)

      console.log('[RankingClientes] Buscando pedidos:', {
        rep_id: repId,
        representada_id: representadaSelecionada?.id,
        data_limite: dataLimite.toISOString(),
        periodo
      })

      let query = supabase
        .from('pedidos')
        .select('cliente_id, cliente_nome, valor_total')
        .eq('rep_id', repId)
        .eq('status', 'pedido')
        .gte('created_at', dataLimite.toISOString())

      if (representadaSelecionada) {
        query = query.eq('representada_id', representadaSelecionada.id)
      }

      const { data, error } = await query

      clearTimeout(timeout)

      if (error) {
        console.error('[RankingClientes] Erro:', error)
        setErro('Erro ao carregar dados')
        setLoading(false)
        return
      }

      console.log('[RankingClientes] Pedidos encontrados:', data?.length || 0)

    // Agrupar por cliente
    const porCliente = {}
    let total = 0
    ;(data || []).forEach(p => {
      if (!p.cliente_id) return
      if (!porCliente[p.cliente_id]) {
        porCliente[p.cliente_id] = {
          cliente_id: p.cliente_id,
          nome: p.cliente_nome || 'Cliente',
          valor: 0,
          pedidos: 0
        }
      }
      porCliente[p.cliente_id].valor += p.valor_total || 0
      porCliente[p.cliente_id].pedidos += 1
      total += p.valor_total || 0
    })

    // Ordenar por valor
    const ordenado = Object.values(porCliente).sort((a, b) => b.valor - a.valor)

    // Calcular curva ABC
    let acumulado = 0
    const comCurva = ordenado.map((c, idx) => {
      acumulado += c.valor
      const percentualAcumulado = total > 0 ? (acumulado / total) * 100 : 0
      const percentualIndividual = total > 0 ? (c.valor / total) * 100 : 0

      let curva = 'C'
      if (percentualAcumulado <= 80 || idx < ordenado.length * 0.2) {
        curva = 'A'
      } else if (percentualAcumulado <= 95 || idx < ordenado.length * 0.5) {
        curva = 'B'
      }

      return {
        ...c,
        curva,
        percentual: percentualIndividual,
        posicao: idx + 1
      }
    })

    setRanking(comCurva)
    setTotalGeral(total)
    setLoading(false)
    } catch (err) {
      clearTimeout(timeout)
      console.error('[RankingClientes] Exceção:', err)
      setErro('Erro ao processar dados')
      setLoading(false)
    }
  }

  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function getCurvaStyle(curva) {
    switch (curva) {
      case 'A': return { bg: 'rgba(255, 204, 0, 0.2)', color: '#ffcc00' }
      case 'B': return { bg: 'rgba(192, 192, 192, 0.2)', color: '#c0c0c0' }
      case 'C': return { bg: 'rgba(205, 127, 50, 0.2)', color: '#cd7f32' }
      default: return { bg: 'transparent', color: '#8e8e93' }
    }
  }

  // Stats curva
  const curvaA = ranking.filter(r => r.curva === 'A')
  const curvaB = ranking.filter(r => r.curva === 'B')
  const curvaC = ranking.filter(r => r.curva === 'C')
  const totalA = curvaA.reduce((sum, c) => sum + c.valor, 0)
  const totalB = curvaB.reduce((sum, c) => sum + c.valor, 0)
  const totalC = curvaC.reduce((sum, c) => sum + c.valor, 0)

  return (
    <div className={`ranking-clientes ${isDark ? 'dark' : 'light'}`}>
      <header className="rc-header">
        <button className="rc-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Ranking de Clientes</h1>
        <div className="rc-header-spacer"></div>
      </header>

      {/* Filtros */}
      <div className="rc-filtros">
        <button
          className={`rc-filtro ${periodo === 30 ? 'active' : ''}`}
          onClick={() => setPeriodo(30)}
        >
          30 dias
        </button>
        <button
          className={`rc-filtro ${periodo === 90 ? 'active' : ''}`}
          onClick={() => setPeriodo(90)}
        >
          90 dias
        </button>
        <button
          className={`rc-filtro ${periodo === 365 ? 'active' : ''}`}
          onClick={() => setPeriodo(365)}
        >
          1 ano
        </button>
      </div>

      <div className="rc-content">
        {loading ? (
          <div className="rc-loading">Carregando...</div>
        ) : erro ? (
          <div className="rc-vazio">
            <span className="rc-vazio-icon">⚠️</span>
            <p>{erro}</p>
            <button onClick={fetchRanking} style={{ marginTop: 12, padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              Tentar novamente
            </button>
          </div>
        ) : ranking.length === 0 ? (
          <div className="rc-vazio">
            <span className="rc-vazio-icon">🏆</span>
            <p>Nenhum pedido no periodo</p>
          </div>
        ) : (
          <>
            {/* Stats curva ABC */}
            <div className="rc-curvas">
              <div className="rc-curva-card a">
                <div className="rc-curva-badge">A</div>
                <div className="rc-curva-info">
                  <span className="rc-curva-qtd">{curvaA.length} clientes</span>
                  <span className="rc-curva-valor">{formatarValor(totalA)}</span>
                </div>
                <span className="rc-curva-percent">
                  {totalGeral > 0 ? ((totalA / totalGeral) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <div className="rc-curva-card b">
                <div className="rc-curva-badge">B</div>
                <div className="rc-curva-info">
                  <span className="rc-curva-qtd">{curvaB.length} clientes</span>
                  <span className="rc-curva-valor">{formatarValor(totalB)}</span>
                </div>
                <span className="rc-curva-percent">
                  {totalGeral > 0 ? ((totalB / totalGeral) * 100).toFixed(0) : 0}%
                </span>
              </div>
              <div className="rc-curva-card c">
                <div className="rc-curva-badge">C</div>
                <div className="rc-curva-info">
                  <span className="rc-curva-qtd">{curvaC.length} clientes</span>
                  <span className="rc-curva-valor">{formatarValor(totalC)}</span>
                </div>
                <span className="rc-curva-percent">
                  {totalGeral > 0 ? ((totalC / totalGeral) * 100).toFixed(0) : 0}%
                </span>
              </div>
            </div>

            {/* Lista ranking */}
            <div className="rc-lista">
              {ranking.map(cliente => {
                const curvaStyle = getCurvaStyle(cliente.curva)
                return (
                  <div
                    key={cliente.cliente_id}
                    className="rc-item"
                    onClick={() => navigate(`/clientes/${cliente.cliente_id}`)}
                  >
                    <div className="rc-item-posicao">
                      {cliente.posicao <= 3 ? (
                        <span className={`rc-medal medal-${cliente.posicao}`}>
                          {cliente.posicao === 1 ? '🥇' : cliente.posicao === 2 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="rc-numero">{cliente.posicao}</span>
                      )}
                    </div>
                    <div className="rc-item-info">
                      <span className="rc-item-nome">{cliente.nome}</span>
                      <span className="rc-item-meta">
                        {cliente.pedidos} pedido{cliente.pedidos > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="rc-item-right">
                      <span className="rc-item-valor">{formatarValor(cliente.valor)}</span>
                      <div className="rc-item-curva-row">
                        <span
                          className="rc-item-curva"
                          style={{ background: curvaStyle.bg, color: curvaStyle.color }}
                        >
                          {cliente.curva}
                        </span>
                        <span className="rc-item-percent">{cliente.percentual.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default RankingClientes

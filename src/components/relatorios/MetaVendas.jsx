import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import { formatarInputMoeda, parseMoeda } from '../../utils/formatarMoeda'
import './MetaVendas.css'

function MetaVendas() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { representadas, representadaSelecionada } = useRepresentada()
  const [isDark, setIsDark] = useState(false)

  const [loading, setLoading] = useState(true)
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth())
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear())

  const [vendidoMes, setVendidoMes] = useState(0)
  const [vendidoHoje, setVendidoHoje] = useState(0)
  const [metaMes, setMetaMes] = useState(null)
  const [historico, setHistorico] = useState([])

  const [mostrarSheet, setMostrarSheet] = useState(false)
  const [metaRepresentada, setMetaRepresentada] = useState('')
  const [metaMesInput, setMetaMesInput] = useState(new Date().getMonth())
  const [metaAnoInput, setMetaAnoInput] = useState(new Date().getFullYear())
  const [metaValorDisplay, setMetaValorDisplay] = useState('R$ 0,00')
  const [metaValor, setMetaValor] = useState(0)
  const [salvandoMeta, setSalvandoMeta] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (representadaSelecionada) {
      setMetaRepresentada(representadaSelecionada.id)
    }
  }, [representadaSelecionada])

  useEffect(() => {
    if (!repId) return
    fetchDados()
  }, [repId, mesSelecionado, anoSelecionado, representadaSelecionada])

  async function fetchDados() {
    setLoading(true)

    const inicioMes = new Date(anoSelecionado, mesSelecionado, 1)
    const fimMes = new Date(anoSelecionado, mesSelecionado + 1, 0)
    const hoje = new Date().toISOString().split('T')[0]

    // Vendas do mes
    let queryVendas = supabase
      .from('pedidos')
      .select('valor_total, created_at')
      .eq('rep_id', repId)
      .eq('status', 'pedido')
      .gte('created_at', inicioMes.toISOString())
      .lte('created_at', fimMes.toISOString() + 'T23:59:59')

    if (representadaSelecionada) {
      queryVendas = queryVendas.eq('representada_id', representadaSelecionada.id)
    }

    const { data: pedidosMes } = await queryVendas

    const totalMes = (pedidosMes || []).reduce((sum, p) => sum + (p.valor_total || 0), 0)
    setVendidoMes(totalMes)

    // Vendas de hoje (so se for o mes atual)
    const mesAtual = new Date().getMonth()
    const anoAtual = new Date().getFullYear()
    if (mesSelecionado === mesAtual && anoSelecionado === anoAtual) {
      const pedidosHoje = (pedidosMes || []).filter(p => p.created_at?.startsWith(hoje))
      const totalHoje = pedidosHoje.reduce((sum, p) => sum + (p.valor_total || 0), 0)
      setVendidoHoje(totalHoje)
    } else {
      setVendidoHoje(0)
    }

    // Meta do mes
    let queryMeta = supabase
      .from('metas')
      .select('*')
      .eq('rep_id', repId)
      .eq('mes', mesSelecionado + 1)
      .eq('ano', anoSelecionado)

    if (representadaSelecionada) {
      queryMeta = queryMeta.eq('representada_id', representadaSelecionada.id)
    }

    const { data: metaData } = await queryMeta.maybeSingle()
    setMetaMes(metaData)

    // Historico (ultimos 6 meses)
    const historicoMeses = []
    for (let i = 1; i <= 6; i++) {
      let m = mesSelecionado - i
      let a = anoSelecionado
      if (m < 0) {
        m += 12
        a -= 1
      }
      historicoMeses.push({ mes: m, ano: a })
    }

    const historicoData = []
    for (const { mes, ano } of historicoMeses) {
      const inicio = new Date(ano, mes, 1)
      const fim = new Date(ano, mes + 1, 0)

      let qVendas = supabase
        .from('pedidos')
        .select('valor_total')
        .eq('rep_id', repId)
        .eq('status', 'pedido')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString() + 'T23:59:59')

      if (representadaSelecionada) {
        qVendas = qVendas.eq('representada_id', representadaSelecionada.id)
      }

      const { data: vendas } = await qVendas
      const totalVendas = (vendas || []).reduce((sum, p) => sum + (p.valor_total || 0), 0)

      let qMeta = supabase
        .from('metas')
        .select('valor')
        .eq('rep_id', repId)
        .eq('mes', mes + 1)
        .eq('ano', ano)

      if (representadaSelecionada) {
        qMeta = qMeta.eq('representada_id', representadaSelecionada.id)
      }

      const { data: meta } = await qMeta.maybeSingle()

      historicoData.push({
        mes,
        ano,
        vendido: totalVendas,
        meta: meta?.valor || 0,
        percentual: meta?.valor ? (totalVendas / meta.valor) * 100 : 0
      })
    }

    setHistorico(historicoData)
    setLoading(false)
  }

  function handleMetaValorChange(valor) {
    const formatted = formatarInputMoeda(valor)
    setMetaValorDisplay(formatted)
    setMetaValor(parseMoeda(formatted))
  }

  async function salvarMeta() {
    if (!metaRepresentada) {
      alert('Selecione uma representada')
      return
    }
    if (!metaValor || metaValor <= 0) {
      alert('Informe um valor valido')
      return
    }

    setSalvandoMeta(true)

    const { data: existente } = await supabase
      .from('metas')
      .select('id')
      .eq('rep_id', repId)
      .eq('representada_id', metaRepresentada)
      .eq('mes', metaMesInput + 1)
      .eq('ano', metaAnoInput)
      .maybeSingle()

    if (existente) {
      const { error } = await supabase
        .from('metas')
        .update({ valor: metaValor })
        .eq('id', existente.id)

      if (error) {
        console.error('[MetaVendas] Erro ao atualizar:', error)
        alert('Erro ao salvar meta')
      }
    } else {
      const { error } = await supabase
        .from('metas')
        .insert({
          rep_id: repId,
          representada_id: metaRepresentada,
          mes: metaMesInput + 1,
          ano: metaAnoInput,
          valor: metaValor
        })

      if (error) {
        console.error('[MetaVendas] Erro ao inserir:', error)
        alert('Erro ao salvar meta')
      }
    }

    setSalvandoMeta(false)
    setMostrarSheet(false)
    setMetaValorDisplay('R$ 0,00')
    setMetaValor(0)
    fetchDados()
  }

  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function getNomeMes(mes) {
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return nomes[mes]
  }

  function gerarPeriodos() {
    const periodos = []
    const hoje = new Date()
    for (let i = 0; i < 6; i++) {
      let m = hoje.getMonth() - i
      let a = hoje.getFullYear()
      if (m < 0) {
        m += 12
        a -= 1
      }
      periodos.push({ mes: m, ano: a, label: `${getNomeMes(m)} ${a}` })
    }
    return periodos
  }

  const periodos = gerarPeriodos()
  const percentualMeta = metaMes?.valor ? (vendidoMes / metaMes.valor) * 100 : 0
  const mesAtual = new Date().getMonth()
  const anoAtual = new Date().getFullYear()
  const ehMesAtual = mesSelecionado === mesAtual && anoSelecionado === anoAtual

  // Calcular dias uteis restantes
  function getDiasUteisRestantes() {
    const hoje = new Date()
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
    let dias = 0
    for (let d = hoje.getDate() + 1; d <= fimMes.getDate(); d++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth(), d)
      const diaSemana = data.getDay()
      if (diaSemana !== 0 && diaSemana !== 6) dias++
    }
    return dias
  }

  const diasUteis = getDiasUteisRestantes()
  const faltaVender = metaMes?.valor ? Math.max(0, metaMes.valor - vendidoMes) : 0
  const porDia = diasUteis > 0 ? faltaVender / diasUteis : 0

  return (
    <div className={`meta-vendas ${isDark ? 'dark' : 'light'}`}>
      <header className="mv-header">
        <button className="mv-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Meta de Vendas</h1>
        <button className="mv-config" onClick={() => setMostrarSheet(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </header>

      {/* Filtro de periodo */}
      <div className="mv-filtros">
        {periodos.map((p, idx) => (
          <button
            key={idx}
            className={`mv-filtro ${p.mes === mesSelecionado && p.ano === anoSelecionado ? 'active' : ''}`}
            onClick={() => {
              setMesSelecionado(p.mes)
              setAnoSelecionado(p.ano)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mv-content">
        {loading ? (
          <div className="mv-loading">Carregando...</div>
        ) : (
          <>
            {/* Card Vendido */}
            <div className="mv-card">
              <div className="mv-card-header">
                <span className="mv-card-icon vendido">💰</span>
                <span className="mv-card-label">Vendido no mes</span>
              </div>
              <div className="mv-card-valor">{formatarValor(vendidoMes)}</div>
              {ehMesAtual && vendidoHoje > 0 && (
                <div className="mv-card-hoje">Hoje {formatarValor(vendidoHoje)}</div>
              )}
            </div>

            {/* Card Meta */}
            <div className="mv-card">
              <div className="mv-card-header">
                <span className="mv-card-icon meta">🎯</span>
                <span className="mv-card-label">Meta do mes</span>
              </div>
              {metaMes ? (
                <>
                  <div className="mv-card-valor">{formatarValor(metaMes.valor)}</div>
                  <div className="mv-progress-container">
                    <div className="mv-progress-bar">
                      <div
                        className={`mv-progress-fill ${percentualMeta >= 100 ? 'completo' : percentualMeta >= 80 ? 'bom' : percentualMeta >= 50 ? 'medio' : 'baixo'}`}
                        style={{ width: `${Math.min(100, percentualMeta)}%` }}
                      />
                    </div>
                    <span className={`mv-progress-badge ${percentualMeta >= 100 ? 'completo' : percentualMeta >= 80 ? 'bom' : percentualMeta >= 50 ? 'medio' : 'baixo'}`}>
                      {percentualMeta.toFixed(0)}%
                    </span>
                  </div>
                </>
              ) : (
                <div className="mv-sem-meta">
                  <p>Nenhuma meta cadastrada</p>
                  <button onClick={() => setMostrarSheet(true)}>+ Cadastrar meta</button>
                </div>
              )}
            </div>

            {/* Card Necessario (so no mes atual com meta) */}
            {ehMesAtual && metaMes && faltaVender > 0 && (
              <div className="mv-card necessario">
                <div className="mv-card-header">
                  <span className="mv-card-icon necessario">📊</span>
                  <span className="mv-card-label">Necessario vender</span>
                </div>
                <div className="mv-card-valor">{formatarValor(porDia)}<span className="mv-por-dia">/dia util</span></div>
                <div className="mv-card-detalhe">
                  Equivalente a {formatarValor(faltaVender)} restantes em {diasUteis} dias uteis
                </div>
              </div>
            )}

            {ehMesAtual && metaMes && faltaVender <= 0 && (
              <div className="mv-card sucesso">
                <div className="mv-card-header">
                  <span className="mv-card-icon sucesso">🎉</span>
                  <span className="mv-card-label">Meta batida!</span>
                </div>
                <div className="mv-card-valor">+{formatarValor(vendidoMes - metaMes.valor)}</div>
                <div className="mv-card-detalhe">Acima da meta</div>
              </div>
            )}

            {/* Historico */}
            {historico.length > 0 && (
              <div className="mv-historico">
                <h3>Historico</h3>
                <div className="mv-historico-lista">
                  {historico.map((h, idx) => (
                    <div key={idx} className={`mv-historico-item ${h.meta > 0 && h.vendido >= h.meta ? 'bateu' : h.meta > 0 ? 'nao-bateu' : ''}`}>
                      <div className="mv-historico-mes">{getNomeMes(h.mes)} {h.ano}</div>
                      <div className="mv-historico-valores">
                        <span className="mv-historico-vendido">{formatarValor(h.vendido)}</span>
                        {h.meta > 0 && (
                          <>
                            <span className="mv-historico-separador">/</span>
                            <span className="mv-historico-meta">{formatarValor(h.meta)}</span>
                          </>
                        )}
                      </div>
                      {h.meta > 0 && (
                        <span className={`mv-historico-badge ${h.vendido >= h.meta ? 'bateu' : 'nao-bateu'}`}>
                          {h.percentual.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sheet cadastrar meta */}
      {mostrarSheet && (
        <div className="mv-sheet-overlay" onClick={() => setMostrarSheet(false)}>
          <div className="mv-sheet" onClick={e => e.stopPropagation()}>
            <div className="mv-sheet-handle"></div>
            <h3>Cadastrar Meta</h3>

            <div className="mv-sheet-campo">
              <label>Representada</label>
              <select
                value={metaRepresentada}
                onChange={e => setMetaRepresentada(e.target.value)}
              >
                <option value="">Selecione...</option>
                {representadas.map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>

            <div className="mv-sheet-row">
              <div className="mv-sheet-campo">
                <label>Mes</label>
                <select value={metaMesInput} onChange={e => setMetaMesInput(Number(e.target.value))}>
                  {[0,1,2,3,4,5,6,7,8,9,10,11].map(m => (
                    <option key={m} value={m}>{getNomeMes(m)}</option>
                  ))}
                </select>
              </div>
              <div className="mv-sheet-campo">
                <label>Ano</label>
                <select value={metaAnoInput} onChange={e => setMetaAnoInput(Number(e.target.value))}>
                  {[anoAtual - 1, anoAtual, anoAtual + 1].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mv-sheet-campo">
              <label>Valor da meta</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={metaValorDisplay}
                onChange={e => handleMetaValorChange(e.target.value)}
              />
            </div>

            <button
              className="mv-sheet-salvar"
              onClick={salvarMeta}
              disabled={salvandoMeta}
            >
              {salvandoMeta ? 'Salvando...' : 'Salvar Meta'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MetaVendas

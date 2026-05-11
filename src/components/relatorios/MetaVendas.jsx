import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { dataLocal } from '../../lib/data'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import { formatarInputMoeda, parseMoeda } from '../../utils/formatarMoeda'
import './MetaVendas.css'

const MESES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function MetaVendas() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { representadas, representadaSelecionada } = useRepresentada()
  const [isDark, setIsDark] = useState(false)

  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth()

  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual)

  const [vendidoMes, setVendidoMes] = useState(0)
  const [vendidoHoje, setVendidoHoje] = useState(0)
  const [metaMes, setMetaMes] = useState(null)
  const [historico, setHistorico] = useState([])

  const [mostrarSheet, setMostrarSheet] = useState(false)
  const [nomeRep, setNomeRep] = useState('')
  const [metaRepresentada, setMetaRepresentada] = useState('')
  const [metaMesInput, setMetaMesInput] = useState(mesAtual)
  const [metaAnoInput, setMetaAnoInput] = useState(anoAtual)
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
    fetchNomeRep()
  }, [repId, mesSelecionado, anoSelecionado, representadaSelecionada])

  async function fetchNomeRep() {
    const { data } = await supabase
      .from('representantes')
      .select('nome')
      .eq('id', repId)
      .single()
    if (data?.nome) setNomeRep(data.nome)
  }

  // Pre-preencher sheet com periodo selecionado
  function abrirSheet() {
    setMetaMesInput(mesSelecionado)
    setMetaAnoInput(anoSelecionado)
    setMetaValorDisplay('R$ 0,00')
    setMetaValor(0)
    setMostrarSheet(true)
  }

  async function fetchDados() {
    if (!navigator.onLine) {
      setLoading(false)
      setOffline(true)
      return
    }
    setOffline(false)
    if (representadaSelecionada?.tipo === 'empresa') {
      return fetchDadosEnterprise()
    }
    return fetchDadosPro()
  }

  async function fetchDadosPro() {
    setLoading(true)

    const inicioMes = new Date(anoSelecionado, mesSelecionado, 1)
    const fimMes = new Date(anoSelecionado, mesSelecionado + 1, 0)
    const hoje = dataLocal()

    // Vendas do mes
    let queryVendas = supabase
      .from('pedidos')
      .select('valor_liquido, created_at')
      .eq('rep_id', repId)
      .eq('status', 'pedido')
      .gte('created_at', inicioMes.toISOString())
      .lte('created_at', fimMes.toISOString() + 'T23:59:59')

    if (representadaSelecionada) {
      queryVendas = queryVendas.eq('representada_id', representadaSelecionada.id)
    }

    const { data: pedidosMes } = await queryVendas

    const totalMes = (pedidosMes || []).reduce((sum, p) => sum + (p.valor_liquido || 0), 0)
    setVendidoMes(totalMes)

    // Vendas de hoje (so se for o mes atual)
    const ehMesAtual = mesSelecionado === mesAtual && anoSelecionado === anoAtual
    if (ehMesAtual) {
      const pedidosHoje = (pedidosMes || []).filter(p => p.created_at?.startsWith(hoje))
      const totalHoje = pedidosHoje.reduce((sum, p) => sum + (p.valor_liquido || 0), 0)
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

    // Historico (ultimos 12 meses, apenas com dados)
    await fetchHistoricoPro()

    setLoading(false)
  }

  async function fetchDadosEnterprise() {
    setLoading(true)

    const empresaId = representadaSelecionada.empresa_id
    const hoje = dataLocal()

    // Vendas do mes via view vendas_rep_mensal (so transmitidos)
    const { data: vendasView } = await supabase
      .from('vendas_rep_mensal')
      .select('*')
      .eq('rep_id', repId)
      .eq('empresa_id', empresaId)
      .eq('mes', mesSelecionado + 1)
      .eq('ano', anoSelecionado)
      .maybeSingle()

    const totalMes = vendasView?.valor_vendido || 0
    setVendidoMes(totalMes)

    // Vendas de hoje (buscar pedidos transmitidos hoje)
    const ehMesAtual = mesSelecionado === mesAtual && anoSelecionado === anoAtual
    if (ehMesAtual) {
      const { data: pedidosHoje } = await supabase
        .from('pedidos')
        .select('valor_liquido')
        .eq('rep_id', repId)
        .eq('empresa_id', empresaId)
        .eq('erp_status', 'transmitido')
        .gte('erp_transmitido_em', hoje + 'T00:00:00')
        .lte('erp_transmitido_em', hoje + 'T23:59:59')

      const totalHoje = (pedidosHoje || []).reduce((sum, p) => sum + (p.valor_liquido || 0), 0)
      setVendidoHoje(totalHoje)
    } else {
      setVendidoHoje(0)
    }

    // Meta do mes (metas_rep_mensal para Enterprise)
    const { data: metaData } = await supabase
      .from('metas_rep_mensal')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('rep_id', repId)
      .eq('ano', anoSelecionado)
      .eq('mes', mesSelecionado + 1)
      .maybeSingle()

    setMetaMes(metaData ? { valor: metaData.meta_valor } : null)

    // Historico (ultimos 12 meses, apenas com dados)
    await fetchHistoricoEnterprise()

    setLoading(false)
  }

  async function fetchHistorico() {
    if (representadaSelecionada?.tipo === 'empresa') {
      return fetchHistoricoEnterprise()
    }
    return fetchHistoricoPro()
  }

  async function fetchHistoricoPro() {
    const historicoData = []

    // Buscar ultimos 12 meses a partir do mes selecionado
    for (let i = 1; i <= 12; i++) {
      let m = mesSelecionado - i
      let a = anoSelecionado
      while (m < 0) {
        m += 12
        a -= 1
      }

      const inicio = new Date(a, m, 1)
      const fim = new Date(a, m + 1, 0)

      // Buscar vendas
      let qVendas = supabase
        .from('pedidos')
        .select('valor_liquido')
        .eq('rep_id', repId)
        .eq('status', 'pedido')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString() + 'T23:59:59')

      if (representadaSelecionada) {
        qVendas = qVendas.eq('representada_id', representadaSelecionada.id)
      }

      const { data: vendas } = await qVendas
      const totalVendas = (vendas || []).reduce((sum, p) => sum + (p.valor_liquido || 0), 0)

      // Buscar meta
      let qMeta = supabase
        .from('metas')
        .select('valor')
        .eq('rep_id', repId)
        .eq('mes', m + 1)
        .eq('ano', a)

      if (representadaSelecionada) {
        qMeta = qMeta.eq('representada_id', representadaSelecionada.id)
      }

      const { data: meta } = await qMeta.maybeSingle()
      const metaValor = meta?.valor || 0

      // So adicionar se tiver vendas OU meta (nunca zerado)
      if (totalVendas > 0 || metaValor > 0) {
        historicoData.push({
          mes: m,
          ano: a,
          vendido: totalVendas,
          meta: metaValor,
          percentual: metaValor > 0 ? (totalVendas / metaValor) * 100 : 0,
          bateu: metaValor > 0 && totalVendas >= metaValor
        })
      }
    }

    setHistorico(historicoData)
  }

  async function fetchHistoricoEnterprise() {
    const empresaId = representadaSelecionada.empresa_id
    const historicoData = []

    // Buscar ultimos 12 meses via view vendas_rep_mensal
    for (let i = 1; i <= 12; i++) {
      let m = mesSelecionado - i
      let a = anoSelecionado
      while (m < 0) {
        m += 12
        a -= 1
      }

      // Buscar vendas transmitidas via view
      const { data: vendasView } = await supabase
        .from('vendas_rep_mensal')
        .select('valor_vendido')
        .eq('rep_id', repId)
        .eq('empresa_id', empresaId)
        .eq('mes', m + 1)
        .eq('ano', a)
        .maybeSingle()

      const totalVendas = vendasView?.valor_vendido || 0

      // Buscar meta (metas_rep_mensal para Enterprise)
      const { data: meta } = await supabase
        .from('metas_rep_mensal')
        .select('meta_valor')
        .eq('empresa_id', empresaId)
        .eq('rep_id', repId)
        .eq('ano', a)
        .eq('mes', m + 1)
        .maybeSingle()

      const metaValor = meta?.meta_valor || 0

      // So adicionar se tiver vendas OU meta (nunca zerado)
      if (totalVendas > 0 || metaValor > 0) {
        historicoData.push({
          mes: m,
          ano: a,
          vendido: totalVendas,
          meta: metaValor,
          percentual: metaValor > 0 ? (totalVendas / metaValor) * 100 : 0,
          bateu: metaValor > 0 && totalVendas >= metaValor
        })
      }
    }

    setHistorico(historicoData)
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

    // Upsert: verificar se ja existe
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
        setSalvandoMeta(false)
        return
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
        setSalvandoMeta(false)
        return
      }
    }

    setSalvandoMeta(false)
    setMostrarSheet(false)
    fetchDados()
  }

  function formatarValor(valor) {
    if (valor === null || valor === undefined) return 'R$ 0,00'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function getPeriodoLabel() {
    return `${MESES[mesSelecionado]} ${anoSelecionado}`
  }

  function exportarPDF() {
    if (!temVendas && !temMeta) {
      alert('Nenhum dado para exportar')
      return
    }

    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')

    navigate('/relatorios/pdf', {
      state: {
        tipo: 'meta-vendas',
        dados: {
          vendidoMes,
          metaMes: metaMes?.valor || 0,
          percentual: percentualMeta,
          historico,
          nomeRep,
          periodo: getPeriodoLabel()
        },
        nomeArquivo: `meta-vendas-${hoje}.pdf`,
        titulo: 'Meta de Vendas'
      }
    })
  }

  // Gerar anos para o select (3 anos atras ate ano atual)
  function gerarAnos() {
    const anos = []
    for (let a = anoAtual; a >= anoAtual - 2; a--) {
      anos.push(a)
    }
    return anos
  }

  const ehMesAtual = mesSelecionado === mesAtual && anoSelecionado === anoAtual
  const percentualMeta = metaMes?.valor ? (vendidoMes / metaMes.valor) * 100 : 0
  const temVendas = vendidoMes > 0
  const temMeta = metaMes !== null && metaMes?.valor > 0

  // Calcular dias uteis restantes no mes atual
  function getDiasUteisRestantes() {
    if (!ehMesAtual) return 0
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
  const faltaVender = temMeta ? Math.max(0, metaMes.valor - vendidoMes) : 0
  const porDia = diasUteis > 0 ? faltaVender / diasUteis : 0
  const metaBatida = temMeta && vendidoMes >= metaMes.valor

  // Determinar estado da tela
  // Estado 1: tem meta E tem vendas (ou meta batida)
  // Estado 2: tem vendas MAS nao tem meta
  // Estado 3: sem vendas E sem meta
  const estado = temMeta ? 1 : temVendas ? 2 : 3

  return (
    <div className={`meta-vendas ${isDark ? 'dark' : 'light'}`}>
      <header className="mv-header">
        <button className="mv-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Meta de Vendas</h1>
        <div className="mv-header-actions">
          <button className="mv-export" onClick={exportarPDF} disabled={loading || (!temVendas && !temMeta)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button className="mv-config" onClick={abrirSheet}>
            <span>⚙️</span>
          </button>
        </div>
      </header>

      {offline && (
        <div style={{ background: '#ff9500', color: '#fff', padding: '8px 16px', textAlign: 'center', fontSize: 14 }}>
          Voce esta offline. Conecte-se para ver os dados.
        </div>
      )}

      {/* Seletor de periodo: Mes + Ano */}
      <div className="mv-periodo">
        <div className="mv-periodo-select">
          <select
            value={mesSelecionado}
            onChange={e => setMesSelecionado(Number(e.target.value))}
          >
            {MESES.map((nome, idx) => (
              <option key={idx} value={idx}>{nome}</option>
            ))}
          </select>
        </div>
        <div className="mv-periodo-select">
          <select
            value={anoSelecionado}
            onChange={e => setAnoSelecionado(Number(e.target.value))}
          >
            {gerarAnos().map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mv-content">
        {loading ? (
          <div className="mv-loading">Carregando...</div>
        ) : (
          <>
            {/* Card Vendido - sempre aparece */}
            <div className={`mv-card ${estado === 3 ? 'sem-dados' : ''}`}>
              <div className="mv-card-header">
                <span className="mv-card-icon vendido">💰</span>
                <span className="mv-card-label">Vendido no mes</span>
              </div>
              <div className={`mv-card-valor ${estado === 3 ? 'zerado' : ''}`}>
                {formatarValor(vendidoMes)}
              </div>
              {ehMesAtual && vendidoHoje > 0 && (
                <div className="mv-card-hoje">Hoje {formatarValor(vendidoHoje)}</div>
              )}
            </div>

            {/* Estado 1: Com meta cadastrada */}
            {estado === 1 && (
              <>
                {/* Card Meta */}
                <div className="mv-card">
                  <div className="mv-card-header">
                    <span className="mv-card-icon meta">🎯</span>
                    <span className="mv-card-label">Meta do mes</span>
                  </div>
                  <div className="mv-card-valor">{formatarValor(metaMes.valor)}</div>
                  <div className="mv-progress-container">
                    <div className="mv-progress-bar">
                      <div
                        className={`mv-progress-fill ${percentualMeta >= 100 ? 'verde' : percentualMeta >= 80 ? 'verde' : percentualMeta >= 50 ? 'amarelo' : 'vermelho'}`}
                        style={{ width: `${Math.min(100, percentualMeta)}%` }}
                      />
                    </div>
                    <span className={`mv-progress-badge ${percentualMeta >= 80 ? 'verde' : percentualMeta >= 50 ? 'amarelo' : 'vermelho'}`}>
                      {percentualMeta.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Card Necessario vender - so mes atual e meta nao batida */}
                {ehMesAtual && !metaBatida && diasUteis > 0 && (
                  <div className="mv-card necessario">
                    <div className="mv-card-header">
                      <span className="mv-card-icon necessario">📊</span>
                      <span className="mv-card-label">Necessario vender por dia util</span>
                    </div>
                    <div className="mv-card-valor">{formatarValor(porDia)}</div>
                    <div className="mv-card-detalhe">
                      {diasUteis} dias uteis restantes em {MESES[mesSelecionado].toLowerCase()}
                    </div>
                  </div>
                )}

                {/* Card Meta batida */}
                {ehMesAtual && metaBatida && (
                  <div className="mv-card sucesso">
                    <div className="mv-card-header">
                      <span className="mv-card-icon sucesso">🎉</span>
                      <span className="mv-card-label">Meta batida!</span>
                    </div>
                    <div className="mv-card-valor">+{formatarValor(vendidoMes - metaMes.valor)}</div>
                    <div className="mv-card-detalhe">Acima da meta</div>
                  </div>
                )}
              </>
            )}

            {/* Estado 2: Sem meta mas com vendas */}
            {estado === 2 && (
              <div className="mv-card sem-meta">
                <div className="mv-sem-meta-content">
                  <span className="mv-sem-meta-icon">🎯</span>
                  <span className="mv-sem-meta-texto">Sem meta cadastrada</span>
                  <button className="mv-sem-meta-btn" onClick={abrirSheet}>
                    ⚙️ Cadastrar meta
                  </button>
                </div>
              </div>
            )}

            {/* Estado 3: Sem vendas e sem meta */}
            {estado === 3 && (
              <div className="mv-vazio">
                <p>Nenhum dado para exibir neste periodo</p>
              </div>
            )}

            {/* Historico - so mostrar se tiver dados */}
            {historico.length > 0 && estado !== 3 && (
              <div className="mv-historico">
                <h3>Historico</h3>
                <div className="mv-historico-lista">
                  {historico.map((h, idx) => (
                    <div key={idx} className={`mv-historico-item ${h.meta > 0 ? (h.bateu ? 'bateu' : 'nao-bateu') : ''}`}>
                      <div className="mv-historico-mes">{MESES_CURTO[h.mes]} {h.ano}</div>
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
                        <span className={`mv-historico-badge ${h.bateu ? 'bateu' : 'nao-bateu'}`}>
                          {h.bateu ? '✓' : '✗'} {h.percentual.toFixed(0)}%
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
                  {MESES.map((nome, idx) => (
                    <option key={idx} value={idx}>{nome}</option>
                  ))}
                </select>
              </div>
              <div className="mv-sheet-campo">
                <label>Ano</label>
                <select value={metaAnoInput} onChange={e => setMetaAnoInput(Number(e.target.value))}>
                  {gerarAnos().map(a => (
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

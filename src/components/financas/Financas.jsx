import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import NovoLancamento from './NovoLancamento'
import './Financas.css'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const CATEGORIAS_RECEITA = [
  { id: 'comissao', nome: 'Comissão', icone: '💼' },
  { id: 'bonificacao', nome: 'Bonificação', icone: '🎁' },
  { id: 'premio', nome: 'Prêmio', icone: '🏆' },
  { id: 'outros', nome: 'Outros', icone: '···' }
]

const CATEGORIAS_DESPESA = [
  { id: 'combustivel', nome: 'Combustível', icone: '⛽' },
  { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
  { id: 'hospedagem', nome: 'Hospedagem', icone: '🏨' },
  { id: 'pedagio', nome: 'Pedágio', icone: '🛣️' },
  { id: 'manutencao', nome: 'Manutenção', icone: '🔧' },
  { id: 'software', nome: 'Software', icone: '💻' },
  { id: 'outros', nome: 'Outros', icone: '···' }
]

function Financas() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()

  // Navegação de período
  const hoje = new Date()
  const [mesAtual, setMesAtual] = useState(hoje.getMonth())
  const [anoAtual, setAnoAtual] = useState(hoje.getFullYear())

  // Estado
  const [abaAtiva, setAbaAtiva] = useState('comissoes') // comissoes, despesas, impostos
  const [lancamentos, setLancamentos] = useState([])
  const [impostos, setImpostos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarSheet, setMostrarSheet] = useState(false)
  const [lancamentoSelecionado, setLancamentoSelecionado] = useState(null)
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false)

  // Novo imposto inline
  const [novoImposto, setNovoImposto] = useState({ nome: '', dia: '' })
  const [salvandoImposto, setSalvandoImposto] = useState(false)

  // Dark mode
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Verificar se é mês futuro
  const ehMesFuturo = anoAtual > hoje.getFullYear() ||
    (anoAtual === hoje.getFullYear() && mesAtual > hoje.getMonth())

  // Navegação de mês
  function mesAnterior() {
    if (mesAtual === 0) {
      setMesAtual(11)
      setAnoAtual(anoAtual - 1)
    } else {
      setMesAtual(mesAtual - 1)
    }
  }

  function mesProximo() {
    if (mesAtual === 11) {
      setMesAtual(0)
      setAnoAtual(anoAtual + 1)
    } else {
      setMesAtual(mesAtual + 1)
    }
  }

  // Carregar lançamentos
  useEffect(() => {
    if (!repId) return

    async function fetchLancamentos() {
      setLoading(true)

      // Calcular range de datas do mês
      const dataInicio = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`
      const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate()
      const dataFim = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${ultimoDia}`

      const { data, error } = await supabase
        .from('financeiro')
        .select('*')
        .eq('rep_id', repId)
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .order('data', { ascending: false })

      if (error) {
        console.error('[Financas] Erro ao carregar:', error)
      } else {
        setLancamentos(data || [])
      }

      setLoading(false)
    }

    fetchLancamentos()
  }, [repId, mesAtual, anoAtual])

  // Carregar impostos
  useEffect(() => {
    if (!repId) return

    async function fetchImpostos() {
      const { data } = await supabase
        .from('impostos')
        .select('*')
        .eq('rep_id', repId)
        .order('dia')

      setImpostos(data || [])
    }

    fetchImpostos()
  }, [repId])

  // Calcular totais
  const receitas = lancamentos
    .filter(l => l.tipo === 'receita')
    .reduce((acc, l) => acc + (l.valor || 0), 0)

  const despesas = lancamentos
    .filter(l => l.tipo === 'despesa')
    .reduce((acc, l) => acc + (l.valor || 0), 0)

  const resultado = receitas - despesas

  // Filtrar por aba
  const lancamentosFiltrados = lancamentos.filter(l => {
    if (abaAtiva === 'comissoes') return l.tipo === 'receita'
    if (abaAtiva === 'despesas') return l.tipo === 'despesa'
    return false
  })

  // Agrupar por dia
  function agruparPorDia(items) {
    const grupos = {}
    items.forEach(item => {
      const data = item.data
      if (!grupos[data]) grupos[data] = []
      grupos[data].push(item)
    })
    return Object.entries(grupos).sort((a, b) => b[0].localeCompare(a[0]))
  }

  const lancamentosAgrupados = agruparPorDia(lancamentosFiltrados)

  // Formatar valor
  function formatarValor(valor) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0)
  }

  // Formatar data
  function formatarData(dataStr) {
    const [ano, mes, dia] = dataStr.split('-')
    return `${dia}/${mes}`
  }

  function formatarDataCompleta(dataStr) {
    const [ano, mes, dia] = dataStr.split('-')
    const data = new Date(ano, mes - 1, dia)
    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    return `${diasSemana[data.getDay()]}, ${dia}/${mes}`
  }

  // Obter ícone da categoria
  function getIconeCategoria(categoria, tipo) {
    const cats = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA
    const cat = cats.find(c => c.nome === categoria || c.id === categoria?.toLowerCase())
    return cat?.icone || '···'
  }

  // Verificar impostos próximos
  function getImpostosProximos() {
    const diaHoje = hoje.getDate()
    return impostos.filter(imp => {
      const diff = imp.dia - diaHoje
      return diff >= 0 && diff <= 7
    })
  }

  const impostosProximos = getImpostosProximos()

  // Salvar novo imposto
  async function salvarImposto() {
    if (!novoImposto.nome.trim() || !novoImposto.dia) return

    setSalvandoImposto(true)

    const { data, error } = await supabase
      .from('impostos')
      .insert({
        rep_id: repId,
        nome: novoImposto.nome.trim(),
        dia: parseInt(novoImposto.dia)
      })
      .select()
      .single()

    if (!error && data) {
      setImpostos([...impostos, data].sort((a, b) => a.dia - b.dia))
      setNovoImposto({ nome: '', dia: '' })
    }

    setSalvandoImposto(false)
  }

  // Excluir imposto
  async function excluirImposto(id) {
    await supabase.from('impostos').delete().eq('id', id)
    setImpostos(impostos.filter(i => i.id !== id))
  }

  // Clicar em lançamento
  function handleClickLancamento(lancamento) {
    if (lancamento.tipo_lancamento === 'parcelado' || lancamento.tipo_lancamento === 'recorrente') {
      setLancamentoSelecionado(lancamento)
      setMostrarOpcoes(true)
    }
  }

  // Ações de lançamento parcelado/recorrente
  async function excluirAPartirDeste() {
    if (!lancamentoSelecionado) return

    await supabase
      .from('financeiro')
      .delete()
      .eq('grupo_id', lancamentoSelecionado.grupo_id)
      .gte('data', lancamentoSelecionado.data)

    setMostrarOpcoes(false)
    setLancamentoSelecionado(null)
    // Recarregar
    recarregarLancamentos()
  }

  async function excluirTodos() {
    if (!lancamentoSelecionado) return

    await supabase
      .from('financeiro')
      .delete()
      .eq('grupo_id', lancamentoSelecionado.grupo_id)

    setMostrarOpcoes(false)
    setLancamentoSelecionado(null)
    recarregarLancamentos()
  }

  async function recarregarLancamentos() {
    const dataInicio = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-01`
    const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).getDate()
    const dataFim = `${anoAtual}-${String(mesAtual + 1).padStart(2, '0')}-${ultimoDia}`

    const { data } = await supabase
      .from('financeiro')
      .select('*')
      .eq('rep_id', repId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false })

    setLancamentos(data || [])
  }

  if (loadingRep) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className={`financas ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="fin-header">
        <button className="fin-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Finanças</h1>
        <button className="fin-novo" onClick={() => setMostrarSheet(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </header>

      {/* Navegação de período */}
      <div className="fin-periodo">
        <button className="fin-periodo-btn" onClick={mesAnterior}>‹</button>
        <span className="fin-periodo-texto">{MESES[mesAtual]} {anoAtual}</span>
        <button className="fin-periodo-btn" onClick={mesProximo}>›</button>
      </div>

      {/* Banner mês futuro */}
      {ehMesFuturo && (
        <div className="fin-banner-futuro">
          <span>📊 Valores projetados</span>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="fin-resumo">
        <div className="fin-resumo-card receita">
          <span className="fin-resumo-label">Receitas</span>
          <span className="fin-resumo-valor">{formatarValor(receitas)}</span>
        </div>
        <div className="fin-resumo-card despesa">
          <span className="fin-resumo-label">Despesas</span>
          <span className="fin-resumo-valor">{formatarValor(despesas)}</span>
        </div>
        <div className={`fin-resumo-card resultado ${resultado >= 0 ? 'positivo' : 'negativo'}`}>
          <span className="fin-resumo-label">Resultado</span>
          <span className="fin-resumo-valor">{formatarValor(resultado)}</span>
        </div>
      </div>

      {/* Abas */}
      <div className="fin-abas">
        <button
          className={`fin-aba ${abaAtiva === 'comissoes' ? 'ativa' : ''}`}
          onClick={() => setAbaAtiva('comissoes')}
        >
          Comissões
        </button>
        <button
          className={`fin-aba ${abaAtiva === 'despesas' ? 'ativa' : ''}`}
          onClick={() => setAbaAtiva('despesas')}
        >
          Despesas
        </button>
        <button
          className={`fin-aba ${abaAtiva === 'impostos' ? 'ativa' : ''}`}
          onClick={() => setAbaAtiva('impostos')}
        >
          Impostos
        </button>
      </div>

      {/* Conteúdo das abas */}
      <div className="fin-content">
        {loading ? (
          <div className="fin-loading">Carregando...</div>
        ) : abaAtiva === 'impostos' ? (
          /* Aba Impostos */
          <div className="fin-impostos">
            {/* Alerta de impostos próximos */}
            {impostosProximos.length > 0 && (
              <div className="fin-alerta-impostos">
                <span className="fin-alerta-icon">⚠️</span>
                <div className="fin-alerta-texto">
                  <strong>Vencimentos próximos:</strong>
                  {impostosProximos.map(imp => (
                    <span key={imp.id}>{imp.nome} (dia {imp.dia})</span>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de impostos */}
            <div className="fin-impostos-lista">
              {impostos.length === 0 && (
                <p className="fin-vazio">Nenhum imposto cadastrado</p>
              )}

              {impostos.map(imp => (
                <div key={imp.id} className="fin-imposto-item">
                  <div className="fin-imposto-info">
                    <span className="fin-imposto-nome">{imp.nome}</span>
                    <span className="fin-imposto-dia">Vence dia {imp.dia}</span>
                  </div>
                  <button
                    className="fin-imposto-excluir"
                    onClick={() => excluirImposto(imp.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Formulário novo imposto */}
            <div className="fin-novo-imposto">
              <input
                type="text"
                placeholder="Nome do imposto"
                value={novoImposto.nome}
                onChange={(e) => setNovoImposto({ ...novoImposto, nome: e.target.value })}
              />
              <input
                type="number"
                placeholder="Dia"
                min="1"
                max="31"
                value={novoImposto.dia}
                onChange={(e) => setNovoImposto({ ...novoImposto, dia: e.target.value })}
              />
              <button
                onClick={salvarImposto}
                disabled={salvandoImposto || !novoImposto.nome || !novoImposto.dia}
              >
                +
              </button>
            </div>
          </div>
        ) : (
          /* Aba Comissões ou Despesas */
          <div className="fin-lista">
            {lancamentosAgrupados.length === 0 && (
              <p className="fin-vazio">
                Nenhum lançamento em {MESES[mesAtual].toLowerCase()}
              </p>
            )}

            {lancamentosAgrupados.map(([data, items]) => (
              <div key={data} className="fin-grupo">
                <div className="fin-grupo-header">
                  <span>{formatarDataCompleta(data)}</span>
                </div>
                <div className="fin-grupo-items">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className={`fin-item ${item.tipo_lancamento || 'unico'}`}
                      onClick={() => handleClickLancamento(item)}
                    >
                      <span className="fin-item-icon">
                        {getIconeCategoria(item.categoria, item.tipo)}
                      </span>
                      <div className="fin-item-info">
                        <span className="fin-item-desc">
                          {item.descricao || item.categoria}
                        </span>
                        <span className="fin-item-meta">
                          {item.categoria}
                          {item.tipo_lancamento === 'parcelado' && (
                            <span className="fin-badge parcelado">
                              {item.parcela_atual}/{item.parcelas_total}x
                            </span>
                          )}
                          {item.tipo_lancamento === 'recorrente' && (
                            <span className="fin-badge recorrente">
                              Recorrente
                            </span>
                          )}
                          {item.projetado && (
                            <span className="fin-badge projetado">
                              Projetado
                            </span>
                          )}
                        </span>
                      </div>
                      <span className={`fin-item-valor ${item.tipo}`}>
                        {item.tipo === 'despesa' ? '-' : '+'}{formatarValor(item.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sheet novo lançamento */}
      {mostrarSheet && (
        <NovoLancamento
          onClose={() => setMostrarSheet(false)}
          onSuccess={() => {
            setMostrarSheet(false)
            recarregarLancamentos()
          }}
          isDark={isDark}
        />
      )}

      {/* Sheet de opções para parcelado/recorrente */}
      {mostrarOpcoes && lancamentoSelecionado && (
        <div className="fin-opcoes-overlay" onClick={() => setMostrarOpcoes(false)}>
          <div className="fin-opcoes-sheet" onClick={e => e.stopPropagation()}>
            <div className="fin-opcoes-handle"></div>
            <h3>
              {lancamentoSelecionado.tipo_lancamento === 'parcelado'
                ? `Parcela ${lancamentoSelecionado.parcela_atual}/${lancamentoSelecionado.parcelas_total}`
                : 'Lançamento recorrente'}
            </h3>

            <div className="fin-opcoes-btns">
              <button onClick={excluirAPartirDeste}>
                Cancelar a partir deste mês
              </button>
              <button className="danger" onClick={excluirTodos}>
                Excluir todos
              </button>
              <button className="cancel" onClick={() => setMostrarOpcoes(false)}>
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Financas

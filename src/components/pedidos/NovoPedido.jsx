import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { usePlano } from '../../hooks/usePlano'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import './NovoPedido.css'

const CATEGORIAS_GASTO = [
  { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
  { id: 'cafe', nome: 'Café/Lanche', icone: '☕' },
  { id: 'brinde', nome: 'Brinde', icone: '🎁' },
  { id: 'amostra', nome: 'Amostra', icone: '📦' },
  { id: 'evento', nome: 'Evento', icone: '🎉' },
  { id: 'outros', nome: 'Outros', icone: '💰' }
]

function NovoPedido() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { plano, isStarter, isPro, loading: loadingPlano } = usePlano()
  const { representadaSelecionada } = useRepresentada()

  // Log do plano para debug
  useEffect(() => {
    console.log('[NovoPedido] Plano atual:', plano, 'isStarter:', isStarter, 'isPro:', isPro, 'loading:', loadingPlano)
  }, [plano, isStarter, isPro, loadingPlano])

  // Restaurar dados do sessionStorage
  const dadosSalvos = sessionStorage.getItem('novoPedido')
  const inicial = dadosSalvos ? JSON.parse(dadosSalvos) : {}

  const [canal, setCanal] = useState(inicial.canal || 'presencial')
  const [clienteId, setClienteId] = useState(inicial.clienteId || '')
  const [isDark, setIsDark] = useState(false)

  const [clientes, setClientes] = useState([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [mostrarClientes, setMostrarClientes] = useState(false)

  // Último pedido do cliente
  const [ultimoPedido, setUltimoPedido] = useState(null)

  // Orçamentos em aberto do cliente
  const [orcamentosAbertos, setOrcamentosAbertos] = useState([])
  const [avisoOrcamentoFechado, setAvisoOrcamentoFechado] = useState(false)

  // Gasto colapsado
  const [mostrarGasto, setMostrarGasto] = useState(false)
  const [gastoCategoria, setGastoCategoria] = useState('')
  const [gastoValor, setGastoValor] = useState('')
  const [gastoObs, setGastoObs] = useState('')

  const [salvando, setSalvando] = useState(false)

  // Salvar dados no sessionStorage quando mudam
  useEffect(() => {
    if (clienteId || canal !== 'presencial') {
      sessionStorage.setItem('novoPedido', JSON.stringify({ clienteId, canal }))
    }
  }, [clienteId, canal])

  // Redirecionar Starter para PedidoSimples (aguardar loading do plano)
  useEffect(() => {
    if (loadingPlano) {
      console.log('[NovoPedido] Aguardando plano carregar...')
      return // Não redirecionar enquanto está carregando
    }
    console.log('[NovoPedido] Plano carregado, isStarter:', isStarter)
    if (isStarter) {
      console.log('[NovoPedido] Redirecionando para PedidoSimples')
      navigate('/pedidos/novo/simples', { replace: true })
    }
  }, [isStarter, loadingPlano, navigate])

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar clientes
  useEffect(() => {
    if (!repId) return

    async function fetchClientes() {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cidade')
        .eq('rep_id', repId)
        .order('nome')

      if (data) setClientes(data)
    }

    fetchClientes()
  }, [repId])


  // Buscar último PEDIDO (não orçamento) do cliente selecionado - qualquer representada
  useEffect(() => {
    if (!clienteId || !repId) {
      setUltimoPedido(null)
      return
    }

    async function fetchUltimoPedido() {
      const { data } = await supabase
        .from('pedidos')
        .select('id, valor_total, created_at, status, representada_nome')
        .eq('cliente_id', clienteId)
        .eq('rep_id', repId)
        .eq('status', 'pedido')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setUltimoPedido(data)
      } else {
        setUltimoPedido(null)
      }
    }

    fetchUltimoPedido()
  }, [clienteId, repId])

  // Buscar orçamentos em aberto do cliente
  useEffect(() => {
    if (!clienteId || !repId) {
      setOrcamentosAbertos([])
      setAvisoOrcamentoFechado(false)
      return
    }

    async function fetchOrcamentos() {
      const { data } = await supabase
        .from('pedidos')
        .select('id, valor_total, created_at, status, representada_id, representada_nome')
        .eq('cliente_id', clienteId)
        .eq('rep_id', repId)
        .eq('status', 'orcamento')
        .order('created_at', { ascending: false })

      if (data) {
        setOrcamentosAbertos(data)
        setAvisoOrcamentoFechado(false)
      } else {
        setOrcamentosAbertos([])
      }
    }

    fetchOrcamentos()
  }, [clienteId, repId])

  // Filtrar clientes
  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
    c.cidade?.toLowerCase().includes(buscaCliente.toLowerCase())
  )

  const clienteSelecionado = clientes.find(c => c.id === clienteId)

  function handleValorChange(valorStr) {
    let limpo = valorStr.replace(/[^\d,]/g, '')
    const partes = limpo.split(',')
    if (partes.length > 2) {
      limpo = partes[0] + ',' + partes.slice(1).join('')
    }
    if (partes.length === 2 && partes[1].length > 2) {
      limpo = partes[0] + ',' + partes[1].slice(0, 2)
    }
    setGastoValor(limpo)
  }

  function parsearValor(str) {
    if (!str) return 0
    return parseFloat(str.replace(',', '.')) || 0
  }

  function formatarValor(valor) {
    if (!valor || valor === 0) return 'R$ 0'
    if (valor >= 1000000) {
      return `R$ ${(valor / 1000000).toFixed(1).replace('.', ',')}M`
    }
    if (valor >= 1000) {
      return `R$ ${(valor / 1000).toFixed(1).replace('.', ',')}k`
    }
    return `R$ ${valor.toFixed(0)}`
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    return new Date(dataStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  function diasDesde(dataStr) {
    if (!dataStr) return null
    const diff = Date.now() - new Date(dataStr).getTime()
    return Math.floor(diff / (1000 * 60 * 60 * 24))
  }

  function getCorDias(dias) {
    if (dias === null) return '#888'
    if (dias <= 30) return '#34c759' // verde
    if (dias <= 89) return '#ff9500' // amarelo
    return '#ff3b30' // vermelho
  }

  // Verifica se orçamento é da representada atual
  function isRepresentadaAtual(orc) {
    return representadaSelecionada && orc.representada_id === representadaSelecionada.id
  }

  // Navegar para orçamento
  function navegarOrcamento(orc) {
    if (isRepresentadaAtual(orc)) {
      // Mesma representada - pode editar
      navigate(`/pedidos/${orc.id}`)
    } else {
      // Outra representada - somente leitura
      navigate(`/pedidos/${orc.id}`, { state: { readonly: true, from: 'novo-pedido' } })
    }
  }

  // Ver todos os orçamentos do cliente
  function verTodosOrcamentos() {
    navigate(`/clientes/${clienteId}/orcamentos`, { state: { from: 'novo-pedido' } })
  }

  // Criar novo orçamento (fechar aviso)
  function criarNovoOrcamento() {
    setAvisoOrcamentoFechado(true)
  }

  // Orçamentos a exibir (máximo 2)
  const orcamentosVisiveis = orcamentosAbertos.slice(0, 2)
  const orcamentosRestantes = orcamentosAbertos.length - 2

  // Voltar para lista de pedidos e limpar dados temporários
  function handleVoltar() {
    sessionStorage.removeItem('novoPedido')
    navigate('/pedidos')
  }

  async function continuar() {
    if (!clienteId) {
      alert('Selecione um cliente')
      return
    }
    if (!representadaSelecionada) {
      alert('Selecione uma representada no menu principal')
      return
    }

    setSalvando(true)

    try {
      const hoje = new Date().toISOString().split('T')[0]
      const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const cliente = clientes.find(c => c.id === clienteId)

      let visitaId = null

      // Se presencial, verificar/criar check-in
      if (canal === 'presencial') {
        // Verificar se já existe visita do dia
        const { data: visitaExistente } = await supabase
          .from('visitas')
          .select('id')
          .eq('cliente_id', clienteId)
          .eq('rep_id', repId)
          .eq('data', hoje)
          .single()

        if (visitaExistente) {
          visitaId = visitaExistente.id
        } else {
          // Criar nova visita
          const { data: novaVisita, error: erroVisita } = await supabase
            .from('visitas')
            .insert({
              cliente_id: clienteId,
              rep_id: repId,
              nome_cliente: cliente?.nome,
              cidade: cliente?.cidade,
              data: hoje,
              hora: agora,
              tipo: 'presencial'
            })
            .select()
            .single()

          if (erroVisita) {
            console.error('[NovoPedido] Erro visita:', erroVisita)
          } else {
            visitaId = novaVisita.id

            // Atualizar ultima_visita do cliente
            await supabase
              .from('clientes')
              .update({ ultima_visita: hoje })
              .eq('id', clienteId)
          }
        }

        // Se tem gasto, salvar
        if (mostrarGasto && gastoCategoria && gastoValor) {
          await supabase
            .from('gastos_cliente')
            .insert({
              cliente_id: clienteId,
              rep_id: repId,
              visita_id: visitaId,
              cliente_nome: cliente?.nome,
              categoria: gastoCategoria,
              valor: parsearValor(gastoValor),
              descricao: gastoObs.trim() || null,
              data: hoje
            })
        }
      }

      // Criar pedido - sempre começa como orçamento
      const dadosPedido = {
        rep_id: repId,
        cliente_id: clienteId,
        cliente_nome: cliente?.nome,
        visita_id: visitaId,
        representada_id: representadaSelecionada.id,
        representada_nome: representadaSelecionada.nome,
        status: 'orcamento',
        canal: canal,
        valor_total: 0,
        itens: []
      }

      console.log('[NovoPedido] Inserindo pedido:', JSON.stringify(dadosPedido, null, 2))

      const { data: novoPedido, error: erroPedido } = await supabase
        .from('pedidos')
        .insert(dadosPedido)
        .select()
        .single()

      if (erroPedido) {
        console.error('[NovoPedido] Erro pedido:', {
          message: erroPedido.message,
          code: erroPedido.code,
          details: erroPedido.details,
          hint: erroPedido.hint
        })
        alert(`Erro ao criar pedido:\n${erroPedido.message}\n\nCódigo: ${erroPedido.code || '-'}\nDetalhes: ${erroPedido.details || '-'}\nHint: ${erroPedido.hint || '-'}`)
        setSalvando(false)
        return
      }

      console.log('[NovoPedido] Pedido criado:', novoPedido)

      // Limpar sessionStorage
      sessionStorage.removeItem('novoPedido')

      // Navegar para catálogo
      navigate(`/pedidos/${novoPedido.id}/catalogo`)

    } catch (err) {
      console.error('[NovoPedido] Exceção:', err)
      alert('Erro ao criar pedido')
    }

    setSalvando(false)
  }

  return (
    <div className={`novo-pedido ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="np-header">
        <button className="np-voltar" onClick={handleVoltar}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="np-header-titulo">Novo Pedido</span>
        <div style={{ width: 36 }}></div>
      </header>

      <div className="np-content">
        {/* Canal */}
        <div className="np-secao">
          <label className="np-secao-titulo">Canal de venda</label>
          <div className="np-canal-cards">
            <button
              className={`np-canal-card ${canal === 'presencial' ? 'active' : ''}`}
              onClick={() => setCanal('presencial')}
            >
              <span className="np-canal-icon">🏪</span>
              <span className="np-canal-nome">Presencial</span>
              <span className="np-canal-desc">Registra check-in</span>
            </button>
            <button
              className={`np-canal-card ${canal === 'whatsapp' ? 'active' : ''}`}
              onClick={() => setCanal('whatsapp')}
            >
              <span className="np-canal-icon">💬</span>
              <span className="np-canal-nome">WhatsApp</span>
              <span className="np-canal-desc">Sem visita</span>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '0 4px', marginTop: '6px' }}>
            <span style={{ fontSize: '13px', color: '#888', flexShrink: 0, marginTop: '1px' }}>🔒</span>
            <span style={{ fontSize: '10px', color: '#888', lineHeight: '1.4' }}>
              Uso interno do representante. Esta informação não é compartilhada com clientes ou empresas.
            </span>
          </div>
        </div>

        {/* Cliente */}
        <div className="np-secao">
          <label className="np-secao-titulo">Cliente</label>
          <button
            className="np-select-cliente"
            onClick={() => setMostrarClientes(true)}
          >
            {clienteSelecionado ? (
              <div className="np-cliente-selecionado">
                <span className="np-cliente-nome">{clienteSelecionado.nome}</span>
                <span className="np-cliente-cidade">{clienteSelecionado.cidade}</span>
              </div>
            ) : (
              <span className="np-placeholder">Selecione um cliente</span>
            )}
            <span className="np-seta">›</span>
          </button>
        </div>

        {/* Gasto colapsado (só se presencial) */}
        {canal === 'presencial' && (
          <>
            {!mostrarGasto ? (
              <button className="np-gasto-toggle" onClick={() => setMostrarGasto(true)}>
                <span>💰 Gastou algo com o cliente? Registrar</span>
                <span className="np-gasto-add">+</span>
              </button>
            ) : (
              <div className="np-gasto-form np-gasto-form-expandido">
                <div className="np-gasto-header">
                  <span>Gasto com cliente</span>
                  <button className="np-gasto-remover" onClick={() => {
                    setMostrarGasto(false)
                    setGastoCategoria('')
                    setGastoValor('')
                    setGastoObs('')
                  }}>×</button>
                </div>

                {/* Categoria - scroll horizontal */}
                <div className="np-gasto-categorias-scroll">
                  {CATEGORIAS_GASTO.map(cat => (
                    <button
                      key={cat.id}
                      className={`np-gasto-cat-btn ${gastoCategoria === cat.id ? 'active' : ''}`}
                      onClick={() => setGastoCategoria(cat.id)}
                    >
                      <span className="np-gasto-cat-icon">{cat.icone}</span>
                      <span className="np-gasto-cat-nome">{cat.nome}</span>
                    </button>
                  ))}
                </div>

                {/* Valor - grande e destacado */}
                <div className="np-gasto-valor-grande">
                  <span className="np-gasto-valor-prefix">R$</span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={gastoValor}
                    onChange={(e) => handleValorChange(e.target.value)}
                    inputMode="decimal"
                    className="np-gasto-valor-input"
                  />
                </div>

                {/* Descrição do gasto */}
                <input
                  type="text"
                  className="np-gasto-descricao"
                  placeholder="Descrição do gasto (ex: Almoço no Famiglia)"
                  value={gastoObs}
                  onChange={(e) => setGastoObs(e.target.value)}
                />
              </div>
            )}
          </>
        )}

        {/* Card último pedido */}
        {ultimoPedido && (
          <button
            className="np-ultimo-pedido"
            onClick={() => navigate(`/pedidos/${ultimoPedido.id}`, { state: { readonly: true, from: 'novo-pedido' } })}
          >
            <span className="np-up-icon">📋</span>
            <div className="np-up-info">
              <span className="np-up-titulo">Último pedido</span>
              <div className="np-up-detalhes">
                <span className="np-up-valor">{formatarValor(ultimoPedido.valor_total)}</span>
                <span className="np-up-sep">·</span>
                <span className="np-up-data">{formatarData(ultimoPedido.created_at)}</span>
                <span
                  className="np-up-dias"
                  style={{ color: getCorDias(diasDesde(ultimoPedido.created_at)) }}
                >
                  {diasDesde(ultimoPedido.created_at) === 0
                    ? 'hoje'
                    : `${diasDesde(ultimoPedido.created_at)}d atrás`}
                </span>
              </div>
              {ultimoPedido.representada_nome && (
                <span className="np-up-rep">{ultimoPedido.representada_nome}</span>
              )}
            </div>
            <span className="np-up-seta">›</span>
          </button>
        )}

        {/* Aviso de orçamentos em aberto */}
        {orcamentosAbertos.length > 0 && !avisoOrcamentoFechado && (
          <div className="np-orcamentos-abertos">
            <div className="np-oa-header">
              <span className="np-oa-icon">⚠️</span>
              <span className="np-oa-titulo">
                {orcamentosAbertos.length === 1
                  ? '1 orçamento em aberto'
                  : `${orcamentosAbertos.length} orçamentos em aberto`}
              </span>
            </div>

            <div className="np-oa-lista">
              {orcamentosVisiveis.map(orc => (
                <button
                  key={orc.id}
                  className="np-oa-item"
                  onClick={() => navegarOrcamento(orc)}
                >
                  <div className="np-oa-item-info">
                    <div className="np-oa-item-top">
                      <span className="np-oa-badge">ORC-{String(orc.id).slice(-3)}</span>
                      {isRepresentadaAtual(orc) && (
                        <span className="np-oa-atual">✓ atual</span>
                      )}
                    </div>
                    <span className="np-oa-rep">{orc.representada_nome}</span>
                    <div className="np-oa-item-meta">
                      <span className="np-oa-valor">{formatarValor(orc.valor_total)}</span>
                      <span className="np-oa-sep">·</span>
                      <span className="np-oa-data">{formatarData(orc.created_at)}</span>
                    </div>
                  </div>
                  <span className="np-oa-acao">
                    {isRepresentadaAtual(orc) ? 'Continuar ›' : 'Ver ›'}
                  </span>
                </button>
              ))}
            </div>

            {orcamentosRestantes > 0 && (
              <button className="np-oa-ver-todos" onClick={verTodosOrcamentos}>
                + {orcamentosRestantes} orçamento{orcamentosRestantes > 1 ? 's' : ''} em aberto · Ver todos ›
              </button>
            )}

            <button className="np-oa-criar-novo" onClick={criarNovoOrcamento}>
              Criar novo orçamento
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="np-footer">
        <button
          className="np-btn-continuar"
          onClick={continuar}
          disabled={salvando || !clienteId}
        >
          {salvando ? 'Criando...' : 'Adicionar produtos'}
        </button>
      </div>

      {/* Sheet de clientes */}
      {mostrarClientes && (
        <div className={`np-overlay ${isDark ? 'dark' : 'light'}`} onClick={() => setMostrarClientes(false)}>
          <div className="np-sheet" onClick={e => e.stopPropagation()}>
            <div className="np-handle"></div>
            <h3>Selecionar cliente</h3>

            <div className="np-sheet-busca">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                autoFocus
              />
            </div>

            <div className="np-clientes-lista">
              {clientesFiltrados.slice(0, 20).map(c => (
                <button
                  key={c.id}
                  className={`np-cliente-item ${clienteId === c.id ? 'active' : ''}`}
                  onClick={() => {
                    setClienteId(c.id)
                    setMostrarClientes(false)
                    setBuscaCliente('')
                  }}
                >
                  <div className="np-cliente-info">
                    <span className="np-cliente-nome">{c.nome}</span>
                    <span className="np-cliente-cidade">{c.cidade}</span>
                  </div>
                  {clienteId === c.id && <span className="np-check">✓</span>}
                </button>
              ))}
              {clientesFiltrados.length === 0 && (
                <div className="np-clientes-vazio">Nenhum cliente encontrado</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default NovoPedido

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { formatarInputMoeda, parseMoeda } from '../../utils/formatarMoeda'
import './PedidoSimples.css'

function PedidoSimples() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { repId } = useRepId()

  const clienteId = searchParams.get('cliente')
  const visitaId = searchParams.get('visita')
  const tipoInicial = searchParams.get('tipo') || 'pedido'
  const tipoDefinido = searchParams.has('tipo') // Se veio do check-in, tipo já está definido

  const [cliente, setCliente] = useState(null)
  const [clientes, setClientes] = useState([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState(clienteId || '')
  const [mostrarListaClientes, setMostrarListaClientes] = useState(false)
  const [representadas, setRepresentadas] = useState([])
  const [representadaId, setRepresentadaId] = useState('')
  const [tipo, setTipo] = useState(tipoInicial)
  const [valorTotal, setValorTotal] = useState(0)
  const [valorTotalDisplay, setValorTotalDisplay] = useState('R$ 0,00')
  const [obs, setObs] = useState('')
  const [canal, setCanal] = useState(visitaId ? 'presencial' : 'whatsapp')
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // Se veio do check-in, cliente é fixo
  const clienteFixo = !!clienteId

  const dataHora = new Date()
  const dataFormatada = dataHora.toLocaleDateString('pt-BR')
  const horaFormatada = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar cliente específico (quando vem do check-in)
  useEffect(() => {
    if (!clienteId) return

    async function fetchCliente() {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cidade')
        .eq('id', clienteId)
        .single()

      if (data) setCliente(data)
    }

    fetchCliente()
  }, [clienteId])

  // Carregar lista de clientes (quando não vem do check-in)
  useEffect(() => {
    if (clienteFixo || !repId) return

    async function fetchClientes() {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cidade')
        .eq('rep_id', repId)
        .order('nome')

      if (data) setClientes(data)
    }

    fetchClientes()
  }, [repId, clienteFixo])

  // Filtrar clientes pela busca
  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
    c.cidade?.toLowerCase().includes(buscaCliente.toLowerCase())
  )

  // Selecionar cliente da lista
  function selecionarCliente(c) {
    setCliente(c)
    setClienteSelecionadoId(c.id)
    setBuscaCliente('')
    setMostrarListaClientes(false)
  }

  // Carregar representadas
  useEffect(() => {
    if (!repId) return

    async function fetchRepresentadas() {
      const { data } = await supabase
        .from('representadas')
        .select('id, nome')
        .eq('rep_id', repId)
        .order('nome')

      if (data) {
        setRepresentadas(data)
        if (data.length > 0) setRepresentadaId(data[0].id)
      }
    }

    fetchRepresentadas()
  }, [repId])

  // Formatar valor
  function handleValorChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setValorTotalDisplay(formatted)
    setValorTotal(parseMoeda(formatted))
  }

  async function salvarPedido() {
    if (!cliente || !clienteSelecionadoId) {
      alert('Selecione um cliente')
      return
    }

    if (!valorTotal || valorTotal <= 0) {
      alert('Informe o valor total')
      return
    }

    setSalvando(true)

    try {
      const hoje = new Date().toISOString().split('T')[0]
      const representadaNome = representadas.find(r => r.id === representadaId)?.nome || null

      console.log('[PedidoSimples] Salvando pedido com valor:', valorTotal)
      console.log('[PedidoSimples] valorTotalDisplay:', valorTotalDisplay)
      console.log('[PedidoSimples] parseMoeda result:', parseMoeda(valorTotalDisplay))

      // Criar pedido
      const dadosPedido = {
        rep_id: repId,
        cliente_id: clienteSelecionadoId,
        cliente_nome: cliente?.nome,
        visita_id: visitaId || null,
        representada_id: representadaId || null,
        representada_nome: representadaNome,
        valor_total: valorTotal,
        status: tipo === 'orcamento' ? 'orcamento' : 'pedido',
        canal: canal,
        obs: obs.trim() || null,
        created_at: new Date().toISOString()
      }

      console.log('[PedidoSimples] dadosPedido:', JSON.stringify(dadosPedido, null, 2))

      const { data: novoPedido, error } = await supabase
        .from('pedidos')
        .insert(dadosPedido)
        .select()
        .single()

      console.log('[PedidoSimples] Resposta Supabase:', { data: novoPedido, error })

      if (error) {
        console.error('[PedidoSimples] Erro:', error)
        alert('Erro ao salvar pedido')
        setSalvando(false)
        return
      }

      // Atualizar ultimo_pedido do cliente
      await supabase
        .from('clientes')
        .update({
          ultimo_pedido_data: hoje,
          ultimo_pedido_valor: valorTotal
        })
        .eq('id', clienteSelecionadoId)

      // Navegar de volta
      navigate(`/clientes/${clienteSelecionadoId}`)

    } catch (err) {
      console.error('[PedidoSimples] Exceção:', err)
      alert('Erro ao salvar pedido')
    }

    setSalvando(false)
  }

  return (
    <div className={`pedido-simples ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="ps-header">
        <button className="ps-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="ps-header-center">
          <span className={`ps-badge ${tipo === 'orcamento' ? 'orcamento' : 'pedido'}`}>
            {tipo === 'orcamento' ? 'Orçamento' : 'Pedido'}
          </span>
          <span className="ps-header-titulo">
            {tipo === 'orcamento' ? 'Novo Orçamento' : 'Novo Pedido'}
          </span>
        </div>
        <button
          className="ps-salvar"
          onClick={salvarPedido}
          disabled={salvando}
        >
          {salvando ? '...' : 'Salvar'}
        </button>
      </header>

      {/* Banner check-in */}
      {visitaId && (
        <div className="ps-banner">
          <span>✅ Check-in registrado · {dataFormatada} às {horaFormatada}</span>
        </div>
      )}

      <div className="ps-content">
        {/* 1. Cliente */}
        <div className="ps-campo">
          <label>Cliente *</label>
          {clienteFixo && cliente ? (
            // Cliente fixo (veio do check-in)
            <div className="ps-cliente-fixo">
              <span className="ps-cliente-nome">{cliente.nome}</span>
              <span className="ps-cliente-cidade">{cliente.cidade}</span>
            </div>
          ) : (
            // Seleção de cliente
            <div className="ps-cliente-select">
              {cliente ? (
                <button
                  className="ps-cliente-selecionado"
                  onClick={() => setMostrarListaClientes(true)}
                >
                  <div className="ps-cliente-info">
                    <span className="ps-cliente-nome">{cliente.nome}</span>
                    <span className="ps-cliente-cidade">{cliente.cidade}</span>
                  </div>
                  <span className="ps-cliente-trocar">trocar</span>
                </button>
              ) : (
                <button
                  className="ps-cliente-placeholder"
                  onClick={() => setMostrarListaClientes(true)}
                >
                  <span>Selecionar cliente</span>
                  <span className="ps-seta">›</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 2. Representada */}
        {representadas.length > 0 && (
          <div className="ps-campo">
            <label>Representada</label>
            <select
              className="ps-select"
              value={representadaId}
              onChange={(e) => setRepresentadaId(e.target.value)}
            >
              {representadas.map(r => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </div>
        )}

        {/* Tipo - só mostra se não veio definido do check-in */}
        {!tipoDefinido && (
          <div className="ps-campo">
            <label>Tipo</label>
            <div className="ps-toggle">
              <button
                className={`ps-toggle-btn ${tipo === 'pedido' ? 'active' : ''}`}
                onClick={() => setTipo('pedido')}
              >
                Pedido
              </button>
              <button
                className={`ps-toggle-btn ${tipo === 'orcamento' ? 'active' : ''}`}
                onClick={() => setTipo('orcamento')}
              >
                Orçamento
              </button>
            </div>
          </div>
        )}

        {/* 3. Valor total */}
        <div className="ps-campo">
          <label>Valor total</label>
          <div className="ps-valor-input">
            <input
              type="text"
              placeholder="R$ 0,00"
              value={valorTotalDisplay}
              onChange={(e) => handleValorChange(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Observação */}
        <div className="ps-campo">
          <label>Observação</label>
          <textarea
            className="ps-textarea"
            placeholder="Anotações sobre o pedido..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
          />
        </div>

        {/* Aviso Pro */}
        <div className="ps-aviso-pro">
          <div className="ps-aviso-texto">
            <span className="ps-aviso-icon">🔒</span>
            <span>Catálogo de produtos disponível no plano Pro</span>
          </div>
          <button
            className="ps-aviso-link"
            onClick={() => navigate('/upgrade')}
          >
            Conhecer o Pro →
          </button>
        </div>
      </div>

      {/* Sheet de seleção de cliente */}
      {mostrarListaClientes && (
        <div className="ps-sheet-overlay" onClick={() => setMostrarListaClientes(false)}>
          <div className="ps-sheet" onClick={e => e.stopPropagation()}>
            <div className="ps-sheet-handle"></div>
            <h3>Selecionar cliente</h3>

            {/* Busca */}
            <div className="ps-sheet-busca">
              <input
                type="text"
                placeholder="Buscar por nome ou cidade..."
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                autoFocus
              />
            </div>

            {/* Lista de clientes */}
            <div className="ps-sheet-lista">
              {clientesFiltrados.length === 0 ? (
                <div className="ps-sheet-vazio">
                  {buscaCliente ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
                </div>
              ) : (
                clientesFiltrados.map(c => (
                  <button
                    key={c.id}
                    className={`ps-sheet-item ${clienteSelecionadoId === c.id ? 'active' : ''}`}
                    onClick={() => selecionarCliente(c)}
                  >
                    <div className="ps-sheet-item-info">
                      <span className="ps-sheet-item-nome">{c.nome}</span>
                      <span className="ps-sheet-item-cidade">{c.cidade}</span>
                    </div>
                    {clienteSelecionadoId === c.id && (
                      <span className="ps-sheet-check">✓</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PedidoSimples

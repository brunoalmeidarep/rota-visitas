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
  const [representadas, setRepresentadas] = useState([])
  const [representadaId, setRepresentadaId] = useState('')
  const [tipo, setTipo] = useState(tipoInicial)
  const [valorTotal, setValorTotal] = useState(0)
  const [valorTotalDisplay, setValorTotalDisplay] = useState('R$ 0,00')
  const [obs, setObs] = useState('')
  const [canal, setCanal] = useState('presencial')
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)

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

  // Carregar cliente
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
    if (!valorTotal || valorTotal <= 0) {
      alert('Informe o valor total')
      return
    }

    setSalvando(true)

    try {
      const hoje = new Date().toISOString().split('T')[0]
      const representadaNome = representadas.find(r => r.id === representadaId)?.nome || null

      // Criar pedido
      const { data: novoPedido, error } = await supabase
        .from('pedidos')
        .insert({
          rep_id: repId,
          cliente_id: clienteId,
          cliente_nome: cliente?.nome,
          visita_id: visitaId || null,
          representada_id: representadaId || null,
          representada_nome: representadaNome,
          valor_total: valorTotal,
          status: tipo === 'orcamento' ? 'orcamento' : 'pedido',
          canal: canal,
          obs: obs.trim() || null,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

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
        .eq('id', clienteId)

      // Navegar de volta
      navigate(`/clientes/${clienteId}`)

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
        {/* Cliente */}
        {cliente && (
          <div className="ps-cliente">
            <span className="ps-cliente-nome">{cliente.nome}</span>
            <span className="ps-cliente-cidade">{cliente.cidade}</span>
          </div>
        )}

        {/* Canal */}
        <div className="ps-campo">
          <label>Canal</label>
          <div className="ps-toggle">
            <button
              className={`ps-toggle-btn ${canal === 'presencial' ? 'active' : ''}`}
              onClick={() => setCanal('presencial')}
            >
              🏪 Presencial
            </button>
            <button
              className={`ps-toggle-btn ${canal === 'whatsapp' ? 'active' : ''}`}
              onClick={() => setCanal('whatsapp')}
            >
              📱 WhatsApp
            </button>
          </div>
          {canal === 'whatsapp' && (
            <span className="ps-aviso">Não registra visita presencial</span>
          )}
        </div>

        {/* Representada */}
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

        {/* Valor total */}
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
    </div>
  )
}

export default PedidoSimples

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { usePlano } from '../../hooks/usePlano'
import { formatarInputMoeda, parseMoeda } from '../../utils/formatarMoeda'
import './Checkin.css'

const hojeBR = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date())

const CATEGORIAS_GASTO = [
  { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
  { id: 'cafe', nome: 'Café/Lanche', icone: '☕' },
  { id: 'brinde', nome: 'Brinde', icone: '🎁' },
  { id: 'amostra', nome: 'Amostra', icone: '📦' },
  { id: 'evento', nome: 'Evento', icone: '🎉' },
  { id: 'outros', nome: 'Outros', icone: '💰' }
]

function Checkin() {
  const navigate = useNavigate()
  const { id: clienteId } = useParams()
  const { repId } = useRepId()
  const { plano, isStarter, isPro, loading: loadingPlano } = usePlano()

  // Debug do plano
  useEffect(() => {
    console.log('[Checkin] Plano:', plano, 'isStarter:', isStarter, 'isPro:', isPro, 'loading:', loadingPlano)
  }, [plano, isStarter, isPro, loadingPlano])

  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)

  // Campos do formulário
  const [tipoVisita, setTipoVisita] = useState('')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Gasto
  const [mostrarGasto, setMostrarGasto] = useState(false)
  const [gastoCategoria, setGastoCategoria] = useState('')
  const [gastoValor, setGastoValor] = useState(0)
  const [gastoValorDisplay, setGastoValorDisplay] = useState('R$ 0,00')
  const [gastoDescricao, setGastoDescricao] = useState('')
  const [mostrarCategorias, setMostrarCategorias] = useState(false)

  // Pedido (só Starter)
  const [pedidoValor, setPedidoValor] = useState(0)
  const [pedidoValorDisplay, setPedidoValorDisplay] = useState('')
  const [pedidoTipo, setPedidoTipo] = useState('')

  // Erros
  const [erroTipo, setErroTipo] = useState('')
  const [erroPedido, setErroPedido] = useState('')

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
      setLoading(true)
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, cidade')
        .eq('id', clienteId)
        .single()

      if (error) {
        console.error('[Checkin] Erro ao carregar cliente:', error)
      } else {
        setCliente(data)
      }
      setLoading(false)
    }

    fetchCliente()
  }, [clienteId])

  function handleGastoValorChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setGastoValorDisplay(formatted)
    setGastoValor(parseMoeda(formatted))
  }

  function handlePedidoValorChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setPedidoValorDisplay(formatted)
    setPedidoValor(parseMoeda(formatted))
    if (erroPedido) setErroPedido('')
  }

  function getCategoriaInfo(id) {
    return CATEGORIAS_GASTO.find(c => c.id === id)
  }

  function limparGasto() {
    setMostrarGasto(false)
    setGastoCategoria('')
    setGastoValor(0)
    setGastoValorDisplay('R$ 0,00')
    setGastoDescricao('')
  }

  async function salvarCheckin(tipoPedidoEscolhido = null) {
    // Validar tipo de visita
    if (!tipoVisita) {
      setErroTipo('Escolha um tipo de visita')
      return
    }
    setErroTipo('')

    // Validar pedido (só Starter)
    if (isStarter && pedidoValor > 0 && !tipoPedidoEscolhido) {
      setErroPedido('Escolha se é pedido ou orçamento para registrar o valor, ou limpe o valor para salvar só o check-in.')
      return
    }
    setErroPedido('')

    if (!cliente || !repId) return
    if (loadingPlano) return

    setSalvando(true)

    try {
      const hoje = hojeBR()
      const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      // Passo 1: INSERT em visitas
      const { data: novaVisita, error: erroVisita } = await supabase
        .from('visitas')
        .insert({
          cliente_id: clienteId,
          rep_id: repId,
          nome_cliente: cliente.nome,
          cidade: cliente.cidade,
          data: hoje,
          hora: agora,
          tipo: tipoVisita,
          obs: obs.trim() || null
        })
        .select()
        .single()

      if (erroVisita) {
        console.error('[Checkin] Erro ao criar visita:', erroVisita)
        alert('Erro ao salvar check-in: ' + (erroVisita.message || 'Erro desconhecido'))
        setSalvando(false)
        return
      }

      const visitaId = novaVisita.id
      console.log('[Checkin] Visita criada:', visitaId)

      // Passo 2: INSERT em pedidos (só Starter + valor > 0 + tipo escolhido)
      if (isStarter && pedidoValor > 0 && tipoPedidoEscolhido) {
        const dadosPedido = {
          rep_id: repId,
          cliente_id: clienteId,
          cliente_nome: cliente.nome,
          visita_id: visitaId,
          representada_id: null,
          representada_nome: null,
          valor_total: pedidoValor,
          status: tipoPedidoEscolhido,
          canal: tipoVisita,
          obs: null,
          created_at: new Date().toISOString()
        }

        const { error: erroPedido } = await supabase
          .from('pedidos')
          .insert(dadosPedido)

        if (erroPedido) {
          console.error('[Checkin] Erro ao criar pedido:', erroPedido)
          alert('Check-in salvo, mas pedido falhou. Tente novamente pelo Novo Pedido.')
        } else {
          console.log('[Checkin] Pedido criado com visita_id:', visitaId)

          // Atualizar ultimo_pedido do cliente
          await supabase
            .from('clientes')
            .update({
              ultimo_pedido_data: hoje,
              ultimo_pedido_valor: pedidoValor
            })
            .eq('id', clienteId)
        }
      }

      // Passo 3: INSERT em gastos_cliente (se gasto foi adicionado)
      if (mostrarGasto && gastoCategoria && gastoValor > 0) {
        const { error: erroGasto } = await supabase
          .from('gastos_cliente')
          .insert({
            cliente_id: clienteId,
            rep_id: repId,
            visita_id: visitaId,
            cliente_nome: cliente.nome,
            categoria: gastoCategoria,
            valor: gastoValor,
            descricao: gastoDescricao.trim() || null,
            data: hoje
          })

        if (erroGasto) {
          console.error('[Checkin] Erro ao salvar gasto:', erroGasto)
        } else {
          console.log('[Checkin] Gasto salvo')
        }
      }

      // Passo 4: UPDATE ultima_visita (só se presencial)
      if (tipoVisita === 'presencial') {
        await supabase
          .from('clientes')
          .update({ ultima_visita: hoje })
          .eq('id', clienteId)

        console.log('[Checkin] ultima_visita atualizada')
      }

      // Passo 5: Navigate
      navigate(`/clientes/${clienteId}`)

    } catch (err) {
      console.error('[Checkin] Exceção:', err)
      alert('Erro ao salvar check-in')
    }

    setSalvando(false)
  }

  function handleSalvarComoPedido() {
    if (!tipoVisita) {
      setErroTipo('Escolha um tipo de visita')
      return
    }
    if (pedidoValor <= 0) {
      setErroPedido('Digite um valor para salvar como pedido')
      return
    }
    salvarCheckin('pedido')
  }

  function handleSalvarComoOrcamento() {
    if (!tipoVisita) {
      setErroTipo('Escolha um tipo de visita')
      return
    }
    if (pedidoValor <= 0) {
      setErroPedido('Digite um valor para salvar como orçamento')
      return
    }
    salvarCheckin('orcamento')
  }

  function handleConfirmar() {
    salvarCheckin(null)
  }

  if (loading || loadingPlano) {
    return <div className="checkin-loading">Carregando...</div>
  }

  if (!cliente) {
    return (
      <div className={`checkin-page ${isDark ? 'dark' : 'light'}`}>
        <header className="checkin-header">
          <button className="checkin-voltar" onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="checkin-header-titulo">Check-in</span>
          <div style={{ width: 36 }}></div>
        </header>
        <div className="checkin-erro">Cliente não encontrado</div>
      </div>
    )
  }

  return (
    <div className={`checkin-page ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="checkin-header">
        <button className="checkin-voltar" onClick={() => navigate(`/clientes/${clienteId}`)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="checkin-header-titulo">Check-in</span>
        <div style={{ width: 36 }}></div>
      </header>

      <div className="checkin-content">
        {/* Card cliente */}
        <div className="checkin-cliente-card">
          <span className="checkin-cliente-nome">{cliente.nome}</span>
          <span className="checkin-cliente-cidade">{cliente.cidade || 'Cidade não informada'}</span>
        </div>

        {/* Tipo de visita */}
        <div className="checkin-secao">
          <label className="checkin-label">Tipo de visita *</label>
          <div className="checkin-tipo-btns">
            <button
              className={`checkin-tipo-btn ${tipoVisita === 'presencial' ? 'active' : ''}`}
              onClick={() => { setTipoVisita('presencial'); setErroTipo('') }}
            >
              <span className="checkin-tipo-icon">🏪</span>
              <span>Presencial</span>
            </button>
            <button
              className={`checkin-tipo-btn ${tipoVisita === 'whatsapp' ? 'active' : ''}`}
              onClick={() => { setTipoVisita('whatsapp'); setErroTipo('') }}
            >
              <span className="checkin-tipo-icon">💬</span>
              <span>WhatsApp</span>
            </button>
          </div>
          {erroTipo && <span className="checkin-erro-inline">{erroTipo}</span>}
          <span className="checkin-hint">
            Uso interno do representante. Esta informação não é compartilhada com clientes ou empresas.
          </span>
        </div>

        {/* Observação */}
        <div className="checkin-secao">
          <label className="checkin-label">Observação</label>
          <textarea
            className="checkin-textarea"
            placeholder="Anotações sobre a visita..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
          />
        </div>

        {/* Gasto */}
        <div className="checkin-secao">
          {!mostrarGasto ? (
            <button className="checkin-gasto-toggle" onClick={() => setMostrarGasto(true)}>
              <span>💰 Registrar gasto?</span>
              <span className="checkin-gasto-add">+ Adicionar</span>
            </button>
          ) : (
            <div className="checkin-gasto-form">
              <div className="checkin-gasto-header">
                <span>💰 Gasto com cliente</span>
                <button className="checkin-gasto-remover" onClick={limparGasto}>×</button>
              </div>

              <button
                className="checkin-gasto-categoria-btn"
                onClick={() => setMostrarCategorias(true)}
              >
                {gastoCategoria ? (
                  <>
                    <span>{getCategoriaInfo(gastoCategoria)?.icone}</span>
                    <span>{getCategoriaInfo(gastoCategoria)?.nome}</span>
                  </>
                ) : (
                  <span className="checkin-placeholder">Selecione a categoria</span>
                )}
                <span className="checkin-seta">›</span>
              </button>

              <div className="checkin-gasto-valor">
                <input
                  type="text"
                  placeholder="R$ 0,00"
                  value={gastoValorDisplay}
                  onChange={(e) => handleGastoValorChange(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <input
                type="text"
                className="checkin-gasto-descricao"
                placeholder="Descrição (opcional)"
                value={gastoDescricao}
                onChange={(e) => setGastoDescricao(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Pedido - só Starter */}
        {isStarter && (
          <div className="checkin-secao checkin-pedido-secao">
            <label className="checkin-label">Teve pedido nessa visita?</label>

            <div className="checkin-pedido-valor">
              <span className="checkin-pedido-prefix">R$</span>
              <input
                type="text"
                placeholder="0,00"
                value={pedidoValorDisplay}
                onChange={(e) => handlePedidoValorChange(e.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="checkin-pedido-btns">
              <button
                className="checkin-pedido-btn"
                onClick={handleSalvarComoPedido}
                disabled={salvando}
              >
                Salvar como pedido
              </button>
              <button
                className="checkin-pedido-btn"
                onClick={handleSalvarComoOrcamento}
                disabled={salvando}
              >
                Salvar como orçamento
              </button>
            </div>

            {erroPedido && <span className="checkin-erro-inline">{erroPedido}</span>}

            {pedidoValor > 0 && !pedidoTipo && (
              <span className="checkin-hint checkin-hint-aviso">
                Escolha se é pedido ou orçamento, ou limpe o valor para salvar apenas o check-in.
              </span>
            )}

            {(pedidoValor === 0 || pedidoTipo) && (
              <span className="checkin-hint">
                Deixe em branco se não houve pedido. Check-in será salvo sem pedido.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="checkin-footer">
        <button
          className="checkin-btn-cancelar"
          onClick={() => navigate(`/clientes/${clienteId}`)}
          disabled={salvando}
        >
          Cancelar
        </button>
        <button
          className="checkin-btn-confirmar"
          onClick={handleConfirmar}
          disabled={salvando || (isStarter && pedidoValor > 0 && !pedidoTipo)}
        >
          {salvando ? 'Salvando...' : 'Confirmar'}
        </button>
      </div>

      {/* Sheet de categorias */}
      {mostrarCategorias && (
        <div className="checkin-categorias-overlay" onClick={() => setMostrarCategorias(false)}>
          <div className="checkin-categorias-sheet" onClick={e => e.stopPropagation()}>
            <div className="checkin-handle"></div>
            <h3>Categoria do gasto</h3>
            <div className="checkin-categorias-lista">
              {CATEGORIAS_GASTO.map(cat => (
                <button
                  key={cat.id}
                  className={`checkin-categoria-item ${gastoCategoria === cat.id ? 'active' : ''}`}
                  onClick={() => {
                    setGastoCategoria(cat.id)
                    setMostrarCategorias(false)
                  }}
                >
                  <span className="checkin-categoria-icon">{cat.icone}</span>
                  <span className="checkin-categoria-nome">{cat.nome}</span>
                  {gastoCategoria === cat.id && <span className="checkin-categoria-check">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Checkin

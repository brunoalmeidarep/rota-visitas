import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { usePlano } from '../../hooks/usePlano'
import { abrirPreviewPDF, compartilharPDF } from './PDFOrcamento'
import './DetalhesPedido.css'

function DetalhesPedido() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: pedidoId } = useParams()
  const { repId } = useRepId()
  const { isStarter, isPro, isEnterprise, loading: loadingPlano } = usePlano()

  // Navegacao contextual: se veio do perfil/historico do cliente, voltar para la
  const fromCliente = location.state?.from === 'cliente' || location.state?.from === 'historico'
  const fromNovoPedido = location.state?.from === 'novo-pedido'
  const returnClienteId = location.state?.clienteId
  const isReadonly = location.state?.readonly === true

  function handleVoltar() {
    if (fromCliente && returnClienteId) {
      navigate(`/clientes/${returnClienteId}`)
    } else if (fromNovoPedido) {
      navigate('/pedidos/novo')
    } else {
      navigate('/pedidos')
    }
  }

  const [pedido, setPedido] = useState(null)
  const [representada, setRepresentada] = useState(null)
  const [representante, setRepresentante] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [showEmailSheet, setShowEmailSheet] = useState(false)
  const [showPagamentoSheet, setShowPagamentoSheet] = useState(false)
  const [showTipoSheet, setShowTipoSheet] = useState(false)
  const [gerandoPDF, setGerandoPDF] = useState(false)
  const [toast, setToast] = useState('')
  const [toastTipo, setToastTipo] = useState('sucesso') // 'sucesso' | 'erro'

  // Campos editáveis
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [tipoPedido, setTipoPedido] = useState('Venda')
  const [infoAdicionais, setInfoAdicionais] = useState('')
  const [ocCliente, setOcCliente] = useState('')
  const [erroCondicao, setErroCondicao] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar pedido e dados relacionados
  useEffect(() => {
    if (!pedidoId || !repId) return

    async function fetchPedido() {
      setLoading(true)

      // Buscar pedido
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (error) {
        console.error('[DetalhesPedido] Erro:', error)
      } else if (data) {
        setPedido(data)
        setCondicaoPagamento(data.condicao_pagamento || '')
        setTipoPedido(data.tipo || 'Venda')
        setInfoAdicionais(data.info_adicionais || '')
        setOcCliente(data.oc_cliente || '')

        // Buscar representada
        if (data.representada_id) {
          const { data: repData } = await supabase
            .from('representadas')
            .select('*')
            .eq('id', data.representada_id)
            .single()
          if (repData) setRepresentada(repData)
        }

        // Buscar cliente
        if (data.cliente_id) {
          const { data: cliData } = await supabase
            .from('clientes')
            .select('*')
            .eq('id', data.cliente_id)
            .single()
          if (cliData) setCliente(cliData)
        }
      }

      // Buscar representante
      const { data: reprData } = await supabase
        .from('representantes')
        .select('*')
        .eq('id', repId)
        .single()
      if (reprData) setRepresentante(reprData)

      setLoading(false)
    }

    fetchPedido()
  }, [pedidoId, repId])

  function formatarValor(valor) {
    if (!valor || valor === 0) return 'R$ 0,00'
    if (valor >= 1000000) {
      return `R$ ${(valor / 1000000).toFixed(1).replace('.', ',')}M`
    }
    if (valor >= 10000) {
      return `R$ ${(valor / 1000).toFixed(1).replace('.', ',')}k`
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isEditavel = pedido?.status === 'orcamento' && !isReadonly
  const totalItens = pedido?.itens?.length || 0
  const subtotal = totalItens > 0
    ? (pedido?.itens || []).reduce((acc, item) =>
        acc + (item.subtotal || item.preco_unitario * item.quantidade || 0), 0
      )
    : pedido?.valor_total || 0
  const descontoTotal = pedido?.valor_desconto || 0
  const total = totalItens > 0 ? subtotal - descontoTotal : pedido?.valor_total || 0

  async function salvar() {
    console.log('[salvar] 1. Iniciando...')

    // Validar condição de pagamento
    if (!condicaoPagamento.trim()) {
      setErroCondicao(true)
      setToastTipo('erro')
      setToast('Defina a condição de pagamento')
      setTimeout(() => setToast(''), 3000)
      return
    }
    setErroCondicao(false)

    setSalvando(true)

    const dadosUpdate = {
      condicao_pagamento: condicaoPagamento.trim() || null,
      tipo: tipoPedido || 'Venda',
      info_adicionais: infoAdicionais.trim() || null,
      oc_cliente: ocCliente.trim() || null,
      valor_total: total
    }

    console.log('[salvar] 2. Dados:', JSON.stringify(dadosUpdate, null, 2))
    console.log('[salvar] 3. pedidoId:', pedidoId)

    try {
      const { data, error } = await supabase
        .from('pedidos')
        .update(dadosUpdate)
        .eq('id', pedidoId)
        .select()

      console.log('[salvar] 4. Supabase retornou:', { data, error })

      if (error) {
        console.error('[salvar] ERRO Supabase:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        alert(`Erro ao salvar:\n${error.message}`)
        setSalvando(false)
        return
      }

      console.log('[salvar] 5. Sucesso! Mostrando toast...')
      setToastTipo('sucesso')
      setToast('Pedido salvo!')

      console.log('[salvar] 6. Aguardando 800ms...')
      setTimeout(() => {
        console.log('[salvar] 7. Chamando navigate(/pedidos)...')
        navigate('/pedidos')
        console.log('[salvar] 8. navigate() chamado')
      }, 800)

    } catch (err) {
      console.error('[salvar] EXCECAO:', err)
      alert('Erro ao salvar: ' + err.message)
      setSalvando(false)
    }
  }

  async function gerarPedido() {
    // Validar condição de pagamento
    if (!condicaoPagamento.trim()) {
      setErroCondicao(true)
      setToastTipo('erro')
      setToast('Defina a condição de pagamento antes de gerar o pedido')
      setTimeout(() => setToast(''), 3000)
      return
    }
    setErroCondicao(false)

    if (!confirm('Confirma gerar o pedido? Após gerado, não será mais possível editar.')) {
      return
    }

    setSalvando(true)

    try {
      // Verificar se rep tem empresa_id (Enterprise)
      const { data: rep } = await supabase
        .from('representantes')
        .select('empresa_id, plano')
        .eq('id', repId)
        .single()

      // Gerar número do pedido
      const { data: ultimoPedido } = await supabase
        .from('pedidos')
        .select('numero')
        .eq('rep_id', repId)
        .not('numero', 'is', null)
        .order('numero', { ascending: false })
        .limit(1)

      const novoNumero = (ultimoPedido?.[0]?.numero || 0) + 1

      // Montar dados do update
      const dadosUpdate = {
        status: 'pedido',
        numero: novoNumero,
        condicao_pagamento: condicaoPagamento.trim() || null,
        tipo: tipoPedido || 'Venda',
        info_adicionais: infoAdicionais.trim() || null,
        oc_cliente: ocCliente.trim() || null,
        valor_total: total,
        data_pedido: new Date().toISOString()
      }

      // Se rep tem empresa_id (Enterprise), enviar para aprovação
      if (rep?.empresa_id) {
        dadosUpdate.empresa_id = rep.empresa_id
        dadosUpdate.status_empresa = 'aguardando'
        // Campos denormalizados para o SalesRP (evita JOINs)
        dadosUpdate.cliente_cnpj = cliente?.cnpj_cpf || null
        dadosUpdate.cliente_telefone = cliente?.telefone || null
        dadosUpdate.cliente_cidade = cliente?.cidade || null
        dadosUpdate.cliente_estado = cliente?.estado || null
        dadosUpdate.rep_nome = representante?.nome || null
        dadosUpdate.rep_telefone = representante?.telefone || null
        dadosUpdate.rep_email = representante?.email || null
        dadosUpdate.qtd_itens = pedido?.itens?.length || 0
      }

      const { error } = await supabase
        .from('pedidos')
        .update(dadosUpdate)
        .eq('id', pedidoId)

      if (error) {
        console.error('[DetalhesPedido] Erro:', error)
        alert('Erro ao gerar pedido')
        setSalvando(false)
        return
      }

      // Atualizar ultimo_pedido do cliente
      if (pedido?.cliente_id) {
        await supabase
          .from('clientes')
          .update({
            ultimo_pedido_data: new Date().toISOString().split('T')[0],
            ultimo_pedido_valor: total
          })
          .eq('id', pedido.cliente_id)
      }

      // Recarregar pedido
      const { data: pedidoAtualizado } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (pedidoAtualizado) {
        setPedido(pedidoAtualizado)
      }

      // Mostrar mensagem apropriada
      if (rep?.empresa_id) {
        setToastTipo('sucesso')
        setToast('Pedido enviado para aprovação')
        setTimeout(() => setToast(''), 3000)
      }

    } catch (err) {
      console.error('[DetalhesPedido] Exceção:', err)
      alert('Erro ao gerar pedido')
    }

    setSalvando(false)
  }

  async function duplicarPedido() {
    setSalvando(true)

    try {
      const { data: novoPedido, error } = await supabase
        .from('pedidos')
        .insert({
          ...pedido,
          id: undefined,
          status: 'orcamento',
          numero: null,
          created_at: new Date().toISOString(),
          data_pedido: null
        })
        .select()
        .single()

      if (error) {
        console.error('[DetalhesPedido] Erro duplicar:', error)
        alert('Erro ao duplicar')
      } else {
        navigate(`/pedidos/${novoPedido.id}`)
      }
    } catch (err) {
      console.error('[DetalhesPedido] Exceção:', err)
      alert('Erro ao duplicar')
    }

    setSalvando(false)
  }

  async function verPDF() {
    setGerandoPDF(true)
    try {
      await abrirPreviewPDF(pedido, representada, representante, cliente)
    } catch (err) {
      console.error('[DetalhesPedido] Erro PDF:', err)
      alert('Erro ao gerar PDF')
    }
    setGerandoPDF(false)
  }

  async function handleCompartilhar() {
    setGerandoPDF(true)
    try {
      await compartilharPDF(pedido, representada, representante, cliente)
    } catch (err) {
      console.error('[DetalhesPedido] Erro compartilhar:', err)
      alert('Erro ao compartilhar')
    }
    setGerandoPDF(false)
  }

  async function cancelarOrcamento() {
    if (!confirm('Você tem certeza que deseja cancelar esse orçamento? Esta ação não pode ser desfeita.')) {
      return
    }

    setSalvando(true)

    try {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId)

      if (error) {
        console.error('[DetalhesPedido] Erro ao cancelar:', error)
        alert('Erro ao cancelar orçamento')
        setSalvando(false)
        return
      }

      setToastTipo('sucesso')
      setToast('Orçamento cancelado')
      setTimeout(() => {
        navigate('/pedidos')
      }, 800)

    } catch (err) {
      console.error('[DetalhesPedido] Exceção:', err)
      alert('Erro ao cancelar orçamento')
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <div className={`detalhes-pedido ${isDark ? 'dark' : 'light'}`}>
        <header className="dp-header">
          <button className="dp-voltar" onClick={handleVoltar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="dp-header-titulo">Pedido</span>
          <div style={{ width: 60 }}></div>
        </header>
        <div className="dp-loading">Carregando...</div>
      </div>
    )
  }

  return (
    <div className={`detalhes-pedido ${isDark ? 'dark' : 'light'} ${isReadonly ? 'readonly' : ''}`}>
      {/* Header */}
      <header className="dp-header">
        <button className="dp-voltar" onClick={handleVoltar}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className={`dp-badge ${pedido?.status}`}>
          {pedido?.status === 'orcamento' ? 'Em orçamento' :
           pedido?.status === 'transmitido' ? 'Transmitido' :
           `Pedido #${String(pedido?.numero || 0).padStart(3, '0')}`}
        </span>
        {isEditavel && !isReadonly && (
          <button
            className="dp-salvar"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? '...' : 'Salvar'}
          </button>
        )}
        {(!isEditavel || isReadonly) && <div style={{ width: 60 }}></div>}
      </header>

      {/* Banner somente leitura */}
      {isReadonly && (
        <div className="dp-banner-readonly">
          <span>👁️ Visualização do pedido — somente leitura</span>
        </div>
      )}

      {/* Banner check-in */}
      {!isReadonly && pedido?.canal === 'presencial' && pedido?.visita_id && (
        <div className="dp-banner">
          <span>✅ Check-in · {formatarData(pedido.created_at)}</span>
        </div>
      )}

      <div className="dp-content">
        {/* Informações básicas */}
        <div className="dp-card">
          <div className="dp-info-linha">
            <span className="dp-info-label">Cliente</span>
            <span className="dp-info-valor">{pedido?.cliente_nome}</span>
          </div>
          <div className="dp-info-linha">
            <span className="dp-info-label">Representada</span>
            <span className="dp-info-valor">{pedido?.representada_nome || '-'}</span>
          </div>
          <div className="dp-info-linha">
            <span className="dp-info-label">Data emissão</span>
            <span className="dp-info-valor">{formatarData(pedido?.created_at)}</span>
          </div>
          <div className="dp-info-linha">
            <span className="dp-info-label">Canal</span>
            <span className="dp-info-valor">
              {pedido?.canal === 'whatsapp' ? '💬 WhatsApp' : '🏪 Presencial'}
            </span>
          </div>
        </div>

        {/* Condições comerciais */}
        <div className="dp-card dp-condicoes">
          <div className="dp-card-titulo">Condições comerciais</div>

          {/* Linha 1: Condição de pagamento (obrigatória) */}
          <div
            className={`dp-condicao-linha ${!isEditavel ? 'travado' : ''} ${erroCondicao ? 'erro' : ''}`}
            onClick={isEditavel ? () => { setShowPagamentoSheet(true); setErroCondicao(false); } : undefined}
            style={{ cursor: isEditavel ? 'pointer' : 'default' }}
          >
            <span className="dp-condicao-label">
              Condição pagamento
              {isEditavel && <span style={{ color: '#ff3b30', marginLeft: 2 }}>*</span>}
            </span>
            <div className="dp-condicao-right">
              <span style={{
                color: !isEditavel ? '#888' :
                       condicaoPagamento ? '#007aff' :
                       erroCondicao ? '#ff3b30' : '#ff9500'
              }}>
                {condicaoPagamento || (isEditavel ? 'Selecionar' : '-')}
              </span>
              {isEditavel && <span className="dp-condicao-seta" style={{ color: erroCondicao ? '#ff3b30' : undefined }}>›</span>}
            </div>
          </div>
          {erroCondicao && (
            <div style={{ padding: '0 16px 8px', marginTop: -4 }}>
              <span style={{ fontSize: 12, color: '#ff3b30' }}>Condição de pagamento é obrigatória</span>
            </div>
          )}

          {/* Linha 2: Tipo de pedido */}
          <div
            className={`dp-condicao-linha ${!isEditavel ? 'travado' : ''}`}
            onClick={isEditavel ? () => setShowTipoSheet(true) : undefined}
            style={{ cursor: isEditavel ? 'pointer' : 'default' }}
          >
            <span className="dp-condicao-label">Tipo de pedido</span>
            <div className="dp-condicao-right">
              <span style={{ color: isEditavel ? '#007aff' : '#888' }}>
                {tipoPedido || 'Venda'}
              </span>
              {isEditavel && <span className="dp-condicao-seta">›</span>}
            </div>
          </div>

          {/* Linha 3: Descontos */}
          <div
            className={`dp-condicao-linha ${!isEditavel ? 'travado' : ''}`}
            onClick={isEditavel ? () => navigate(`/pedidos/${pedidoId}/descontos`) : undefined}
            style={{ cursor: isEditavel ? 'pointer' : 'default' }}
          >
            <span className="dp-condicao-label">Descontos</span>
            <div className="dp-condicao-right">
              {descontoTotal > 0 ? (
                <>
                  {pedido?.politica_nome && (
                    <span className="dp-condicao-badge">{pedido.politica_nome}</span>
                  )}
                  <span style={{ color: isEditavel ? '#34c759' : '#888', fontWeight: 600 }}>
                    − {formatarValor(descontoTotal)}
                  </span>
                  {isEditavel && <span className="dp-condicao-seta">›</span>}
                </>
              ) : (
                <>
                  <span style={{ color: '#888' }}>
                    {isEditavel ? 'Nenhum desconto' : '-'}
                  </span>
                  {isEditavel && <span className="dp-condicao-link">Definir ›</span>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Produtos - só mostra seção completa para Pro/Enterprise */}
        {!isStarter && (
          <div className="dp-card">
            <div className="dp-card-header">
              <span className="dp-card-titulo">Produtos ({totalItens})</span>
              {isEditavel && (
                <button
                  className="dp-btn-adicionar"
                  onClick={() => navigate(`/pedidos/${pedidoId}/catalogo`)}
                >
                  + Adicionar
                </button>
              )}
            </div>

            {totalItens === 0 ? (
              <div className="dp-produtos-vazio">
                <p>Nenhum produto adicionado</p>
                {isEditavel && (
                  <button onClick={() => navigate(`/pedidos/${pedidoId}/catalogo`)}>
                    Adicionar produtos
                  </button>
                )}
              </div>
            ) : (
              <div className="dp-produtos-lista">
                {pedido.itens.map((item, index) => {
                  const temDescontoItem = item.desconto_percentual > 0 || item.desconto_valor > 0
                  const temDescontoPolitica = item.politica_desconto
                  const precoOriginal = item.preco_tabela || item.preco_unitario
                  return (
                    <div key={index} className="dp-produto-item">
                      <div className="dp-produto-info">
                        <span className="dp-produto-nome">{item.produto_nome}</span>
                        <span className="dp-produto-codigo">{item.produto_codigo}</span>
                        <div className="dp-produto-precos">
                          {temDescontoItem && (
                            <>
                              <span className="dp-preco-riscado">{formatarValor(precoOriginal)}/un</span>
                              <span className="dp-preco-liquido">{formatarValor(item.preco_unitario)}/un</span>
                            </>
                          )}
                          {!temDescontoItem && (
                            <span className="dp-preco-normal">{formatarValor(item.preco_unitario)}/un</span>
                          )}
                        </div>
                      </div>
                      <div className="dp-produto-right">
                        <span className="dp-produto-qty">{item.quantidade} un</span>
                        <span className="dp-produto-valor">{formatarValor(item.subtotal)}</span>
                        {temDescontoItem && (
                          <span className="dp-badge-desconto-item">
                            desc. {item.desconto_percentual || Math.round((1 - item.preco_unitario / precoOriginal) * 100)}%
                          </span>
                        )}
                        {temDescontoPolitica && (
                          <span className="dp-badge-desconto-politica">{item.politica_desconto}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Resumo */}
        <div className="dp-card dp-resumo">
          <div className="dp-resumo-linha">
            <span>Subtotal</span>
            <span>{formatarValor(subtotal)}</span>
          </div>
          {descontoTotal > 0 && (
            <div className="dp-resumo-linha desconto">
              <span>Descontos</span>
              <span>− {formatarValor(descontoTotal)}</span>
            </div>
          )}
          <div className="dp-resumo-total">
            <span>Total</span>
            <span>{formatarValor(total)}</span>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="dp-card">
          <div className="dp-card-titulo">Informações adicionais</div>
          <textarea
            className="dp-textarea"
            placeholder="Observações, instruções de entrega..."
            value={infoAdicionais}
            onChange={(e) => setInfoAdicionais(e.target.value)}
            disabled={!isEditavel}
            rows={4}
          />

          <div className="dp-campo" style={{ marginTop: 14 }}>
            <label>OC do cliente</label>
            <input
              type="text"
              placeholder="Ex: 29848773"
              value={ocCliente}
              onChange={(e) => setOcCliente(e.target.value)}
              disabled={!isEditavel}
            />
          </div>
        </div>

        {/* Ações (escondidas no modo readonly) */}
        {!isReadonly && (
          <div className="dp-acoes">
            {isEditavel ? (
              <>
                <button className="dp-btn-gerar" onClick={gerarPedido} disabled={salvando}>
                  Gerar pedido
                </button>
                <button
                  className="dp-btn-cancelar-orcamento"
                  onClick={cancelarOrcamento}
                  disabled={salvando}
                >
                  🗑️ Cancelar orçamento
                </button>
              </>
            ) : (
              <>
                <button className="dp-btn-acao" onClick={duplicarPedido} disabled={salvando}>
                  Duplicar
                </button>
                <button className="dp-btn-acao" onClick={verPDF} disabled={salvando}>
                  Ver PDF
                </button>
                <button className="dp-btn-acao" onClick={() => setShowEmailSheet(true)} disabled={salvando}>
                  E-mail
                </button>
                <button className="dp-btn-acao" onClick={handleCompartilhar} disabled={salvando}>
                  Compartilhar
                </button>
              </>
            )}
          </div>
        )}

        {/* Transmitir (Enterprise) */}
        {!isReadonly && isEnterprise && pedido?.status === 'pedido' && (
          <button
            className="dp-btn-transmitir"
            onClick={() => alert('Transmissão em desenvolvimento')}
          >
            Transmitir para indústria
          </button>
        )}
      </div>

      {/* Sheet de e-mail */}
      {showEmailSheet && (
        <div className="dp-sheet-overlay" onClick={() => setShowEmailSheet(false)}>
          <div className="dp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="dp-sheet-header">
              <span>Enviar por e-mail</span>
              <button onClick={() => setShowEmailSheet(false)}>X</button>
            </div>
            <div className="dp-sheet-content">
              <p className="dp-sheet-desc">Selecione os destinatários:</p>
              <label className="dp-check-item">
                <input type="checkbox" defaultChecked />
                <span>Meu e-mail ({representante?.email || '-'})</span>
              </label>
              <label className="dp-check-item">
                <input type="checkbox" defaultChecked />
                <span>Representada ({representada?.email || '-'})</span>
              </label>
              <label className="dp-check-item">
                <input type="checkbox" />
                <span>Cliente ({cliente?.email || '-'})</span>
              </label>
              <button
                className="dp-btn-enviar"
                onClick={() => {
                  alert('Envio de e-mail em desenvolvimento')
                  setShowEmailSheet(false)
                }}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet de condição de pagamento */}
      {showPagamentoSheet && (
        <div className="dp-sheet-overlay" onClick={() => setShowPagamentoSheet(false)}>
          <div className="dp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="dp-sheet-header">
              <span>Condição de pagamento</span>
              <button onClick={() => setShowPagamentoSheet(false)}>✕</button>
            </div>
            <div className="dp-sheet-content">
              <div className="dp-sheet-opcoes">
                {['À vista', '30 dias', '30/60', '30/60/90', '28/56/84', 'Boleto 21 dias'].map(opcao => (
                  <button
                    key={opcao}
                    className={`dp-sheet-opcao ${condicaoPagamento === opcao ? 'active' : ''}`}
                    onClick={() => {
                      setCondicaoPagamento(opcao)
                      setShowPagamentoSheet(false)
                    }}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
              <div className="dp-sheet-custom">
                <input
                  type="text"
                  placeholder="Ou digite personalizado..."
                  value={condicaoPagamento}
                  onChange={(e) => setCondicaoPagamento(e.target.value)}
                />
                <button
                  className="dp-sheet-confirmar"
                  onClick={() => setShowPagamentoSheet(false)}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sheet de tipo de pedido */}
      {showTipoSheet && (
        <div className="dp-sheet-overlay" onClick={() => setShowTipoSheet(false)}>
          <div className="dp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="dp-sheet-header">
              <span>Tipo de pedido</span>
              <button onClick={() => setShowTipoSheet(false)}>✕</button>
            </div>
            <div className="dp-sheet-content">
              <div className="dp-sheet-opcoes">
                {['Venda', 'Bonificação', 'Troca', 'Amostra', 'Consignação'].map(opcao => (
                  <button
                    key={opcao}
                    className={`dp-sheet-opcao ${tipoPedido === opcao ? 'active' : ''}`}
                    onClick={() => {
                      setTipoPedido(opcao)
                      setShowTipoSheet(false)
                    }}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading de geracao de PDF */}
      {gerandoPDF && (
        <div className="dp-pdf-loading">
          <div className="dp-pdf-loading-content">
            <div className="dp-spinner"></div>
            <span>Gerando seu PDF...</span>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`dp-toast ${toastTipo}`}>{toast}</div>
      )}
    </div>
  )
}

export default DetalhesPedido

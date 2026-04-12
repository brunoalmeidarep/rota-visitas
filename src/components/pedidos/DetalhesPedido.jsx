import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { usePlano } from '../../hooks/usePlano'
import { abrirPreviewPDF, compartilharPDF } from './PDFOrcamento'
import './DetalhesPedido.css'

function DetalhesPedido() {
  const navigate = useNavigate()
  const { id: pedidoId } = useParams()
  const { repId } = useRepId()
  const { isEnterprise } = usePlano()

  const [pedido, setPedido] = useState(null)
  const [representada, setRepresentada] = useState(null)
  const [representante, setRepresentante] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [showEmailSheet, setShowEmailSheet] = useState(false)

  // Campos editáveis
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [frete, setFrete] = useState('')
  const [transportadora, setTransportadora] = useState('')
  const [infoAdicionais, setInfoAdicionais] = useState('')
  const [ocCliente, setOcCliente] = useState('')

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
        setFrete(data.frete?.toString().replace('.', ',') || '')
        setTransportadora(data.transportadora || '')
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

  function parsearValor(str) {
    if (!str) return 0
    return parseFloat(str.replace(',', '.')) || 0
  }

  const isEditavel = pedido?.status === 'orcamento'
  const totalItens = pedido?.itens?.length || 0
  const subtotal = (pedido?.itens || []).reduce((acc, item) =>
    acc + (item.subtotal || item.preco_unitario * item.quantidade || 0), 0
  )
  const descontoTotal = pedido?.valor_desconto || 0
  const freteValor = parsearValor(frete)
  const total = subtotal - descontoTotal + freteValor

  async function salvar() {
    console.log('[DetalhesPedido] Iniciando salvar...')
    setSalvando(true)

    const dadosUpdate = {
      condicao_pagamento: condicaoPagamento.trim() || null,
      frete: freteValor || null,
      transportadora: transportadora.trim() || null,
      info_adicionais: infoAdicionais.trim() || null,
      oc_cliente: ocCliente.trim() || null,
      valor_total: total
    }

    console.log('[DetalhesPedido] Dados a salvar:', JSON.stringify(dadosUpdate, null, 2))
    console.log('[DetalhesPedido] pedidoId:', pedidoId)

    try {
      const { data, error } = await supabase
        .from('pedidos')
        .update(dadosUpdate)
        .eq('id', pedidoId)
        .select()

      console.log('[DetalhesPedido] Resultado:', { data, error })

      if (error) {
        console.error('[DetalhesPedido] Erro ao salvar:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        alert(`Erro ao salvar:\n${error.message}`)
      } else {
        console.log('[DetalhesPedido] Salvo com sucesso!')
      }
    } catch (err) {
      console.error('[DetalhesPedido] Excecao:', err)
      alert('Erro ao salvar: ' + err.message)
    }

    setSalvando(false)
  }

  async function gerarPedido() {
    if (!confirm('Confirma gerar o pedido? Após gerado, não será mais possível editar.')) {
      return
    }

    setSalvando(true)

    try {
      // Gerar número do pedido
      const { data: ultimoPedido } = await supabase
        .from('pedidos')
        .select('numero')
        .eq('rep_id', repId)
        .not('numero', 'is', null)
        .order('numero', { ascending: false })
        .limit(1)

      const novoNumero = (ultimoPedido?.[0]?.numero || 0) + 1

      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'pedido',
          numero: novoNumero,
          condicao_pagamento: condicaoPagamento.trim() || null,
          frete: freteValor || null,
          transportadora: transportadora.trim() || null,
          info_adicionais: infoAdicionais.trim() || null,
          oc_cliente: ocCliente.trim() || null,
          valor_total: total,
          data_pedido: new Date().toISOString()
        })
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
    setSalvando(true)
    try {
      await abrirPreviewPDF(pedido, representada, representante, cliente)
    } catch (err) {
      console.error('[DetalhesPedido] Erro PDF:', err)
      alert('Erro ao gerar PDF')
    }
    setSalvando(false)
  }

  async function handleCompartilhar() {
    setSalvando(true)
    try {
      await compartilharPDF(pedido, representada, representante, cliente)
    } catch (err) {
      console.error('[DetalhesPedido] Erro compartilhar:', err)
      alert('Erro ao compartilhar')
    }
    setSalvando(false)
  }

  if (loading) {
    return (
      <div className={`detalhes-pedido ${isDark ? 'dark' : 'light'}`}>
        <header className="dp-header">
          <button className="dp-voltar" onClick={() => navigate(-1)}>
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
    <div className={`detalhes-pedido ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="dp-header">
        <button className="dp-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className={`dp-badge ${pedido?.status}`}>
          {pedido?.status === 'orcamento' ? 'Em orcamento' :
           pedido?.status === 'transmitido' ? 'Transmitido' :
           `Pedido #${String(pedido?.numero || 0).padStart(3, '0')}`}
        </span>
        {isEditavel && (
          <button
            className="dp-salvar"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? '...' : 'Salvar'}
          </button>
        )}
        {!isEditavel && <div style={{ width: 60 }}></div>}
      </header>

      {/* Banner check-in */}
      {pedido?.canal === 'presencial' && pedido?.visita_id && (
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

        {/* Condições */}
        <div className="dp-card">
          <div className="dp-card-titulo">Condições</div>

          <div className="dp-campo">
            <label>Condição de pagamento</label>
            <input
              type="text"
              placeholder="Ex: 30/60/90"
              value={condicaoPagamento}
              onChange={(e) => setCondicaoPagamento(e.target.value)}
              disabled={!isEditavel}
            />
          </div>

          <div className="dp-campo">
            <label>Frete</label>
            <div className="dp-input-valor">
              <span>R$</span>
              <input
                type="text"
                placeholder="0,00"
                value={frete}
                onChange={(e) => {
                  let limpo = e.target.value.replace(/[^\d,]/g, '')
                  setFrete(limpo)
                }}
                inputMode="decimal"
                disabled={!isEditavel}
              />
            </div>
          </div>

          <div className="dp-campo">
            <label>Transportadora</label>
            <input
              type="text"
              placeholder="Nome da transportadora"
              value={transportadora}
              onChange={(e) => setTransportadora(e.target.value)}
              disabled={!isEditavel}
            />
          </div>
        </div>

        {/* Produtos */}
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

        {/* Descontos */}
        <button
          className="dp-card dp-btn-descontos"
          onClick={() => navigate(`/pedidos/${pedidoId}/descontos`)}
          disabled={!isEditavel}
        >
          <span className="dp-card-titulo">Descontos</span>
          <div className="dp-descontos-info">
            <span className="dp-descontos-valor">
              {descontoTotal > 0 ? `− ${formatarValor(descontoTotal)}` : 'Sem desconto'}
            </span>
            <span className="dp-seta">›</span>
          </div>
        </button>

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
          {freteValor > 0 && (
            <div className="dp-resumo-linha">
              <span>Frete</span>
              <span>+ {formatarValor(freteValor)}</span>
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

        {/* Ações */}
        <div className="dp-acoes">
          {isEditavel ? (
            <button className="dp-btn-gerar" onClick={gerarPedido} disabled={salvando}>
              Gerar pedido
            </button>
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

        {/* Transmitir (Enterprise) */}
        {isEnterprise && pedido?.status === 'pedido' && (
          <button
            className="dp-btn-transmitir"
            onClick={() => alert('Transmissao em desenvolvimento')}
          >
            Transmitir para industria
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
              <p className="dp-sheet-desc">Selecione os destinatarios:</p>
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
    </div>
  )
}

export default DetalhesPedido

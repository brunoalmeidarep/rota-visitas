import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { atualizarComOuSemConexao } from '../../lib/queue'
import './DetalhesPedido.css'
import './Catalogo.css'
import './ItensPedido.css'

// Helper: calcula preço efetivo do item (mesma cascata do Catalogo/DetalheProdutoPedido/PDFOrcamento/DetalhesPedido)
const calcularPrecoEfetivo = (item) => {
  const precoBase = Number(item.preco_unitario) || 0
  if (item.preco_negociado_direto != null && Number(item.preco_negociado_direto) > 0) {
    return Number(item.preco_negociado_direto)
  }
  if (item.desconto_percentual != null && Number(item.desconto_percentual) > 0) {
    return precoBase * (1 - Number(item.desconto_percentual) / 100)
  }
  if (item.desconto != null && Number(item.desconto) > 0) {
    return Math.max(0, precoBase - Number(item.desconto))
  }
  return precoBase
}

export default function ItensPedido() {
  const { id: pedidoId } = useParams()
  const navigate = useNavigate()

  const [pedido, setPedido] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [draftQtd, setDraftQtd] = useState({})

  // Detectar modo claro/escuro (mesmo pattern do DetalhesPedido)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar pedido (IndexedDB primeiro, fallback Supabase) — mesmo pattern do DetalhesPedido
  useEffect(() => {
    if (!pedidoId) return

    async function fetchPedido() {
      setLoading(true)

      let data = null
      try {
        data = await db.pedidos.get(pedidoId)
      } catch (e) {
        console.warn('[ItensPedido] Erro IndexedDB pedido:', e)
      }

      if (!data && !String(pedidoId).startsWith('offline_')) {
        const r = await supabase
          .from('pedidos')
          .select('*')
          .eq('id', pedidoId)
          .maybeSingle()
        data = r.data
      }

      if (data) setPedido(data)
      setLoading(false)
    }

    fetchPedido()
  }, [pedidoId])

  // Persiste lista de itens recalculando totais (copiado do DetalhesPedido)
  async function persistirItens(novosItens) {
    const valorBrutoTotal = novosItens.reduce(
      (acc, it) => acc + ((Number(it.preco_unitario) || 0) * (Number(it.quantidade) || 0)),
      0
    )
    const valorDescontoTotal = novosItens.reduce((acc, it) => {
      const precoEfetivo = calcularPrecoEfetivo(it)
      return acc + (((Number(it.preco_unitario) || 0) - precoEfetivo) * (Number(it.quantidade) || 0))
    }, 0)

    const resultado = await atualizarComOuSemConexao(
      'pedidos',
      pedidoId,
      {
        itens: novosItens,
        valor_bruto: valorBrutoTotal,
        valor_desconto: valorDescontoTotal
      },
      { tabelaLocal: 'pedidos' }
    )

    if (!resultado.ok) {
      console.error('[ItensPedido] Erro ao persistir itens:', resultado.motivo)
      alert('Erro ao salvar: ' + resultado.motivo)
      return false
    }

    setPedido(prev => ({
      ...prev,
      itens: novosItens,
      valor_bruto: valorBrutoTotal,
      valor_desconto: valorDescontoTotal,
      valor_liquido: valorBrutoTotal - valorDescontoTotal
    }))
    return true
  }

  // Altera quantidade por delta (copiado do DetalhesPedido)
  async function alterarQuantidadeItem(produtoId, delta) {
    const itens = pedido?.itens || []
    const item = itens.find(i => i.produto_id === produtoId)
    if (!item) return

    const novaQtd = Math.max(0, (Number(item.quantidade) || 0) + delta)

    let novosItens
    if (novaQtd === 0) {
      novosItens = itens.filter(i => i.produto_id !== produtoId)
    } else {
      const precoEfetivo = calcularPrecoEfetivo(item)
      const ipiPct = Number(item.ipi) || 0
      const novoSubtotal = precoEfetivo * (1 + ipiPct / 100) * novaQtd
      novosItens = itens.map(i =>
        i.produto_id === produtoId
          ? { ...i, quantidade: novaQtd, subtotal: novoSubtotal }
          : i
      )
    }
    await persistirItens(novosItens)
  }

  // Define quantidade absoluta (mesma fórmula do alterarQuantidadeItem, valor absoluto do teclado)
  async function setQuantidadeItem(produtoId, valorRaw) {
    const novaQtd = Math.max(0, parseInt(String(valorRaw).replace(/\D/g, ''), 10) || 0)
    const itens = pedido?.itens || []
    const item = itens.find(i => i.produto_id === produtoId)
    if (!item) return

    let novosItens
    if (novaQtd === 0) {
      novosItens = itens.filter(i => i.produto_id !== produtoId)
    } else {
      const precoEfetivo = calcularPrecoEfetivo(item)
      const ipiPct = Number(item.ipi) || 0
      const novoSubtotal = precoEfetivo * (1 + ipiPct / 100) * novaQtd
      novosItens = itens.map(i =>
        i.produto_id === produtoId
          ? { ...i, quantidade: novaQtd, subtotal: novoSubtotal }
          : i
      )
    }
    await persistirItens(novosItens)
  }

  // Exclui item (copiado do DetalhesPedido)
  async function excluirItem(produtoId) {
    if (!confirm('Remover este item do pedido?')) return
    const itens = pedido?.itens || []
    const novosItens = itens.filter(i => i.produto_id !== produtoId)
    await persistirItens(novosItens)
  }

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

  // Valor sempre completo (sem abreviação k/M) — usado no footer de totais
  function formatarValorCompleto(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  async function salvar() {
    setSalvando(true)
    // persistirItens já salva automaticamente quando user altera qtd/exclui.
    // Aqui só voltamos pro pedido com sensação de "concluído".
    await new Promise(r => setTimeout(r, 200))
    setSalvando(false)
    navigate(`/pedidos/${pedidoId}`)
  }

  function handleVoltar() {
    navigate(`/pedidos/${pedidoId}`)
  }

  const itensVisiveis = (pedido?.itens || []).filter(it => (Number(it.quantidade) || 0) > 0)

  // Totais — usar o que o pedido já tem (igual DetalhesPedido)
  const subtotal = pedido?.valor_bruto || 0
  const desconto = pedido?.valor_desconto || 0
  const total = pedido?.valor_liquido || (subtotal - desconto)

  if (loading) return <div className="detalhes-pedido dp-redesign">Carregando...</div>

  return (
    <div className={`detalhes-pedido dp-redesign ip-tela ${isDark ? 'dark' : 'light'}`}>

      <header className="dp-header-novo">
        <button className="dp-voltar" onClick={handleVoltar} aria-label="Voltar">‹</button>
        <span className="dp-titulo">Itens do pedido ({itensVisiveis.length})</span>
        <button className="dp-salvar" onClick={salvar} disabled={salvando}>Salvar</button>
      </header>

      <div className="dp-content-novo">

        <button
          className="dp-btn-primary"
          onClick={() => navigate(`/pedidos/${pedidoId}/catalogo`, { state: { from: 'itens', pedidoId } })}
        >
          + Adicionar produtos
        </button>

        {itensVisiveis.length === 0 ? (
          <div className="ip-vazio">Nenhum item no pedido</div>
        ) : (
          <div className="ip-lista">
            {itensVisiveis.map(item => {
              const precoEfetivo = calcularPrecoEfetivo(item)
              const precoUnitario = Number(item.preco_unitario) || 0
              const temDescontoFamilia = Boolean(item.desconto_familia_pct && Number(item.desconto_familia_pct) > 0)
              const temDescontoRep = precoEfetivo < precoUnitario
              const precoComDesconto = temDescontoFamilia || temDescontoRep
              const ipi = Number(item.ipi) || 0
              const qtd = Number(item.quantidade) || 0
              const subtotalItem = precoEfetivo * (1 + ipi / 100) * qtd
              const fotoUrl = item.foto_url || (item.fotos && item.fotos[0])

              return (
                <div
                  key={item.produto_id}
                  className="cat-produto"
                  onClick={() => navigate(`/pedidos/${pedidoId}/produto/${item.produto_id}`, { state: { from: 'itens', pedidoId } })}
                >
                  <div className="cat-produto-top">
                    <div className="cat-produto-foto">
                      {fotoUrl ? (
                        <img src={fotoUrl} alt={item.produto_nome} loading="lazy" />
                      ) : (
                        <span className="cat-produto-sem-foto">📦</span>
                      )}
                    </div>

                    <div className="cat-produto-info">
                      <span className="cat-produto-nome">{item.produto_nome}</span>
                      {item.codigo_barras && (
                        <span className="cat-produto-label">
                          Ref: <span className="cat-produto-label-val">{item.codigo_barras}</span>
                        </span>
                      )}
                    </div>

                    <div className="cat-produto-meta">
                      {item.produto_fornecedor && (
                        <span className="cat-produto-meta-forn">{item.produto_fornecedor}</span>
                      )}
                      {item.nome_familia && (
                        <span className="cat-produto-meta-cat">{item.nome_familia}</span>
                      )}
                      <span className="cat-produto-meta-cod">
                        Cód: <span className="cat-produto-meta-cod-val">{item.produto_codigo || '-'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="cat-produto-bottom">
                    <div className="cat-produto-preco-area">
                      <span className={`cat-produto-preco ${precoComDesconto ? 'com-desconto' : ''}`}>
                        {formatarValor(precoEfetivo)}/UN
                      </span>
                      {temDescontoFamilia && (
                        <span className="cat-badge-desconto-familia" aria-label="Desconto família ativo">$</span>
                      )}
                    </div>

                    <div className="cat-produto-acoes" onClick={e => e.stopPropagation()}>
                      <button
                        className="cat-btn-qty cat-btn-minus active"
                        onClick={() => alterarQuantidadeItem(item.produto_id, -1)}
                        disabled={qtd <= 1}
                      >
                        −
                      </button>
                      <div className="cat-qty-wrap">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className="cat-qty cat-qty-input active"
                          value={
                            draftQtd[item.produto_id] !== undefined
                              ? draftQtd[item.produto_id]
                              : String(item.quantidade)
                          }
                          onChange={e => {
                            const limpo = e.target.value.replace(/\D/g, '')
                            setDraftQtd(prev => ({ ...prev, [item.produto_id]: limpo }))
                          }}
                          onBlur={() => {
                            const novoValor = parseInt(draftQtd[item.produto_id]) || 0
                            if (novoValor >= 1) {
                              setQuantidadeItem(item.produto_id, novoValor)
                            }
                            setDraftQtd(prev => {
                              const novo = { ...prev }
                              delete novo[item.produto_id]
                              return novo
                            })
                          }}
                          onFocus={e => e.target.select()}
                          onClick={e => { e.stopPropagation(); e.target.select() }}
                          aria-label="Quantidade"
                        />
                        <span className="cat-qty-un">UN</span>
                      </div>
                      <button
                        className="cat-btn-qty cat-btn-plus active"
                        onClick={() => alterarQuantidadeItem(item.produto_id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="ip-subtotal-row" onClick={e => e.stopPropagation()}>
                    <div>
                      <span className="ip-subtotal-label">Subtotal: </span>
                      <span className="ip-subtotal-val">{formatarValorCompleto(subtotalItem)}</span>
                    </div>
                    <button
                      className="ip-excluir"
                      onClick={() => excluirItem(item.produto_id)}
                      aria-label="Remover item"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>

      <footer className="dp-footer-fixo ip-footer">
        <div className="ip-footer-row">
          <span className="lbl">Subtotal</span>
          <span className="val">{formatarValorCompleto(subtotal)}</span>
        </div>
        {desconto > 0 && (
          <div className="ip-footer-row desc">
            <span className="lbl">Descontos</span>
            <span className="val">−{formatarValorCompleto(desconto)}</span>
          </div>
        )}
        <div className="ip-footer-row total">
          <span className="lbl">Total</span>
          <span className="val">{formatarValorCompleto(total)}</span>
        </div>
      </footer>

    </div>
  )
}

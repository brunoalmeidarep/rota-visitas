import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import { salvarCarrinho, lerCarrinho, limparCarrinho } from '../../lib/carrinhoStorage'
import { nomeFornecedor } from '../../utils/fornecedor'
import { db } from '../../lib/db'
import { atualizarComOuSemConexao } from '../../lib/queue'
import './Catalogo.css'

const PAGE_SIZE = 50
const DEBOUNCE_MS = 350

function Catalogo() {
  const navigate = useNavigate()
  const { id: pedidoId } = useParams()
  const location = useLocation()
  const { repId } = useRepId()
  const { representadaSelecionada } = useRepresentada()

  const [pedido, setPedido] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [itens, setItens] = useState({}) // { produtoId: { quantidade, preco_unitario, preco_loja, desconto_familia_pct, nome_familia, ipi, desconto, desconto_percentual, preco_negociado_direto, subtotal } }
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [loading, setLoading] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [temMais, setTemMais] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [isDark, setIsDark] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const carregouDoBanco = useRef(false)
  const paginaRef = useRef(0)
  const sentinelRef = useRef(null)
  const requestIdRef = useRef(0)
  const todosProdutosRef = useRef([])

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [busca])

  // Carregar pedido (IndexedDB primeiro, fallback Supabase se for ID real)
  useEffect(() => {
    if (!pedidoId) return
    async function fetchPedido() {
      let data = null

      // 1. Tenta IndexedDB local primeiro
      try {
        data = await db.pedidos.get(pedidoId)
      } catch (e) {
        console.warn('[Catalogo] Erro IndexedDB pedido:', e)
      }

      // 2. Se não achou local E ID não é offline, busca no Supabase
      if (!data && !String(pedidoId).startsWith('offline_') && navigator.onLine) {
        const r = await supabase
          .from('pedidos')
          .select('*')
          .eq('id', pedidoId)
          .maybeSingle()
        data = r.data
      }

      if (data) {
        setPedido(data)
        // Prioridade: BANCO como fonte da verdade (preserva desconto/preço do detalhe).
        // sessionStorage só como fallback se banco não tiver itens (pedido novo / offline)
        if (data.itens && Array.isArray(data.itens) && data.itens.length > 0) {
          const itensObj = {}
          data.itens.forEach(item => {
            itensObj[item.produto_id] = { ...item }
          })
          setItens(itensObj)
        } else {
          const itensStorage = lerCarrinho(pedidoId)
          if (itensStorage && Object.keys(itensStorage).length > 0) {
            setItens(itensStorage)
          }
        }
        carregouDoBanco.current = true
      } else {
        console.warn('[Catalogo] Pedido não encontrado:', pedidoId)
      }
    }
    fetchPedido()
  }, [pedidoId, location.key])

  // Salvar carrinho no sessionStorage quando itens mudar
  useEffect(() => {
    if (!pedidoId || !carregouDoBanco.current) return
    salvarCarrinho(pedidoId, itens)
  }, [pedidoId, itens])

  // Buscar produtos do IndexedDB local (funciona offline e online)
  useEffect(() => {
    if (!pedido) return
    if (!repId || !representadaSelecionada) return
    const currentRequestId = ++requestIdRef.current
    paginaRef.current = 0
    setLoading(true)
    setTemMais(true)

    async function buscarPrimeiraPagina() {
      try {
        // Carrega TODOS os produtos do IndexedDB (já vem com preço/família/desconto)
        let todos = await db.produtos
          .filter(p => p.ativo === true && p.desativado_manualmente === false)
          .toArray()

        // Filtro por empresa (enterprise) ou rep_id (PRO)
        if (representadaSelecionada?.plano === 'enterprise' && representadaSelecionada?.empresa_id) {
          todos = todos.filter(p => p.empresa_id === representadaSelecionada.empresa_id)
        } else if (repId) {
          todos = todos.filter(p => p.rep_id === repId)
        }

        // Filtro por busca (todas as palavras devem existir em nome, código ou código_barras)
        const termos = (buscaDebounced || '').replace(/,/g, ' ').trim().toLowerCase().split(/\s+/).filter(Boolean)
        if (termos.length > 0) {
          todos = todos.filter(p => {
            const alvo = `${p.nome || ''} ${p.codigo || ''} ${p.codigo_barras || ''} ${p.fornecedor_nome || ''} ${p.nome_familia || ''}`.toLowerCase()
            return termos.every(t => alvo.includes(t))
          })
        }

        // Ordena por nome
        todos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))

        if (currentRequestId !== requestIdRef.current) return

        // Guarda lista completa em ref pra paginação
        todosProdutosRef.current = todos

        // Mostra primeira página (50 produtos)
        const primeiraPagina = todos.slice(0, PAGE_SIZE)
        setProdutos(primeiraPagina)
        setTotalCount(todos.length)
        setTemMais(todos.length > PAGE_SIZE)
      } catch (err) {
        console.error('[Catalogo] Erro busca IndexedDB:', err)
        setProdutos([])
        setTotalCount(0)
        setTemMais(false)
      }
      setLoading(false)
    }
    buscarPrimeiraPagina()
  }, [pedido, buscaDebounced, repId, representadaSelecionada])

  // Carregar próxima página (paginação em memória)
  const carregarMais = useCallback(() => {
    if (carregandoMais || !temMais || loading) return
    setCarregandoMais(true)
    paginaRef.current += 1
    const offset = paginaRef.current * PAGE_SIZE
    const todos = todosProdutosRef.current || []
    const proximaPagina = todos.slice(offset, offset + PAGE_SIZE)
    setProdutos(prev => [...prev, ...proximaPagina])
    setTemMais(offset + PAGE_SIZE < todos.length)
    setCarregandoMais(false)
  }, [carregandoMais, temMais, loading])

  // IntersectionObserver pro infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return
    const el = sentinelRef.current
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          carregarMais()
        }
      },
      { rootMargin: '300px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [carregarMais])

  function alterarQuantidade(produtoId, delta) {
    const produto = produtos.find(p => p.id === produtoId)
    const multiplo = produto?.multiplo_venda || produto?.multiplo || 1

    setItens(prev => {
      const itemAtual = prev[produtoId]
      const qtdAtual = itemAtual?.quantidade || 0
      const novaQtd = Math.max(0, qtdAtual + (delta * multiplo))

      // Remove item se zerou
      if (novaQtd === 0) {
        const { [produtoId]: _, ...rest } = prev
        return rest
      }

      // Se item já existe (com possível desconto/preço negociado), mantém tudo e só recalcula subtotal
      if (itemAtual) {
        // Preço efetivo: respeita preco_negociado_direto, desconto em R$ ou %, ou usa preco_unitario puro
        const precoBase = Number(itemAtual.preco_unitario) || 0
        const ipiPct = Number(itemAtual.ipi) || 0
        let precoEfetivo = precoBase
        if (itemAtual.preco_negociado_direto != null && Number(itemAtual.preco_negociado_direto) > 0) {
          precoEfetivo = Number(itemAtual.preco_negociado_direto)
        } else if (itemAtual.desconto_percentual != null && Number(itemAtual.desconto_percentual) > 0) {
          precoEfetivo = precoBase * (1 - Number(itemAtual.desconto_percentual) / 100)
        } else if (itemAtual.desconto != null && Number(itemAtual.desconto) > 0) {
          precoEfetivo = Math.max(0, precoBase - Number(itemAtual.desconto))
        }
        const precoEfetivoComIpi = precoEfetivo * (1 + ipiPct / 100)
        const novoSubtotal = precoEfetivoComIpi * novaQtd
        return { ...prev, [produtoId]: { ...itemAtual, quantidade: novaQtd, subtotal: novoSubtotal } }
      }

      // Item NOVO — cria com preço de catálogo (com desconto família já aplicado), sem desconto extra
      const precoBase = Number(produto?.preco) || 0
      const precoLoja = Number(produto?.preco_loja) || precoBase
      const descontoFamiliaPct = Number(produto?.desconto_pct_aplicado) || 0
      const nomeFamilia = produto?.nome_familia || null
      const ipiPct = Number(produto?.ipi) || 0
      const precoComIpi = precoBase * (1 + ipiPct / 100)
      const subtotal = precoComIpi * novaQtd
      return {
        ...prev,
        [produtoId]: {
          produto_id: produtoId,
          produto_nome: produto?.nome,
          produto_codigo: produto?.codigo,
          produto_fornecedor: produto?.fornecedores?.nome_fantasia || produto?.fornecedores?.nome || null,
          quantidade: novaQtd,
          preco_unitario: precoBase,
          preco_loja: precoLoja,
          desconto_familia_pct: descontoFamiliaPct,
          nome_familia: nomeFamilia,
          ipi: ipiPct,
          desconto: 0,
          desconto_percentual: null,
          preco_negociado_direto: null,
          subtotal
        }
      }
    })
  }

  // Igual a alterarQuantidade mas com valor ABSOLUTO (pra input de teclado #4)
  function setQuantidadeItem(produtoId, novaQtdRaw) {
    const novaQtd = Math.max(0, parseInt(String(novaQtdRaw).replace(/\D/g, ''), 10) || 0)
    const produto = produtos.find(p => p.id === produtoId)

    setItens(prev => {
      const itemAtual = prev[produtoId]

      if (novaQtd === 0) {
        const { [produtoId]: _, ...rest } = prev
        return rest
      }

      if (itemAtual) {
        // Mantém preço/desconto já negociados, só recalcula subtotal
        const precoBase = Number(itemAtual.preco_unitario) || 0
        const ipiPct = Number(itemAtual.ipi) || 0
        let precoEfetivo = precoBase
        if (itemAtual.preco_negociado_direto != null && Number(itemAtual.preco_negociado_direto) > 0) {
          precoEfetivo = Number(itemAtual.preco_negociado_direto)
        } else if (itemAtual.desconto_percentual != null && Number(itemAtual.desconto_percentual) > 0) {
          precoEfetivo = precoBase * (1 - Number(itemAtual.desconto_percentual) / 100)
        } else if (itemAtual.desconto != null && Number(itemAtual.desconto) > 0) {
          precoEfetivo = Math.max(0, precoBase - Number(itemAtual.desconto))
        }
        const novoSubtotal = precoEfetivo * (1 + ipiPct / 100) * novaQtd
        return { ...prev, [produtoId]: { ...itemAtual, quantidade: novaQtd, subtotal: novoSubtotal } }
      }

      // Item NOVO
      const precoBase = Number(produto?.preco) || 0
      const precoLoja = Number(produto?.preco_loja) || precoBase
      const descontoFamiliaPct = Number(produto?.desconto_pct_aplicado) || 0
      const nomeFamilia = produto?.nome_familia || null
      const ipiPct = Number(produto?.ipi) || 0
      const subtotal = precoBase * (1 + ipiPct / 100) * novaQtd
      return {
        ...prev,
        [produtoId]: {
          produto_id: produtoId,
          produto_nome: produto?.nome,
          produto_codigo: produto?.codigo,
          produto_fornecedor: produto?.fornecedores?.nome_fantasia || produto?.fornecedores?.nome || null,
          quantidade: novaQtd,
          preco_unitario: precoBase,
          preco_loja: precoLoja,
          desconto_familia_pct: descontoFamiliaPct,
          nome_familia: nomeFamilia,
          ipi: ipiPct,
          desconto: 0,
          desconto_percentual: null,
          preco_negociado_direto: null,
          subtotal
        }
      }
    })
  }

  function getUnidadeMultiplo(unidade) {
    const map = { 'UN': 'cx', 'PC': 'cx', 'KG': 'fd', 'L': 'cx', 'M': 'rl' }
    return map[unidade] || 'cx'
  }

  function formatarTotalUnidades() {
    const partes = []
    let totalUn = 0

    Object.entries(itens).forEach(([produtoId, item]) => {
      const produto = produtos.find(p => p.id === produtoId)
      const multiplo = produto?.multiplo_venda || produto?.multiplo || 1
      const qtd = item?.quantidade || 0
      totalUn += qtd

      if (multiplo > 1 && qtd >= multiplo) {
        const qtdMultiplos = Math.floor(qtd / multiplo)
        const unidadeMultiplo = getUnidadeMultiplo(produto?.unidade || 'UN')
        partes.push(`${qtdMultiplos} ${unidadeMultiplo}`)
      }
    })

    if (partes.length > 0) {
      return `${totalUn} un (${partes.join(' + ')})`
    }
    return `${totalUn} un`
  }

  function formatarValor(valor) {
    if (!valor) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  // Totais (do carrinho)
  const totalItens = Object.keys(itens).length
  // Total é a soma dos subtotais salvos no item (já com IPI e desconto aplicados)
  const totalValor = Object.values(itens).reduce((acc, item) => {
    return acc + (Number(item?.subtotal) || 0)
  }, 0)

  // Helper: calcula preço efetivo do item (mesma cascata do DetalheProdutoPedido/PDFOrcamento)
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

  // Persiste state atual no banco antes de navegar pro detalhe.
  // Resolve bug: detalhe lia do banco enquanto state do Catalogo só ia pro banco no Concluir.
  async function irParaDetalhe(produtoId) {
    if (Object.keys(itens).length === 0) {
      // Catálogo vazio — nada a persistir, só navega
      navigate(`/pedidos/${pedidoId}/produto/${produtoId}`)
      return
    }
    const itensArray = Object.values(itens)
    const valorBrutoTotal = itensArray.reduce(
      (acc, it) => acc + ((Number(it.preco_unitario) || 0) * (Number(it.quantidade) || 0)),
      0
    )
    const valorDescontoTotal = itensArray.reduce((acc, it) => {
      const precoEfetivo = calcularPrecoEfetivo(it)
      return acc + (((Number(it.preco_unitario) || 0) - precoEfetivo) * (Number(it.quantidade) || 0))
    }, 0)

    await atualizarComOuSemConexao(
      'pedidos',
      pedidoId,
      {
        itens: itensArray,
        valor_bruto: valorBrutoTotal,
        valor_desconto: valorDescontoTotal
      },
      { tabelaLocal: 'pedidos' }
    )

    navigate(`/pedidos/${pedidoId}/produto/${produtoId}`)
  }

  async function concluir() {
    if (totalItens === 0) {
      alert('Adicione pelo menos um produto')
      return
    }
    setSalvando(true)
    try {
      // Buscar dados completos dos produtos do carrinho (do IndexedDB)
      const idsCarrinho = Object.keys(itens)
      const idsNaLista = new Set(produtos.map(p => p.id))
      const idsFaltantes = idsCarrinho.filter(id => !idsNaLista.has(id))
      let produtosCarrinho = produtos.filter(p => idsCarrinho.includes(p.id))

      if (idsFaltantes.length > 0) {
        // Busca do IndexedDB (já tem preço, fornecedor, etc)
        const faltantes = await db.produtos.bulkGet(idsFaltantes)
        const faltantesValidos = (faltantes || []).filter(Boolean)
        produtosCarrinho = [...produtosCarrinho, ...faltantesValidos]
      }

      // Monta itensArray a partir do state rico (preserva preço negociado/desconto)
      const itensArray = Object.entries(itens).map(([produtoId, item]) => {
        const produto = produtosCarrinho.find(p => p.id === produtoId)
        const fornecedorNome = item.produto_fornecedor
          || produto?.fornecedores?.nome_fantasia
          || produto?.fornecedores?.nome
          || produto?.fornecedor_nome
          || null
        const precoEfetivo = calcularPrecoEfetivo(item)
        const ipiPct = Number(item.ipi) || 0
        const subtotalCalculado = precoEfetivo * (1 + ipiPct / 100) * (Number(item.quantidade) || 0)
        return {
          produto_id: produtoId,
          produto_nome: item.produto_nome || produto?.nome,
          produto_codigo: item.produto_codigo || produto?.codigo,
          produto_fornecedor: fornecedorNome,
          produto_familia: item.nome_familia || produto?.nome_familia || null,
          quantidade: Number(item.quantidade) || 0,
          preco_unitario: Number(item.preco_unitario) || 0,
          preco_loja: Number(item.preco_loja) || 0,
          desconto_familia_pct: Number(item.desconto_familia_pct) || 0,
          nome_familia: item.nome_familia || null,
          ipi: ipiPct,
          desconto: Number(item.desconto) || 0,
          desconto_percentual: item.desconto_percentual != null ? Number(item.desconto_percentual) : null,
          preco_negociado_direto: item.preco_negociado_direto != null ? Number(item.preco_negociado_direto) : null,
          subtotal: subtotalCalculado
        }
      })

      // Totais do pedido (sem IPI nos campos bruto/desconto/líquido, mantém convenção do DetalheProdutoPedido)
      const valorBruto = itensArray.reduce((acc, it) => acc + (it.preco_unitario * it.quantidade), 0)
      const valorDesconto = itensArray.reduce((acc, it) => {
        const precoEfetivo = calcularPrecoEfetivo(it)
        return acc + ((it.preco_unitario - precoEfetivo) * it.quantidade)
      }, 0)
      const resultado = await atualizarComOuSemConexao(
        'pedidos',
        pedidoId,
        {
          itens: itensArray,
          valor_bruto: valorBruto,
          valor_desconto: valorDesconto
          // valor_liquido é generated column no banco — calculado automaticamente
        },
        { tabelaLocal: 'pedidos' }
      )

      if (!resultado.ok) {
        console.error('[Catalogo] Erro:', resultado.motivo)
        alert('Erro ao salvar produtos: ' + resultado.motivo)
        setSalvando(false)
        return
      }

      if (resultado.offline) {
        console.log('[Catalogo] Pedido salvo offline')
      }

      limparCarrinho(pedidoId)
      navigate(`/pedidos/${pedidoId}`)
    } catch (err) {
      console.error('[Catalogo] Exceção:', err)
      alert('Erro ao salvar produtos: ' + (err?.message || err))
    }
    setSalvando(false)
  }

  function cancelar() {
    navigate(`/pedidos/${pedidoId}`)
  }

  return (
    <div className={`catalogo ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="cat-header">
        <button className="cat-cancelar" onClick={cancelar}>
          Cancelar
        </button>
        <span className="cat-header-titulo">Adicionar produtos</span>
        <button
          className="cat-concluir"
          onClick={concluir}
          disabled={salvando || totalItens === 0}
        >
          {salvando ? '...' : 'Concluir'}
        </button>
      </header>

      {/* Busca */}
      <div className="cat-busca-container">
        <div className="cat-busca">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome, código ou código de barras..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button className="cat-busca-limpar" onClick={() => setBusca('')}>×</button>
          )}
        </div>
        {!loading && (
          <div className="cat-resultado-count">
            {totalCount > 0
              ? `${totalCount.toLocaleString('pt-BR')} ${totalCount === 1 ? 'produto' : 'produtos'}`
              : 'Nenhum produto encontrado'}
          </div>
        )}
      </div>

      {/* Lista de produtos */}
      <div className="cat-content">
        {loading ? (
          <div className="cat-loading">Carregando produtos...</div>
        ) : produtos.length === 0 ? (
          <div className="cat-vazio">
            <span className="cat-vazio-icon">📦</span>
            <p>{buscaDebounced ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}</p>
          </div>
        ) : (
          <>
            {produtos.map(produto => {
              const quantidade = itens[produto.id]?.quantidade || 0
              const ipiValor = Number(produto.ipi) || 0
              const temIpi = ipiValor > 0
              const precoComIpi = (produto.preco || 0) * (1 + ipiValor / 100)
              const fotoUrl = (produto.fotos && produto.fotos[0]) || produto.foto_url

              const marcaNome = nomeFornecedor(produto)
              const temDescontoFamilia = (produto.desconto_pct_aplicado || 0) > 0
              return (
                <div
                  key={produto.id}
                  className="cat-produto"
                  onClick={() => irParaDetalhe(produto.id)}
                >
                  <div className="cat-produto-top">
                    <div className="cat-produto-foto">
                      {fotoUrl ? (
                        <img src={fotoUrl} alt={produto.nome} loading="lazy" />
                      ) : (
                        <span className="cat-produto-sem-foto">📦</span>
                      )}
                    </div>

                    <div className="cat-produto-info">
                      <span className="cat-produto-nome">{produto.nome}</span>
                      {produto.codigo_barras && (
                        <span className="cat-produto-label">
                          Ref: <span className="cat-produto-label-val">{produto.codigo_barras}</span>
                        </span>
                      )}
                    </div>

                    <div className="cat-produto-meta">
                      {marcaNome && (
                        <span className="cat-produto-meta-forn">{marcaNome}</span>
                      )}
                      {produto.nome_familia && (
                        <span className="cat-produto-meta-cat">{produto.nome_familia}</span>
                      )}
                      <span className="cat-produto-meta-cod">
                        Cód: <span className="cat-produto-meta-cod-val">{produto.codigo || '-'}</span>
                      </span>
                    </div>
                  </div>

                  <div className="cat-produto-bottom">
                    <div className="cat-produto-preco-area">
                      <span className={`cat-produto-preco ${temDescontoFamilia ? 'com-desconto' : ''}`}>
                        {formatarValor(produto.preco)}/{produto.unidade || 'UN'}
                      </span>
                      {temDescontoFamilia && (
                        <span className="cat-badge-desconto-familia" aria-label="Desconto família ativo">$</span>
                      )}
                    </div>

                    <div className="cat-produto-acoes" onClick={e => e.stopPropagation()}>
                      {(() => {
                        const multiplo = produto.multiplo_venda || produto.multiplo || 1
                        return (
                          <>
                            <button
                              className={`cat-btn-qty cat-btn-minus ${quantidade > 0 ? 'active' : ''}`}
                              onClick={() => alterarQuantidade(produto.id, -1)}
                              disabled={quantidade === 0}
                            >
                              −{multiplo > 1 ? multiplo : ''}
                            </button>
                            <div className="cat-qty-wrap">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                className={`cat-qty cat-qty-input ${quantidade > 0 ? 'active' : ''}`}
                                value={quantidade}
                                onChange={(e) => setQuantidadeItem(produto.id, e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onClick={(e) => { e.stopPropagation(); e.target.select() }}
                                aria-label="Quantidade"
                              />
                              <span className="cat-qty-un">UN</span>
                            </div>
                            <button
                              className={`cat-btn-qty cat-btn-plus ${quantidade > 0 ? 'active' : ''}`}
                              onClick={() => alterarQuantidade(produto.id, 1)}
                            >
                              +{multiplo > 1 ? multiplo : ''}
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Sentinela pro infinite scroll */}
            {temMais && (
              <div ref={sentinelRef} className="cat-sentinel">
                {carregandoMais ? 'Carregando mais...' : ''}
              </div>
            )}

            {!temMais && produtos.length > 0 && (
              <div className="cat-fim-lista">— fim dos resultados —</div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {totalItens > 0 && (
        <div className="cat-footer">
          <div className="cat-footer-info">
            <span className="cat-footer-itens">
              {totalItens} {totalItens === 1 ? 'item' : 'itens'} · {formatarTotalUnidades()}
            </span>
          </div>
          <span className="cat-footer-total">{formatarValor(totalValor)}</span>
        </div>
      )}
    </div>
  )
}

export default Catalogo

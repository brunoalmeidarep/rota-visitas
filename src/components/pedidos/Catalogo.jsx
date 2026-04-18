import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { salvarCarrinho, lerCarrinho, limparCarrinho } from '../../lib/carrinhoStorage'
import './Catalogo.css'

function Catalogo() {
  const navigate = useNavigate()
  const { id: pedidoId } = useParams()
  const { repId } = useRepId()

  const [pedido, setPedido] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [itens, setItens] = useState({}) // { produtoId: quantidade }
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const carregouDoBanco = useRef(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar pedido
  useEffect(() => {
    if (!pedidoId) return

    async function fetchPedido() {
      const { data } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (data) {
        setPedido(data)

        // Prioridade: sessionStorage > banco
        const itensStorage = lerCarrinho(pedidoId)
        if (itensStorage && Object.keys(itensStorage).length > 0) {
          setItens(itensStorage)
        } else if (data.itens && Array.isArray(data.itens)) {
          const itensObj = {}
          data.itens.forEach(item => {
            itensObj[item.produto_id] = item.quantidade
          })
          setItens(itensObj)
        }

        carregouDoBanco.current = true
      }
    }

    fetchPedido()
  }, [pedidoId])

  // Salvar carrinho no sessionStorage quando itens mudar
  useEffect(() => {
    if (!pedidoId || !carregouDoBanco.current) return
    salvarCarrinho(pedidoId, itens)
  }, [pedidoId, itens])

  // Carregar produtos
  useEffect(() => {
    if (!pedido?.representada_id) return

    async function fetchProdutos() {
      setLoading(true)
      const { data } = await supabase
        .from('produtos')
        .select('*')
        .eq('representada_id', pedido.representada_id)
        .eq('ativo', true)
        .order('nome')

      if (data) {
        console.log('[Catalogo] Produtos carregados:', data.length)
        // Remover duplicatas por nome + código (manter o primeiro)
        const uniqueProdutos = data.filter((p, i, arr) =>
          arr.findIndex(x => x.codigo === p.codigo && x.nome === p.nome) === i
        )
        console.log('[Catalogo] Produtos únicos:', uniqueProdutos.length)
        setProdutos(uniqueProdutos)
      }
      setLoading(false)
    }

    fetchProdutos()
  }, [pedido?.representada_id])

  // Filtrar produtos
  const produtosFiltrados = produtos.filter(p => {
    // Filtro por busca
    if (busca) {
      const termo = busca.toLowerCase()
      const matchNome = p.nome?.toLowerCase().includes(termo)
      const matchCodigo = p.codigo?.toLowerCase().includes(termo)
      if (!matchNome && !matchCodigo) return false
    }

    // TODO: Filtro por categoria (reposições, promoções, destaques)
    // Por enquanto só "todos" funciona
    if (filtro !== 'todos') return false

    return true
  })

  function alterarQuantidade(produtoId, delta) {
    const produto = produtos.find(p => p.id === produtoId)
    const multiplo = produto?.multiplo_venda || produto?.multiplo || 1

    setItens(prev => {
      const atual = prev[produtoId] || 0
      const nova = Math.max(0, atual + (delta * multiplo))
      if (nova === 0) {
        const { [produtoId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [produtoId]: nova }
    })
  }

  function formatarQuantidadeComMultiplo(quantidade, produto) {
    const multiplo = produto?.multiplo_venda || produto?.multiplo || 1
    if (multiplo <= 1) return quantidade.toString()

    const unidade = produto?.unidade || 'UN'
    const unidadeMultiplo = getUnidadeMultiplo(unidade)
    const qtdMultiplos = Math.floor(quantidade / multiplo)

    if (qtdMultiplos > 0) {
      return `${quantidade} ${unidade} (${qtdMultiplos} ${unidadeMultiplo})`
    }
    return quantidade.toString()
  }

  function getUnidadeMultiplo(unidade) {
    const map = {
      'UN': 'cx',
      'PC': 'cx',
      'KG': 'fd',
      'L': 'cx',
      'M': 'rl'
    }
    return map[unidade] || 'cx'
  }

  function formatarTotalUnidades() {
    const partes = []
    let totalUn = 0

    Object.entries(itens).forEach(([produtoId, qtd]) => {
      const produto = produtos.find(p => p.id === produtoId)
      const multiplo = produto?.multiplo_venda || produto?.multiplo || 1
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

  // Calcular totais
  const totalItens = Object.keys(itens).length
  const totalUnidades = Object.values(itens).reduce((acc, q) => acc + q, 0)
  const totalValor = Object.entries(itens).reduce((acc, [produtoId, qtd]) => {
    const produto = produtos.find(p => p.id === produtoId)
    if (!produto) return acc
    const ipiValor = Number(produto.ipi) || 0
    const precoComIpi = (produto.preco || 0) * (1 + ipiValor / 100)
    return acc + (precoComIpi * qtd)
  }, 0)

  async function concluir() {
    if (totalItens === 0) {
      alert('Adicione pelo menos um produto')
      return
    }

    setSalvando(true)

    try {
      // Converter itens para array
      const itensArray = Object.entries(itens).map(([produtoId, quantidade]) => {
        const produto = produtos.find(p => p.id === produtoId)
        return {
          produto_id: produtoId,
          produto_nome: produto?.nome,
          produto_codigo: produto?.codigo,
          quantidade,
          preco_unitario: produto?.preco || 0,
          ipi: produto?.ipi || 0,
          desconto: 0,
          subtotal: (produto?.preco || 0) * quantidade
        }
      })

      // Atualizar pedido
      const { error } = await supabase
        .from('pedidos')
        .update({
          itens: itensArray,
          valor_total: totalValor
        })
        .eq('id', pedidoId)

      if (error) {
        console.error('[Catalogo] Erro:', error)
        alert('Erro ao salvar produtos')
        setSalvando(false)
        return
      }

      // Limpar carrinho do storage após sucesso
      limparCarrinho(pedidoId)

      // Navegar para detalhe do pedido
      navigate(`/pedidos/${pedidoId}`)

    } catch (err) {
      console.error('[Catalogo] Exceção:', err)
      alert('Erro ao salvar produtos')
    }

    setSalvando(false)
  }

  function cancelar() {
    // Voltar para a tela do pedido
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
            placeholder="Buscar por nome ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button className="cat-busca-limpar" onClick={() => setBusca('')}>×</button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="cat-filtros">
        <button
          className={`cat-filtro ${filtro === 'todos' ? 'active' : ''}`}
          onClick={() => setFiltro('todos')}
        >
          Todos
        </button>
        <button
          className={`cat-filtro ${filtro === 'reposicoes' ? 'active' : ''}`}
          onClick={() => setFiltro('reposicoes')}
        >
          Reposições
        </button>
        <button
          className={`cat-filtro ${filtro === 'promocoes' ? 'active' : ''}`}
          onClick={() => setFiltro('promocoes')}
        >
          Promoções
        </button>
        <button
          className={`cat-filtro ${filtro === 'destaques' ? 'active' : ''}`}
          onClick={() => setFiltro('destaques')}
        >
          Destaques
        </button>
      </div>

      {/* Lista de produtos */}
      <div className="cat-content">
        {loading ? (
          <div className="cat-loading">Carregando produtos...</div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="cat-vazio">
            <span className="cat-vazio-icon">📦</span>
            <p>{busca ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</p>
          </div>
        ) : (
          produtosFiltrados.map(produto => {
            const quantidade = itens[produto.id] || 0
            const ipiValor = Number(produto.ipi) || 0
            const temIpi = ipiValor > 0
            const precoComIpi = (produto.preco || 0) * (1 + ipiValor / 100)

            return (
              <div
                key={produto.id}
                className="cat-produto"
                onClick={() => navigate(`/pedidos/${pedidoId}/produto/${produto.id}`)}
              >
                <div className="cat-produto-foto">
                  {produto.fotos && produto.fotos.length > 0 ? (
                    <img src={produto.fotos[0]} alt={produto.nome} />
                  ) : (
                    <span className="cat-produto-sem-foto">📦</span>
                  )}
                </div>

                <div className="cat-produto-info">
                  <span className="cat-produto-nome">{produto.nome}</span>
                  <span className="cat-produto-codigo">{produto.codigo}</span>
                  <div className="cat-produto-preco-row">
                    <span className="cat-produto-preco">
                      {formatarValor(produto.preco)}/{produto.unidade || 'UN'}
                    </span>
                    {temIpi && (
                      <span className="cat-badge-ipi">IPI {produto.ipi}%</span>
                    )}
                  </div>
                  {temIpi && (
                    <span className="cat-produto-preco-ipi">
                      c/ IPI: {formatarValor(precoComIpi)}
                    </span>
                  )}
                </div>

                <div className="cat-produto-acoes" onClick={e => e.stopPropagation()}>
                  {(() => {
                    const multiplo = produto.multiplo_venda || produto.multiplo || 1
                    return (
                      <>
                        <button
                          className={`cat-btn-qty ${quantidade > 0 ? 'active' : ''}`}
                          onClick={() => alterarQuantidade(produto.id, -1)}
                          disabled={quantidade === 0}
                        >
                          −{multiplo > 1 ? multiplo : ''}
                        </button>
                        <span className={`cat-qty ${quantidade > 0 ? 'active' : ''}`}>
                          {quantidade}
                        </span>
                        <button
                          className={`cat-btn-qty ${quantidade > 0 ? 'active' : ''}`}
                          onClick={() => alterarQuantidade(produto.id, 1)}
                        >
                          +{multiplo > 1 ? multiplo : ''}
                        </button>
                      </>
                    )
                  })()}
                </div>
              </div>
            )
          })
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

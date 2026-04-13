import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatarInputMoeda, parseMoeda, formatarValor } from '../../utils/formatarMoeda'
import './DetalheProdutoPedido.css'

function DetalheProdutoPedido() {
  const navigate = useNavigate()
  const { id: pedidoId, produtoId } = useParams()

  const [produto, setProduto] = useState(null)
  const [pedido, setPedido] = useState(null)
  const [quantidade, setQuantidade] = useState(0)
  const [tipoDesconto, setTipoDesconto] = useState('percentual') // 'percentual' | 'valor'
  const [descontoPercentual, setDescontoPercentual] = useState('')
  const [descontoReais, setDescontoReais] = useState(0)
  const [descontoReaisDisplay, setDescontoReaisDisplay] = useState('R$ 0,00')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [mostrarDescricao, setMostrarDescricao] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar produto e pedido
  useEffect(() => {
    async function fetchDados() {
      setLoading(true)

      const [produtoRes, pedidoRes] = await Promise.all([
        supabase.from('produtos').select('*').eq('id', produtoId).single(),
        supabase.from('pedidos').select('*').eq('id', pedidoId).single()
      ])

      if (produtoRes.data) setProduto(produtoRes.data)
      if (pedidoRes.data) {
        setPedido(pedidoRes.data)
        // Verificar se já tem este item no pedido
        const itemExistente = pedidoRes.data.itens?.find(i => i.produto_id === produtoId)
        if (itemExistente) {
          setQuantidade(itemExistente.quantidade || 0)
          if (itemExistente.desconto_percentual) {
            setTipoDesconto('percentual')
            setDescontoPercentual(itemExistente.desconto_percentual.toString().replace('.', ','))
          } else if (itemExistente.desconto) {
            setTipoDesconto('valor')
            setDescontoReais(itemExistente.desconto)
            setDescontoReaisDisplay(formatarInputMoeda((itemExistente.desconto * 100).toString()))
          }
        }
      }

      setLoading(false)
    }

    fetchDados()
  }, [produtoId, pedidoId])

  function handleDescontoPercentualChange(valor) {
    let limpo = valor.replace(/[^\d,]/g, '')
    const partes = limpo.split(',')
    if (partes.length > 2) {
      limpo = partes[0] + ',' + partes.slice(1).join('')
    }
    if (partes.length === 2 && partes[1].length > 2) {
      limpo = partes[0] + ',' + partes[1].slice(0, 2)
    }
    setDescontoPercentual(limpo)
  }

  function handleDescontoReaisChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setDescontoReaisDisplay(formatted)
    setDescontoReais(parseMoeda(formatted))
  }

  function parsearPercentual(str) {
    if (!str) return 0
    return parseFloat(str.replace(',', '.')) || 0
  }

  // Cálculos
  const precoTabela = produto?.preco || 0
  const ipi = produto?.ipi || 0
  const precoComIpi = precoTabela * (1 + ipi / 100)

  const descontoPercentualNum = parsearPercentual(descontoPercentual)
  let valorDesconto = 0
  if (tipoDesconto === 'percentual' && descontoPercentualNum > 0) {
    valorDesconto = precoTabela * (descontoPercentualNum / 100)
  } else if (tipoDesconto === 'valor') {
    valorDesconto = descontoReais
  }

  const precoLiquido = Math.max(0, precoTabela - valorDesconto)
  const precoLiquidoComIpi = precoLiquido * (1 + ipi / 100)
  const subtotal = precoLiquidoComIpi * quantidade

  async function salvar() {
    setSalvando(true)

    try {
      // Atualizar ou adicionar item ao pedido
      const itensAtuais = pedido?.itens || []
      const indexExistente = itensAtuais.findIndex(i => i.produto_id === produtoId)

      let novosItens
      if (quantidade === 0) {
        // Remover item
        novosItens = itensAtuais.filter(i => i.produto_id !== produtoId)
      } else {
        const novoItem = {
          produto_id: produtoId,
          produto_nome: produto?.nome,
          produto_codigo: produto?.codigo,
          quantidade,
          preco_unitario: precoTabela,
          ipi,
          desconto: valorDesconto,
          desconto_percentual: tipoDesconto === 'percentual' ? descontoPercentualNum : null,
          subtotal
        }

        if (indexExistente >= 0) {
          novosItens = [...itensAtuais]
          novosItens[indexExistente] = novoItem
        } else {
          novosItens = [...itensAtuais, novoItem]
        }
      }

      // Recalcular total
      const novoTotal = novosItens.reduce((acc, item) => acc + (item.subtotal || 0), 0)

      const { error } = await supabase
        .from('pedidos')
        .update({
          itens: novosItens,
          valor_total: novoTotal
        })
        .eq('id', pedidoId)

      if (error) {
        console.error('[DetalheProdutoPedido] Erro:', error)
        alert('Erro ao salvar')
        setSalvando(false)
        return
      }

      navigate(-1)

    } catch (err) {
      console.error('[DetalheProdutoPedido] Exceção:', err)
      alert('Erro ao salvar')
    }

    setSalvando(false)
  }

  if (loading) {
    return (
      <div className={`detalhe-produto-pedido ${isDark ? 'dark' : 'light'}`}>
        <header className="dpp-header">
          <button className="dpp-cancelar" onClick={() => navigate(-1)}>Cancelar</button>
          <span className="dpp-header-titulo">Produto</span>
          <div style={{ width: 60 }}></div>
        </header>
        <div className="dpp-loading">Carregando...</div>
      </div>
    )
  }

  return (
    <div className={`detalhe-produto-pedido ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="dpp-header">
        <button className="dpp-cancelar" onClick={() => navigate(-1)}>
          Cancelar
        </button>
        <span className="dpp-header-titulo">
          {produto?.nome?.length > 20
            ? produto.nome.slice(0, 20) + '...'
            : produto?.nome}
        </span>
        <button
          className="dpp-salvar"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? '...' : 'Salvar'}
        </button>
      </header>

      <div className="dpp-content">
        {/* Foto */}
        <div className="dpp-foto">
          {produto?.fotos && produto.fotos.length > 0 ? (
            <img src={produto.fotos[0]} alt={produto.nome} />
          ) : (
            <span className="dpp-sem-foto">📦</span>
          )}
        </div>

        {/* Informações */}
        <div className="dpp-card">
          <h2 className="dpp-nome">{produto?.nome}</h2>

          <div className="dpp-info-grid">
            <div className="dpp-info-item">
              <span className="dpp-info-label">Ref:</span>
              <span className="dpp-info-valor">{produto?.codigo || '-'}</span>
            </div>
            <div className="dpp-info-item">
              <span className="dpp-info-label">NCM:</span>
              <span className="dpp-info-valor">{produto?.ncm || '-'}</span>
            </div>
            <div className="dpp-info-item">
              <span className="dpp-info-label">IPI:</span>
              <span className="dpp-info-valor">{ipi}%</span>
            </div>
            {produto?.codigo_barras && (
              <div className="dpp-info-item">
                <span className="dpp-info-label">Cód. barras:</span>
                <span className="dpp-info-valor">{produto.codigo_barras}</span>
              </div>
            )}
          </div>

          {produto?.descricao && (
            <div className="dpp-descricao">
              <span className="dpp-descricao-titulo">Sobre o produto</span>
              <p className={`dpp-descricao-texto ${mostrarDescricao ? 'expandido' : ''}`}>
                {produto.descricao}
              </p>
              {produto.descricao.length > 100 && (
                <button
                  className="dpp-ver-mais"
                  onClick={() => setMostrarDescricao(!mostrarDescricao)}
                >
                  {mostrarDescricao ? 'Ver menos' : 'Ver mais'}
                </button>
              )}
            </div>
          )}

          <div className="dpp-preco-tabela">
            <span className="dpp-preco-label">Tabela de preço</span>
            <span className="dpp-preco-valor">
              {formatarValor(precoTabela)}/{produto?.unidade || 'UN'}
            </span>
          </div>

          {produto?.multiplo && produto.multiplo > 1 && (
            <div className="dpp-multiplo">
              <span>Múltiplo de venda: {produto.multiplo} unidades</span>
            </div>
          )}
        </div>

        {/* Quantidade */}
        <div className="dpp-card">
          <div className="dpp-card-titulo">Quantidade</div>
          <div className="dpp-quantidade">
            <button
              className="dpp-qty-btn"
              onClick={() => setQuantidade(Math.max(0, quantidade - (produto?.multiplo || 1)))}
            >
              −
            </button>
            <span className="dpp-qty-valor">{quantidade}</span>
            <button
              className="dpp-qty-btn"
              onClick={() => setQuantidade(quantidade + (produto?.multiplo || 1))}
            >
              +
            </button>
          </div>
        </div>

        {/* Desconto por item */}
        <div className="dpp-card">
          <div className="dpp-card-titulo">Desconto no item</div>

          <div className="dpp-desconto-toggle">
            <button
              className={`dpp-desconto-btn ${tipoDesconto === 'percentual' ? 'active' : ''}`}
              onClick={() => setTipoDesconto('percentual')}
            >
              %
            </button>
            <button
              className={`dpp-desconto-btn ${tipoDesconto === 'valor' ? 'active' : ''}`}
              onClick={() => setTipoDesconto('valor')}
            >
              R$
            </button>
          </div>

          {tipoDesconto === 'percentual' ? (
            <div className="dpp-desconto-input">
              <span className="dpp-desconto-prefix">%</span>
              <input
                type="text"
                placeholder="0,00"
                value={descontoPercentual}
                onChange={(e) => handleDescontoPercentualChange(e.target.value)}
                inputMode="decimal"
              />
            </div>
          ) : (
            <div className="dpp-desconto-input">
              <input
                type="text"
                placeholder="R$ 0,00"
                value={descontoReaisDisplay}
                onChange={(e) => handleDescontoReaisChange(e.target.value)}
                inputMode="numeric"
              />
            </div>
          )}

          {valorDesconto > 0 && (
            <div className="dpp-economia">
              <span>Economia: − {formatarValor(valorDesconto * quantidade)}</span>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div className="dpp-card dpp-resumo">
          <div className="dpp-resumo-linha">
            <span>Preço tabela</span>
            <span>{formatarValor(precoTabela)}</span>
          </div>
          {ipi > 0 && (
            <div className="dpp-resumo-linha">
              <span>IPI ({ipi}%)</span>
              <span>+ {formatarValor(precoTabela * ipi / 100)}</span>
            </div>
          )}
          {valorDesconto > 0 && (
            <div className="dpp-resumo-linha desconto">
              <span>Desconto</span>
              <span>− {formatarValor(valorDesconto)}</span>
            </div>
          )}
          <div className="dpp-resumo-linha liquido">
            <span>Preço líquido</span>
            <span>{formatarValor(precoLiquidoComIpi)}</span>
          </div>
          <div className="dpp-resumo-total">
            <span>Subtotal ({quantidade} un)</span>
            <span>{formatarValor(subtotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DetalheProdutoPedido

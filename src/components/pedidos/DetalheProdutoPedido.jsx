import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { atualizarComOuSemConexao } from '../../lib/queue'
import { formatarInputMoeda, parseMoeda, formatarValor } from '../../utils/formatarMoeda'
import { nomeFornecedor } from '../../utils/fornecedor'
import { calcularPrecoEfetivo } from '../../lib/precos'
import './DetalheProdutoPedido.css'

function DetalheProdutoPedido() {
  const navigate = useNavigate()
  const { id: pedidoId, produtoId } = useParams()
  const location = useLocation()

  function handleVoltar() {
    const from = location.state?.from
    const pid = location.state?.pedidoId || pedidoId
    if (from === 'itens' && pid) {
      navigate(`/pedidos/${pid}/itens`)
      return
    }
    if (from === 'descontos' && pid) {
      navigate(`/pedidos/${pid}/descontos`)
      return
    }
    navigate(-1)
  }

  const [produto, setProduto] = useState(null)
  const [pedido, setPedido] = useState(null)
  const [quantidade, setQuantidade] = useState(0)
  const [tipoDesconto, setTipoDesconto] = useState('percentual') // 'percentual' | 'valor' | 'preco'
  const [descontoPercentual, setDescontoPercentual] = useState('')
  const [descontoReais, setDescontoReais] = useState(0)
  const [descontoReaisDisplay, setDescontoReaisDisplay] = useState('R$ 0,00')
  const [precoNegociado, setPrecoNegociado] = useState(0)
  const [precoNegociadoDisplay, setPrecoNegociadoDisplay] = useState('R$ 0,00')
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
        supabase.from('produtos').select('*, fornecedores(nome, nome_fantasia)').eq('id', produtoId).single(),
        supabase.from('pedidos').select('*').eq('id', pedidoId).single()
      ])

      // Busca info de desconto da família
      const { data: precoInfo } = await supabase
        .from('produtos_com_preco_distribuidora')
        .select('preco_loja, preco_distribuidora, desconto_pct_aplicado, nome_familia')
        .eq('produto_id', produtoId)
        .single()

      // Adiciona ao produto
      if (produtoRes.data) {
        if (precoInfo) {
          produtoRes.data.preco_loja = precoInfo.preco_loja
          produtoRes.data.preco_distribuidora = precoInfo.preco_distribuidora
          produtoRes.data.desconto_pct_aplicado = Number(precoInfo.desconto_pct_aplicado) || 0
          produtoRes.data.nome_familia = precoInfo.nome_familia
        }
        setProduto(produtoRes.data)
      }
      if (pedidoRes.data) {
        setPedido(pedidoRes.data)
        // Verificar se já tem este item no pedido
        const itemExistente = pedidoRes.data.itens?.find(i => i.produto_id === produtoId)
        if (itemExistente) {
          setQuantidade(itemExistente.quantidade || 0)
          if (itemExistente.preco_negociado_direto) {
            setTipoDesconto('preco')
            setPrecoNegociado(itemExistente.preco_negociado_direto)
            setPrecoNegociadoDisplay(formatarInputMoeda((itemExistente.preco_negociado_direto * 100).toString()))
          } else if (itemExistente.desconto_percentual) {
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

  function handlePrecoNegociadoChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setPrecoNegociadoDisplay(formatted)
    setPrecoNegociado(parseMoeda(formatted))
  }

  function parsearPercentual(str) {
    if (!str) return 0
    return parseFloat(str.replace(',', '.')) || 0
  }

  // Cálculos
  const precoTabela = produto?.preco_distribuidora || produto?.preco || 0
  const precoLoja = produto?.preco_loja || produto?.preco || 0
  const descontoFamiliaPct = produto?.desconto_pct_aplicado || 0
  const nomeFamilia = produto?.nome_familia || null
  const ipi = produto?.ipi || 0
  const precoComIpi = precoTabela * (1 + ipi / 100)

  const descontoPercentualNum = parsearPercentual(descontoPercentual)
  let valorDesconto = 0
  const precoNegociadoNum = Number(precoNegociado) || 0
  const precoAcimaTabela = tipoDesconto === 'preco' && precoNegociadoNum > precoTabela

  if (tipoDesconto === 'percentual' && descontoPercentualNum > 0) {
    valorDesconto = precoTabela * (descontoPercentualNum / 100)
  } else if (tipoDesconto === 'valor') {
    valorDesconto = descontoReais
  } else if (tipoDesconto === 'preco') {
    if (precoNegociadoNum > 0) {
      valorDesconto = precoTabela - precoNegociadoNum
    } else {
      valorDesconto = 0
    }
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
          codigo_barras: produto?.codigo_barras || null,
          produto_fornecedor: produto?.fornecedores?.nome_fantasia || produto?.fornecedores?.nome || null,
          quantidade,
          preco_unitario: precoTabela,
          preco_loja: precoLoja,
          desconto_familia_pct: descontoFamiliaPct,
          nome_familia: nomeFamilia,
          ipi,
          desconto: valorDesconto,
          desconto_percentual: tipoDesconto === 'percentual' ? descontoPercentualNum : null,
          preco_negociado_direto: tipoDesconto === 'preco' ? precoNegociadoNum : null,
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

      const valorBrutoTotal = novosItens.reduce((acc, it) => acc + ((Number(it.preco_unitario) || 0) * (Number(it.quantidade) || 0)), 0)
      const totalDescItem = novosItens.reduce((acc, it) => {
        const precoEfetivo = calcularPrecoEfetivo(it)
        return acc + (((Number(it.preco_unitario) || 0) - precoEfetivo) * (Number(it.quantidade) || 0))
      }, 0)
      // Descontos globais (descontos_rep) em cascata sobre o subtotal pós-item — preserva o que a tela de Descontos gravou
      let valorAtualGlobal = valorBrutoTotal - totalDescItem
      let totalDescGlobal = 0
      ;(pedido?.descontos_rep || []).forEach(d => {
        const valorNum = parseFloat(String(d.valor).replace(',', '.')) || 0
        const valor = d.tipo === 'percentual'
          ? valorAtualGlobal * (valorNum / 100)
          : Math.min(valorNum, valorAtualGlobal)
        totalDescGlobal += valor
        valorAtualGlobal = Math.max(0, valorAtualGlobal - valor)
      })
      const valorDescontoTotal = totalDescItem + totalDescGlobal
      const resultado = await atualizarComOuSemConexao(
        'pedidos',
        pedidoId,
        {
          itens: novosItens,
          valor_bruto: valorBrutoTotal,
          valor_desconto: valorDescontoTotal
          // valor_liquido é generated column no banco — calculado automaticamente
        },
        { tabelaLocal: 'pedidos' }
      )

      if (!resultado.ok) {
        console.error('[DetalheProdutoPedido] Erro:', resultado.motivo)
        alert('Erro ao salvar: ' + resultado.motivo)
        setSalvando(false)
        return
      }

      handleVoltar()

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
          <button className="dpp-cancelar" onClick={handleVoltar}>Voltar</button>
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
        <button className="dpp-cancelar" onClick={handleVoltar}>
          Voltar
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
        {/* Informações */}
        <div className="dpp-card dpp-card-info">
          {nomeFornecedor(produto) && (
            <span className="dpp-badge-fornecedor">{nomeFornecedor(produto)}</span>
          )}
          <h2 className="dpp-nome">{produto?.nome}</h2>

          <div className="dpp-info-grid">
            <div className="dpp-info-item">
              <span className="dpp-info-label">Código:</span>
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
                <span className="dpp-info-label">Referência:</span>
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
              {descontoFamiliaPct > 0 && (
                <span className="dpp-badge-desconto-familia" aria-label="Desconto família ativo">$</span>
              )}
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
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className="dpp-qty-input"
              value={quantidade}
              onChange={(e) => {
                const novaQtd = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0
                setQuantidade(novaQtd)
              }}
              onFocus={(e) => e.target.select()}
              onClick={(e) => { e.stopPropagation(); e.target.select() }}
              aria-label="Quantidade"
            />
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
            <button
              className={`dpp-desconto-btn ${tipoDesconto === 'preco' ? 'active' : ''}`}
              onClick={() => setTipoDesconto('preco')}
            >
              Preço
            </button>
          </div>

          {tipoDesconto === 'percentual' && (
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
          )}

          {tipoDesconto === 'valor' && (
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

          {tipoDesconto === 'preco' && (
            <div className="dpp-desconto-input">
              <input
                type="text"
                placeholder="R$ 0,00"
                value={precoNegociadoDisplay}
                onChange={(e) => handlePrecoNegociadoChange(e.target.value)}
                inputMode="numeric"
              />
            </div>
          )}

          {tipoDesconto === 'preco' && precoAcimaTabela && (
            <div className="dpp-desconto-alerta">
              Preço acima da tabela
            </div>
          )}

          {tipoDesconto === 'preco' && precoNegociadoNum > 0 && precoNegociadoNum < precoTabela && (
            <div className="dpp-desconto-hint">
              Equivale a desconto de {((valorDesconto / precoTabela) * 100).toFixed(2).replace('.', ',')}% ({formatarValor(valorDesconto)})
            </div>
          )}

          {tipoDesconto !== 'preco' && descontoFamiliaPct > 0 && (
            <div className="dpp-desconto-hint">
              Em cima do preço com política ({formatarValor(precoTabela)})
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
          {ipi > 0 && (
            <>
              <div className="dpp-resumo-linha">
                <span>Preço líquido</span>
                <span>{formatarValor(precoLiquido)}</span>
              </div>
              <div className="dpp-resumo-linha">
                <span>IPI ({ipi}%)</span>
                <span>+ {formatarValor(precoLiquido * ipi / 100)}</span>
              </div>
            </>
          )}
          <div className="dpp-resumo-linha liquido">
            <span>Preço final</span>
            <span>{formatarValor(precoLiquidoComIpi)}</span>
          </div>
          <div className="dpp-resumo-total">
            <span>Subtotal ({quantidade} un)</span>
            <span>{formatarValor(subtotal)}</span>
          </div>
        </div>

        {/* Foto (no final pra priorizar info do produto) */}
        {produto?.fotos && produto.fotos.length > 0 && (
          <div className="dpp-card">
            <div className="dpp-card-titulo">Foto do produto</div>
            <div className="dpp-foto-pequena">
              <img src={produto.fotos[0]} alt={produto.nome} loading="lazy" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DetalheProdutoPedido

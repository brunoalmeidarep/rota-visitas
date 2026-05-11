import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import './VendasProduto.css'

function VendasProduto() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { representadaSelecionada } = useRepresentada()
  const [isDark, setIsDark] = useState(false)

  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState(90)
  const [produtos, setProdutos] = useState([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [totalUnidades, setTotalUnidades] = useState(0)
  const [nomeRep, setNomeRep] = useState('')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!repId) return
    fetchProdutos()
    fetchNomeRep()
  }, [repId, periodo, representadaSelecionada])

  async function fetchNomeRep() {
    const { data } = await supabase
      .from('representantes')
      .select('nome')
      .eq('id', repId)
      .single()
    if (data?.nome) setNomeRep(data.nome)
  }

  async function fetchProdutos() {
    setLoading(true)

    const dataLimite = new Date()
    dataLimite.setDate(dataLimite.getDate() - periodo)

    const todos = await db.pedidos.where('rep_id').equals(repId).toArray()
    let data = todos.filter(p =>
      p.status === 'pedido' &&
      new Date(p.created_at) >= dataLimite
    )

    if (representadaSelecionada) {
      if (representadaSelecionada.tipo === 'empresa') {
        data = data.filter(p => p.empresa_id === representadaSelecionada.empresa_id)
      } else {
        data = data.filter(p => p.representada_id === representadaSelecionada.id)
      }
    }

    // Agrupar itens por produto
    const porProduto = {}
    let total = 0
    let unidades = 0

    ;(data || []).forEach(pedido => {
      const itens = pedido.itens || []
      itens.forEach(item => {
        const prodId = item.produto_id || item.id || item.codigo
        if (!prodId) return

        if (!porProduto[prodId]) {
          porProduto[prodId] = {
            id: prodId,
            nome: item.nome || item.produto_nome || 'Produto',
            codigo: item.codigo || '',
            foto: item.foto || item.fotos?.[0] || null,
            quantidade: 0,
            valor: 0
          }
        }

        const qtd = item.quantidade || 1
        const valorItem = (item.preco_final || item.preco || 0) * qtd
        porProduto[prodId].quantidade += qtd
        porProduto[prodId].valor += valorItem
        total += valorItem
        unidades += qtd
      })
    })

    // Ordenar por valor
    const ordenado = Object.values(porProduto)
      .sort((a, b) => b.valor - a.valor)
      .map((p, idx) => ({
        ...p,
        percentual: total > 0 ? (p.valor / total) * 100 : 0,
        posicao: idx + 1
      }))

    setProdutos(ordenado)
    setTotalGeral(total)
    setTotalUnidades(unidades)
    setLoading(false)
  }

  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function getPeriodoLabel() {
    if (periodo === 30) return 'Ultimos 30 dias'
    if (periodo === 90) return 'Ultimos 90 dias'
    return 'Ultimo ano'
  }

  function exportarPDF() {
    if (produtos.length === 0) {
      alert('Nenhum dado para exportar')
      return
    }

    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')

    navigate('/relatorios/pdf', {
      state: {
        tipo: 'vendas-produto',
        dados: {
          produtos,
          totalGeral,
          totalUnidades,
          nomeRep,
          periodo: getPeriodoLabel()
        },
        nomeArquivo: `vendas-produto-${hoje}.pdf`,
        titulo: 'Vendas por Produto'
      }
    })
  }

  return (
    <div className={`vendas-produto ${isDark ? 'dark' : 'light'}`}>
      <header className="vp-header">
        <button className="vp-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Vendas por Produto</h1>
        <button className="vp-export" onClick={exportarPDF} disabled={loading || produtos.length === 0}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </header>

      {/* Filtros */}
      <div className="vp-filtros">
        <button
          className={`vp-filtro ${periodo === 30 ? 'active' : ''}`}
          onClick={() => setPeriodo(30)}
        >
          30 dias
        </button>
        <button
          className={`vp-filtro ${periodo === 90 ? 'active' : ''}`}
          onClick={() => setPeriodo(90)}
        >
          90 dias
        </button>
        <button
          className={`vp-filtro ${periodo === 365 ? 'active' : ''}`}
          onClick={() => setPeriodo(365)}
        >
          1 ano
        </button>
      </div>

      <div className="vp-content">
        {loading ? (
          <div className="vp-loading">Carregando...</div>
        ) : produtos.length === 0 ? (
          <div className="vp-vazio">
            <span className="vp-vazio-icon">📦</span>
            <p>Nenhum produto vendido no periodo</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="vp-stats">
              <div className="vp-stat">
                <span className="vp-stat-valor">{produtos.length}</span>
                <span className="vp-stat-label">produtos</span>
              </div>
              <div className="vp-stat">
                <span className="vp-stat-valor">{totalUnidades}</span>
                <span className="vp-stat-label">unidades</span>
              </div>
              <div className="vp-stat">
                <span className="vp-stat-valor">{formatarValor(totalGeral)}</span>
                <span className="vp-stat-label">total</span>
              </div>
            </div>

            {/* Lista */}
            <div className="vp-lista">
              {produtos.map(produto => (
                <div key={produto.id} className="vp-item">
                  <div className="vp-item-foto">
                    {produto.foto ? (
                      <img src={produto.foto} alt="" />
                    ) : (
                      <span className="vp-item-placeholder">📦</span>
                    )}
                  </div>
                  <div className="vp-item-info">
                    <span className="vp-item-nome">{produto.nome}</span>
                    <span className="vp-item-codigo">{produto.codigo}</span>
                    <div className="vp-item-bar-container">
                      <div className="vp-item-bar">
                        <div
                          className="vp-item-bar-fill"
                          style={{ width: `${produto.percentual}%` }}
                        />
                      </div>
                      <span className="vp-item-percent">{produto.percentual.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="vp-item-right">
                    <span className="vp-item-qtd">{produto.quantidade} un</span>
                    <span className="vp-item-valor">{formatarValor(produto.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default VendasProduto

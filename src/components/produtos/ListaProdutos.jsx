import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import './ListaProdutos.css'

function ListaProdutos() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { representadaSelecionada } = useRepresentada()

  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState('todos')
  const [isDark, setIsDark] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar produtos
  useEffect(() => {
    if (!repId || !representadaSelecionada) {
      setProdutos([])
      setLoading(false)
      return
    }

    async function fetchProdutos() {
      setLoading(true)

      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('rep_id', repId)
        .eq('representada_id', representadaSelecionada.id)
        .order('nome')

      if (error) {
        console.error('[ListaProdutos] Erro:', error)
      } else {
        console.log('[ListaProdutos] Produtos carregados:', data?.length)
        // Remover duplicatas por nome + código (manter o primeiro)
        const uniqueProdutos = data?.filter((p, i, arr) =>
          arr.findIndex(x => x.codigo === p.codigo && x.nome === p.nome) === i
        ) || []
        console.log('[ListaProdutos] Produtos únicos:', uniqueProdutos.length)
        setProdutos(uniqueProdutos)
      }

      setLoading(false)
    }

    fetchProdutos()
  }, [repId, representadaSelecionada])

  // Contagens
  const contagens = useMemo(() => {
    const counts = { todos: 0, ativos: 0, inativos: 0 }
    produtos.forEach(p => {
      counts.todos++
      if (p.ativo !== false) {
        counts.ativos++
      } else {
        counts.inativos++
      }
    })
    return counts
  }, [produtos])

  // Filtrar produtos
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      // Filtro de busca
      const termoBusca = busca.toLowerCase()
      const matchBusca = !busca ||
        p.nome?.toLowerCase().includes(termoBusca) ||
        p.codigo?.toLowerCase().includes(termoBusca)

      // Filtro de status
      let matchStatus = true
      if (filtroAtivo === 'ativos') {
        matchStatus = p.ativo !== false
      } else if (filtroAtivo === 'inativos') {
        matchStatus = p.ativo === false
      }

      return matchBusca && matchStatus
    })
  }, [produtos, busca, filtroAtivo])

  function formatarPreco(valor) {
    if (!valor && valor !== 0) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  if (loading) {
    return (
      <div className={`lista-produtos ${isDark ? 'dark' : 'light'}`}>
        <header className="lp-header">
          <button className="lp-voltar" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="lp-header-titulo">Produtos</span>
          <div style={{ width: 40 }}></div>
        </header>
        <div className="lp-loading">Carregando...</div>
      </div>
    )
  }

  return (
    <div className={`lista-produtos ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="lp-header">
        <button className="lp-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="lp-header-titulo">Produtos</span>
        <button className="lp-btn-novo" onClick={() => navigate('/produtos/novo')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </header>

      {/* Representada selecionada */}
      {representadaSelecionada && (
        <div className="lp-representada">
          <span className="lp-rep-label">Empresa:</span>
          <span className="lp-rep-nome">{representadaSelecionada.nome}</span>
        </div>
      )}

      {!representadaSelecionada && (
        <div className="lp-sem-representada">
          <p>Selecione uma representada no menu principal</p>
        </div>
      )}

      {representadaSelecionada && (
        <>
          {/* Busca */}
          <div className="lp-busca-container">
            <svg className="lp-busca-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              className="lp-busca-input"
              placeholder="Buscar por nome ou código..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca && (
              <button className="lp-busca-clear" onClick={() => setBusca('')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Stats Bar */}
          <div className="lp-stats-bar">
            <button
              className={`lp-stat-item ${filtroAtivo === 'todos' ? 'active' : ''}`}
              onClick={() => setFiltroAtivo('todos')}
            >
              <span className="lp-stat-count">{contagens.todos}</span>
              <span className="lp-stat-label">Todos</span>
            </button>
            <button
              className={`lp-stat-item ${filtroAtivo === 'ativos' ? 'active' : ''}`}
              onClick={() => setFiltroAtivo('ativos')}
            >
              <span className="lp-stat-count verde">{contagens.ativos}</span>
              <span className="lp-stat-label">Ativos</span>
            </button>
            <button
              className={`lp-stat-item ${filtroAtivo === 'inativos' ? 'active' : ''}`}
              onClick={() => setFiltroAtivo('inativos')}
            >
              <span className="lp-stat-count vermelho">{contagens.inativos}</span>
              <span className="lp-stat-label">Inativos</span>
            </button>
          </div>

          {/* Lista de Produtos */}
          <div className="lp-lista">
            {produtosFiltrados.length === 0 ? (
              <div className="lp-vazio">
                {busca ? (
                  <>
                    <p>Nenhum produto encontrado</p>
                    <button className="lp-btn-limpar" onClick={() => setBusca('')}>
                      Limpar busca
                    </button>
                  </>
                ) : produtos.length === 0 ? (
                  <>
                    <div className="lp-vazio-icon">📦</div>
                    <h3>Nenhum produto cadastrado</h3>
                    <p>Comece adicionando seu primeiro produto</p>
                    <button className="lp-btn-primeiro" onClick={() => navigate('/produtos/novo')}>
                      + Adicionar primeiro produto
                    </button>
                  </>
                ) : (
                  <p>Nenhum produto neste filtro</p>
                )}
              </div>
            ) : (
              produtosFiltrados.map(produto => {
                const isInativo = produto.ativo === false
                const fotoUrl = produto.fotos?.[0] || null

                return (
                  <button
                    key={produto.id}
                    className={`lp-produto-card ${isInativo ? 'inativo' : ''}`}
                    onClick={() => navigate(`/produtos/${produto.id}`)}
                  >
                    <div className="lp-produto-foto">
                      {fotoUrl ? (
                        <img src={fotoUrl} alt={produto.nome} />
                      ) : (
                        <span className="lp-produto-foto-placeholder">📦</span>
                      )}
                    </div>
                    <div className="lp-produto-info">
                      <span className="lp-produto-nome">{produto.nome}</span>
                      <span className="lp-produto-codigo">{produto.codigo || '-'}</span>
                      <div className="lp-produto-preco-row">
                        <span className="lp-produto-preco">
                          {formatarPreco(produto.preco)}/{produto.unidade || 'UN'}
                        </span>
                        {produto.ipi > 0 && (
                          <span className="lp-badge-ipi">IPI {produto.ipi}%</span>
                        )}
                        {isInativo && (
                          <span className="lp-badge-inativo">Inativo</span>
                        )}
                      </div>
                    </div>
                    <span className="lp-produto-seta">›</span>
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ListaProdutos

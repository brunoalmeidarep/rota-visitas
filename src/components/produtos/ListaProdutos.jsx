import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import { nomeFornecedor } from '../../utils/fornecedor'
import './ListaProdutos.css'

const PAGE_SIZE = 50
const DEBOUNCE_MS = 350

function ListaProdutos() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { representadaSelecionada } = useRepresentada()

  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState('todos')
  const [stats, setStats] = useState({ total: 0, ativos: 0, inativos: 0 })
  const [temMais, setTemMais] = useState(true)
  const [isDark, setIsDark] = useState(false)

  const paginaRef = useRef(0)
  const sentinelRef = useRef(null)
  const requestIdRef = useRef(0)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [busca])

  // Stats totais (chama 1 vez ao trocar empresa/rep, não toda paginação)
  useEffect(() => {
    if (!repId || !representadaSelecionada) {
      setStats({ total: 0, ativos: 0, inativos: 0 })
      return
    }

    async function loadStats() {
      // Stats do IndexedDB (funciona online e offline)
      try {
        let todosParaStats = await db.produtos
          .filter(p => p.desativado_manualmente === false)
          .toArray()

        if (representadaSelecionada?.plano === 'enterprise' && representadaSelecionada?.empresa_id) {
          todosParaStats = todosParaStats.filter(p => p.empresa_id === representadaSelecionada.empresa_id)
        } else if (repId) {
          todosParaStats = todosParaStats.filter(p => p.rep_id === repId)
        }

        const total = todosParaStats.length
        const ativos = todosParaStats.filter(p => p.ativo === true).length

        setStats({
          total,
          ativos,
          inativos: total - ativos
        })
      } catch (err) {
        console.error('[ListaProdutos] Erro stats:', err)
        setStats({ total: 0, ativos: 0, inativos: 0 })
      }
    }
    loadStats()
  }, [repId, representadaSelecionada])

  // Monta query base
  const montarQueryBase = useCallback(() => {
    let query = supabase
      .from('produtos_com_preco_distribuidora')
      .select('id, nome, codigo, codigo_barras, preco, preco_loja, preco_distribuidora, desconto_pct_aplicado, nome_familia, ipi, unidade, fotos, foto_url, ativo, fornecedores(nome, nome_fantasia)')
      .eq('desativado_manualmente', false)

    if (representadaSelecionada?.plano === 'enterprise' && representadaSelecionada?.empresa_id) {
      query = query.eq('empresa_id', representadaSelecionada.empresa_id)
    } else if (repId) {
      query = query.eq('rep_id', repId)
    }

    // Filtro de status
    if (filtroAtivo === 'ativos') {
      query = query.eq('ativo', true)
    } else if (filtroAtivo === 'inativos') {
      query = query.eq('ativo', false)
    }

    return query
  }, [representadaSelecionada, repId, filtroAtivo])

  const aplicarBusca = useCallback((query, termo) => {
    if (!termo) return query
    const t = termo.replace(/,/g, ' ').trim()
    return query.or(`nome.ilike.%${t}%,codigo.ilike.%${t}%,codigo_barras.ilike.%${t}%`)
  }, [])

  // Reset + busca ao mudar busca/empresa/filtro (lê do IndexedDB)
  useEffect(() => {
    if (!repId || !representadaSelecionada) {
      setProdutos([])
      setLoading(false)
      return
    }
    setLoading(true)

    async function buscar() {
      try {
        let todos = await db.produtos
          .filter(p => p.desativado_manualmente === false)
          .toArray()

        // Filtro por empresa (enterprise) ou rep (PRO)
        if (representadaSelecionada?.plano === 'enterprise' && representadaSelecionada?.empresa_id) {
          todos = todos.filter(p => p.empresa_id === representadaSelecionada.empresa_id)
        } else if (repId) {
          todos = todos.filter(p => p.rep_id === repId)
        }

        // Filtro de busca
        const termo = (buscaDebounced || '').replace(/,/g, ' ').trim().toLowerCase()
        if (termo) {
          todos = todos.filter(p => {
            const nome = (p.nome || '').toLowerCase()
            const codigo = (p.codigo || '').toLowerCase()
            const codBarras = (p.codigo_barras || '').toLowerCase()
            return nome.includes(termo) || codigo.includes(termo) || codBarras.includes(termo)
          })
        }

        // Filtro ativo
        if (typeof filtroAtivo !== 'undefined' && filtroAtivo !== 'todos') {
          if (filtroAtivo === 'ativos') {
            todos = todos.filter(p => p.ativo === true)
          } else if (filtroAtivo === 'inativos') {
            todos = todos.filter(p => p.ativo === false)
          }
        }

        todos.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
        setProdutos(todos)
        setTemMais(false)
      } catch (err) {
        console.error('[ListaProdutos] Erro IndexedDB:', err)
        setProdutos([])
      }
      setLoading(false)
    }

    buscar()
  }, [repId, representadaSelecionada, buscaDebounced, filtroAtivo])

  // Carrega mais
  const carregarMais = useCallback(async () => {
    if (carregandoMais || !temMais || loading) return

    const currentRequestId = requestIdRef.current
    setCarregandoMais(true)
    paginaRef.current += 1

    const offset = paginaRef.current * PAGE_SIZE
    let query = montarQueryBase()
    query = aplicarBusca(query, buscaDebounced)
    query = query.order('nome').range(offset, offset + PAGE_SIZE - 1)

    const { data, error } = await query
    if (currentRequestId !== requestIdRef.current) {
      setCarregandoMais(false)
      return
    }

    if (error) {
      console.error('[ListaProdutos] Erro paginação:', error)
      setTemMais(false)
    } else {
      setProdutos(prev => [...prev, ...(data || [])])
      setTemMais((data?.length || 0) === PAGE_SIZE)
    }
    setCarregandoMais(false)
  }, [carregandoMais, temMais, loading, buscaDebounced, montarQueryBase, aplicarBusca])

  // IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return
    const el = sentinelRef.current
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) carregarMais()
      },
      { rootMargin: '300px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [carregarMais])

  function formatarPreco(valor) {
    if (!valor && valor !== 0) return '-'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
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
              placeholder="Buscar por nome, código ou referência..."
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
              <span className="lp-stat-count">{stats.total}</span>
              <span className="lp-stat-label">Todos</span>
            </button>
            <button
              className={`lp-stat-item ${filtroAtivo === 'ativos' ? 'active' : ''}`}
              onClick={() => setFiltroAtivo('ativos')}
            >
              <span className="lp-stat-count verde">{stats.ativos}</span>
              <span className="lp-stat-label">Ativos</span>
            </button>
            <button
              className={`lp-stat-item ${filtroAtivo === 'inativos' ? 'active' : ''}`}
              onClick={() => setFiltroAtivo('inativos')}
            >
              <span className="lp-stat-count vermelho">{stats.inativos}</span>
              <span className="lp-stat-label">Inativos</span>
            </button>
          </div>

          {/* Lista */}
          <div className="lp-lista">
            {loading ? (
              <div className="lp-loading">Carregando...</div>
            ) : produtos.length === 0 ? (
              <div className="lp-vazio">
                {buscaDebounced ? (
                  <>
                    <p>Nenhum produto encontrado</p>
                    <button className="lp-btn-limpar" onClick={() => setBusca('')}>
                      Limpar busca
                    </button>
                  </>
                ) : stats.total === 0 ? (
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
              <>
                {produtos.map(produto => {
                  const isInativo = produto.ativo === false
                  const fotoUrl = produto.fotos?.[0] || produto.foto_url || null
                  const marcaNome = nomeFornecedor(produto)
                  const temDesconto = produto.desconto_pct_aplicado > 0 &&
                    produto.preco_distribuidora != null &&
                    produto.preco_loja != null &&
                    produto.preco_distribuidora < produto.preco_loja
                  const precoExibir = produto.preco_distribuidora ?? produto.preco_loja ?? produto.preco

                  return (
                    <button
                      key={produto.id}
                      className={`lp-produto-card ${isInativo ? 'inativo' : ''}`}
                      onClick={() => navigate(`/produtos/${produto.id}`)}
                    >
                      <div className="lp-produto-foto">
                        {fotoUrl ? (
                          <img src={fotoUrl} alt={produto.nome} loading="lazy" />
                        ) : (
                          <span className="lp-produto-foto-placeholder">📦</span>
                        )}
                      </div>
                      <div className="lp-produto-info">
                        <span className="lp-produto-nome">{produto.nome}</span>
                        <span className="lp-produto-codigo">
                          Cód: {produto.codigo || '-'}
                          {produto.codigo_barras && (
                            <> · Ref: {produto.codigo_barras}</>
                          )}
                        </span>
                        <div className="lp-produto-preco-row">
                          {temDesconto ? (
                            <>
                              <span className="lp-produto-preco-riscado">
                                {formatarPreco(produto.preco_loja)}
                              </span>
                              <span className="lp-produto-preco-destaque">
                                {formatarPreco(precoExibir)}/{produto.unidade || 'UN'}
                              </span>
                              <span className="lp-badge-desconto">
                                -{Math.round(produto.desconto_pct_aplicado)}%
                              </span>
                            </>
                          ) : (
                            <span className="lp-produto-preco">
                              {formatarPreco(precoExibir)}/{produto.unidade || 'UN'}
                            </span>
                          )}
                          {produto.ipi > 0 && (
                            <span className="lp-badge-ipi">IPI {produto.ipi}%</span>
                          )}
                          {isInativo && (
                            <span className="lp-badge-inativo">Inativo</span>
                          )}
                        </div>
                        {produto.nome_familia && (
                          <span className="lp-produto-familia">{produto.nome_familia}</span>
                        )}
                      </div>
                      <div className="lp-produto-right">
                        {marcaNome && (
                          <span className="lp-badge-fornecedor">{marcaNome}</span>
                        )}
                        <span className="lp-produto-seta">›</span>
                      </div>
                    </button>
                  )
                })}

                {/* Sentinela infinite scroll */}
                {temMais && (
                  <div ref={sentinelRef} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {carregandoMais ? 'Carregando mais...' : ''}
                  </div>
                )}
                {!temMais && produtos.length > 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', opacity: 0.6 }}>
                    — fim dos resultados —
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default ListaProdutos

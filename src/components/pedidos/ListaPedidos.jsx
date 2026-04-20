import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { usePlano } from '../../hooks/usePlano'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import { limparCarrinho } from '../../lib/carrinhoStorage'
import './ListaPedidos.css'

function ListaPedidos() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { isPro, isStarter } = usePlano()
  const { representadaSelecionada } = useRepresentada()

  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [isDark, setIsDark] = useState(false)
  const [toast, setToast] = useState('')

  // Swipe state
  const [swipeAberto, setSwipeAberto] = useState(null)
  const [touchStartX, setTouchStartX] = useState(0)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar pedidos filtrados por representada/empresa selecionada
  useEffect(() => {
    if (!repId || !representadaSelecionada) return

    async function fetchPedidos() {
      setLoading(true)

      let query = supabase
        .from('pedidos')
        .select('*')
        .eq('rep_id', repId)

      // Filtrar por representada ou empresa conforme o tipo selecionado
      if (representadaSelecionada.tipo === 'empresa') {
        query = query.eq('empresa_id', representadaSelecionada.empresa_id)
      } else {
        query = query.eq('representada_id', representadaSelecionada.id)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) {
        console.error('[ListaPedidos] Erro:', error)
      } else {
        setPedidos(data || [])
      }
      setLoading(false)
    }

    fetchPedidos()
  }, [repId, representadaSelecionada])

  // Filtrar pedidos
  const pedidosFiltrados = pedidos.filter(p => {
    // Filtro por status
    if (filtro === 'orcamentos' && p.status !== 'orcamento') return false
    if (filtro === 'pedidos' && p.status !== 'pedido' && p.status !== 'transmitido') return false

    // Filtro por busca
    if (busca) {
      const termo = busca.toLowerCase()
      const matchCliente = p.cliente_nome?.toLowerCase().includes(termo)
      const matchNumero = p.numero?.toString().includes(termo)
      if (!matchCliente && !matchNumero) return false
    }

    return true
  })

  // Agrupar por data
  function agruparPorData(items) {
    const grupos = {}
    items.forEach(item => {
      const data = item.created_at?.split('T')[0] || 'sem-data'
      if (!grupos[data]) {
        grupos[data] = []
      }
      grupos[data].push(item)
    })
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([data, items]) => ({
        data,
        label: formatarDataGrupo(data),
        items
      }))
  }

  function formatarDataGrupo(dataStr) {
    if (dataStr === 'sem-data') return 'Sem data'
    const hoje = new Date().toISOString().split('T')[0]
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const d = new Date(dataStr + 'T12:00:00')
    const ddmm = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

    if (dataStr === hoje) return `Hoje · ${ddmm}`
    if (dataStr === ontem) return `Ontem · ${ddmm}`

    const diaSemana = d.toLocaleDateString('pt-BR', { weekday: 'long' })
    const diaSemanaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)
    return `${diaSemanaCapitalizado} · ${ddmm}`
  }

  function formatarValor(valor) {
    if (!valor || valor === 0) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 2000)
      return () => clearTimeout(timer)
    }
  }, [toast])

  // Fechar swipe ao clicar fora
  useEffect(() => {
    function handleClickOutside() {
      if (swipeAberto) {
        setSwipeAberto(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [swipeAberto])

  function handleTouchStart(e, pedidoId, status) {
    if (status !== 'orcamento') return
    setTouchStartX(e.touches[0].clientX)
  }

  function handleTouchEnd(e, pedidoId, status) {
    if (status !== 'orcamento') return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartX - touchEndX

    if (diff > 60) {
      // Swipe para esquerda - abrir
      setSwipeAberto(pedidoId)
    } else if (diff < -60) {
      // Swipe para direita - fechar
      setSwipeAberto(null)
    }
  }

  async function cancelarOrcamento(e, pedidoId) {
    e.stopPropagation()

    if (!confirm('Você tem certeza que deseja cancelar esse orçamento? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId)

      if (error) {
        console.error('[ListaPedidos] Erro ao cancelar:', error)
        alert('Erro ao cancelar orçamento')
        return
      }

      limparCarrinho(pedidoId)

      // Remover da lista local
      setPedidos(prev => prev.filter(p => p.id !== pedidoId))
      setSwipeAberto(null)
      setToast('Orçamento cancelado')

    } catch (err) {
      console.error('[ListaPedidos] Exceção:', err)
      alert('Erro ao cancelar orçamento')
    }
  }

  function handleNovo() {
    if (isStarter) {
      navigate('/pedidos/novo/simples')
    } else {
      navigate('/pedidos/novo')
    }
  }

  const grupos = agruparPorData(pedidosFiltrados)

  return (
    <div className={`lista-pedidos ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="lp-header">
        <button className="lp-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="lp-header-titulo">Pedidos</span>
        <div className="lp-header-acoes">
          <button className="lp-btn-icon" onClick={() => navigate('/relatorios/meta')}>
            <span>📈</span>
          </button>
          <button className="lp-btn-icon" onClick={handleNovo}>
            <span>+</span>
          </button>
        </div>
      </header>

      {/* Busca */}
      <div className="lp-busca-container">
        <div className="lp-busca">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar cliente ou número..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          {busca && (
            <button className="lp-busca-limpar" onClick={() => setBusca('')}>×</button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="lp-filtros">
        <button
          className={`lp-filtro ${filtro === 'todos' ? 'active' : ''}`}
          onClick={() => setFiltro('todos')}
        >
          Todos
        </button>
        <button
          className={`lp-filtro ${filtro === 'orcamentos' ? 'active' : ''}`}
          onClick={() => setFiltro('orcamentos')}
        >
          Orçamentos
        </button>
        <button
          className={`lp-filtro ${filtro === 'pedidos' ? 'active' : ''}`}
          onClick={() => setFiltro('pedidos')}
        >
          Pedidos
        </button>
      </div>

      {/* Conteúdo */}
      <div className="lp-content">
        {loading ? (
          <div className="lp-loading">Carregando...</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="lp-vazio">
            <span className="lp-vazio-icon">📋</span>
            <p>{busca ? 'Nenhum pedido encontrado' : 'Nenhum pedido registrado'}</p>
            <button onClick={handleNovo}>+ Novo pedido</button>
          </div>
        ) : (
          grupos.map((grupo, idx) => (
            <div key={idx} className="lp-grupo">
              <div className="lp-grupo-header">
                <span className="lp-grupo-data">{grupo.label}</span>
              </div>
              <div className="lp-grupo-card">
                {grupo.items.map((p, itemIdx) => (
                  <div
                    key={p.id}
                    className={`lp-item-wrapper ${swipeAberto === p.id ? 'swiped' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className={`lp-item ${itemIdx < grupo.items.length - 1 ? 'with-border' : ''}`}
                      onClick={() => {
                        if (swipeAberto === p.id) {
                          setSwipeAberto(null)
                        } else {
                          navigate(`/pedidos/${p.id}`)
                        }
                      }}
                      onTouchStart={(e) => handleTouchStart(e, p.id, p.status)}
                      onTouchEnd={(e) => handleTouchEnd(e, p.id, p.status)}
                    >
                      <div className="lp-item-info">
                        <span className="lp-item-cliente">{p.cliente_nome || 'Cliente'}</span>
                        <span className="lp-item-meta">
                          {p.representada_nome || '-'}
                          {p.condicao_pagamento && ` · ${p.condicao_pagamento}`}
                        </span>
                      </div>
                      <div className="lp-item-right">
                        <span className="lp-item-valor">{formatarValor(p.valor_total)}</span>
                        <span className={`lp-item-badge ${p.status}`}>
                          {p.status === 'orcamento' ? 'Orçamento' :
                           p.status === 'transmitido' ? 'Transmitido' : 'Pedido'}
                        </span>
                      </div>
                    </div>
                    {p.status === 'orcamento' && (
                      <button
                        className="lp-item-cancelar"
                        onClick={(e) => cancelarOrcamento(e, p.id)}
                      >
                        🗑️ Cancelar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="lp-toast">{toast}</div>
      )}
    </div>
  )
}

export default ListaPedidos

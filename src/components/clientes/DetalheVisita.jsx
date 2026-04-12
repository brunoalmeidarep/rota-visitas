import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './DetalheVisita.css'

function DetalheVisita() {
  const navigate = useNavigate()
  const { id: clienteId, visitaId } = useParams()
  const { repId } = useRepId()

  const [visita, setVisita] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar dados
  useEffect(() => {
    if (!visitaId || !repId) return

    async function fetchDados() {
      setLoading(true)

      // Carregar visita
      const { data: visitaData } = await supabase
        .from('visitas')
        .select('*')
        .eq('id', visitaId)
        .single()

      if (visitaData) {
        setVisita(visitaData)

        // Carregar cliente se não veio no params
        if (visitaData.cliente_id) {
          const { data: clienteData } = await supabase
            .from('clientes')
            .select('id, nome, cidade')
            .eq('id', visitaData.cliente_id)
            .single()

          if (clienteData) setCliente(clienteData)
        }

        // Carregar pedidos da visita
        const { data: pedidosData } = await supabase
          .from('pedidos')
          .select('*')
          .eq('visita_id', visitaId)
          .order('created_at', { ascending: false })

        if (pedidosData) setPedidos(pedidosData)

        // Carregar gastos da visita
        const { data: gastosData } = await supabase
          .from('gastos_cliente')
          .select('*')
          .eq('visita_id', visitaId)
          .order('created_at', { ascending: false })

        if (gastosData) setGastos(gastosData)
      }

      setLoading(false)
    }

    fetchDados()
  }, [visitaId, repId])

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  function formatarValor(num) {
    if (!num) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num)
  }

  function getTipoIcon(tipo) {
    switch (tipo) {
      case 'presencial': return '🏪'
      case 'whatsapp': return '📱'
      default: return '📍'
    }
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'orcamento':
        return <span className="dv-badge orcamento">Orçamento</span>
      case 'pedido':
        return <span className="dv-badge pedido">Pedido</span>
      case 'transmitido':
        return <span className="dv-badge transmitido">Transmitido</span>
      default:
        return null
    }
  }

  function getCategoriaInfo(id) {
    const categorias = {
      'alimentacao': { nome: 'Alimentação', icone: '🍽️' },
      'cafe': { nome: 'Café/Lanche', icone: '☕' },
      'brinde': { nome: 'Brinde', icone: '🎁' },
      'amostra': { nome: 'Amostra', icone: '📦' },
      'evento': { nome: 'Evento', icone: '🎉' },
      'outros': { nome: 'Outros', icone: '💰' }
    }
    return categorias[id] || { nome: id, icone: '💰' }
  }

  const totalPedidos = pedidos.reduce((acc, p) => acc + (p.valor_total || 0), 0)
  const totalGastos = gastos.reduce((acc, g) => acc + (g.valor || 0), 0)

  if (loading) {
    return (
      <div className={`detalhe-visita ${isDark ? 'dark' : 'light'}`}>
        <header className="dv-header">
          <button className="dv-voltar" onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="dv-header-titulo">Visita</span>
          <div style={{ width: 36 }}></div>
        </header>
        <div className="dv-loading">Carregando...</div>
      </div>
    )
  }

  if (!visita) {
    return (
      <div className={`detalhe-visita ${isDark ? 'dark' : 'light'}`}>
        <header className="dv-header">
          <button className="dv-voltar" onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="dv-header-titulo">Visita</span>
          <div style={{ width: 36 }}></div>
        </header>
        <div className="dv-erro">
          <p>Visita não encontrada</p>
          <button onClick={() => navigate(-1)}>Voltar</button>
        </div>
      </div>
    )
  }

  return (
    <div className={`detalhe-visita ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="dv-header">
        <button className="dv-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="dv-header-titulo">Visita</span>
        <div style={{ width: 36 }}></div>
      </header>

      <div className="dv-content">
        {/* Hero */}
        <div className="dv-hero">
          <span className="dv-hero-icon">{getTipoIcon(visita.tipo)}</span>
          <h1 className="dv-hero-cliente">{visita.nome_cliente || cliente?.nome}</h1>
          <span className="dv-hero-cidade">{visita.cidade || cliente?.cidade}</span>
          <span className="dv-hero-data">{formatarData(visita.data)}</span>
          {visita.hora && <span className="dv-hero-hora">às {visita.hora}</span>}
        </div>

        {/* Tipo da visita */}
        <div className="dv-card">
          <div className="dv-card-titulo">Tipo</div>
          <div className="dv-tipo">
            <span className="dv-tipo-icon">{getTipoIcon(visita.tipo)}</span>
            <span className="dv-tipo-nome">
              {visita.tipo === 'presencial' ? 'Visita Presencial' :
               visita.tipo === 'whatsapp' ? 'Atendimento WhatsApp' :
               'Visita'}
            </span>
          </div>
        </div>

        {/* Observação */}
        {visita.obs && (
          <div className="dv-card">
            <div className="dv-card-titulo">Observação</div>
            <p className="dv-obs">{visita.obs}</p>
          </div>
        )}

        {/* Pedidos */}
        {pedidos.length > 0 && (
          <div className="dv-card">
            <div className="dv-card-header">
              <span className="dv-card-titulo">Pedidos</span>
              <span className="dv-card-total">{formatarValor(totalPedidos)}</span>
            </div>
            <div className="dv-lista">
              {pedidos.map(p => (
                <div key={p.id} className="dv-item">
                  <div className="dv-item-info">
                    <span className="dv-item-nome">{p.representada_nome || 'Pedido'}</span>
                    {getStatusBadge(p.status)}
                  </div>
                  <span className="dv-item-valor">{formatarValor(p.valor_total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gastos */}
        {gastos.length > 0 && (
          <div className="dv-card">
            <div className="dv-card-header">
              <span className="dv-card-titulo">Gastos</span>
              <span className="dv-card-total gasto">{formatarValor(totalGastos)}</span>
            </div>
            <div className="dv-lista">
              {gastos.map(g => (
                <div key={g.id} className="dv-item">
                  <div className="dv-item-info">
                    <span className="dv-item-icon">{getCategoriaInfo(g.categoria).icone}</span>
                    <span className="dv-item-nome">{getCategoriaInfo(g.categoria).nome}</span>
                  </div>
                  <span className="dv-item-valor">{formatarValor(g.valor)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sem pedidos nem gastos */}
        {pedidos.length === 0 && gastos.length === 0 && (
          <div className="dv-vazio">
            <span>Nenhum pedido ou gasto registrado nesta visita</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default DetalheVisita

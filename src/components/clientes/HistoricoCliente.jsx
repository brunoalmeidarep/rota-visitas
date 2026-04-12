import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './HistoricoCliente.css'

function formatarValor(valor) {
  if (!valor || valor === 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor)
}

function formatarData(data) {
  if (!data) return '-'
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

function formatarHora(hora) {
  if (!hora) return ''
  return hora.slice(0, 5)
}

function HistoricoCliente() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const { repId } = useRepId()

  // Determinar aba ativa pela URL
  const getAbaFromPath = () => {
    if (location.pathname.includes('/pedidos')) return 'pedidos'
    if (location.pathname.includes('/orcamentos')) return 'orcamentos'
    return 'visitas'
  }

  const [abaAtiva, setAbaAtiva] = useState(getAbaFromPath())
  const [cliente, setCliente] = useState(null)
  const [visitas, setVisitas] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
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

  // Atualizar aba quando URL muda
  useEffect(() => {
    setAbaAtiva(getAbaFromPath())
  }, [location.pathname])

  // Carregar cliente
  useEffect(() => {
    async function fetchCliente() {
      if (!id) return

      const { data } = await supabase
        .from('clientes')
        .select('id, nome')
        .eq('id', id)
        .single()

      if (data) setCliente(data)
    }

    fetchCliente()
  }, [id])

  // Carregar dados
  useEffect(() => {
    async function fetchDados() {
      if (!id || !repId) return

      setLoading(true)

      // Visitas (todas, sem limite)
      const { data: visitasData } = await supabase
        .from('visitas')
        .select('id, data, hora, tipo, obs')
        .eq('cliente_id', id)
        .eq('rep_id', repId)
        .order('data', { ascending: false })

      if (visitasData) setVisitas(visitasData)

      // Pedidos
      const { data: pedidosData } = await supabase
        .from('pedidos')
        .select('id, numero, valor_total, created_at, status, representada_nome, canal')
        .eq('cliente_id', id)
        .eq('rep_id', repId)
        .eq('status', 'pedido')
        .order('created_at', { ascending: false })

      if (pedidosData) setPedidos(pedidosData)

      // Orcamentos
      const { data: orcamentosData } = await supabase
        .from('pedidos')
        .select('id, numero, valor_total, created_at, status, representada_nome, canal')
        .eq('cliente_id', id)
        .eq('rep_id', repId)
        .eq('status', 'orcamento')
        .order('created_at', { ascending: false })

      if (orcamentosData) setOrcamentos(orcamentosData)

      setLoading(false)
    }

    fetchDados()
  }, [id, repId])

  // Trocar aba e atualizar URL
  function trocarAba(aba) {
    setAbaAtiva(aba)
    if (aba === 'visitas') navigate(`/clientes/${id}/visitas`, { replace: true })
    else if (aba === 'pedidos') navigate(`/clientes/${id}/pedidos`, { replace: true })
    else if (aba === 'orcamentos') navigate(`/clientes/${id}/orcamentos`, { replace: true })
  }

  // Navegar para item
  function navegarParaVisita(visitaId) {
    navigate(`/clientes/${id}/visitas/${visitaId}`, { state: { from: 'historico', clienteId: id } })
  }

  function navegarParaPedido(pedidoId) {
    navigate(`/pedidos/${pedidoId}`, { state: { from: 'historico', clienteId: id } })
  }

  // Titulo da aba
  const tituloAba = abaAtiva === 'visitas' ? 'Visitas' :
                    abaAtiva === 'pedidos' ? 'Pedidos' : 'Orcamentos'

  // Nome curto para header
  function getNomeCurto(nome) {
    if (!nome) return ''
    const palavras = nome.split(' ')
    if (palavras.length <= 2) return nome
    return `${palavras[0]} ${palavras[palavras.length - 1]}`
  }

  if (loading) {
    return (
      <div className={`historico-cliente ${isDark ? 'dark' : 'light'}`}>
        <header className="hc-header">
          <button className="hc-voltar" onClick={() => navigate(`/clientes/${id}`)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="hc-header-titulo">{tituloAba}</span>
          <div style={{ width: 36 }}></div>
        </header>
        <div className="hc-loading">Carregando...</div>
      </div>
    )
  }

  return (
    <div className={`historico-cliente ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="hc-header">
        <button className="hc-voltar" onClick={() => navigate(`/clientes/${id}`)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div className="hc-header-info">
          <span className="hc-header-cliente">{getNomeCurto(cliente?.nome)}</span>
          <span className="hc-header-titulo">{tituloAba}</span>
        </div>
        <div style={{ width: 36 }}></div>
      </header>

      {/* Tabs */}
      <div className="hc-tabs">
        <button
          className={`hc-tab ${abaAtiva === 'visitas' ? 'active' : ''}`}
          onClick={() => trocarAba('visitas')}
        >
          Visitas ({visitas.length})
        </button>
        <button
          className={`hc-tab ${abaAtiva === 'pedidos' ? 'active' : ''}`}
          onClick={() => trocarAba('pedidos')}
        >
          Pedidos ({pedidos.length})
        </button>
        <button
          className={`hc-tab ${abaAtiva === 'orcamentos' ? 'active' : ''}`}
          onClick={() => trocarAba('orcamentos')}
        >
          Orcamentos ({orcamentos.length})
        </button>
      </div>

      {/* Conteudo */}
      <div className="hc-content">
        {/* Aba Visitas */}
        {abaAtiva === 'visitas' && (
          <>
            {visitas.length === 0 ? (
              <div className="hc-vazio">Nenhuma visita registrada</div>
            ) : (
              <div className="hc-lista">
                {visitas.map((v) => (
                  <button
                    key={v.id}
                    className="hc-item"
                    onClick={() => navegarParaVisita(v.id)}
                  >
                    <div className="hc-item-left">
                      <span className="hc-item-check">✓</span>
                      <div className="hc-item-info">
                        <span className="hc-item-data">
                          {formatarData(v.data)}
                          {v.hora && ` as ${formatarHora(v.hora)}`}
                        </span>
                        <span className="hc-item-tipo">
                          {v.tipo === 'whatsapp' ? '📱 WhatsApp' : '🏪 Presencial'}
                        </span>
                      </div>
                    </div>
                    <div className="hc-item-right">
                      {v.obs && (
                        <span className="hc-item-obs">
                          {v.obs.length > 25 ? `${v.obs.slice(0, 25)}...` : v.obs}
                        </span>
                      )}
                      <span className="hc-item-seta">›</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Aba Pedidos */}
        {abaAtiva === 'pedidos' && (
          <>
            {pedidos.length === 0 ? (
              <div className="hc-vazio">Nenhum pedido registrado</div>
            ) : (
              <div className="hc-lista">
                {pedidos.map((p) => (
                  <button
                    key={p.id}
                    className="hc-item"
                    onClick={() => navegarParaPedido(p.id)}
                  >
                    <div className="hc-item-left">
                      <span className="hc-item-badge verde">
                        #{String(p.numero || 0).padStart(3, '0')}
                      </span>
                      <div className="hc-item-info">
                        <span className="hc-item-empresa">{p.representada_nome || 'Empresa'}</span>
                        <span className="hc-item-meta">
                          {formatarData(p.created_at)}
                          {p.canal && ` · ${p.canal === 'whatsapp' ? '📱' : '🏪'}`}
                        </span>
                      </div>
                    </div>
                    <div className="hc-item-right">
                      <span className="hc-item-valor">{formatarValor(p.valor_total)}</span>
                      <span className="hc-item-seta">›</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Aba Orcamentos */}
        {abaAtiva === 'orcamentos' && (
          <>
            {orcamentos.length === 0 ? (
              <div className="hc-vazio">Nenhum orcamento registrado</div>
            ) : (
              <div className="hc-lista">
                {orcamentos.map((o) => (
                  <button
                    key={o.id}
                    className="hc-item"
                    onClick={() => navegarParaPedido(o.id)}
                  >
                    <div className="hc-item-left">
                      <span className="hc-item-badge laranja">
                        ORC-{String(o.id).slice(-3)}
                      </span>
                      <div className="hc-item-info">
                        <span className="hc-item-empresa">{o.representada_nome || 'Empresa'}</span>
                        <span className="hc-item-meta">
                          {formatarData(o.created_at)}
                          {o.canal && ` · ${o.canal === 'whatsapp' ? '📱' : '🏪'}`}
                        </span>
                      </div>
                    </div>
                    <div className="hc-item-right">
                      <span className="hc-item-valor">{formatarValor(o.valor_total)}</span>
                      <span className="hc-item-seta">›</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default HistoricoCliente

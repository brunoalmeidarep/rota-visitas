import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import CheckIn from './CheckIn'
import './PerfilCliente.css'

// Formata valor monetário de forma abreviada
function formatarValor(valor) {
  if (!valor || valor === 0) return 'R$ 0'

  if (valor >= 1000000) {
    return `R$ ${(valor / 1000000).toFixed(1).replace('.', ',')}M`
  }
  if (valor >= 1000) {
    return `R$ ${(valor / 1000).toFixed(1).replace('.', ',')}k`
  }
  return `R$ ${valor.toFixed(2).replace('.', ',')}`
}

// Formata data
function formatarData(data) {
  if (!data) return '-'
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  })
}

// Calcula dias desde uma data
function diasDesde(data) {
  if (!data) return null
  const diff = Date.now() - new Date(data).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function PerfilCliente() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { repId } = useRepId()

  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [isDark, setIsDark] = useState(false)

  // Histórico
  const [abaAtiva, setAbaAtiva] = useState('visitas')
  const [visitas, setVisitas] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [total12Meses, setTotal12Meses] = useState(0)

  // Check-in modal
  const [mostrarCheckIn, setMostrarCheckIn] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar cliente
  useEffect(() => {
    async function fetchCliente() {
      if (!id) return

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .single()

        if (error) {
          console.error('[PerfilCliente] Erro:', error)
          setErro('Cliente não encontrado')
        } else {
          setCliente(data)
        }
      } catch (err) {
        console.error('[PerfilCliente] Exceção:', err)
        setErro('Erro ao carregar cliente')
      }
      setLoading(false)
    }

    fetchCliente()
  }, [id])

  // Carregar histórico
  useEffect(() => {
    async function fetchHistorico() {
      if (!id || !repId) return

      // Visitas
      const { data: visitasData } = await supabase
        .from('visitas')
        .select('id, data, hora, tipo, obs')
        .eq('cliente_id', id)
        .eq('rep_id', repId)
        .order('data', { ascending: false })
        .limit(5)

      if (visitasData) setVisitas(visitasData)

      // Pedidos (status = pedido)
      const { data: pedidosData } = await supabase
        .from('pedidos')
        .select('id, numero, valor_total, created_at, status, representada_nome')
        .eq('cliente_id', id)
        .eq('rep_id', repId)
        .eq('status', 'pedido')
        .order('created_at', { ascending: false })
        .limit(5)

      if (pedidosData) setPedidos(pedidosData)

      // Orçamentos (status = orcamento)
      const { data: orcamentosData } = await supabase
        .from('pedidos')
        .select('id, numero, valor_total, created_at, status, representada_nome')
        .eq('cliente_id', id)
        .eq('rep_id', repId)
        .eq('status', 'orcamento')
        .order('created_at', { ascending: false })
        .limit(5)

      if (orcamentosData) setOrcamentos(orcamentosData)

      // Total 12 meses
      const dataLimite = new Date()
      dataLimite.setFullYear(dataLimite.getFullYear() - 1)

      const { data: totalData } = await supabase
        .from('pedidos')
        .select('valor_total')
        .eq('cliente_id', id)
        .eq('rep_id', repId)
        .eq('status', 'pedido')
        .gte('created_at', dataLimite.toISOString())

      if (totalData) {
        const total = totalData.reduce((acc, p) => acc + (p.valor_total || 0), 0)
        setTotal12Meses(total)
      }
    }

    fetchHistorico()
  }, [id, repId])

  // Abre no mapa
  function abrirNoMapa() {
    if (!cliente) return

    if (cliente.lat && cliente.lng) {
      window.open(`https://www.google.com/maps?q=${cliente.lat},${cliente.lng}`, '_blank')
    } else if (cliente.endereco && cliente.cidade) {
      const endereco = encodeURIComponent(`${cliente.endereco}, ${cliente.cidade}`)
      window.open(`https://www.google.com/maps/search/${endereco}`, '_blank')
    } else {
      alert('Endereço não disponível')
    }
  }

  // Nome curto para header
  function getNomeCurto(nome) {
    if (!nome) return ''
    const palavras = nome.split(' ')
    if (palavras.length <= 2) return nome
    return `${palavras[0]} ${palavras[palavras.length - 1]}`
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  if (erro || !cliente) {
    return (
      <div className={`perfil-cliente ${isDark ? 'dark' : 'light'}`}>
        <header className="perfil-header">
          <button className="perfil-voltar" onClick={() => navigate('/clientes')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="perfil-header-titulo">Cliente</span>
        </header>
        <div className="perfil-erro">
          <p>{erro || 'Cliente não encontrado'}</p>
          <button onClick={() => navigate('/clientes')}>Voltar</button>
        </div>
      </div>
    )
  }

  const diasUltimaVisita = diasDesde(cliente.ultima_visita)

  return (
    <div className={`perfil-cliente ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="perfil-header">
        <button className="perfil-voltar" onClick={() => navigate('/clientes')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="perfil-header-titulo">{getNomeCurto(cliente.nome)}</span>
        <button className="perfil-editar" onClick={() => navigate(`/clientes/${id}/editar`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </header>

      {/* Card de Stats */}
      <div className="perfil-stats-card">
        <h1 className="perfil-nome">{cliente.nome}</h1>
        <p className="perfil-subtitulo">
          {cliente.cidade || 'Cidade não informada'}
          {cliente.regime && ` · ${cliente.regime}`}
        </p>

        <div className="perfil-stats">
          <div className="perfil-stat">
            <div className="perfil-stat-valor">
              {diasUltimaVisita !== null ? (
                diasUltimaVisita === 0 ? 'Hoje' : `${diasUltimaVisita}d`
              ) : '-'}
            </div>
            <div className="perfil-stat-label">Última visita</div>
          </div>
          <div className="perfil-stat">
            <div className="perfil-stat-valor">
              {formatarValor(cliente.ultimo_pedido_valor || 0)}
            </div>
            <div className="perfil-stat-label">Último pedido</div>
          </div>
          <div className="perfil-stat">
            <div className="perfil-stat-valor">{formatarValor(total12Meses)}</div>
            <div className="perfil-stat-label">12 meses</div>
          </div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="perfil-acoes">
        <button className="perfil-acao" onClick={() => setMostrarCheckIn(true)}>
          <span className="perfil-acao-icon">✅</span>
          <span className="perfil-acao-texto">Check-in</span>
        </button>
        <button className="perfil-acao" onClick={() => navigate(`/clientes/${id}/bonificacao`)}>
          <span className="perfil-acao-icon">🎁</span>
          <span className="perfil-acao-texto">Bonificação</span>
        </button>
        <button className="perfil-acao" onClick={() => navigate(`/clientes/${id}/gastos`)}>
          <span className="perfil-acao-icon">💸</span>
          <span className="perfil-acao-texto">Gastos</span>
        </button>
        <button className="perfil-acao perfil-acao-mapa" onClick={abrirNoMapa}>
          <svg viewBox="0 0 60 40" className="perfil-mapa-svg">
            <rect width="60" height="40" fill="#e8f5e9" rx="4"/>
            <path d="M5 20 Q20 10, 35 18 T55 15" stroke="#a5d6a7" strokeWidth="2" fill="none"/>
            <circle cx="20" cy="18" r="4" fill="#f44336"/>
            <circle cx="40" cy="22" r="3" fill="#ff7043"/>
          </svg>
          <span className="perfil-acao-texto">Mapa</span>
        </button>
      </div>

      {/* Card Dados do Cliente */}
      <button className="perfil-dados-card" onClick={() => navigate(`/clientes/${id}/dados`)}>
        <div className="perfil-dados-left">
          <span className="perfil-dados-icon">📋</span>
          <span className="perfil-dados-titulo">Dados do cliente</span>
        </div>
        <span className="perfil-dados-seta">Ver →</span>
      </button>

      {/* Histórico */}
      <div className="perfil-historico">
        <div className="perfil-historico-tabs">
          <button
            className={`perfil-tab ${abaAtiva === 'visitas' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('visitas')}
          >
            Visitas
          </button>
          <button
            className={`perfil-tab ${abaAtiva === 'pedidos' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('pedidos')}
          >
            Pedidos
          </button>
          <button
            className={`perfil-tab ${abaAtiva === 'orcamentos' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('orcamentos')}
          >
            Orçamentos
          </button>
        </div>

        <div className="perfil-historico-content">
          {/* Aba Visitas */}
          {abaAtiva === 'visitas' && (
            <>
              {visitas.length === 0 ? (
                <div className="perfil-historico-vazio">Nenhuma visita registrada</div>
              ) : (
                visitas.map((v) => (
                  <div
                    key={v.id}
                    className="perfil-historico-item clickable"
                    onClick={() => navigate(`/clientes/${id}/visitas/${v.id}`, { state: { from: 'cliente', clienteId: id } })}
                  >
                    <div className="perfil-historico-item-left">
                      <span className="perfil-historico-check">✓</span>
                      <div className="perfil-historico-info">
                        <span className="perfil-historico-data">{formatarData(v.data)}</span>
                        <span className="perfil-historico-tipo">
                          {v.tipo === 'whatsapp' ? '📱 WhatsApp' : '🏪 Presencial'}
                        </span>
                      </div>
                    </div>
                    {v.obs && (
                      <span className="perfil-historico-obs">
                        {v.obs.length > 30 ? `${v.obs.slice(0, 30)}...` : v.obs}
                      </span>
                    )}
                  </div>
                ))
              )}
              {visitas.length > 0 && (
                <button className="perfil-historico-ver-todas" onClick={() => navigate(`/clientes/${id}/visitas`)}>
                  Ver todas →
                </button>
              )}
            </>
          )}

          {/* Aba Pedidos */}
          {abaAtiva === 'pedidos' && (
            <>
              {pedidos.length === 0 ? (
                <div className="perfil-historico-vazio">Nenhum pedido registrado</div>
              ) : (
                pedidos.map((p) => (
                  <div
                    key={p.id}
                    className="perfil-historico-item clickable"
                    onClick={() => navigate(`/pedidos/${p.id}`, { state: { from: 'cliente', clienteId: id } })}
                  >
                    <div className="perfil-historico-item-left">
                      <span className="perfil-historico-badge verde">Pedido</span>
                      <div className="perfil-historico-info">
                        <span className="perfil-historico-empresa">{p.representada_nome || 'Empresa'}</span>
                        <span className="perfil-historico-data">{formatarData(p.created_at)}</span>
                      </div>
                    </div>
                    <span className="perfil-historico-valor">{formatarValor(p.valor_total)}</span>
                  </div>
                ))
              )}
              {pedidos.length > 0 && (
                <button className="perfil-historico-ver-todas" onClick={() => navigate(`/clientes/${id}/pedidos`)}>
                  Ver todos →
                </button>
              )}
            </>
          )}

          {/* Aba Orçamentos */}
          {abaAtiva === 'orcamentos' && (
            <>
              {orcamentos.length === 0 ? (
                <div className="perfil-historico-vazio">Nenhum orçamento registrado</div>
              ) : (
                orcamentos.map((o) => (
                  <div
                    key={o.id}
                    className="perfil-historico-item clickable"
                    onClick={() => navigate(`/pedidos/${o.id}`, { state: { from: 'cliente', clienteId: id } })}
                  >
                    <div className="perfil-historico-item-left">
                      <span className="perfil-historico-badge laranja">Orçamento</span>
                      <div className="perfil-historico-info">
                        <span className="perfil-historico-empresa">{o.representada_nome || 'Empresa'}</span>
                        <span className="perfil-historico-data">{formatarData(o.created_at)}</span>
                      </div>
                    </div>
                    <span className="perfil-historico-valor">{formatarValor(o.valor_total)}</span>
                  </div>
                ))
              )}
              {orcamentos.length > 0 && (
                <button className="perfil-historico-ver-todas" onClick={() => navigate(`/clientes/${id}/orcamentos`)}>
                  Ver todos →
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Check-in Modal */}
      {mostrarCheckIn && (
        <CheckIn
          cliente={cliente}
          onClose={() => setMostrarCheckIn(false)}
          onConfirm={async () => {
            // Recarregar última visita
            const { data: updatedCliente } = await supabase
              .from('clientes')
              .select('*')
              .eq('id', id)
              .single()

            if (updatedCliente) setCliente(updatedCliente)

            // Recarregar visitas
            const { data: visitasData } = await supabase
              .from('visitas')
              .select('id, data, hora, tipo, obs')
              .eq('cliente_id', id)
              .eq('rep_id', repId)
              .order('data', { ascending: false })
              .limit(5)

            if (visitasData) setVisitas(visitasData)
          }}
        />
      )}
    </div>
  )
}

export default PerfilCliente

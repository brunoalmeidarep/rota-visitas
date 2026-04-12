import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './PerfilCliente.css'

function PerfilCliente() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

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

  // Formata data
  function formatarData(data) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  // Formata CNPJ
  function formatarCnpj(cnpj) {
    if (!cnpj) return '-'
    const nums = cnpj.replace(/\D/g, '')
    if (nums.length !== 14) return cnpj
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`
  }

  // Abre telefone
  function ligarTelefone(tel) {
    if (!tel) return
    const nums = tel.replace(/\D/g, '')
    window.open(`tel:${nums}`, '_self')
  }

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

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  if (erro || !cliente) {
    return (
      <div className="perfil-cliente">
        <header className="perfil-header">
          <button className="perfil-voltar" onClick={() => navigate('/clientes')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Clientes
          </button>
        </header>
        <div className="perfil-erro">
          <p>{erro || 'Cliente não encontrado'}</p>
          <button onClick={() => navigate('/clientes')}>Voltar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="perfil-cliente">
      {/* Header */}
      <header className="perfil-header">
        <button className="perfil-voltar" onClick={() => navigate('/clientes')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Clientes
        </button>
        <button className="perfil-editar" onClick={() => navigate(`/clientes/${id}/editar`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </header>

      {/* Hero */}
      <div className="perfil-hero">
        <h1 className="perfil-nome">{cliente.nome}</h1>
        <p className="perfil-subtitulo">
          {cliente.cidade || 'Cidade não informada'}
          {cliente.regime && ` · ${cliente.regime}`}
        </p>
      </div>

      {/* Stats */}
      <div className="perfil-stats">
        <div className="perfil-stat">
          <div className="perfil-stat-valor">{formatarData(cliente.ultima_visita)}</div>
          <div className="perfil-stat-label">Última visita</div>
        </div>
        <div className="perfil-stat">
          <div className="perfil-stat-valor">{formatarData(cliente.ultimo_pedido_data)}</div>
          <div className="perfil-stat-label">Último pedido</div>
        </div>
        <div className="perfil-stat">
          <div className="perfil-stat-valor">R$ 0</div>
          <div className="perfil-stat-label">Total 12 meses</div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="perfil-acoes">
        <button className="perfil-acao" onClick={() => alert('Check-in em desenvolvimento')}>
          <span className="perfil-acao-icon">✅</span>
          <span className="perfil-acao-texto">Check-in</span>
        </button>
        <button className="perfil-acao" onClick={() => alert('Bonificação em desenvolvimento')}>
          <span className="perfil-acao-icon">🎁</span>
          <span className="perfil-acao-texto">Bonificação</span>
        </button>
        <button className="perfil-acao" onClick={() => alert('Gastos em desenvolvimento')}>
          <span className="perfil-acao-icon">💸</span>
          <span className="perfil-acao-texto">Gastos</span>
        </button>
        <button className="perfil-acao" onClick={abrirNoMapa}>
          <span className="perfil-acao-icon">🗺️</span>
          <span className="perfil-acao-texto">Ver no mapa</span>
        </button>
      </div>

      {/* Dados do cliente */}
      <div className="perfil-dados">
        <h2 className="perfil-dados-titulo">Dados do cliente</h2>

        <div className="perfil-campo">
          <span className="perfil-campo-label">CNPJ</span>
          <span className="perfil-campo-valor">{formatarCnpj(cliente.cnpj)}</span>
        </div>

        <div className="perfil-campo">
          <span className="perfil-campo-label">Telefone</span>
          {cliente.telefone ? (
            <button className="perfil-telefone" onClick={() => ligarTelefone(cliente.telefone)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {cliente.telefone}
            </button>
          ) : (
            <span className="perfil-campo-valor">-</span>
          )}
        </div>

        <div className="perfil-campo">
          <span className="perfil-campo-label">Comprador</span>
          <span className="perfil-campo-valor">{cliente.comprador || '-'}</span>
        </div>

        <div className="perfil-campo">
          <span className="perfil-campo-label">Segmento</span>
          <span className="perfil-campo-valor">{cliente.segmento || '-'}</span>
        </div>

        <div className="perfil-campo">
          <span className="perfil-campo-label">Endereço</span>
          <span className="perfil-campo-valor">
            {cliente.endereco ? `${cliente.endereco}, ${cliente.cidade}` : cliente.cidade || '-'}
          </span>
        </div>

        {cliente.lat && cliente.lng && (
          <div className="perfil-campo">
            <span className="perfil-campo-label">Coordenadas</span>
            <span className="perfil-campo-valor perfil-coords">
              {cliente.lat.toFixed(6)}, {cliente.lng.toFixed(6)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default PerfilCliente

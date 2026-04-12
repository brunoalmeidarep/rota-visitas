import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './CarteiraClientes.css'

const GEOCODING_API_KEY = 'AIzaSyCwgVzb1CW3_rN-3t6LAkBC1IOPYN5zqJI'

// Normaliza texto para Title Case
function toTitleCase(str) {
  if (!str) return ''
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

function CarteiraClientes() {
  const navigate = useNavigate()
  const location = useLocation()
  const { repId, loading: loadingRep } = useRepId()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(false)
  const [carregouUmaVez, setCarregouUmaVez] = useState(false)
  const [erro, setErro] = useState(null)
  const [busca, setBusca] = useState('')
  const [filtroAtivo, setFiltroAtivo] = useState('todos')

  // Estado para geocodificação em massa
  const [geocodificando, setGeocodificando] = useState(false)
  const [geoProgresso, setGeoProgresso] = useState({ atual: 0, total: 0, sucesso: 0 })

  // Função para buscar clientes (reutilizável)
  const fetchClientes = useCallback(async () => {
    if (!repId) return

    setLoading(true)
    setErro(null)
    console.log('[CarteiraClientes] Buscando clientes para rep_id:', repId)

    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('rep_id', repId)
        .order('nome')

      console.log('[CarteiraClientes] Resultado:', { data, error })

      if (error) {
        console.error('[CarteiraClientes] Erro Supabase:', error)
        setErro(error.message || 'Erro ao carregar clientes')
      } else {
        setClientes(data || [])
        console.log('[CarteiraClientes] Clientes carregados:', data?.length || 0)
      }
    } catch (err) {
      console.error('[CarteiraClientes] Exceção:', err)
      setErro('Erro de conexão. Verifique sua internet.')
    } finally {
      setLoading(false)
      setCarregouUmaVez(true)
    }
  }, [repId])

  // Debug: log repId
  useEffect(() => {
    console.log('[CarteiraClientes] loadingRep:', loadingRep, 'repId:', repId)
  }, [loadingRep, repId])

  // Busca inicial quando repId estiver disponível
  useEffect(() => {
    if (loadingRep) return

    if (!repId) {
      console.log('[CarteiraClientes] repId é null/undefined após carregar')
      setCarregouUmaVez(true)
      return
    }

    fetchClientes()
  }, [repId, loadingRep, fetchClientes])

  // Refetch quando navegar de volta para esta tela (ex: após cadastrar cliente)
  useEffect(() => {
    if (repId && carregouUmaVez) {
      console.log('[CarteiraClientes] Refetch ao entrar na tela')
      fetchClientes()
    }
  }, [location.key]) // location.key muda a cada navegação

  // Calcula dias desde última visita
  function diasDesdeVisita(ultimaVisita) {
    if (!ultimaVisita) return null
    const hoje = new Date()
    const visita = new Date(ultimaVisita)
    const diff = Math.floor((hoje - visita) / (1000 * 60 * 60 * 24))
    return diff
  }

  // Classifica cliente por status
  function getStatus(cliente) {
    const dias = diasDesdeVisita(cliente.ultima_visita)
    if (dias === null) return 'prospect'
    if (dias <= 30) return 'ativo'
    if (dias <= 89) return 'recente'
    return 'inativo'
  }

  // Cor baseada nos dias
  function getCorDias(dias) {
    if (dias === null) return 'gray'
    if (dias <= 30) return 'green'
    if (dias <= 89) return 'yellow'
    return 'red'
  }

  // Formata data para exibição
  function formatarData(data) {
    if (!data) return '-'
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    })
  }

  // Formata valor em reais
  function formatarValor(valor) {
    if (!valor) return null
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
  }

  // Conta clientes sem geocodificação
  const clientesSemGeo = useMemo(() => {
    return clientes.filter(c => !c.lat || !c.lng)
  }, [clientes])

  // Geocodifica um endereço
  async function geocodificarEndereco(cliente) {
    const partes = []
    if (cliente.endereco) partes.push(cliente.endereco)
    if (cliente.cidade) partes.push(cliente.cidade)
    const enderecoCompleto = partes.join(', ')

    if (!enderecoCompleto) return null

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(enderecoCompleto)}&key=${GEOCODING_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.status === 'OK' && data.results?.length > 0) {
        const loc = data.results[0].geometry.location
        return { lat: loc.lat, lng: loc.lng }
      }
      return null
    } catch (err) {
      console.error('[Geocoding] Erro:', err)
      return null
    }
  }

  // Geocodifica todos os clientes sem lat/lng
  async function geocodificarTodos() {
    if (geocodificando) return
    if (clientesSemGeo.length === 0) {
      alert('Todos os clientes já possuem coordenadas!')
      return
    }

    const confirma = confirm(`Geocodificar ${clientesSemGeo.length} cliente(s) sem coordenadas?\n\nIsso pode levar alguns segundos.`)
    if (!confirma) return

    setGeocodificando(true)
    setGeoProgresso({ atual: 0, total: clientesSemGeo.length, sucesso: 0 })

    let sucesso = 0

    for (let i = 0; i < clientesSemGeo.length; i++) {
      const cliente = clientesSemGeo[i]
      setGeoProgresso(prev => ({ ...prev, atual: i + 1 }))

      console.log(`[Geocoding] ${i + 1}/${clientesSemGeo.length}: ${cliente.nome}`)

      const coords = await geocodificarEndereco(cliente)

      if (coords) {
        const { error } = await supabase
          .from('clientes')
          .update({ lat: coords.lat, lng: coords.lng })
          .eq('id', cliente.id)

        if (!error) {
          sucesso++
          console.log(`[Geocoding] ✅ ${cliente.nome}: ${coords.lat}, ${coords.lng}`)
        } else {
          console.error(`[Geocoding] ❌ Erro ao atualizar ${cliente.nome}:`, error)
        }
      } else {
        console.warn(`[Geocoding] ⚠️ Sem resultado para ${cliente.nome}`)
      }

      // Delay para não sobrecarregar a API (200ms entre requests)
      if (i < clientesSemGeo.length - 1) {
        await new Promise(r => setTimeout(r, 200))
      }
    }

    setGeoProgresso(prev => ({ ...prev, sucesso }))
    setGeocodificando(false)

    alert(`Geocodificação concluída!\n\n✅ ${sucesso} de ${clientesSemGeo.length} endereços geocodificados.`)

    // Recarregar lista de clientes
    fetchClientes()
  }

  // Contagem por status
  const contagens = useMemo(() => {
    const counts = { todos: 0, ativo: 0, recente: 0, inativo: 0, prospect: 0 }
    clientes.forEach(c => {
      counts.todos++
      counts[getStatus(c)]++
    })
    return counts
  }, [clientes])

  // Filtra clientes
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      // Filtro de busca
      const termoBusca = busca.toLowerCase()
      const matchBusca = !busca ||
        c.nome?.toLowerCase().includes(termoBusca) ||
        c.cidade?.toLowerCase().includes(termoBusca)

      // Filtro de status
      const status = getStatus(c)
      const matchStatus = filtroAtivo === 'todos' || status === filtroAtivo

      return matchBusca && matchStatus
    })
  }, [clientes, busca, filtroAtivo])

  // Estado de carregamento inicial
  if (loadingRep || (loading && !carregouUmaVez)) {
    return <div className="loading">Carregando...</div>
  }

  // Rep não encontrado
  if (!repId) {
    return (
      <div className="error-state">
        <h2>Rep não encontrado</h2>
        <p>Não foi possível identificar o representante logado.</p>
        <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
          Verifique se o usuário está cadastrado na tabela "representantes".
        </p>
      </div>
    )
  }

  // Erro ao carregar
  if (erro) {
    return (
      <div className="error-state">
        <h2>Erro ao carregar</h2>
        <p>{erro}</p>
        <button onClick={() => window.location.reload()} style={{
          marginTop: '16px',
          padding: '10px 20px',
          background: '#1a3a6b',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="carteira-clientes">
      {/* Header */}
      <header className="carteira-header">
        <button className="header-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Clientes</h1>
        <div className="header-actions">
          <button className="header-btn blue" onClick={() => navigate('/mapa')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </button>
          <button className="header-btn green" onClick={() => navigate('/clientes/novo')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Busca */}
      <div className="busca-container">
        <svg className="busca-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          className="busca-input"
          placeholder="Buscar por nome ou cidade..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <button className="busca-clear" onClick={() => setBusca('')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Botão geocodificação (só aparece se há clientes sem coordenadas) */}
      {clientesSemGeo.length > 0 && (
        <button
          className="btn-geocodificar"
          onClick={geocodificarTodos}
          disabled={geocodificando}
        >
          {geocodificando
            ? `📍 Geocodificando ${geoProgresso.atual}/${geoProgresso.total}...`
            : `📍 Geocodificar ${clientesSemGeo.length} endereço(s)`
          }
        </button>
      )}

      {/* Stats Bar */}
      <div className="stats-bar">
        <button
          className={`stat-item ${filtroAtivo === 'todos' ? 'active' : ''}`}
          onClick={() => setFiltroAtivo('todos')}
        >
          <span className="stat-count">{contagens.todos}</span>
          <span className="stat-label">Todos</span>
        </button>
        <button
          className={`stat-item ${filtroAtivo === 'ativo' ? 'active' : ''}`}
          onClick={() => setFiltroAtivo('ativo')}
        >
          <span className="stat-count green">{contagens.ativo}</span>
          <span className="stat-label">Ativos</span>
        </button>
        <button
          className={`stat-item ${filtroAtivo === 'recente' ? 'active' : ''}`}
          onClick={() => setFiltroAtivo('recente')}
        >
          <span className="stat-count yellow">{contagens.recente}</span>
          <span className="stat-label">Recentes</span>
        </button>
        <button
          className={`stat-item ${filtroAtivo === 'inativo' ? 'active' : ''}`}
          onClick={() => setFiltroAtivo('inativo')}
        >
          <span className="stat-count red">{contagens.inativo}</span>
          <span className="stat-label">Inativos</span>
        </button>
        <button
          className={`stat-item ${filtroAtivo === 'prospect' ? 'active' : ''}`}
          onClick={() => setFiltroAtivo('prospect')}
        >
          <span className="stat-count gray">{contagens.prospect}</span>
          <span className="stat-label">Prospect</span>
        </button>
      </div>

      {/* Lista de Clientes */}
      <div className="clientes-lista">
        {clientesFiltrados.length === 0 ? (
          <div className="empty-state">
            {busca ? (
              <>
                <p>Nenhum cliente encontrado</p>
                <button className="btn-limpar-busca" onClick={() => setBusca('')}>
                  Limpar busca
                </button>
              </>
            ) : clientes.length === 0 ? (
              <>
                <div className="empty-icon">👥</div>
                <h3>Nenhum cliente cadastrado ainda</h3>
                <p>Comece adicionando seu primeiro cliente</p>
                <button className="btn-adicionar-primeiro" onClick={() => navigate('/clientes/novo')}>
                  + Adicionar primeiro cliente
                </button>
              </>
            ) : (
              <p>Nenhum cliente neste filtro</p>
            )}
          </div>
        ) : (
          clientesFiltrados.map(cliente => {
            const dias = diasDesdeVisita(cliente.ultima_visita)
            const corDias = getCorDias(dias)

            return (
              <div
                key={cliente.id}
                className="cliente-card"
                onClick={() => navigate(`/clientes/${cliente.id}`)}
              >
                <div className="cliente-info">
                  <h3 className="cliente-nome">{cliente.nome}</h3>
                  <p className="cliente-cidade">{toTitleCase(cliente.cidade) || 'Cidade não informada'}</p>
                  {cliente.ultimo_pedido_valor && (
                    <p className="cliente-pedido">
                      {formatarValor(cliente.ultimo_pedido_valor)}
                      {cliente.ultimo_pedido_data && (
                        <span className="pedido-data"> · {formatarData(cliente.ultimo_pedido_data)}</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="cliente-visita">
                  <span className="visita-label">Última visita</span>
                  <span className={`visita-dias ${corDias}`}>
                    {dias === null ? 'Nunca' : dias === 0 ? 'Hoje' : `${dias} dias`}
                  </span>
                  <span className="visita-data">{formatarData(cliente.ultima_visita)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default CarteiraClientes

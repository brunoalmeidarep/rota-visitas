import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './Mapa.css'

// Token do Mapbox
mapboxgl.accessToken = 'pk.eyJ1IjoiYnJ1bm9tcnAiLCJhIjoiY21vMHZpenBhMGNpNDJycHV3N3Z4a2NreiJ9.gjgY__dvCLzH69odm4OSLQ'

const STATUS_CONFIG = {
  ativo: { cor: '#34c759', label: 'Ativo', emoji: '🟢', desc: '≤30 dias' },
  atencao: { cor: '#ff9500', label: 'Atenção', emoji: '🟠', desc: '31-90 dias' },
  inativo: { cor: '#ff3b30', label: 'Inativo', emoji: '🔴', desc: '90+ dias' },
  prospect: { cor: '#007aff', label: 'Prospect', emoji: '🔵', desc: 'nunca visitado' }
}

function calcularStatus(ultimaVisita) {
  if (!ultimaVisita) return 'prospect'
  const dias = Math.floor((new Date() - new Date(ultimaVisita)) / (1000 * 60 * 60 * 24))
  if (dias <= 30) return 'ativo'
  if (dias <= 90) return 'atencao'
  return 'inativo'
}

function diasDesde(data) {
  if (!data) return null
  return Math.floor((new Date() - new Date(data)) / (1000 * 60 * 60 * 24))
}

function Mapa() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef([])

  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')

  // Inicializar mapa imediatamente ao montar
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-48.8487, -26.3045], // Joinville default
      zoom: 12
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    map.current.on('load', () => {
      setMapReady(true)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Carregar clientes com última visita
  useEffect(() => {
    if (!repId) return

    async function fetchDados() {
      setLoading(true)

      // Buscar centro do representante
      const { data: repData } = await supabase
        .from('representantes')
        .select('lat_base, lng_base')
        .eq('id', repId)
        .single()

      if (repData?.lat_base && repData?.lng_base && map.current) {
        map.current.setCenter([repData.lng_base, repData.lat_base])
      }

      // Buscar clientes com coordenadas
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, nome, cidade, lat, lng')
        .eq('rep_id', repId)
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      if (!clientesData || clientesData.length === 0) {
        setClientes([])
        setLoading(false)
        return
      }

      // Buscar última visita de cada cliente
      const clienteIds = clientesData.map(c => c.id)
      const { data: visitasData } = await supabase
        .from('visitas')
        .select('cliente_id, created_at')
        .eq('rep_id', repId)
        .in('cliente_id', clienteIds)
        .order('created_at', { ascending: false })

      // Agrupar última visita por cliente
      const ultimaVisitaPorCliente = {}
      visitasData?.forEach(v => {
        if (!ultimaVisitaPorCliente[v.cliente_id]) {
          ultimaVisitaPorCliente[v.cliente_id] = v.created_at
        }
      })

      // Calcular status de cada cliente
      const clientesComStatus = clientesData.map(c => ({
        ...c,
        ultimaVisita: ultimaVisitaPorCliente[c.id] || null,
        status: calcularStatus(ultimaVisitaPorCliente[c.id])
      }))

      setClientes(clientesComStatus)
      setLoading(false)
    }

    fetchDados()
  }, [repId])

  // Adicionar markers quando mapa e dados estiverem prontos
  useEffect(() => {
    if (!map.current || !mapReady || loading) return

    // Limpar markers anteriores
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Filtrar clientes
    const clientesFiltrados = filtroStatus === 'todos'
      ? clientes
      : clientes.filter(c => c.status === filtroStatus)

    // Criar markers
    clientesFiltrados.forEach(cliente => {
      const config = STATUS_CONFIG[cliente.status]

      // Criar elemento do marker
      const el = document.createElement('div')
      el.className = 'mapa-marker'
      el.innerHTML = `
        <div class="mapa-marker-dot" style="background: ${config.cor}; box-shadow: 0 0 12px ${config.cor}80;"></div>
        <div class="mapa-marker-label">${cliente.nome.split(' ')[0]}</div>
      `

      // Criar popup
      const dias = diasDesde(cliente.ultimaVisita)
      const visitaTexto = dias !== null ? `${dias} dias atrás` : 'Nunca visitado'

      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`
          <div class="mapa-popup">
            <div class="mapa-popup-nome">${cliente.nome}</div>
            <div class="mapa-popup-cidade">${cliente.cidade || '-'}</div>
            <div class="mapa-popup-visita">Última visita: ${visitaTexto}</div>
            <button class="mapa-popup-btn" onclick="window.navegarCliente('${cliente.id}')">
              Ver perfil →
            </button>
          </div>
        `)

      const marker = new mapboxgl.Marker(el)
        .setLngLat([cliente.lng, cliente.lat])
        .setPopup(popup)
        .addTo(map.current)

      markersRef.current.push(marker)
    })

    // Função global para navegação (popup não tem acesso ao React)
    window.navegarCliente = (id) => {
      navigate(`/clientes/${id}`)
    }

    // Ajustar bounds se houver clientes
    if (clientesFiltrados.length > 0) {
      const bounds = new mapboxgl.LngLatBounds()
      clientesFiltrados.forEach(c => bounds.extend([c.lng, c.lat]))

      if (clientesFiltrados.length > 1) {
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 })
      }
    }

    return () => {
      delete window.navegarCliente
    }
  }, [clientes, filtroStatus, mapReady, loading, navigate])

  // Contagens por status
  const contagens = {
    todos: clientes.length,
    ativo: clientes.filter(c => c.status === 'ativo').length,
    atencao: clientes.filter(c => c.status === 'atencao').length,
    inativo: clientes.filter(c => c.status === 'inativo').length,
    prospect: clientes.filter(c => c.status === 'prospect').length
  }

  const clientesNoMapa = filtroStatus === 'todos'
    ? clientes.length
    : contagens[filtroStatus]

  return (
    <div className="mapa-container">
      {/* Header */}
      <header className="mapa-header">
        <button className="mapa-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Mapa de Clientes</h1>
        <div className="mapa-header-spacer"></div>
      </header>

      {/* Legenda */}
      <div className="mapa-legenda">
        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
          <div key={key} className="mapa-legenda-item">
            <span>{config.emoji}</span>
            <span className="mapa-legenda-label">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Mapa */}
      <div ref={mapContainer} className="mapa-canvas" />
      {loading && (
        <div className="mapa-loading">
          <span>Carregando...</span>
        </div>
      )}

      {/* Filtros */}
      <div className="mapa-filtros">
        <div className="mapa-filtros-pills">
          <button
            className={`mapa-filtro ${filtroStatus === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('todos')}
          >
            Todos ({contagens.todos})
          </button>
          <button
            className={`mapa-filtro ${filtroStatus === 'ativo' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('ativo')}
          >
            {STATUS_CONFIG.ativo.emoji} Ativos ({contagens.ativo})
          </button>
          <button
            className={`mapa-filtro ${filtroStatus === 'atencao' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('atencao')}
          >
            {STATUS_CONFIG.atencao.emoji} Atenção ({contagens.atencao})
          </button>
          <button
            className={`mapa-filtro ${filtroStatus === 'inativo' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('inativo')}
          >
            {STATUS_CONFIG.inativo.emoji} Inativos ({contagens.inativo})
          </button>
          <button
            className={`mapa-filtro ${filtroStatus === 'prospect' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('prospect')}
          >
            {STATUS_CONFIG.prospect.emoji} Prospects ({contagens.prospect})
          </button>
        </div>
        <div className="mapa-filtros-count">
          {clientesNoMapa} cliente{clientesNoMapa !== 1 ? 's' : ''} no mapa
        </div>
      </div>
    </div>
  )
}

export default Mapa

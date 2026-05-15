import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { loadGoogleMaps } from '../../lib/googleMaps'
import './Mapa.css'

const STATUS_CONFIG = {
  ativo: { cor: '#34c759', label: 'Ativo', emoji: '🟢', desc: '≤30 dias' },
  atencao: { cor: '#ff9500', label: 'Atenção', emoji: '🟠', desc: '31-90 dias' },
  inativo: { cor: '#ff3b30', label: 'Inativo', emoji: '🔴', desc: '90+ dias' },
  prospect: { cor: '#007aff', label: 'Prospect', emoji: '🔵', desc: 'nunca visitado' }
}

function calcularStatus(ultimaVisita) {
  if (!ultimaVisita) return 'prospect'
  const dias = Math.floor((Date.now() - new Date(ultimaVisita).getTime()) / (1000 * 60 * 60 * 24))
  if (dias <= 30) return 'ativo'
  if (dias <= 90) return 'atencao'
  return 'inativo'
}

function diasDesde(data) {
  if (!data) return null
  return Math.floor((Date.now() - new Date(data).getTime()) / (1000 * 60 * 60 * 24))
}

function Mapa() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const mapContainer = useRef(null)
  const map = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)

  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('todos')

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    loadGoogleMaps()
      .then(() => {
        map.current = new window.google.maps.Map(mapContainer.current, {
          center: { lat: -26.3045, lng: -48.8487 }, // Joinville default
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })

        infoWindowRef.current = new window.google.maps.InfoWindow()
        setMapReady(true)
      })
      .catch(err => console.warn('[Mapa] Erro ao carregar Google Maps:', err))

    return () => {
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
      map.current = null
    }
  }, [])

  // Carregar clientes com última visita
  useEffect(() => {
    if (!repId) return

    async function fetchDados() {
      setLoading(true)

      const { data: repData } = await supabase
        .from('representantes')
        .select('lat_base, lng_base')
        .eq('id', repId)
        .single()

      if (repData?.lat_base && repData?.lng_base && map.current) {
        map.current.setCenter({ lat: repData.lat_base, lng: repData.lng_base })
      }

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

      const { data: visitasData } = await supabase
        .from('visitas')
        .select('cliente_id, data')
        .eq('rep_id', repId)
        .order('data', { ascending: false })

      const ultimaVisitaPorCliente = {}
      visitasData?.forEach(v => {
        if (!ultimaVisitaPorCliente[v.cliente_id]) {
          ultimaVisitaPorCliente[v.cliente_id] = v.data
        }
      })

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

  // Adicionar markers
  useEffect(() => {
    if (!map.current || !mapReady || loading) return

    // Limpar markers anteriores
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const clientesFiltrados = filtroStatus === 'todos'
      ? clientes
      : clientes.filter(c => c.status === filtroStatus)

    clientesFiltrados.forEach(cliente => {
      const config = STATUS_CONFIG[cliente.status]

      const marker = new window.google.maps.Marker({
        position: { lat: cliente.lat, lng: cliente.lng },
        map: map.current,
        title: cliente.nome,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: config.cor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        }
      })

      marker.addListener('click', () => {
        const dias = diasDesde(cliente.ultimaVisita)
        const visitaTexto = dias !== null ? `${dias} dias atrás` : 'Nunca visitado'

        infoWindowRef.current.setContent(`
          <div class="mapa-popup">
            <div class="mapa-popup-nome">${cliente.nome}</div>
            <div class="mapa-popup-cidade">${cliente.cidade || '-'}</div>
            <div class="mapa-popup-visita">Última visita: ${visitaTexto}</div>
            <button class="mapa-popup-btn" onclick="window.navegarCliente('${cliente.id}')">
              Ver perfil →
            </button>
          </div>
        `)
        infoWindowRef.current.open(map.current, marker)
      })

      markersRef.current.push(marker)
    })

    window.navegarCliente = (id) => {
      navigate(`/clientes/${id}`)
    }

    // Ajustar bounds se houver clientes
    if (clientesFiltrados.length > 1) {
      const bounds = new window.google.maps.LatLngBounds()
      clientesFiltrados.forEach(c => bounds.extend({ lat: c.lat, lng: c.lng }))
      map.current.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 })
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

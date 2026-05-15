import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { useRepId } from '../../hooks/useRepId'
import { loadGoogleMaps } from '../../lib/googleMaps'
import InputEndereco from '../shared/InputEndereco'
import './Planner.css'

const GEOCODING_API_KEY = import.meta.env.VITE_GEOCODING_API_KEY

const NOMES_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const NOMES_DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const COR_MAP = {
  blue: 'var(--primary)',
  orange: 'var(--warning)',
  green: 'var(--success)'
}

// Formata Date para 'YYYY-MM-DD'
function dataStr(d) {
  return d.toISOString().split('T')[0]
}

// Retorna início da semana (domingo)
function inicioSemana(d) {
  const result = new Date(d)
  result.setDate(result.getDate() - result.getDay())
  return result
}

// Retorna número da semana no ano
function getSemanaAno(d) {
  const start = new Date(d.getFullYear(), 0, 1)
  const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7)
}

// Cálculo de distância Haversine (km)
function calcDistKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Normaliza nome de cidade: Title Case + remove espaços extras
function normalizarCidade(cidade) {
  if (!cidade) return ''
  return cidade
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

// Compara duas cidades (case-insensitive, remove espaços)
function cidadesIguais(a, b) {
  if (!a || !b) return false
  return a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ')
}

function Planner() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()

  // Estados principais do Planner
  const [plannerView, setPlannerView] = useState('semana') // 'semana' | 'mes' | 'rotas'
  const [plannerRef, setPlannerRef] = useState(new Date())
  const [plannerDiaSel, setPlannerDiaSel] = useState(new Date())
  const [plannerDados, setPlannerDados] = useState({})
  const [visitasDia, setVisitasDia] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal de compromisso
  const [modalAberto, setModalAberto] = useState(false)
  const [modalTxt, setModalTxt] = useState('')
  const [modalHora, setModalHora] = useState('09:00')
  const [modalCor, setModalCor] = useState('blue')

  // ==================== ROTAS ====================
  const [rotasCache, setRotasCache] = useState([])
  const [clientesCache, setClientesCache] = useState([])
  const [repData, setRepData] = useState(null)
  const [rotaDetalhe, setRotaDetalhe] = useState(null)

  // Modal Nova Rota
  const [modalRotaAberto, setModalRotaAberto] = useState(false)
  const [rotaNome, setRotaNome] = useState('')
  const [rotaPartidaTipo, setRotaPartidaTipo] = useState('casa')
  const [rotaPartidaInput, setRotaPartidaInput] = useState('')
  const [rotaChegadaTipo, setRotaChegadaTipo] = useState('casa')
  const [rotaChegadaInput, setRotaChegadaInput] = useState('')
  const [rotaModoViagem, setRotaModoViagem] = useState(false)
  const [rotaViagemCidades, setRotaViagemCidades] = useState([])
  const [cidadesFiltro, setCidadesFiltro] = useState([])
  const [clientesSelecionados, setClientesSelecionados] = useState([])
  const [salvandoRota, setSalvandoRota] = useState(false)

  // Estados para Casa sem endereço
  const [enderecoBaseTmp, setEnderecoBaseTmp] = useState('')
  const [salvandoEnderecoBase, setSalvandoEnderecoBase] = useState(false)

  // Estados para GPS
  const [gpsPartidaStatus, setGpsPartidaStatus] = useState('idle') // 'idle' | 'loading' | 'success' | 'error'
  const [gpsPartidaCoords, setGpsPartidaCoords] = useState(null)
  const [gpsPartidaErro, setGpsPartidaErro] = useState('')
  const [gpsChegadaStatus, setGpsChegadaStatus] = useState('idle')
  const [gpsChegadaCoords, setGpsChegadaCoords] = useState(null)
  const [gpsChegadaErro, setGpsChegadaErro] = useState('')

  // Coordenadas geocodificadas dos endereços
  const enderecoBaseCoordsRef = useRef(null)

  // ==================== DEBUG PANEL ====================
  const [debugLogs, setDebugLogs] = useState([])
  const [debugPanelAberto, setDebugPanelAberto] = useState(true)
  const originalConsoleRef = useRef({})
  const logIdRef = useRef(0)
  const isLoggingRef = useRef(false)

  // Carregar Google Maps SDK ao montar
  useEffect(() => {
    loadGoogleMaps().catch(err => console.warn('[Planner] Erro ao carregar Google Maps:', err))
  }, [])

  // Interceptar console.log, console.error, console.warn
  useEffect(() => {
    // Salvar referências originais
    originalConsoleRef.current = {
      log: console.log,
      error: console.error,
      warn: console.warn
    }

    const addLog = (type, args) => {
      // Evitar recursão
      if (isLoggingRef.current) return
      isLoggingRef.current = true

      try {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')

        // Ignorar erros de React sobre keys duplicadas (loop infinito)
        if (msg.includes('same key') || msg.includes('unique key')) {
          isLoggingRef.current = false
          return
        }

        const timestamp = new Date().toLocaleTimeString('pt-BR')
        logIdRef.current += 1
        setDebugLogs(prev => [...prev.slice(-9), { type, msg, timestamp, id: logIdRef.current }])
      } finally {
        isLoggingRef.current = false
      }
    }

    console.log = (...args) => {
      originalConsoleRef.current.log(...args)
      addLog('log', args)
    }
    console.error = (...args) => {
      originalConsoleRef.current.error(...args)
      addLog('error', args)
    }
    console.warn = (...args) => {
      originalConsoleRef.current.warn(...args)
      addLog('warn', args)
    }

    // Log inicial
    console.log('[Debug Panel] Iniciado')

    return () => {
      // Restaurar console original
      console.log = originalConsoleRef.current.log
      console.error = originalConsoleRef.current.error
      console.warn = originalConsoleRef.current.warn
    }
  }, [])

  // ==================== PLANNER ORIGINAL ====================

  const carregarTodoPlanner = useCallback(async () => {
    if (!repId) return
    setLoading(true)
    try {
      const data = await db.planner
        .where('rep_id')
        .equals(repId)
        .toArray()

      // Agrupar eventos por data
      const dados = {}
      for (const item of data || []) {
        const ds = item.data
        if (!ds) continue
        if (!dados[ds]) {
          dados[ds] = { eventos: [] }
        }
        dados[ds].eventos.push({
          id: item.id,
          txt: item.titulo || '',
          hora: item.hora || '09:00',
          cor: item.tipo || 'blue',
          cliente_id: item.cliente_id
        })
      }
      // Ordenar eventos por hora em cada dia
      Object.keys(dados).forEach(ds => {
        dados[ds].eventos.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
      })
      setPlannerDados(dados)
    } catch (err) {
      console.error('[Planner] Erro:', err)
      setPlannerDados({})
    }
    setLoading(false)
  }, [repId])

  const carregarVisitasDia = useCallback(async (ds) => {
    if (!repId) return
    try {
      const todas = await db.visitas
        .where('rep_id')
        .equals(repId)
        .toArray()
      const filtradas = todas
        .filter(v => v.data === ds && v.tipo !== 'whatsapp')
        .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
      setVisitasDia(filtradas)
    } catch (err) {
      console.error('[Planner] Erro visitas:', err)
    }
  }, [repId])

  // ==================== ROTAS - CARREGAR DADOS ====================

  const carregarRotas = useCallback(async () => {
    if (!repId) return
    try {
      const data = await db.rotas
        .where('rep_id')
        .equals(repId)
        .toArray()
      data.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      setRotasCache(data)
    } catch (err) {
      console.error('[Planner] Erro rotas:', err)
      setRotasCache([])
    }
  }, [repId])

  const carregarClientes = useCallback(async () => {
    if (!repId) return
    try {
      const data = await db.clientes
        .where('rep_id')
        .equals(repId)
        .sortBy('nome')
      setClientesCache(data || [])
    } catch (e) {
      console.error('[Clientes] Erro:', e)
      setClientesCache([])
    }
  }, [repId])

  const carregarRepData = useCallback(async () => {
    if (!repId) return
    try {
      const { data } = await supabase
        .from('representantes')
        .select('endereco_base, lat_base, lng_base, media_carro, preco_gasolina')
        .eq('id', repId)
        .single()
      setRepData(data)
    } catch (e) {
      console.error('[Rep] Erro:', e)
    }
  }, [repId])

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (repId) {
      carregarTodoPlanner()
      carregarRotas()
      carregarClientes()
      carregarRepData()
    }
  }, [repId, carregarTodoPlanner, carregarRotas, carregarClientes, carregarRepData])

  useEffect(() => {
    if (repId) {
      carregarVisitasDia(dataStr(plannerDiaSel))
    }
  }, [repId, plannerDiaSel, carregarVisitasDia])

  // ==================== PLANNER - FUNÇÕES ====================

  async function adicionarCompromisso() {
    if (!modalTxt.trim()) return

    const ds = dataStr(plannerDiaSel)

    try {
      const { data: novoEvento, error } = await supabase
        .from('planner')
        .insert({
          rep_id: repId,
          titulo: modalTxt.trim(),
          data: ds,
          hora: modalHora,
          tipo: modalCor
        })
        .select()
        .single()

      if (error) {
        console.error('[Planner] Erro ao salvar evento:', error)
      } else {
        // Atualizar state local
        const atual = plannerDados[ds] || { eventos: [] }
        const novosEventos = [...atual.eventos, {
          id: novoEvento.id,
          txt: novoEvento.titulo,
          hora: novoEvento.hora,
          cor: novoEvento.tipo
        }].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))

        setPlannerDados(prev => ({ ...prev, [ds]: { eventos: novosEventos } }))
      }
    } catch (err) {
      console.error('[Planner] Erro ao salvar evento:', err)
    }

    setModalAberto(false)
    setModalTxt('')
    setModalHora('09:00')
    setModalCor('blue')
  }

  async function deletarCompromisso(eventoId) {
    const ds = dataStr(plannerDiaSel)

    try {
      const { error } = await supabase
        .from('planner')
        .delete()
        .eq('id', eventoId)

      if (error) {
        console.error('[Planner] Erro ao deletar evento:', error)
      } else {
        // Atualizar state local
        const atual = plannerDados[ds] || { eventos: [] }
        const novosEventos = atual.eventos.filter(ev => ev.id !== eventoId)
        setPlannerDados(prev => ({ ...prev, [ds]: { eventos: novosEventos } }))
      }
    } catch (err) {
      console.error('[Planner] Erro ao deletar evento:', err)
    }
  }

  function navegarPlanner(delta) {
    const novaRef = new Date(plannerRef)
    if (plannerView === 'semana') {
      novaRef.setDate(novaRef.getDate() + delta * 7)
    } else {
      novaRef.setMonth(novaRef.getMonth() + delta)
    }
    setPlannerRef(novaRef)
    setPlannerDiaSel(new Date(novaRef))
  }

  function irParaHoje() {
    setPlannerRef(new Date())
    setPlannerDiaSel(new Date())
  }

  function getDadosDia(ds) {
    const dados = plannerDados[ds] || { eventos: [] }
    // Manter compatibilidade com UI (campos não usados)
    return { ...dados, cidades: '', notas: '' }
  }

  function agruparVisitasPorCidade() {
    const agrupado = {}
    visitasDia.forEach(v => {
      const cidade = v.cidade || 'Sem cidade'
      if (!agrupado[cidade]) agrupado[cidade] = []
      agrupado[cidade].push(v)
    })
    return agrupado
  }

  // ==================== ROTAS - FUNÇÕES ====================

  function abrirModalNovaRota() {
    setRotaNome('')
    setRotaPartidaTipo('casa')
    setRotaPartidaInput('')
    setRotaChegadaTipo('casa')
    setRotaChegadaInput('')
    setRotaModoViagem(false)
    setRotaViagemCidades([])
    setCidadesFiltro([])
    setClientesSelecionados([])
    setEnderecoBaseTmp('')
    setGpsPartidaStatus('idle')
    setGpsPartidaCoords(null)
    setGpsPartidaErro('')
    setGpsChegadaStatus('idle')
    setGpsChegadaCoords(null)
    setGpsChegadaErro('')
    setModalRotaAberto(true)
  }

  // Geocodifica um endereço
  async function geocodificarEndereco(endereco) {
    if (!endereco) return null
    console.log('[Geocoding] Endereço base a geocodificar:', endereco)

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${GEOCODING_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()

      console.log('[Geocoding] Resposta:', { status: data.status, results: data.results?.length || 0 })

      if (data.status === 'OK' && data.results?.length > 0) {
        const loc = data.results[0].geometry.location
        console.log('[Geocoding] ✅ Coordenadas:', { lat: loc.lat, lng: loc.lng })
        return { lat: loc.lat, lng: loc.lng }
      }
      console.warn('[Geocoding] ⚠️ Sem resultados')
      return null
    } catch (err) {
      console.error('[Geocoding] ❌ Erro:', err)
      return null
    }
  }

  // Salvar endereço base do representante (com geocodificação)
  async function salvarEnderecoBase() {
    if (!enderecoBaseTmp.trim()) return
    setSalvandoEnderecoBase(true)

    try {
      // Usar coordenadas já geocodificadas pelo InputEndereco, ou fazer fallback
      let coords = enderecoBaseCoordsRef.current
      if (!coords) {
        coords = await geocodificarEndereco(enderecoBaseTmp.trim())
      }

      // Preparar dados para salvar
      const dadosUpdate = {
        endereco_base: enderecoBaseTmp.trim()
      }

      // Se geocodificou, salvar lat/lng também
      if (coords) {
        dadosUpdate.lat_base = coords.lat
        dadosUpdate.lng_base = coords.lng
      }

      const { error } = await supabase
        .from('representantes')
        .update(dadosUpdate)
        .eq('id', repId)

      if (!error) {
        setRepData(prev => ({
          ...prev,
          endereco_base: enderecoBaseTmp.trim(),
          lat_base: coords?.lat || null,
          lng_base: coords?.lng || null
        }))
        setEnderecoBaseTmp('')

        if (!coords) {
          alert('⚠️ Endereço salvo, mas não foi possível geocodificar.\nAs rotas podem não funcionar corretamente.')
        }
      } else {
        console.error('[Rep] Erro ao salvar:', error)
        // Se erro for por colunas lat_base/lng_base não existirem, tenta sem elas
        if (error.message?.includes('lat_base') || error.message?.includes('lng_base')) {
          console.warn('[Rep] Colunas lat_base/lng_base não existem, salvando apenas endereco_base')
          const { error: err2 } = await supabase
            .from('representantes')
            .update({ endereco_base: enderecoBaseTmp.trim() })
            .eq('id', repId)

          if (!err2) {
            setRepData(prev => ({ ...prev, endereco_base: enderecoBaseTmp.trim() }))
            setEnderecoBaseTmp('')
            alert('⚠️ Endereço salvo!\n\nNota: Colunas lat_base e lng_base não existem na tabela representantes.\nExecute no Supabase:\nALTER TABLE representantes ADD COLUMN lat_base DOUBLE PRECISION;\nALTER TABLE representantes ADD COLUMN lng_base DOUBLE PRECISION;')
          } else {
            alert('Erro ao salvar endereço')
          }
        } else {
          alert('Erro ao salvar endereço')
        }
      }
    } catch (e) {
      console.error('[Rep] Erro ao salvar endereco_base:', e)
      alert('Erro ao salvar endereço')
    }
    setSalvandoEnderecoBase(false)
  }

  // Obter localização GPS
  function obterGPS(tipo) {
    const setStatus = tipo === 'partida' ? setGpsPartidaStatus : setGpsChegadaStatus
    const setCoords = tipo === 'partida' ? setGpsPartidaCoords : setGpsChegadaCoords
    const setErro = tipo === 'partida' ? setGpsPartidaErro : setGpsChegadaErro

    setStatus('loading')
    setCoords(null)
    setErro('')

    // Detectar HTTP local (GPS requer HTTPS exceto localhost)
    const isLocalHttp = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost'
    if (isLocalHttp) {
      setStatus('warning')
      setErro('GPS requer HTTPS. No app nativo funcionará automaticamente.')
      return
    }

    if (!navigator.geolocation) {
      setStatus('error')
      setErro('Geolocalização não suportada pelo navegador')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`
        setCoords(coords)
        setStatus('success')
      },
      (err) => {
        setStatus('error')
        if (err.code === err.PERMISSION_DENIED) {
          setErro('Permissão de localização negada. Verifique as configurações do navegador.')
        } else if (err.code === err.TIMEOUT) {
          setErro('Tempo esgotado ao obter localização. Tente novamente.')
        } else {
          setErro('Não foi possível obter sua localização.')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  // Callback quando endereço base é geocodificado
  function handleEnderecoBaseGeocode(lat, lng) {
    enderecoBaseCoordsRef.current = { lat, lng }
    console.log('[Planner] Endereço base geocodificado:', { lat, lng })
  }

  function fecharModalRota() {
    setModalRotaAberto(false)
  }

  // Lista de cidades únicas dos clientes (normalizadas, sem duplicatas case-insensitive)
  function getCidadesUnicas() {
    const vistas = new Set()
    const resultado = []
    clientesCache.forEach(c => {
      if (!c.cidade) return
      const norm = normalizarCidade(c.cidade)
      const chave = norm.toLowerCase()
      if (!vistas.has(chave)) {
        vistas.add(chave)
        resultado.push(norm)
      }
    })
    return resultado.sort()
  }

  // Clientes filtrados pelas cidades selecionadas (compara case-insensitive)
  function getClientesFiltrados() {
    if (cidadesFiltro.length === 0) return clientesCache
    return clientesCache.filter(c => {
      const cidadeNorm = normalizarCidade(c.cidade)
      return cidadesFiltro.some(filtro => cidadesIguais(filtro, cidadeNorm))
    })
  }

  function toggleCidadeFiltro(cidade) {
    setCidadesFiltro(prev => {
      if (prev.includes(cidade)) {
        return prev.filter(c => c !== cidade)
      } else {
        return [...prev, cidade]
      }
    })
  }

  function toggleClienteSelecionado(id) {
    const sid = String(id)
    setClientesSelecionados(prev => {
      if (prev.includes(sid)) {
        return prev.filter(c => c !== sid)
      } else {
        return [...prev, sid]
      }
    })
  }

  function adicionarCidadeViagem(cidade) {
    if (!cidade || rotaViagemCidades.some(c => cidadesIguais(c, cidade))) return
    setRotaViagemCidades(prev => [...prev, cidade])
    // Auto-selecionar clientes da cidade (compara case-insensitive)
    const clientesDaCidade = clientesCache.filter(c => cidadesIguais(c.cidade, cidade))
    setClientesSelecionados(prev => {
      const novos = clientesDaCidade.map(c => String(c.id)).filter(id => !prev.includes(id))
      return [...prev, ...novos]
    })
  }

  function removerCidadeViagem(idx) {
    setRotaViagemCidades(prev => prev.filter((_, i) => i !== idx))
  }

  async function resolverEnderecoPonto(tipo, inputValue, isPartida = true) {
    if (tipo === 'casa') return repData?.endereco_base || null
    if (tipo === 'gps') {
      // Usar coordenadas já obtidas
      const coords = isPartida ? gpsPartidaCoords : gpsChegadaCoords
      if (coords) return coords
      // Fallback se não tiver
      return new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve(`${pos.coords.latitude},${pos.coords.longitude}`),
          () => resolve(null),
          { timeout: 10000 }
        )
      })
    }
    return inputValue?.trim() || null
  }

  // Otimização com Google Directions API (timeout 8s)
  function otimizarRotaGoogle(clientesSel, origemCustom, destinoCustom) {
    return new Promise((resolve, reject) => {
      // Timeout de 8 segundos
      const timeout = setTimeout(() => {
        reject(new Error('TIMEOUT'))
      }, 8000)

      try {
        if (!window.google?.maps?.DirectionsService) {
          clearTimeout(timeout)
          reject(new Error('Google Maps não disponível'))
          return
        }
        const ds = new window.google.maps.DirectionsService()
        const origem = origemCustom || `${clientesSel[0].lat},${clientesSel[0].lng}`
        const destino = destinoCustom || origemCustom || `${clientesSel[clientesSel.length - 1].lat},${clientesSel[clientesSel.length - 1].lng}`
        const waypoints = clientesSel.map(c => ({
          location: new window.google.maps.LatLng(parseFloat(c.lat), parseFloat(c.lng)),
          stopover: true
        }))
        ds.route({
          origin: origem,
          destination: destino,
          waypoints,
          optimizeWaypoints: true,
          travelMode: window.google.maps.TravelMode.DRIVING
        }, (result, status) => {
          clearTimeout(timeout)
          if (status === 'OK') resolve(result)
          else reject(new Error(status))
        })
      } catch (err) {
        clearTimeout(timeout)
        reject(err)
      }
    })
  }

  async function salvarNovaRota() {
    if (!rotaNome.trim()) {
      alert('Dê um nome para a rota')
      return
    }
    if (clientesSelecionados.length < 2) {
      alert('Selecione ao menos 2 clientes')
      return
    }

    setSalvandoRota(true)

    const endPartida = await resolverEnderecoPonto(rotaPartidaTipo, rotaPartidaInput, true)
    const endChegada = await resolverEnderecoPonto(rotaChegadaTipo, rotaChegadaInput, false)

    const clientesSel = clientesCache.filter(c =>
      clientesSelecionados.includes(String(c.id)) && c.lat && c.lng
    )

    let kmTotal = 0
    let tempoEstimado = 0
    let ordemOtimizada = clientesSel.map(c => String(c.id))
    let usouFallback = false

    // Função auxiliar para otimizar com nearest neighbor e calcular com Haversine
    const calcularHaversine = () => {
      // Nearest neighbor: começar do primeiro cliente e ir ao mais próximo
      const restantes = [...clientesSel]
      const ordenado = []

      // Ponto de partida: primeiro cliente ou coordenadas de partida
      let pontoAtual = restantes.shift()
      ordenado.push(pontoAtual)

      while (restantes.length > 0) {
        let menorDist = Infinity
        let maisProximoIdx = 0

        for (let i = 0; i < restantes.length; i++) {
          const dist = calcDistKm(
            parseFloat(pontoAtual.lat), parseFloat(pontoAtual.lng),
            parseFloat(restantes[i].lat), parseFloat(restantes[i].lng)
          )
          if (dist < menorDist) {
            menorDist = dist
            maisProximoIdx = i
          }
        }

        pontoAtual = restantes.splice(maisProximoIdx, 1)[0]
        ordenado.push(pontoAtual)
      }

      // Atualizar ordem otimizada
      ordemOtimizada = ordenado.map(c => String(c.id))

      // Calcular distância total na ordem otimizada
      let km = 0
      for (let i = 0; i < ordenado.length - 1; i++) {
        const a = ordenado[i]
        const b = ordenado[i + 1]
        if (a.lat && b.lat) {
          km += calcDistKm(parseFloat(a.lat), parseFloat(a.lng), parseFloat(b.lat), parseFloat(b.lng))
        }
      }
      kmTotal = Math.round(km * 1.3 * 10) / 10
      tempoEstimado = Math.round(kmTotal / 60 * 3600)
      usouFallback = true
    }

    try {
      if (!window.google?.maps?.DirectionsService) {
        throw new Error('Maps não disponível')
      }

      if (rotaModoViagem && rotaViagemCidades.length > 1) {
        // Rota de viagem: otimiza por cidade em sequência
        let ordemFinal = []
        let kmAcum = 0
        let tempoAcum = 0
        let algumFallback = false

        for (let ci = 0; ci < rotaViagemCidades.length; ci++) {
          const cidade = rotaViagemCidades[ci]
          const clientesCidade = clientesSel.filter(c => cidadesIguais(c.cidade, cidade))
          if (!clientesCidade.length) continue

          const origemCidade = ci === 0 ? endPartida : null
          const destinoCidade = ci === rotaViagemCidades.length - 1 ? endChegada : null

          try {
            const res = await otimizarRotaGoogle(clientesCidade, origemCidade, destinoCidade)
            const route = res.routes[0]
            route.waypoint_order.forEach(i => ordemFinal.push(String(clientesCidade[i].id)))
            route.legs.forEach(leg => {
              kmAcum += leg.distance.value / 1000
              tempoAcum += leg.duration.value
            })
          } catch (err) {
            console.warn('[Rota] Fallback cidade:', cidade, err?.message || err)
            algumFallback = true
            clientesCidade.forEach(c => ordemFinal.push(String(c.id)))
          }
        }
        ordemOtimizada = ordemFinal
        kmTotal = kmAcum
        tempoEstimado = tempoAcum
        usouFallback = algumFallback
      } else {
        const resultado = await otimizarRotaGoogle(clientesSel, endPartida, endChegada)
        const route = resultado.routes[0]
        ordemOtimizada = route.waypoint_order.map(i => String(clientesSel[i].id))
        route.legs.forEach(leg => {
          kmTotal += leg.distance.value / 1000
          tempoEstimado += leg.duration.value
        })
      }
    } catch (e) {
      console.warn('[Rota] Fallback Haversine:', e?.message || e)
      calcularHaversine()
    }

    const { error } = await supabase.from('rotas').insert({
      nome: rotaNome.trim(),
      clientes_ids: clientesSelecionados,
      ordem_otimizada: ordemOtimizada,
      km_total: Math.round(kmTotal * 10) / 10,
      tempo_estimado: Math.round(tempoEstimado),
      rep_id: repId,
      tipo_partida: rotaPartidaTipo,
      ponto_partida: endPartida,
      tipo_chegada: rotaChegadaTipo,
      ponto_chegada: endChegada,
      nome_hotel: rotaChegadaTipo === 'hotel' ? rotaChegadaInput : null
    })

    setSalvandoRota(false)

    if (error) {
      console.error('[Rotas] Erro ao salvar:', error)
      alert('Erro ao salvar rota')
      return
    }

    setModalRotaAberto(false)
    await carregarRotas()

    // Toast diferenciado
    if (usouFallback) {
      mostrarToast('✓ Rota salva (otimização Google indisponível)', 'warning')
    } else {
      mostrarToast('✓ Rota salva com sucesso!', 'success')
    }
  }

  // Toast simples
  function mostrarToast(msg, tipo = 'success') {
    const toast = document.createElement('div')
    toast.className = `planner-toast ${tipo}`
    toast.textContent = msg
    document.body.appendChild(toast)
    setTimeout(() => toast.classList.add('show'), 10)
    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  }

  async function excluirRota(id) {
    if (!confirm('Excluir esta rota?')) return

    const { error } = await supabase.from('rotas').delete().eq('id', id)
    if (error) {
      alert('Erro ao excluir rota')
      return
    }
    setRotasCache(prev => prev.filter(r => r.id !== id))
    if (rotaDetalhe?.id === id) {
      setRotaDetalhe(null)
    }
  }

  function abrirGoogleMapsRota(rota) {
    const ids = rota.ordem_otimizada || rota.clientes_ids || []
    const pts = ids.map(cid => clientesCache.find(c => String(c.id) === cid)).filter(c => c && c.lat && c.lng)

    if (!pts.length) {
      alert('Sem coordenadas para esta rota')
      return
    }

    let origin
    if (rota.ponto_partida) {
      origin = encodeURIComponent(rota.ponto_partida)
    } else if (repData?.endereco_base) {
      origin = encodeURIComponent(repData.endereco_base)
    } else {
      origin = `${pts[0].lat},${pts[0].lng}`
    }

    let dest
    if (rota.ponto_chegada) {
      dest = encodeURIComponent(rota.ponto_chegada)
    } else {
      dest = `${pts[pts.length - 1].lat},${pts[pts.length - 1].lng}`
    }

    const waypoints = pts.map(c => `${c.lat},${c.lng}`).join('|')
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints ? '&waypoints=' + waypoints : ''}&travelmode=driving`
    window.open(url, '_blank')
  }

  function formatarTempo(segundos) {
    if (!segundos) return '-'
    const h = Math.floor(segundos / 3600)
    const m = Math.round((segundos % 3600) / 60)
    return h > 0 ? `${h}h${m.toString().padStart(2, '0')}min` : `${m}min`
  }

  // ==================== RENDER ====================

  if (loadingRep || loading) {
    return <div className="loading">Carregando...</div>
  }

  const hoje = new Date()
  const hojeStr = dataStr(hoje)
  const selStr = dataStr(plannerDiaSel)
  const dadosSel = getDadosDia(selStr)
  const ehHoje = selStr === hojeStr

  // Período para título
  let tituloNav = ''
  let subtituloNav = ''

  if (plannerView === 'semana') {
    const ini = inicioSemana(plannerRef)
    const fim = new Date(ini)
    fim.setDate(fim.getDate() + 6)
    tituloNav = `${ini.getDate()} — ${fim.getDate()} ${NOMES_MES[fim.getMonth()].slice(0, 3).toLowerCase()}`
    subtituloNav = `Semana ${getSemanaAno(ini)}`
  } else if (plannerView === 'mes') {
    tituloNav = `${NOMES_MES[plannerRef.getMonth()]} ${plannerRef.getFullYear()}`
    subtituloNav = '30 dias'
  }

  // ==================== VIEW ROTAS ====================
  if (plannerView === 'rotas') {
    return (
      <div className="planner">
        {/* Header Rotas */}
        <header className="planner-nav">
          <button className="planner-home-btn" onClick={() => navigate('/')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </button>
          <button className="planner-nav-btn" onClick={() => setPlannerView('semana')}>‹</button>
          <div className="planner-nav-centro">
            <div className="planner-titulo">Rotas salvas</div>
          </div>
          <button className="planner-add-rota-btn" onClick={abrirModalNovaRota}>+ Nova</button>
        </header>

        {/* Lista de Rotas */}
        <div className="rotas-lista">
          {rotasCache.length === 0 ? (
            <div className="rotas-vazio">
              <div className="rotas-vazio-icon">🗺️</div>
              <p>Nenhuma rota salva ainda</p>
              <button className="btn-criar-primeira-rota" onClick={abrirModalNovaRota}>
                + Criar primeira rota
              </button>
            </div>
          ) : (
            rotasCache.map(rota => (
              <div key={rota.id} className="rota-card" onClick={() => setRotaDetalhe(rota)}>
                <div className="rota-card-header">
                  <div className="rota-card-nome">{rota.nome}</div>
                  <div className="rota-card-status">
                    {rota.ordem_otimizada ? '🗺️ Otimizada' : 'Ativa'}
                  </div>
                </div>
                <div className="rota-card-meta">
                  <span>👥 {(rota.clientes_ids || []).length} clientes</span>
                  {rota.km_total > 0 && <span>📍 {rota.km_total.toFixed(0)} km</span>}
                  {rota.tempo_estimado > 0 && <span>⏱ {formatarTempo(rota.tempo_estimado)}</span>}
                </div>
                <div className="rota-card-acoes">
                  <button
                    className="rota-btn-sm"
                    onClick={(e) => { e.stopPropagation(); abrirGoogleMapsRota(rota) }}
                  >
                    ↗ Google Maps
                  </button>
                  <button
                    className="rota-btn-sm danger"
                    onClick={(e) => { e.stopPropagation(); excluirRota(rota.id) }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Nova Rota */}
        {modalRotaAberto && (
          <div className="rota-modal-overlay" onClick={fecharModalRota}>
            {/* Debug Panel - estilo terminal */}
            {debugPanelAberto && (
              <div className="debug-panel" onClick={e => e.stopPropagation()}>
                <div className="debug-panel-header">
                  <span>🔧 DEBUG</span>
                  <button onClick={() => setDebugPanelAberto(false)}>✕</button>
                </div>
                <div className="debug-panel-logs">
                  {debugLogs.length === 0 ? (
                    <div className="debug-log log">Aguardando logs...</div>
                  ) : (
                    debugLogs.map(log => (
                      <div key={log.id} className={`debug-log ${log.type}`}>
                        <span className="debug-time">{log.timestamp}</span>
                        <span className="debug-msg">{log.msg}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Botão para reabrir debug panel */}
            {!debugPanelAberto && (
              <button
                className="debug-panel-toggle"
                onClick={e => { e.stopPropagation(); setDebugPanelAberto(true); }}
              >
                🔧
              </button>
            )}

            <div className="rota-modal-sheet" onClick={e => e.stopPropagation()}>
              <div className="rota-modal-handle"></div>

              <div className="rota-modal-header">
                <div className="rota-modal-titulo">🗺️ Nova Rota</div>
                <button className="rota-modal-close" onClick={fecharModalRota}>✕</button>
              </div>

              {/* Nome */}
              <div className="rota-campo">
                <label>Nome da rota</label>
                <input
                  type="text"
                  placeholder="Ex: Jaraguá do Sul - Segunda"
                  value={rotaNome}
                  onChange={e => setRotaNome(e.target.value)}
                />
              </div>

              {/* Ponto de partida */}
              <div className="rota-secao-label">Ponto de partida</div>
              <div className="rota-ponto-row">
                <button
                  className={`rota-ponto-pill ${rotaPartidaTipo === 'casa' ? 'active' : ''}`}
                  onClick={() => { setRotaPartidaTipo('casa'); setGpsPartidaStatus('idle'); }}
                >🏠 Casa</button>
                <button
                  className={`rota-ponto-pill ${rotaPartidaTipo === 'gps' ? 'active' : ''}`}
                  onClick={() => { setRotaPartidaTipo('gps'); obterGPS('partida'); }}
                >📍 GPS</button>
                <button
                  className={`rota-ponto-pill ${rotaPartidaTipo === 'outro' ? 'active' : ''}`}
                  onClick={() => { setRotaPartidaTipo('outro'); setGpsPartidaStatus('idle'); }}
                >✏️ Outro</button>
              </div>

              {/* Casa sem endereço cadastrado */}
              {rotaPartidaTipo === 'casa' && !repData?.endereco_base && (
                <div className="rota-casa-aviso">
                  <div className="rota-casa-aviso-texto">⚠️ Nenhum endereço base cadastrado</div>
                  <InputEndereco
                    value={enderecoBaseTmp}
                    onChange={setEnderecoBaseTmp}
                    onGeocode={handleEnderecoBaseGeocode}
                    placeholder="Digite seu endereço..."
                  />
                  {enderecoBaseTmp && (
                    <div className="rota-endereco-selecionado">
                      📍 {enderecoBaseTmp}
                    </div>
                  )}
                  <button
                    className="rota-btn-salvar-endereco"
                    onClick={salvarEnderecoBase}
                    disabled={!enderecoBaseTmp.trim() || salvandoEnderecoBase}
                  >
                    {salvandoEnderecoBase ? '⏳ Salvando...' : '💾 Salvar como meu endereço base'}
                  </button>
                </div>
              )}

              {/* Casa com endereço */}
              {rotaPartidaTipo === 'casa' && repData?.endereco_base && (
                <div className="rota-endereco-confirmado">
                  <span>📍</span> {repData.endereco_base}
                </div>
              )}

              {/* GPS */}
              {rotaPartidaTipo === 'gps' && (
                <div className="rota-gps-status">
                  {gpsPartidaStatus === 'loading' && (
                    <div className="rota-gps-loading">
                      <div className="rota-gps-spinner"></div>
                      <span>Obtendo localização...</span>
                    </div>
                  )}
                  {gpsPartidaStatus === 'success' && gpsPartidaCoords && (
                    <div className="rota-gps-sucesso">
                      <span>✅ Localização obtida</span>
                      <span className="rota-gps-coords">{gpsPartidaCoords}</span>
                    </div>
                  )}
                  {gpsPartidaStatus === 'warning' && (
                    <div className="rota-gps-aviso">
                      <span>⚠️ {gpsPartidaErro}</span>
                      <span>Use "Outro" para digitar um endereço manualmente.</span>
                    </div>
                  )}
                  {gpsPartidaStatus === 'error' && (
                    <div className="rota-gps-erro">
                      <span>❌ {gpsPartidaErro}</span>
                      <button className="rota-gps-retry" onClick={() => obterGPS('partida')}>
                        Tentar novamente
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Outro endereço */}
              {rotaPartidaTipo === 'outro' && (
                <div className="rota-autocomplete-wrapper">
                  <InputEndereco
                    value={rotaPartidaInput}
                    onChange={setRotaPartidaInput}
                    placeholder="Digite o endereço de partida..."
                  />
                  {rotaPartidaInput && (
                    <div className="rota-endereco-selecionado">
                      📍 {rotaPartidaInput}
                    </div>
                  )}
                </div>
              )}

              {/* Ponto de chegada */}
              <div className="rota-secao-label">Ponto de chegada</div>
              <div className="rota-ponto-row">
                <button
                  className={`rota-ponto-pill ${rotaChegadaTipo === 'casa' ? 'active' : ''}`}
                  onClick={() => { setRotaChegadaTipo('casa'); setGpsChegadaStatus('idle'); }}
                >🏠 Casa</button>
                <button
                  className={`rota-ponto-pill ${rotaChegadaTipo === 'hotel' ? 'active' : ''}`}
                  onClick={() => { setRotaChegadaTipo('hotel'); setGpsChegadaStatus('idle'); }}
                >🏨 Hotel</button>
                <button
                  className={`rota-ponto-pill ${rotaChegadaTipo === 'outro' ? 'active' : ''}`}
                  onClick={() => { setRotaChegadaTipo('outro'); setGpsChegadaStatus('idle'); }}
                >✏️ Outro</button>
              </div>

              {/* Casa - mostrar endereço se tiver */}
              {rotaChegadaTipo === 'casa' && repData?.endereco_base && (
                <div className="rota-endereco-confirmado">
                  <span>📍</span> {repData.endereco_base}
                </div>
              )}

              {/* Casa sem endereço */}
              {rotaChegadaTipo === 'casa' && !repData?.endereco_base && (
                <div className="rota-casa-aviso">
                  <div className="rota-casa-aviso-texto">⚠️ Nenhum endereço base cadastrado</div>
                  <div className="rota-casa-aviso-sub">Cadastre na seção de partida acima</div>
                </div>
              )}

              {/* Hotel ou Outro endereço */}
              {(rotaChegadaTipo === 'hotel' || rotaChegadaTipo === 'outro') && (
                <div className="rota-autocomplete-wrapper">
                  <InputEndereco
                    value={rotaChegadaInput}
                    onChange={setRotaChegadaInput}
                    placeholder={rotaChegadaTipo === 'hotel' ? 'Digite o endereço do hotel...' : 'Digite o endereço de chegada...'}
                  />
                  {rotaChegadaInput && (
                    <div className="rota-endereco-selecionado">
                      📍 {rotaChegadaInput}
                    </div>
                  )}
                </div>
              )}

              {/* Toggle modo viagem */}
              <div className="rota-viagem-toggle" onClick={() => setRotaModoViagem(!rotaModoViagem)}>
                <span>🗺️</span>
                <span className="rota-viagem-toggle-label">Rota de viagem (múltiplas cidades)</span>
                <div className={`rota-viagem-sw ${rotaModoViagem ? 'on' : ''}`}></div>
              </div>

              {rotaModoViagem && (
                <div className="rota-viagem-wrap">
                  <div className="rota-viagem-cidades">
                    {rotaViagemCidades.length === 0 ? (
                      <div className="rota-viagem-vazio">Nenhuma cidade adicionada</div>
                    ) : (
                      rotaViagemCidades.map((c, i) => (
                        <div key={c} className="rota-viagem-item">
                          <span className="rota-viagem-num">{i + 1}.</span>
                          <span className="rota-viagem-nome">📍 {c}</span>
                          <button className="rota-viagem-del" onClick={() => removerCidadeViagem(i)}>×</button>
                        </div>
                      ))
                    )}
                  </div>
                  <select
                    className="rota-add-cidade-select"
                    value=""
                    onChange={e => adicionarCidadeViagem(e.target.value)}
                  >
                    <option value="">+ Adicionar cidade</option>
                    {getCidadesUnicas().filter(c => !rotaViagemCidades.includes(c)).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtrar por cidade */}
              <div className="rota-secao-label">Filtrar por cidade</div>
              <div className="rota-cidade-pills">
                {getCidadesUnicas().map(cidade => (
                  <button
                    key={cidade}
                    className={`rota-cidade-pill ${cidadesFiltro.includes(cidade) ? 'sel' : ''}`}
                    onClick={() => toggleCidadeFiltro(cidade)}
                  >
                    {cidade}
                  </button>
                ))}
              </div>

              {/* Lista de clientes */}
              <div className="rota-secao-label">Clientes ({clientesSelecionados.length} selecionados)</div>
              <div className="rota-clientes-lista">
                {getClientesFiltrados().map(cliente => (
                  <div
                    key={cliente.id}
                    className="rota-cliente-item"
                    onClick={() => toggleClienteSelecionado(cliente.id)}
                  >
                    <div className={`rota-cliente-check ${clientesSelecionados.includes(String(cliente.id)) ? 'sel' : ''}`}>
                      {clientesSelecionados.includes(String(cliente.id)) && '✓'}
                    </div>
                    <div>
                      <div className="rota-cliente-nome">{cliente.nome}</div>
                      <div className="rota-cliente-cidade">{normalizarCidade(cliente.cidade)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="rota-btn-criar"
                onClick={salvarNovaRota}
                disabled={salvandoRota}
              >
                {salvandoRota ? '⏳ Otimizando rota...' : 'Criar Rota'}
              </button>
            </div>
          </div>
        )}

        {/* Detalhe da Rota */}
        {rotaDetalhe && (
          <div className="rota-detalhe-overlay">
            <div className="rota-detalhe">
              <div className="rota-detalhe-header">
                <button className="rota-detalhe-voltar" onClick={() => setRotaDetalhe(null)}>← Voltar</button>
                <div className="rota-detalhe-titulo">{rotaDetalhe.nome}</div>
              </div>
              <div className="rota-detalhe-body">
                {/* Resumo */}
                <div className="rota-resumo-bar">
                  <div className="rota-resumo-item">
                    <div className="rota-resumo-val">{(rotaDetalhe.km_total || 0).toFixed(0)}</div>
                    <div className="rota-resumo-lbl">km total</div>
                  </div>
                  <div className="rota-resumo-item">
                    <div className="rota-resumo-val">
                      {((rotaDetalhe.km_total || 0) / (repData?.media_carro || 10)).toFixed(1)}L
                    </div>
                    <div className="rota-resumo-lbl">combustível</div>
                  </div>
                  <div className="rota-resumo-item">
                    <div className="rota-resumo-val">
                      R${(((rotaDetalhe.km_total || 0) / (repData?.media_carro || 10)) * (repData?.preco_gasolina || 6)).toFixed(0)}
                    </div>
                    <div className="rota-resumo-lbl">custo est.</div>
                  </div>
                </div>

                {/* Ponto de início */}
                {rotaDetalhe.ponto_partida && (
                  <div className="rota-trecho inicio">
                    <div className="rota-trecho-num inicio">
                      {rotaDetalhe.tipo_partida === 'casa' ? '🏠' : rotaDetalhe.tipo_partida === 'gps' ? '📍' : '✏️'}
                    </div>
                    <div className="rota-trecho-info">
                      <div className="rota-trecho-nome">Início: {rotaDetalhe.tipo_partida === 'casa' ? 'Endereço base' : rotaDetalhe.tipo_partida === 'gps' ? 'Localização GPS' : 'Endereço personalizado'}</div>
                      <div className="rota-trecho-meta">{rotaDetalhe.ponto_partida}</div>
                    </div>
                  </div>
                )}

                {/* Clientes da rota */}
                {(rotaDetalhe.ordem_otimizada || rotaDetalhe.clientes_ids || []).map((cid, i) => {
                  const cliente = clientesCache.find(c => String(c.id) === cid)
                  if (!cliente) return null
                  return (
                    <div key={cid} className="rota-trecho">
                      <div className="rota-trecho-num">{i + 1}</div>
                      <div className="rota-trecho-info">
                        <div className="rota-trecho-nome">{cliente.nome}</div>
                        <div className="rota-trecho-meta">{normalizarCidade(cliente.cidade)} {cliente.endereco ? '• ' + cliente.endereco : ''}</div>
                      </div>
                    </div>
                  )
                })}

                {/* Ponto de fim */}
                {rotaDetalhe.ponto_chegada && (
                  <div className="rota-trecho fim">
                    <div className="rota-trecho-num fim">
                      {rotaDetalhe.tipo_chegada === 'casa' ? '🏠' : rotaDetalhe.tipo_chegada === 'hotel' ? '🏨' : '✏️'}
                    </div>
                    <div className="rota-trecho-info">
                      <div className="rota-trecho-nome">Fim: {rotaDetalhe.tipo_chegada === 'casa' ? 'Endereço base' : rotaDetalhe.tipo_chegada === 'hotel' ? 'Hotel' : 'Endereço personalizado'}</div>
                      <div className="rota-trecho-meta">{rotaDetalhe.ponto_chegada}</div>
                    </div>
                  </div>
                )}

                <button
                  className="rota-btn-abrir-maps"
                  onClick={() => abrirGoogleMapsRota(rotaDetalhe)}
                >
                  ↗ Abrir no Google Maps
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ==================== VIEW SEMANA/MÊS ====================
  return (
    <div className="planner">
      {/* Navegação */}
      <header className="planner-nav">
        <button className="planner-home-btn" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>
        <button className="planner-nav-btn" onClick={() => navegarPlanner(-1)}>‹</button>
        <div className="planner-nav-centro">
          <div className="planner-titulo">{tituloNav}</div>
          <div className="planner-sub">{subtituloNav}</div>
        </div>
        <button className="planner-hoje-btn" onClick={irParaHoje}>Hoje</button>
        <button className="planner-nav-btn" onClick={() => navegarPlanner(1)}>›</button>
      </header>

      {/* Toggle de views */}
      <div className="planner-view-toggle">
        <button
          className={`planner-view-btn ${plannerView === 'semana' ? 'active' : ''}`}
          onClick={() => setPlannerView('semana')}
        >
          Semana
        </button>
        <button
          className={`planner-view-btn ${plannerView === 'mes' ? 'active' : ''}`}
          onClick={() => setPlannerView('mes')}
        >
          Mês
        </button>
      </div>

      {/* VIEW SEMANA */}
      {plannerView === 'semana' && (
        <div className="planner-semana-wrap">
          {/* Mini dias */}
          <div className="planner-dias-mini">
            {(() => {
              const ini = inicioSemana(plannerRef)
              const dias = []
              for (let i = 0; i < 7; i++) {
                const d = new Date(ini)
                d.setDate(d.getDate() + i)
                const ds = dataStr(d)
                const dadosDia = getDadosDia(ds)
                const ehHojeD = ds === hojeStr
                const ehSel = ds === selStr
                const ehFds = d.getDay() === 0 || d.getDay() === 6

                const temVisita = ds === selStr && visitasDia.length > 0
                const temEventos = dadosDia.eventos?.length > 0

                dias.push(
                  <div
                    key={ds}
                    className="planner-dia-mini"
                    onClick={() => setPlannerDiaSel(new Date(d))}
                  >
                    <div className="planner-dia-mini-label">{NOMES_DIA_CURTO[d.getDay()]}</div>
                    <div className={`planner-dia-mini-num ${ehHojeD ? 'hoje' : ''} ${ehSel && !ehHojeD ? 'selecionado' : ''} ${ehFds ? 'fds' : ''}`}>
                      {d.getDate()}
                    </div>
                    <div className="planner-dia-mini-dots">
                      {temVisita && <div className="planner-dia-mini-dot green"></div>}
                      {temEventos && <div className="planner-dia-mini-dot orange"></div>}
                    </div>
                  </div>
                )
              }
              return dias
            })()}
          </div>

          {/* Painel do dia */}
          <div className="planner-body">
            <div className="planner-dia-header">
              <div>
                <div className="planner-dia-titulo">{NOMES_DIA[plannerDiaSel.getDay()]}-feira</div>
                <div className="planner-dia-data">
                  {plannerDiaSel.getDate()} de {NOMES_MES[plannerDiaSel.getMonth()]}
                  {ehHoje && ' · Hoje'}
                </div>
              </div>
            </div>

            {/* Card Rota Inteligente */}
            <div className="planner-rota-card" onClick={() => setPlannerView('rotas')}>
              <div className="planner-rota-card-info">
                <div className="planner-rota-card-titulo">🗺️ Monte sua rota</div>
                <div className="planner-rota-card-sub">Otimize suas visitas do dia</div>
              </div>
              <button className="planner-rota-card-btn">Planejar Rota →</button>
            </div>

            {/* Compromissos */}
            <div className="planner-bloco">
              <div className="planner-bloco-label">📌 Compromissos</div>
              {dadosSel.eventos?.length > 0 ? (
                dadosSel.eventos.map((ev) => (
                  <div key={ev.id} className="planner-evento-item">
                    <div className="planner-evento-cor" style={{ background: COR_MAP[ev.cor] || COR_MAP.blue }}></div>
                    <div className="planner-evento-txt">{ev.txt}</div>
                    <div className="planner-evento-hora">{ev.hora || ''}</div>
                    <button className="planner-evento-del" onClick={() => deletarCompromisso(ev.id)}>×</button>
                  </div>
                ))
              ) : (
                <div className="planner-vazio">Nenhum compromisso</div>
              )}
              <button className="planner-add-btn" onClick={() => setModalAberto(true)}>
                + Adicionar compromisso
              </button>
            </div>

            {/* Visitados no dia */}
            {visitasDia.length > 0 && (
              <div className="planner-bloco">
                <div className="planner-bloco-label">✅ Visitados no dia</div>
                <div className="planner-checkins-lista">
                  {Object.entries(agruparVisitasPorCidade()).map(([cidade, visitas]) => (
                    <div key={cidade}>
                      <div className="planner-checkin-cidade">📍 {cidade}</div>
                      {visitas.map(v => (
                        <div key={v.id} className="planner-checkin-item">
                          <div className="planner-checkin-dot"></div>
                          <div className="planner-checkin-nome">{v.nome_cliente}</div>
                          <div className="planner-checkin-hora">{v.hora || ''}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notas */}
          </div>
        </div>
      )}

      {/* VIEW MÊS */}
      {plannerView === 'mes' && (
        <div className="planner-mes-wrap">
          {/* Grid do calendário */}
          <div className="planner-cal-wrap">
            <div className="planner-cal-weekdays">
              <div className="planner-cal-wd dom">D</div>
              <div className="planner-cal-wd">S</div>
              <div className="planner-cal-wd">T</div>
              <div className="planner-cal-wd">Q</div>
              <div className="planner-cal-wd">Q</div>
              <div className="planner-cal-wd">S</div>
              <div className="planner-cal-wd">S</div>
            </div>
            <div className="planner-cal-grid">
              {(() => {
                const mes = plannerRef.getMonth()
                const ano = plannerRef.getFullYear()
                const primeiroDia = new Date(ano, mes, 1)
                const ultimoDia = new Date(ano, mes + 1, 0)
                const diasNoMes = ultimoDia.getDate()
                const diaSemanaInicio = primeiroDia.getDay()
                const diasMesAnt = new Date(ano, mes, 0).getDate()

                const cells = []

                for (let i = diaSemanaInicio - 1; i >= 0; i--) {
                  cells.push(
                    <div key={`prev-${i}`} className="planner-cal-d outro">
                      <div className="planner-cal-d-num">{diasMesAnt - i}</div>
                    </div>
                  )
                }

                for (let d = 1; d <= diasNoMes; d++) {
                  const data = new Date(ano, mes, d)
                  const ds = dataStr(data)
                  const dadosDia = getDadosDia(ds)
                  const ehHojeD = ds === hojeStr
                  const ehSel = ds === selStr

                  const temVisita = ds === selStr && visitasDia.length > 0
                  const temEventos = dadosDia.eventos?.length > 0

                  let cls = 'planner-cal-d'
                  if (ehHojeD) cls += ' hoje'
                  if (ehSel) cls += ' selecionado'
                  if (temVisita || temEventos) cls += ' tem-algo'

                  cells.push(
                    <div
                      key={ds}
                      className={cls}
                      onClick={() => setPlannerDiaSel(new Date(data))}
                    >
                      <div className="planner-cal-d-num">{d}</div>
                      <div className="planner-cal-d-dots">
                        {temVisita && <div className="planner-cal-d-dot green"></div>}
                        {temEventos && <div className="planner-cal-d-dot orange"></div>}
                      </div>
                    </div>
                  )
                }

                const totalCells = cells.length
                const resto = totalCells % 7
                if (resto > 0) {
                  for (let d = 1; d <= 7 - resto; d++) {
                    cells.push(
                      <div key={`next-${d}`} className="planner-cal-d outro">
                        <div className="planner-cal-d-num">{d}</div>
                      </div>
                    )
                  }
                }

                return cells
              })()}
            </div>
            <div className="planner-cal-legenda">
              <div className="planner-cal-leg"><div className="planner-cal-leg-dot green"></div>Visitas</div>
              <div className="planner-cal-leg"><div className="planner-cal-leg-dot orange"></div>Evento</div>
              <div className="planner-cal-leg"><div className="planner-cal-leg-dot blue"></div>Planejado</div>
            </div>
          </div>

          {/* Painel do dia */}
          <div className="planner-body">
            <div className="planner-dia-header">
              <div>
                <div className="planner-dia-titulo">{NOMES_DIA[plannerDiaSel.getDay()]}-feira</div>
                <div className="planner-dia-data">
                  {plannerDiaSel.getDate()} de {NOMES_MES[plannerDiaSel.getMonth()]}
                  {ehHoje && ' · Hoje'}
                </div>
              </div>
            </div>

            {visitasDia.length > 0 && (
              <div className="planner-bloco">
                <div className="planner-bloco-label">✅ Visitados</div>
                <div className="planner-checkins-lista">
                  {Object.entries(agruparVisitasPorCidade()).map(([cidade, visitas]) => (
                    <div key={cidade}>
                      <div className="planner-checkin-cidade">📍 {cidade}</div>
                      {visitas.map(v => (
                        <div key={v.id} className="planner-checkin-item">
                          <div className="planner-checkin-dot"></div>
                          <div className="planner-checkin-nome">{v.nome_cliente}</div>
                          <div className="planner-checkin-hora">{v.hora || ''}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dadosSel.eventos?.length > 0 && (
              <div className="planner-bloco">
                <div className="planner-bloco-label">📌 Compromissos</div>
                {dadosSel.eventos.map((ev, idx) => (
                  <div key={idx} className="planner-evento-item">
                    <div className="planner-evento-cor" style={{ background: COR_MAP[ev.cor] || COR_MAP.blue }}></div>
                    <div className="planner-evento-txt">{ev.txt}</div>
                    <div className="planner-evento-hora">{ev.hora || ''}</div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Modal de compromisso */}
      {modalAberto && (
        <div className="planner-modal" onClick={() => setModalAberto(false)}>
          <div className="planner-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="planner-modal-handle"></div>
            <div className="planner-modal-titulo">Novo compromisso</div>
            <input
              className="planner-modal-input"
              placeholder="Ex: Reunião INKOR, Feira SC..."
              value={modalTxt}
              onChange={(e) => setModalTxt(e.target.value)}
              autoFocus
            />
            <div className="planner-modal-row">
              <input
                className="planner-modal-hora"
                type="time"
                value={modalHora}
                onChange={(e) => setModalHora(e.target.value)}
              />
            </div>
            <div className="planner-modal-cor-wrap">
              {['blue', 'orange', 'green'].map(cor => (
                <div
                  key={cor}
                  className={`planner-modal-cor ${modalCor === cor ? 'ativa' : ''}`}
                  style={{ background: COR_MAP[cor] }}
                  onClick={() => setModalCor(cor)}
                />
              ))}
            </div>
            <button className="planner-modal-salvar" onClick={adicionarCompromisso}>
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Planner

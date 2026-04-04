import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './Planner.css'

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

function Planner() {
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

  // Refs para autocomplete
  const partidaInputRef = useRef(null)
  const chegadaInputRef = useRef(null)
  const enderecoBaseInputRef = useRef(null)
  const partidaAutocompleteRef = useRef(null)
  const chegadaAutocompleteRef = useRef(null)
  const enderecoBaseAutocompleteRef = useRef(null)

  // ==================== DEBUG PANEL ====================
  const [debugLogs, setDebugLogs] = useState([])
  const [debugPanelAberto, setDebugPanelAberto] = useState(true)
  const originalConsoleRef = useRef({})
  const logIdRef = useRef(0)
  const isLoggingRef = useRef(false)

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
      const { data, error } = await supabase
        .from('planner')
        .select('*')
        .eq('rep_id', repId)

      if (error) {
        console.error('[Planner] Erro ao carregar:', error)
      } else {
        const dados = {}
        data.forEach(item => {
          dados[item.data] = {
            cidades: item.cidades || '',
            notas: item.notas || '',
            eventos: item.eventos || []
          }
        })
        setPlannerDados(dados)
      }
    } catch (err) {
      console.error('[Planner] Exceção:', err)
    }
    setLoading(false)
  }, [repId])

  const carregarVisitasDia = useCallback(async (ds) => {
    if (!repId) return

    try {
      const { data, error } = await supabase
        .from('visitas')
        .select('id, cliente_id, nome_cliente, cidade, hora, tipo')
        .eq('rep_id', repId)
        .eq('data', ds)
        .neq('tipo', 'whatsapp')
        .order('hora')

      if (!error && data) {
        setVisitasDia(data)
      }
    } catch (err) {
      console.error('[Planner] Erro ao carregar visitas:', err)
    }
  }, [repId])

  // ==================== ROTAS - CARREGAR DADOS ====================

  const carregarRotas = useCallback(async () => {
    if (!repId) return
    try {
      const { data } = await supabase
        .from('rotas')
        .select('*')
        .eq('rep_id', repId)
        .order('created_at', { ascending: false })
      setRotasCache(data || [])
    } catch (e) {
      console.error('[Rotas] Erro:', e)
      setRotasCache([])
    }
  }, [repId])

  const carregarClientes = useCallback(async () => {
    if (!repId) return
    try {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cidade, endereco, lat, lng')
        .eq('rep_id', repId)
        .order('nome')
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
        .select('endereco_base, media_carro, preco_gasolina')
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

  async function salvarPlannerDia(campo, valor) {
    const ds = dataStr(plannerDiaSel)
    const atual = plannerDados[ds] || { cidades: '', notas: '', eventos: [] }
    const novosDados = { ...atual, [campo]: valor }

    setPlannerDados(prev => ({ ...prev, [ds]: novosDados }))

    try {
      await supabase.from('planner').upsert({
        rep_id: repId,
        data: ds,
        cidades: novosDados.cidades,
        notas: novosDados.notas,
        eventos: novosDados.eventos,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'rep_id,data' })
    } catch (err) {
      console.error('[Planner] Erro ao salvar:', err)
    }
  }

  async function adicionarCompromisso() {
    if (!modalTxt.trim()) return

    const ds = dataStr(plannerDiaSel)
    const atual = plannerDados[ds] || { cidades: '', notas: '', eventos: [] }
    const novosEventos = [...(atual.eventos || []), { txt: modalTxt.trim(), hora: modalHora, cor: modalCor }]

    const novosDados = { ...atual, eventos: novosEventos }
    setPlannerDados(prev => ({ ...prev, [ds]: novosDados }))

    try {
      await supabase.from('planner').upsert({
        rep_id: repId,
        data: ds,
        cidades: novosDados.cidades,
        notas: novosDados.notas,
        eventos: novosEventos,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'rep_id,data' })
    } catch (err) {
      console.error('[Planner] Erro ao salvar evento:', err)
    }

    setModalAberto(false)
    setModalTxt('')
    setModalHora('09:00')
    setModalCor('blue')
  }

  async function deletarCompromisso(idx) {
    const ds = dataStr(plannerDiaSel)
    const atual = plannerDados[ds] || { cidades: '', notas: '', eventos: [] }
    const novosEventos = atual.eventos.filter((_, i) => i !== idx)

    const novosDados = { ...atual, eventos: novosEventos }
    setPlannerDados(prev => ({ ...prev, [ds]: novosDados }))

    try {
      await supabase.from('planner').upsert({
        rep_id: repId,
        data: ds,
        cidades: novosDados.cidades,
        notas: novosDados.notas,
        eventos: novosEventos,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'rep_id,data' })
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
    return plannerDados[ds] || { cidades: '', notas: '', eventos: [] }
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

  // Salvar endereço base do representante
  async function salvarEnderecoBase() {
    if (!enderecoBaseTmp.trim()) return
    setSalvandoEnderecoBase(true)
    try {
      const { error } = await supabase
        .from('representantes')
        .update({ endereco_base: enderecoBaseTmp.trim() })
        .eq('id', repId)

      if (!error) {
        setRepData(prev => ({ ...prev, endereco_base: enderecoBaseTmp.trim() }))
        setEnderecoBaseTmp('')
      } else {
        alert('Erro ao salvar endereço')
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

  // Carregar Google Maps API dinamicamente (nova API Places com v=weekly)
  // NOTA: ApiTargetBlockedMapError em desenvolvimento local (192.168.x.x) é esperado
  // por restrição da key. Vai funcionar normalmente no deploy do Cloudflare Pages.
  const loadGoogleMaps = useCallback(() => {
    return new Promise((resolve) => {
      // Se já está carregado, resolve imediatamente
      if (window.google?.maps?.places?.PlaceAutocompleteElement) {
        console.log('[Google Maps] ✅ API já carregada (PlaceAutocompleteElement disponível)')
        resolve(true)
        return
      }

      // Se já tem um script sendo carregado, aguarda
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        console.log('[Google Maps] ⏳ Script existente encontrado, aguardando...')
        const checkReady = () => {
          if (window.google?.maps?.places?.PlaceAutocompleteElement) {
            console.log('[Google Maps] ✅ PlaceAutocompleteElement disponível')
            resolve(true)
          } else {
            setTimeout(checkReady, 100)
          }
        }
        existingScript.addEventListener('load', checkReady)
        setTimeout(checkReady, 500)
        return
      }

      // Carrega o script com v=weekly para nova API Places
      console.log('[Google Maps] 🔄 Carregando script (v=weekly)...')
      const script = document.createElement('script')
      script.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyCwgVzb1CW3_rN-3t6LAkBC1IOPYN5zqJI&libraries=places&v=weekly'
      script.async = true
      script.defer = true
      script.onload = () => {
        console.log('[Google Maps] ✅ Script carregou')
        // Verificar nova API
        if (window.google?.maps?.places?.PlaceAutocompleteElement) {
          console.log('[Google Maps] ✅ PlaceAutocompleteElement disponível')
        } else {
          console.warn('[Google Maps] ⚠️ PlaceAutocompleteElement não encontrado, tentando API legada')
        }
        resolve(true)
      }
      script.onerror = (err) => {
        console.error('[Google Maps] ❌ FALHA ao carregar script:', err)
        resolve(false)
      }
      document.head.appendChild(script)
    })
  }, [])

  // Inicializar Google Places Autocomplete (nova API PlaceAutocompleteElement)
  const initAutocomplete = useCallback(async (containerRef, autocompleteRef, setValueFn, inputName = 'input', placeholder = '') => {
    console.log(`[Autocomplete:${inputName}] 🔄 Iniciando...`)

    if (!containerRef.current) {
      console.warn(`[Autocomplete:${inputName}] ❌ Container ref não existe`)
      return
    }

    // Aguarda a API carregar
    const loaded = await loadGoogleMaps()
    if (!loaded) {
      console.error(`[Autocomplete:${inputName}] ❌ loadGoogleMaps retornou false`)
      return
    }

    // Verifica se container ainda existe
    if (!containerRef.current) {
      console.warn(`[Autocomplete:${inputName}] ❌ Container ref perdido após load`)
      return
    }

    // Limpar elemento anterior se existir
    if (autocompleteRef.current) {
      console.log(`[Autocomplete:${inputName}] 🧹 Removendo elemento anterior`)
      try {
        autocompleteRef.current.remove()
      } catch (e) { /* ignore */ }
      autocompleteRef.current = null
    }

    // Limpar container
    containerRef.current.innerHTML = ''

    // Tentar nova API PlaceAutocompleteElement
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      try {
        console.log(`[Autocomplete:${inputName}] 📍 Criando PlaceAutocompleteElement...`)

        const placeAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
          componentRestrictions: { country: 'br' },
          types: ['establishment', 'geocode']
        })

        // Estilizar o elemento
        placeAutocomplete.style.cssText = `
          width: 100%;
          --gmpx-color-surface: var(--bg, #f5f5f5);
          --gmpx-color-on-surface: var(--text, #333);
          --gmpx-color-primary: var(--primary, #1a3a6b);
          --gmpx-font-family-base: inherit;
          --gmpx-font-size-base: 14px;
        `

        // Evento de seleção
        placeAutocomplete.addEventListener('gmp-placeselect', async (event) => {
          console.log(`[Autocomplete:${inputName}] 📍 gmp-placeselect event`)
          try {
            const place = event.placePrediction.toPlace()
            await place.fetchFields({ fields: ['displayName', 'formattedAddress'] })

            const displayName = place.displayName || ''
            const formattedAddress = place.formattedAddress || ''

            console.log(`[Autocomplete:${inputName}] 📍 Place:`, { displayName, formattedAddress })

            // Se tem nome diferente do endereço, mostrar "Nome — Endereço"
            let valor = ''
            if (displayName && formattedAddress && !formattedAddress.toLowerCase().includes(displayName.toLowerCase())) {
              valor = `${displayName} — ${formattedAddress}`
            } else {
              valor = formattedAddress || displayName || ''
            }
            setValueFn(valor)
          } catch (err) {
            console.error(`[Autocomplete:${inputName}] ❌ Erro ao buscar place:`, err)
          }
        })

        // Inserir no container
        containerRef.current.appendChild(placeAutocomplete)
        autocompleteRef.current = placeAutocomplete

        console.log(`[Autocomplete:${inputName}] ✅ PlaceAutocompleteElement criado!`)
        return
      } catch (err) {
        console.error(`[Autocomplete:${inputName}] ❌ Erro ao criar PlaceAutocompleteElement:`, err)
      }
    }

    // Fallback: criar input simples sem autocomplete
    console.warn(`[Autocomplete:${inputName}] ⚠️ Usando input simples (sem autocomplete)`)
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'rota-endereco-input'
    input.placeholder = placeholder || 'Digite o endereço...'
    input.addEventListener('input', (e) => setValueFn(e.target.value))
    containerRef.current.appendChild(input)
  }, [loadGoogleMaps])

  // Effect para inicializar autocomplete quando input de partida aparecer
  useEffect(() => {
    if (modalRotaAberto && rotaPartidaTipo === 'outro') {
      const timer = setTimeout(() => {
        if (partidaInputRef.current) {
          initAutocomplete(partidaInputRef, partidaAutocompleteRef, setRotaPartidaInput, 'partida', 'Ex: Rua das Flores, 123, Joinville - SC')
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [modalRotaAberto, rotaPartidaTipo, initAutocomplete])

  // Effect para inicializar autocomplete quando input de chegada aparecer
  useEffect(() => {
    if (modalRotaAberto && (rotaChegadaTipo === 'outro' || rotaChegadaTipo === 'hotel')) {
      const timer = setTimeout(() => {
        if (chegadaInputRef.current) {
          const placeholder = rotaChegadaTipo === 'hotel' ? 'Ex: Hotel Ibis, Joinville - SC' : 'Ex: Rua das Flores, 123, Joinville - SC'
          initAutocomplete(chegadaInputRef, chegadaAutocompleteRef, setRotaChegadaInput, 'chegada', placeholder)
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [modalRotaAberto, rotaChegadaTipo, initAutocomplete])

  // Effect para inicializar autocomplete do endereço base
  useEffect(() => {
    if (modalRotaAberto && rotaPartidaTipo === 'casa' && !repData?.endereco_base) {
      const timer = setTimeout(() => {
        if (enderecoBaseInputRef.current) {
          initAutocomplete(enderecoBaseInputRef, enderecoBaseAutocompleteRef, setEnderecoBaseTmp, 'enderecoBase', 'Ex: Rua das Flores, 123, Joinville - SC')
        }
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [modalRotaAberto, rotaPartidaTipo, repData?.endereco_base, initAutocomplete])

  // Debug: testar Google Places API quando modal abre
  useEffect(() => {
    if (modalRotaAberto) {
      console.log('='.repeat(50))
      console.log('[DEBUG] Modal de Rotas aberto - testando Google Maps API...')
      loadGoogleMaps().then(loaded => {
        if (loaded && window.google?.maps?.places) {
          console.log('[DEBUG] ✅ Google Places API OK!')
          console.log('[DEBUG] Autocomplete disponível:', typeof window.google.maps.places.Autocomplete)
        } else {
          console.error('[DEBUG] ❌ Google Places API FALHOU!')
          console.log('[DEBUG] window.google:', window.google)
        }
      })
    }
  }, [modalRotaAberto, loadGoogleMaps])


  function fecharModalRota() {
    setModalRotaAberto(false)
  }

  // Lista de cidades únicas dos clientes
  function getCidadesUnicas() {
    return [...new Set(clientesCache.map(c => c.cidade).filter(Boolean))].sort()
  }

  // Clientes filtrados pelas cidades selecionadas
  function getClientesFiltrados() {
    if (cidadesFiltro.length === 0) return clientesCache
    return clientesCache.filter(c => cidadesFiltro.includes(c.cidade))
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
    if (!cidade || rotaViagemCidades.includes(cidade)) return
    setRotaViagemCidades(prev => [...prev, cidade])
    // Auto-selecionar clientes da cidade
    const clientesDaCidade = clientesCache.filter(c => c.cidade === cidade)
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

  // Otimização com Google Directions API
  function otimizarRotaGoogle(clientesSel, origemCustom, destinoCustom) {
    return new Promise((resolve, reject) => {
      if (!window.google?.maps?.DirectionsService) {
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
        if (status === 'OK') resolve(result)
        else reject(new Error(status))
      })
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

    try {
      if (window.google?.maps?.DirectionsService) {
        if (rotaModoViagem && rotaViagemCidades.length > 1) {
          // Rota de viagem: otimiza por cidade em sequência
          let ordemFinal = []
          let kmAcum = 0
          let tempoAcum = 0

          for (let ci = 0; ci < rotaViagemCidades.length; ci++) {
            const cidade = rotaViagemCidades[ci]
            const clientesCidade = clientesSel.filter(c => c.cidade === cidade)
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
            } catch {
              clientesCidade.forEach(c => ordemFinal.push(String(c.id)))
            }
          }
          ordemOtimizada = ordemFinal
          kmTotal = kmAcum
          tempoEstimado = tempoAcum
        } else {
          const resultado = await otimizarRotaGoogle(clientesSel, endPartida, endChegada)
          const route = resultado.routes[0]
          ordemOtimizada = route.waypoint_order.map(i => String(clientesSel[i].id))
          route.legs.forEach(leg => {
            kmTotal += leg.distance.value / 1000
            tempoEstimado += leg.duration.value
          })
        }
      } else {
        throw new Error('Maps não disponível')
      }
    } catch (e) {
      console.warn('Fallback Haversine:', e)
      // Fallback: Haversine * 1.3
      for (let i = 0; i < clientesSel.length - 1; i++) {
        const a = clientesSel[i]
        const b = clientesSel[i + 1]
        if (a.lat && b.lat) {
          kmTotal += calcDistKm(parseFloat(a.lat), parseFloat(a.lng), parseFloat(b.lat), parseFloat(b.lng))
        }
      }
      kmTotal = Math.round(kmTotal * 1.3 * 10) / 10
      tempoEstimado = Math.round(kmTotal / 60 * 3600)
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
                  {/* Container para PlaceAutocompleteElement */}
                  <div ref={enderecoBaseInputRef} className="rota-autocomplete-container"></div>
                  {/* Input de fallback mostrado apenas se valor já existe */}
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
                  <div ref={partidaInputRef} className="rota-autocomplete-container"></div>
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
                  <div ref={chegadaInputRef} className="rota-autocomplete-container"></div>
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
                      <div className="rota-cliente-cidade">{cliente.cidade || ''}</div>
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
                        <div className="rota-trecho-meta">{cliente.cidade || ''} {cliente.endereco ? '• ' + cliente.endereco : ''}</div>
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
                const temPlanejado = dadosDia.cidades?.trim()

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
                      {temPlanejado && !temVisita && <div className="planner-dia-mini-dot blue"></div>}
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

            {/* Cidades planejadas */}
            <div className="planner-bloco">
              <div className="planner-bloco-label">📍 Cidades planejadas</div>
              <textarea
                className="planner-bloco-textarea"
                placeholder="Ex: Joinville — Cliente A, Cliente B"
                value={dadosSel.cidades || ''}
                onChange={(e) => setPlannerDados(prev => ({
                  ...prev,
                  [selStr]: { ...dadosSel, cidades: e.target.value }
                }))}
                onBlur={(e) => salvarPlannerDia('cidades', e.target.value)}
              />
            </div>

            {/* Compromissos */}
            <div className="planner-bloco">
              <div className="planner-bloco-label">📌 Compromissos</div>
              {dadosSel.eventos?.length > 0 ? (
                dadosSel.eventos.map((ev, idx) => (
                  <div key={idx} className="planner-evento-item">
                    <div className="planner-evento-cor" style={{ background: COR_MAP[ev.cor] || COR_MAP.blue }}></div>
                    <div className="planner-evento-txt">{ev.txt}</div>
                    <div className="planner-evento-hora">{ev.hora || ''}</div>
                    <button className="planner-evento-del" onClick={() => deletarCompromisso(idx)}>×</button>
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
            <div className="planner-bloco">
              <div className="planner-bloco-label">📝 Notas</div>
              <textarea
                className="planner-bloco-textarea"
                placeholder="Anotações livres..."
                value={dadosSel.notas || ''}
                onChange={(e) => setPlannerDados(prev => ({
                  ...prev,
                  [selStr]: { ...dadosSel, notas: e.target.value }
                }))}
                onBlur={(e) => salvarPlannerDia('notas', e.target.value)}
              />
            </div>
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
                  const temPlanejado = dadosDia.cidades?.trim()

                  let cls = 'planner-cal-d'
                  if (ehHojeD) cls += ' hoje'
                  if (ehSel) cls += ' selecionado'
                  if (temVisita || temEventos || temPlanejado) cls += ' tem-algo'

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
                        {temPlanejado && !temVisita && !temEventos && <div className="planner-cal-d-dot blue"></div>}
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

            {dadosSel.cidades && (
              <div className="planner-bloco">
                <div className="planner-bloco-label">📍 Planejado</div>
                <div className="planner-texto-readonly">
                  {dadosSel.cidades.split('\n').map((l, i) => <div key={i}>{l}</div>)}
                </div>
              </div>
            )}

            {dadosSel.notas && (
              <div className="planner-bloco">
                <div className="planner-bloco-label">📝 Notas</div>
                <div className="planner-texto-readonly">
                  {dadosSel.notas.split('\n').map((l, i) => <div key={i}>{l}</div>)}
                </div>
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

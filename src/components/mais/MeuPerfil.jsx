import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './MeuPerfil.css'

const GOOGLE_MAPS_KEY = 'AIzaSyA8MEv3kZLzuEbykwI9dfqfw3_R9udDTWo'
const GEOCODING_API_KEY = 'AIzaSyCwgVzb1CW3_rN-3t6LAkBC1IOPYN5zqJI'

function MeuPerfil() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()

  // Campos do perfil
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [enderecoBase, setEnderecoBase] = useState('')
  const [mediaCarro, setMediaCarro] = useState('10')
  const [precoGasolina, setPrecoGasolina] = useState('6,00')

  // Estados de controle
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  // Autocomplete manual
  const [sugestoes, setSugestoes] = useState([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [buscandoSugestoes, setBuscandoSugestoes] = useState(false)
  const autocompleteServiceRef = useRef(null)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Carregar dados do representante
  useEffect(() => {
    async function fetchRep() {
      if (!repId) return

      setLoading(true)
      try {
        const { data: repData, error: repError } = await supabase
          .from('representantes')
          .select('nome, email, endereco_base, lat_base, lng_base, media_carro, preco_gasolina')
          .eq('id', repId)
          .single()

        if (repError) {
          console.error('[MeuPerfil] Erro ao buscar rep:', repError)
          if (repError.message?.includes('lat_base') || repError.message?.includes('lng_base')) {
            setErro('Colunas lat_base/lng_base não existem. Execute no Supabase:\nALTER TABLE representantes ADD COLUMN lat_base DOUBLE PRECISION;\nALTER TABLE representantes ADD COLUMN lng_base DOUBLE PRECISION;')
          }
        } else if (repData) {
          setNome(repData.nome || '')
          setEmail(repData.email || '')
          setEnderecoBase(repData.endereco_base || '')
          setMediaCarro(repData.media_carro?.toString() || '10')
          setPrecoGasolina(formatarPreco(repData.preco_gasolina || 6))
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          setEmail(user.email)
        }
      } catch (err) {
        console.error('[MeuPerfil] Exceção:', err)
        setErro('Erro ao carregar dados')
      }
      setLoading(false)
    }

    fetchRep()
  }, [repId])

  // Carregar Google Maps API
  const loadGoogleMaps = useCallback(() => {
    return new Promise((resolve) => {
      if (window.google?.maps?.places?.AutocompleteService) {
        resolve(true)
        return
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        const checkReady = () => {
          if (window.google?.maps?.places?.AutocompleteService) {
            resolve(true)
          } else {
            setTimeout(checkReady, 100)
          }
        }
        existingScript.addEventListener('load', checkReady)
        setTimeout(checkReady, 500)
        return
      }

      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`
      script.async = true
      script.defer = true
      script.onload = () => {
        const checkReady = () => {
          if (window.google?.maps?.places?.AutocompleteService) {
            resolve(true)
          } else {
            setTimeout(checkReady, 100)
          }
        }
        checkReady()
      }
      script.onerror = () => resolve(false)
      document.head.appendChild(script)
    })
  }, [])

  // Inicializar AutocompleteService
  useEffect(() => {
    async function init() {
      const loaded = await loadGoogleMaps()
      if (loaded && window.google?.maps?.places?.AutocompleteService) {
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
        console.log('[MeuPerfil] AutocompleteService inicializado')
      }
    }
    init()
  }, [loadGoogleMaps])

  // Fechar dropdown ao clicar fora ou pressionar Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMostrarSugestoes(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMostrarSugestoes(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Formatar preço para exibição
  function formatarPreco(valor) {
    if (!valor && valor !== 0) return ''
    return valor.toFixed(2).replace('.', ',')
  }

  // Parsear preço para número
  function parsearPreco(str) {
    if (!str) return 0
    return parseFloat(str.replace(',', '.')) || 0
  }

  // Máscara para preço da gasolina
  function handlePrecoChange(valor) {
    let limpo = valor.replace(/[^\d,]/g, '')
    const partes = limpo.split(',')
    if (partes.length > 2) {
      limpo = partes[0] + ',' + partes.slice(1).join('')
    }
    if (partes.length === 2 && partes[1].length > 2) {
      limpo = partes[0] + ',' + partes[1].slice(0, 2)
    }
    setPrecoGasolina(limpo)
  }

  // Buscar sugestões de endereço
  function buscarSugestoes(texto) {
    if (!texto || texto.length < 3) {
      setSugestoes([])
      setMostrarSugestoes(false)
      return
    }

    if (!autocompleteServiceRef.current) {
      console.warn('[MeuPerfil] AutocompleteService não disponível')
      return
    }

    // Debounce de 400ms
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setBuscandoSugestoes(true)

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: texto,
          componentRestrictions: { country: 'br' },
          language: 'pt-BR'
        },
        (predictions, status) => {
          setBuscandoSugestoes(false)

          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            console.log('[MeuPerfil] Sugestões:', predictions.length)
            setSugestoes(predictions.map(p => ({
              id: p.place_id,
              texto: p.description,
              principal: p.structured_formatting?.main_text || '',
              secundario: p.structured_formatting?.secondary_text || ''
            })))
            setMostrarSugestoes(true)
          } else {
            console.warn('[MeuPerfil] Sem sugestões:', status)
            setSugestoes([])
            setMostrarSugestoes(false)
          }
        }
      )
    }, 400)
  }

  // Selecionar sugestão
  function selecionarSugestao(sugestao) {
    setEnderecoBase(sugestao.texto)
    setSugestoes([])
    setMostrarSugestoes(false)
  }

  // Handler do input de endereço
  function handleEnderecoChange(e) {
    const valor = e.target.value
    setEnderecoBase(valor)
    buscarSugestoes(valor)
  }

  // Geocodificar endereço
  async function geocodificarEndereco(endereco) {
    if (!endereco) return null
    console.log('[Geocoding] Endereço:', endereco)

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
      return null
    } catch (err) {
      console.error('[Geocoding] Erro:', err)
      return null
    }
  }

  // Salvar perfil
  async function salvar() {
    if (!nome.trim()) {
      setErro('Nome é obrigatório')
      return
    }

    setSalvando(true)
    setErro('')
    setSucesso('')

    try {
      // Geocodificar endereço base
      let coords = null
      if (enderecoBase.trim()) {
        coords = await geocodificarEndereco(enderecoBase.trim())
      }

      // Preparar dados
      const dadosUpdate = {
        nome: nome.trim(),
        endereco_base: enderecoBase.trim() || null,
        media_carro: parseFloat(mediaCarro) || 10,
        preco_gasolina: parsearPreco(precoGasolina) || 6
      }

      // Adicionar coordenadas se geocodificou
      if (coords) {
        dadosUpdate.lat_base = coords.lat
        dadosUpdate.lng_base = coords.lng
      }

      console.log('[MeuPerfil] Salvando:', dadosUpdate)

      const { error } = await supabase
        .from('representantes')
        .update(dadosUpdate)
        .eq('id', repId)

      if (error) {
        console.error('[MeuPerfil] Erro ao salvar:', error)
        if (error.message?.includes('lat_base') || error.message?.includes('lng_base')) {
          const { error: err2 } = await supabase
            .from('representantes')
            .update({
              nome: nome.trim(),
              endereco_base: enderecoBase.trim() || null,
              media_carro: parseFloat(mediaCarro) || 10,
              preco_gasolina: parsearPreco(precoGasolina) || 6
            })
            .eq('id', repId)

          if (err2) {
            setErro('Erro ao salvar')
          } else {
            setSucesso('Salvo! (Colunas lat_base/lng_base não existem)')
          }
        } else {
          setErro(error.message || 'Erro ao salvar')
        }
      } else {
        if (enderecoBase.trim() && !coords) {
          setSucesso('Salvo! (Endereço não geocodificado)')
        } else {
          setSucesso('Salvo com sucesso!')
        }
      }
    } catch (err) {
      console.error('[MeuPerfil] Exceção:', err)
      setErro('Erro ao salvar')
    }

    setSalvando(false)

    if (!erro) {
      setTimeout(() => setSucesso(''), 3000)
    }
  }

  if (loadingRep || loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="meu-perfil">
      {/* Header */}
      <header className="perfil-header">
        <button className="perfil-voltar" onClick={() => navigate('/mais')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Voltar
        </button>
        <h1>Meu Perfil</h1>
        <button className="perfil-salvar" onClick={salvar} disabled={salvando}>
          {salvando ? '...' : 'Salvar'}
        </button>
      </header>

      {/* Mensagens */}
      {erro && <div className="perfil-erro">{erro}</div>}
      {sucesso && <div className="perfil-sucesso">{sucesso}</div>}

      {/* Formulário */}
      <div className="perfil-form">
        {/* Nome */}
        <div className="perfil-campo">
          <label>Nome completo</label>
          <input
            type="text"
            className="perfil-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        {/* Email */}
        <div className="perfil-campo">
          <label>Email</label>
          <input
            type="email"
            className="perfil-input readonly"
            value={email}
            readOnly
          />
          <span className="perfil-campo-hint">O email não pode ser alterado</span>
        </div>

        {/* Endereço base com autocomplete manual */}
        <div className="perfil-campo" ref={containerRef}>
          <label>Endereço base (ponto de partida das rotas)</label>
          <div className="perfil-autocomplete-wrapper">
            <input
              type="text"
              className="perfil-input"
              value={enderecoBase}
              onChange={handleEnderecoChange}
              onFocus={() => sugestoes.length > 0 && setMostrarSugestoes(true)}
              placeholder="Digite seu endereço..."
            />
            {buscandoSugestoes && (
              <div className="perfil-autocomplete-loading">...</div>
            )}

            {/* Dropdown de sugestões */}
            {mostrarSugestoes && sugestoes.length > 0 && (
              <div className="perfil-autocomplete-dropdown">
                {sugestoes.map((s) => (
                  <button
                    key={s.id}
                    className="perfil-autocomplete-item"
                    onClick={() => selecionarSugestao(s)}
                    type="button"
                  >
                    <span className="perfil-autocomplete-principal">{s.principal}</span>
                    {s.secundario && (
                      <span className="perfil-autocomplete-secundario">{s.secundario}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {enderecoBase && !mostrarSugestoes && (
            <div className="perfil-endereco-preview">
              📍 {enderecoBase}
            </div>
          )}
        </div>

        {/* Seção Veículo */}
        <div className="perfil-secao">
          <h2 className="perfil-secao-titulo">Meu veículo</h2>

          {/* Consumo médio */}
          <div className="perfil-campo">
            <label>Consumo médio (km/L)</label>
            <input
              type="number"
              className="perfil-input"
              value={mediaCarro}
              onChange={(e) => setMediaCarro(e.target.value)}
              placeholder="10"
              min="1"
              max="50"
              step="0.1"
            />
          </div>

          {/* Preço da gasolina */}
          <div className="perfil-campo">
            <label>Preço da gasolina (R$/L)</label>
            <div className="perfil-input-prefix">
              <span>R$</span>
              <input
                type="text"
                className="perfil-input"
                value={precoGasolina}
                onChange={(e) => handlePrecoChange(e.target.value)}
                placeholder="6,00"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeuPerfil

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

  // Refs para autocomplete
  const enderecoInputRef = useRef(null)
  const autocompleteRef = useRef(null)

  // Carregar dados do representante
  useEffect(() => {
    async function fetchRep() {
      if (!repId) return

      setLoading(true)
      try {
        // Buscar dados do representante
        const { data: repData, error: repError } = await supabase
          .from('representantes')
          .select('nome, email, endereco_base, lat_base, lng_base, media_carro, preco_gasolina')
          .eq('id', repId)
          .single()

        if (repError) {
          console.error('[MeuPerfil] Erro ao buscar rep:', repError)
          // Verificar se é erro de coluna não existente
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

        // Buscar email do usuário autenticado
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
    // Remove tudo que não for número ou vírgula
    let limpo = valor.replace(/[^\d,]/g, '')
    // Garante apenas uma vírgula
    const partes = limpo.split(',')
    if (partes.length > 2) {
      limpo = partes[0] + ',' + partes.slice(1).join('')
    }
    // Limita casas decimais
    if (partes.length === 2 && partes[1].length > 2) {
      limpo = partes[0] + ',' + partes[1].slice(0, 2)
    }
    setPrecoGasolina(limpo)
  }

  // Carregar Google Maps API
  const loadGoogleMaps = useCallback(() => {
    return new Promise((resolve) => {
      if (window.google?.maps?.places?.PlaceAutocompleteElement) {
        resolve(true)
        return
      }

      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
      if (existingScript) {
        const checkReady = () => {
          if (window.google?.maps?.places?.PlaceAutocompleteElement) {
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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&v=weekly`
      script.async = true
      script.defer = true
      script.onload = () => {
        if (window.google?.maps?.places?.PlaceAutocompleteElement) {
          resolve(true)
        } else {
          setTimeout(() => resolve(true), 500)
        }
      }
      script.onerror = () => resolve(false)
      document.head.appendChild(script)
    })
  }, [])

  // Inicializar autocomplete
  const initAutocomplete = useCallback(async () => {
    if (!enderecoInputRef.current) return

    const loaded = await loadGoogleMaps()
    if (!loaded || !enderecoInputRef.current) return

    // Limpar elemento anterior
    if (autocompleteRef.current) {
      try {
        autocompleteRef.current.remove()
      } catch (e) { /* ignore */ }
      autocompleteRef.current = null
    }

    enderecoInputRef.current.innerHTML = ''

    // Criar PlaceAutocompleteElement
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      try {
        const placeAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
          componentRestrictions: { country: 'br' },
          types: ['establishment', 'geocode']
        })

        placeAutocomplete.style.cssText = `
          width: 100%;
          --gmpx-color-surface: var(--bg, #f5f5f5);
          --gmpx-color-on-surface: var(--text, #333);
          --gmpx-color-primary: var(--primary, #1a3a6b);
          --gmpx-font-family-base: inherit;
          --gmpx-font-size-base: 14px;
        `

        placeAutocomplete.addEventListener('gmp-placeselect', async (event) => {
          try {
            const place = event.placePrediction.toPlace()
            await place.fetchFields({ fields: ['displayName', 'formattedAddress'] })
            const displayName = place.displayName || ''
            const formattedAddress = place.formattedAddress || ''
            let valor = ''
            if (displayName && formattedAddress && !formattedAddress.toLowerCase().includes(displayName.toLowerCase())) {
              valor = `${displayName} — ${formattedAddress}`
            } else {
              valor = formattedAddress || displayName || ''
            }
            setEnderecoBase(valor)
          } catch (err) {
            console.error('[Autocomplete] Erro:', err)
          }
        })

        enderecoInputRef.current.appendChild(placeAutocomplete)
        autocompleteRef.current = placeAutocomplete
        return
      } catch (err) {
        console.error('[Autocomplete] Erro ao criar:', err)
      }
    }

    // Fallback: input simples
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'perfil-input'
    input.placeholder = 'Digite seu endereço...'
    input.value = enderecoBase
    input.addEventListener('input', (e) => setEnderecoBase(e.target.value))
    enderecoInputRef.current.appendChild(input)
  }, [loadGoogleMaps, enderecoBase])

  // Inicializar autocomplete quando componente montar
  useEffect(() => {
    if (!loading && !loadingRep) {
      const timer = setTimeout(initAutocomplete, 300)
      return () => clearTimeout(timer)
    }
  }, [loading, loadingRep, initAutocomplete])

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
        // Se erro de coluna, tenta sem lat/lng
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

    // Limpar mensagem de sucesso após 3s
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

        {/* Endereço base */}
        <div className="perfil-campo">
          <label>Endereço base (ponto de partida das rotas)</label>
          <div ref={enderecoInputRef} className="perfil-autocomplete-container"></div>
          {enderecoBase && (
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

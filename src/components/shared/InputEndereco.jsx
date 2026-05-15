import { useState, useEffect, useRef } from 'react'
import { loadGoogleMaps } from '../../lib/googleMaps'
import './InputEndereco.css'

const GEOCODING_API_KEY = import.meta.env.VITE_GEOCODING_API_KEY

function InputEndereco({
  value = '',
  onChange,
  onSelect,
  onGeocode,
  onAddressComponents,
  placeholder = 'Digite o endereço...',
  label,
  className = ''
}) {
  const [sugestoes, setSugestoes] = useState([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [buscando, setBuscando] = useState(false)

  const autocompleteServiceRef = useRef(null)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Inicializar AutocompleteService
  useEffect(() => {
    loadGoogleMaps()
      .then(() => {
        if (window.google?.maps?.places?.AutocompleteService) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
        }
      })
      .catch(err => console.warn('[InputEndereco] Erro ao carregar Google Maps:', err))
  }, [])

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

  // Buscar sugestões
  function buscarSugestoes(texto) {
    if (!texto || texto.length < 3) {
      setSugestoes([])
      setMostrarSugestoes(false)
      return
    }

    if (!autocompleteServiceRef.current) {
      console.warn('[InputEndereco] AutocompleteService não disponível')
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setBuscando(true)

      autocompleteServiceRef.current.getPlacePredictions(
        {
          input: texto,
          componentRestrictions: { country: 'br' },
          language: 'pt-BR'
        },
        (predictions, status) => {
          setBuscando(false)

          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSugestoes(predictions.map(p => ({
              placeId: p.place_id,
              description: p.description,
              mainText: p.structured_formatting?.main_text || '',
              secondaryText: p.structured_formatting?.secondary_text || ''
            })))
            setMostrarSugestoes(true)
          } else {
            setSugestoes([])
            setMostrarSugestoes(false)
          }
        }
      )
    }, 400)
  }

  // Geocodificar por place_id e extrair componentes
  async function geocodificar(placeId) {
    if (!placeId) return
    if (!onGeocode && !onAddressComponents) return

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${GEOCODING_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()

      if (data.status === 'OK' && data.results?.length > 0) {
        const result = data.results[0]

        // Retornar coordenadas
        if (onGeocode) {
          const loc = result.geometry.location
          onGeocode(loc.lat, loc.lng)
        }

        // Retornar componentes do endereço
        if (onAddressComponents && result.address_components) {
          const components = {}
          for (const comp of result.address_components) {
            const type = comp.types[0]
            if (type === 'route') components.rua = comp.long_name
            if (type === 'street_number') components.numero = comp.long_name
            if (type === 'sublocality_level_1' || type === 'sublocality') components.bairro = comp.long_name
            if (type === 'administrative_area_level_2') components.cidade = comp.long_name
            if (type === 'administrative_area_level_1') components.estado = comp.short_name
            if (type === 'postal_code') components.cep = comp.long_name
          }
          onAddressComponents(components)
        }
      }
    } catch (err) {
      console.error('[InputEndereco] Erro ao geocodificar:', err)
    }
  }

  // Handler do input
  function handleInputChange(e) {
    const valor = e.target.value
    if (onChange) {
      onChange(valor)
    }
    buscarSugestoes(valor)
  }

  // Selecionar sugestão
  function selecionarSugestao(sugestao) {
    if (onChange) {
      onChange(sugestao.description)
    }
    if (onSelect) {
      onSelect(sugestao.description, sugestao.placeId)
    }
    setSugestoes([])
    setMostrarSugestoes(false)

    // Geocodificar automaticamente (se callbacks disponíveis)
    if (onGeocode || onAddressComponents) {
      geocodificar(sugestao.placeId)
    }
  }

  return (
    <div className={`input-endereco ${className}`} ref={containerRef}>
      {label && <label className="input-endereco-label">{label}</label>}

      <div className="input-endereco-wrapper">
        <input
          type="text"
          className="input-endereco-field"
          value={value}
          onChange={handleInputChange}
          onFocus={() => sugestoes.length > 0 && setMostrarSugestoes(true)}
          placeholder={placeholder}
        />
        {buscando && (
          <div className="input-endereco-loading">...</div>
        )}

        {mostrarSugestoes && sugestoes.length > 0 && (
          <div className="input-endereco-dropdown">
            {sugestoes.map((s) => (
              <button
                key={s.placeId}
                className="input-endereco-item"
                onClick={() => selecionarSugestao(s)}
                type="button"
              >
                <span className="input-endereco-item-main">{s.mainText}</span>
                {s.secondaryText && (
                  <span className="input-endereco-item-secondary">{s.secondaryText}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default InputEndereco

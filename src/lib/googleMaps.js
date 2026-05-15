const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

let loadPromise = null

/**
 * Carrega o SDK do Google Maps uma única vez.
 * Chamadas subsequentes retornam a mesma promise.
 * Resolve quando o SDK está disponível em window.google.maps.
 */
export function loadGoogleMaps() {
  // Já carregado
  if (window.google?.maps?.places?.AutocompleteService) {
    return Promise.resolve(true)
  }

  // Já está carregando — retorna a mesma promise
  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_KEY) {
      console.error('[googleMaps] VITE_GOOGLE_MAPS_KEY não definida')
      reject(new Error('Chave do Google Maps ausente'))
      return
    }

    // Verifica se já tem um script carregando
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(true))
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar Google Maps')))
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      loadPromise = null  // permite tentar de novo
      reject(new Error('Falha ao carregar Google Maps'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

import { useRepresentada } from '../contexts/RepresentadaContext'
import { usePlano } from '../hooks/usePlano'

export default function DebugBanner() {
  const { representadas, representadaSelecionada, loading } = useRepresentada()
  const { plano, isPro, isEnterprise, isStarter } = usePlano()

  const localStorageId = typeof window !== 'undefined'
    ? localStorage.getItem('representada_selecionada')
    : null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: 'rgba(255, 0, 0, 0.9)',
      color: 'white',
      padding: '8px',
      fontSize: '10px',
      fontFamily: 'monospace',
      zIndex: 99999,
      maxHeight: '200px',
      overflowY: 'auto',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all'
    }}>
      {`LOADING: ${loading}
REPRESENTADAS COUNT: ${representadas?.length || 0}
LOCALSTORAGE ID: ${localStorageId}
SELECIONADA: ${JSON.stringify(representadaSelecionada, null, 2)}
PLANO: ${plano}
isStarter: ${isStarter} | isPro: ${isPro} | isEnterprise: ${isEnterprise}
ALL REPS: ${JSON.stringify(representadas?.map(r => ({ nome: r.nome, plano: r.plano, tipo: r.tipo })), null, 2)}`}
    </div>
  )
}

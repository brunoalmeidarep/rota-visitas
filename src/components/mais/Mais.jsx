import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import './Mais.css'

const THROTTLE_MS = 2 * 60 * 1000 // 2 minutos

function Mais() {
  const navigate = useNavigate()
  const { sync } = useRepresentada()

  // Estados para sync do catálogo
  const [ultimaSync, setUltimaSync] = useState(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [lastClickedAt, setLastClickedAt] = useState(null)
  const [throttleRemaining, setThrottleRemaining] = useState(0)
  const [toast, setToast] = useState('')
  const [toastTipo, setToastTipo] = useState('sucesso')

  const syncDisabled = throttleRemaining > 0

  // Effect 1: Carregar última sync do banco + último clique do localStorage
  useEffect(() => {
    async function fetchUltimaSync() {
      const { data } = await supabase
        .from('erp_sync_log')
        .select('created_at')
        .eq('erp_tipo', 'microvix')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data?.created_at) {
        setUltimaSync(new Date(data.created_at))
      }
    }

    const saved = localStorage.getItem('lastSyncRepClickedAt')
    if (saved) {
      setLastClickedAt(parseInt(saved, 10))
    }

    fetchUltimaSync()
  }, [])

  // Effect 2: Countdown do throttle (atualiza a cada 1s)
  useEffect(() => {
    if (!lastClickedAt) {
      setThrottleRemaining(0)
      return
    }

    function calcularRestante() {
      const agora = Date.now()
      const diff = lastClickedAt + THROTTLE_MS - agora
      return Math.max(0, Math.ceil(diff / 1000))
    }

    setThrottleRemaining(calcularRestante())

    const interval = setInterval(() => {
      const restante = calcularRestante()
      setThrottleRemaining(restante)
      if (restante <= 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lastClickedAt])

  // Effect 3: Atualizar "há X min" a cada 60s
  useEffect(() => {
    if (!ultimaSync) return

    const interval = setInterval(() => {
      setUltimaSync(prev => prev ? new Date(prev.getTime()) : null)
    }, 60000)

    return () => clearInterval(interval)
  }, [ultimaSync])

  function formatarTempoDecorrido(data) {
    if (!data) return ''
    const agora = new Date()
    const diffMs = agora - data
    const diffMin = Math.floor(diffMs / 60000)

    if (diffMin < 1) return '0 min'
    if (diffMin < 60) return `${diffMin} min`

    const diffHoras = Math.floor(diffMin / 60)
    if (diffHoras < 24) return `${diffHoras}h`

    const diffDias = Math.floor(diffHoras / 24)
    return `${diffDias}d`
  }

  async function handleAtualizarCatalogo() {
    if (syncDisabled || syncLoading) return

    const agora = Date.now()
    localStorage.setItem('lastSyncRepClickedAt', agora.toString())
    setLastClickedAt(agora)

    setSyncLoading(true)

    const FUNCTIONS = [
      'microvix-sync-produtos',
      'microvix-sync-produtos-custos',
      'microvix-sync-produtos-detalhes',
      'microvix-sync-fornecedores'
    ]

    try {
      const results = await Promise.allSettled(
        FUNCTIONS.map(name => supabase.functions.invoke(name))
      )

      const falhas = results.filter(r => r.status === 'rejected' || r.value?.error)

      if (falhas.length === 0) {
        setToast('Catálogo atualizado')
        setToastTipo('sucesso')
      } else if (falhas.length < FUNCTIONS.length) {
        setToast('Sincronização parcial')
        setToastTipo('erro')
      } else {
        setToast('Erro na sincronização')
        setToastTipo('erro')
      }

      setUltimaSync(new Date())

    } catch (err) {
      console.error('[Mais] Erro sync:', err)
      setToast('Erro na sincronização')
      setToastTipo('erro')
    }

    setSyncLoading(false)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleLogout() {
    const confirma = confirm('Deseja realmente sair?')
    if (!confirma) return
    localStorage.removeItem('plano_cache')
    navigate('/', { replace: true })
    await supabase.auth.signOut()
  }

  function placeholder(nome) {
    alert(`${nome} — em desenvolvimento`)
  }

  async function handleAtualizarDadosOffline() {
    if (!sync) return
    if (sync.sincronizando) {
      alert('Já está sincronizando, aguarde...')
      return
    }
    if (!sync.online) {
      alert('Sem conexão. Conecte-se à internet para atualizar os dados.')
      return
    }
    const resultado = await sync.sincronizar(true)
    if (resultado.ok) {
      alert('Dados atualizados com sucesso!')
    } else {
      alert('Erro ao atualizar: ' + (resultado.motivo || 'desconhecido'))
    }
  }

  return (
    <div className="mais">
      {/* Header */}
      <header className="mais-header">
        <button className="mais-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Opções</h1>
      </header>

      <div className="mais-content">
        {/* Configurações */}
        <section className="mais-secao">
          <h2 className="mais-secao-titulo">Configurações</h2>
          <div className="mais-lista">
            <button className="mais-lista-item" onClick={() => navigate('/mais/perfil')}>
              <span className="mais-lista-icon">👤</span>
              <span className="mais-lista-texto">Meu Perfil</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item" onClick={() => navigate('/mais/segmentos')}>
              <span className="mais-lista-icon">🏷️</span>
              <span className="mais-lista-texto">Segmentos</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item" onClick={handleAtualizarDadosOffline}>
              <span className="mais-lista-icon">📥</span>
              <div className="mais-lista-content">
                <span className="mais-lista-texto">
                  {sync?.sincronizando ? 'Atualizando...' : 'Atualizar dados offline'}
                </span>
                <span className="mais-lista-subtitulo">
                  {sync?.ultimoSync
                    ? `Última: ${new Date(sync.ultimoSync).toLocaleString('pt-BR')}`
                    : 'Sincroniza clientes, produtos e pedidos'}
                </span>
              </div>
            </button>
            <button
              className={`mais-lista-item ${syncDisabled ? 'disabled' : ''}`}
              onClick={handleAtualizarCatalogo}
              disabled={syncDisabled || syncLoading}
            >
              <span className="mais-lista-icon">🔄</span>
              <div className="mais-lista-content">
                <span className="mais-lista-texto">Atualizar catálogo</span>
                <span className="mais-lista-subtitulo">
                  {syncLoading
                    ? 'Sincronizando...'
                    : syncDisabled
                      ? `Aguarde ${Math.floor(throttleRemaining / 60)}m ${throttleRemaining % 60}s`
                      : ultimaSync
                        ? `Última atualização: há ${formatarTempoDecorrido(ultimaSync)}`
                        : 'Nunca sincronizado'}
                </span>
              </div>
            </button>
            <button className="mais-lista-item" onClick={() => placeholder('Importar clientes')}>
              <span className="mais-lista-icon">📥</span>
              <span className="mais-lista-texto">Importar clientes</span>
              <span className="mais-lista-seta">›</span>
            </button>
          </div>
        </section>

        {/* Conta */}
        <section className="mais-secao">
          <h2 className="mais-secao-titulo">Conta</h2>
          <div className="mais-lista">
            <button className="mais-lista-item" onClick={() => placeholder('Termos de uso')}>
              <span className="mais-lista-icon">📄</span>
              <span className="mais-lista-texto">Termos de uso</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item" onClick={() => placeholder('Privacidade')}>
              <span className="mais-lista-icon">🔒</span>
              <span className="mais-lista-texto">Privacidade</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item logout" onClick={handleLogout}>
              <span className="mais-lista-icon">🚪</span>
              <span className="mais-lista-texto">Sair</span>
            </button>
          </div>
        </section>

        {/* Versão */}
        <div className="mais-versao">
          Minha Rota RP v2.0.0
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mais-toast ${toastTipo}`}>{toast}</div>
      )}
    </div>
  )
}

export default Mais

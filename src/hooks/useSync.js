// src/hooks/useSync.js
// Hook centralizado de sincronização com IndexedDB.
// Detecta online/offline, sincroniza automaticamente quando online.

import { useState, useEffect, useCallback, useRef } from 'react'
import { sincronizarTudo } from '../lib/sync'
import { getSyncTimestamp } from '../lib/db'
import { processarFila, contarFila } from '../lib/queue'

// Tempo mínimo entre syncs automáticas (5 minutos)
const SYNC_THROTTLE_MS = 5 * 60 * 1000

export function useSync(empresaId) {
  const [online, setOnline] = useState(navigator.onLine)
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimoSync, setUltimoSync] = useState(null)
  const [erro, setErro] = useState(null)
  const [pendentesFila, setPendentesFila] = useState(0)
  const ultimoSyncRef = useRef(0)

  // Função de sync exposta (manual ou automática)
  const sincronizar = useCallback(async (forcar = false) => {
    if (!empresaId) return { ok: false, motivo: 'sem_empresa' }
    if (!navigator.onLine) {
      setErro('Sem conexão com a internet')
      return { ok: false, motivo: 'offline' }
    }
    if (sincronizando) return { ok: false, motivo: 'ja_sincronizando' }

    // Throttle: não sincroniza se já fez nos últimos 5min (a menos que force)
    const agora = Date.now()
    if (!forcar && agora - ultimoSyncRef.current < SYNC_THROTTLE_MS) {
      return { ok: true, motivo: 'throttled' }
    }

    setSincronizando(true)
    setErro(null)

    try {
      // 1. Primeiro processa a fila offline (pedidos pendentes de envio)
      const filaResultado = await processarFila()
      if (!filaResultado.ok && filaResultado.erros > 0) {
        console.warn('[useSync] fila com erros:', filaResultado)
        // Não bloqueia o resto da sync, só avisa
      }

      // 2. Depois sincroniza os dados de leitura
      const resultado = await sincronizarTudo(empresaId)
      if (resultado.ok) {
        ultimoSyncRef.current = agora
        setUltimoSync(new Date().toISOString())
        const total = await contarFila()
        setPendentesFila(total)
      } else {
        setErro(resultado.motivo || 'Erro desconhecido')
      }
      return resultado
    } catch (e) {
      const msg = e?.message || String(e)
      setErro(msg)
      return { ok: false, motivo: msg }
    } finally {
      setSincronizando(false)
    }
  }, [empresaId, sincronizando])

  // Detecta online/offline
  useEffect(() => {
    const handleOnline = () => {
      console.log('[useSync] voltou online — sincronizando...')
      setOnline(true)
      sincronizar(false)
    }
    const handleOffline = () => {
      console.log('[useSync] ficou offline')
      setOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [sincronizar])

  // Sincroniza ao montar (primeira vez que app abre)
  useEffect(() => {
    if (!empresaId) return
    sincronizar(false)
    // Também carrega o timestamp da última sync salvo no banco
    getSyncTimestamp('produtos').then(ts => {
      if (ts) setUltimoSync(ts)
    })
  }, [empresaId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    online,
    sincronizando,
    ultimoSync,
    erro,
    pendentesFila,
    sincronizar
  }
}

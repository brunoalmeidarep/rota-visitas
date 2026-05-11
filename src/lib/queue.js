// src/lib/queue.js
// Fila de sincronização offline.
// Operações criadas offline ficam aqui até serem enviadas pro Supabase.

import { supabase } from './supabase'
import { db } from './db'

/**
 * Adiciona uma operação à fila offline.
 *
 * @param {string} tabela - nome da tabela no Supabase (ex: 'pedidos')
 * @param {string} operacao - 'insert' | 'update' | 'delete'
 * @param {object} dados - payload completo da operação
 * @param {string} registroLocalId - id local do registro (opcional, pra rastrear)
 * @returns {Promise<number>} id do item na fila
 */
export async function enfileirar(tabela, operacao, dados, registroLocalId = null) {
  const id = await db.sync_queue.add({
    tabela,
    operacao,
    dados,
    registro_id: registroLocalId,
    criado_em: new Date().toISOString(),
    tentativas: 0,
    ultimo_erro: null
  })
  console.log(`[queue] enfileirado: ${operacao} em ${tabela} (id local ${id})`)
  return id
}

/**
 * Conta quantos itens há na fila.
 */
export async function contarFila() {
  return await db.sync_queue.count()
}

/**
 * Lista todos os itens da fila (pra tela de pendências).
 */
export async function listarFila() {
  return await db.sync_queue.orderBy('criado_em').toArray()
}

/**
 * Processa um item específico da fila.
 * Tenta enviar pro Supabase. Se sucesso: remove da fila e atualiza o IndexedDB local.
 * Se erro: incrementa tentativas e guarda mensagem.
 */
async function processarItem(item) {
  try {
    let resultado

    if (item.operacao === 'insert') {
      // Remove o id se for temporário (offline_xxx) — Supabase gera novo UUID
      const { id, ...dadosLimpos } = item.dados || {}
      const dadosParaInserir = (id && String(id).startsWith('offline_')) ? dadosLimpos : item.dados
      const { data, error } = await supabase
        .from(item.tabela)
        .insert(dadosParaInserir)
        .select()
        .single()
      if (error) throw error
      resultado = data
    } else if (item.operacao === 'update') {
      // dados deve conter { id, ...campos }
      const { id, ...campos } = item.dados
      const { data, error } = await supabase
        .from(item.tabela)
        .update(campos)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      resultado = data
    } else if (item.operacao === 'delete') {
      const { error } = await supabase
        .from(item.tabela)
        .delete()
        .eq('id', item.dados.id)
      if (error) throw error
      resultado = { id: item.dados.id }
    } else {
      throw new Error(`operação desconhecida: ${item.operacao}`)
    }

    // Atualiza o IndexedDB local com o registro real do servidor
    if (item.tabela === 'pedidos' && resultado) {
      // Se o registro local tinha ID temporário, troca pelo ID real
      if (item.registro_id && item.registro_id !== resultado.id) {
        await db.pedidos.delete(item.registro_id)
      }
      await db.pedidos.put({
        ...resultado,
        _synced_at: new Date().toISOString(),
        _pending_sync: 0
      })
    }

    // Remove da fila
    await db.sync_queue.delete(item.id)
    console.log(`[queue] sucesso: ${item.operacao} em ${item.tabela}`)
    return { ok: true, resultado }
  } catch (error) {
    // Erro: incrementa tentativas e guarda
    await db.sync_queue.update(item.id, {
      tentativas: (item.tentativas || 0) + 1,
      ultimo_erro: error?.message || String(error)
    })
    console.error(`[queue] erro em ${item.operacao} ${item.tabela}:`, error?.message)
    return { ok: false, erro: error?.message }
  }
}

/**
 * Processa toda a fila em ordem (FIFO).
 * Para na primeira falha pra evitar inconsistência.
 */
export async function processarFila() {
  if (!navigator.onLine) {
    return { ok: false, motivo: 'offline' }
  }

  const itens = await db.sync_queue.orderBy('criado_em').toArray()
  if (itens.length === 0) {
    return { ok: true, processados: 0 }
  }

  console.log(`[queue] processando ${itens.length} itens...`)
  let sucessos = 0
  let erros = 0

  for (const item of itens) {
    const r = await processarItem(item)
    if (r.ok) {
      sucessos++
    } else {
      erros++
      // Continua processando os outros mesmo se um falhar
    }
  }

  console.log(`[queue] finalizado: ${sucessos} sucesso, ${erros} erro`)
  return { ok: erros === 0, processados: sucessos, erros }
}

/**
 * Remove um item específico da fila (usado se rep cancelar manualmente).
 */
export async function removerDaFila(filaId) {
  await db.sync_queue.delete(filaId)
}

/**
 * Reseta tentativas de um item (usado se rep clicar "tentar de novo" depois de erro).
 */
export async function resetarTentativas(filaId) {
  await db.sync_queue.update(filaId, { tentativas: 0, ultimo_erro: null })
}

/**
 * Salva um registro respeitando online/offline.
 * - Online: insere no Supabase e retorna o registro real
 * - Offline: gera ID temporário, salva no IndexedDB local (se aplicável) e enfileira
 *
 * @param {string} tabela - nome da tabela ('pedidos', 'visitas', 'gastos_cliente', etc)
 * @param {object} dados - payload do registro
 * @param {object} options - { tabelaLocal: 'pedidos'|null } — se quer salvar no IndexedDB local também
 * @returns {Promise<{ok: boolean, registro?: object, offline?: boolean, motivo?: string}>}
 */
export async function salvarComOuSemConexao(tabela, dados, options = {}) {
  const { tabelaLocal = null } = options

  // Tenta online primeiro
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from(tabela)
        .insert(dados)
        .select()
        .single()

      if (error) throw error

      // Se também queremos cachear localmente (ex: pedidos)
      if (tabelaLocal && db[tabelaLocal]) {
        await db[tabelaLocal].put({
          ...data,
          _synced_at: new Date().toISOString(),
          _pending_sync: 0
        })
      }

      return { ok: true, registro: data, offline: false }
    } catch (error) {
      // Se erro de rede, cai pro offline. Senão, propaga o erro
      const msg = error?.message || String(error)
      const isNetworkError = msg.includes('Failed to fetch') ||
                             msg.includes('NetworkError') ||
                             msg.includes('TypeError')
      if (!isNetworkError) {
        return { ok: false, motivo: msg, offline: false }
      }
      console.warn(`[queue] online falhou (${msg}), salvando offline...`)
      // Continua pro fluxo offline abaixo
    }
  }

  // Fluxo offline: gera ID temporário, salva local, enfileira
  try {
    const idTemporario = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const registroOffline = {
      ...dados,
      id: idTemporario,
      _synced_at: null,
      _pending_sync: 1,
      _offline_created_at: new Date().toISOString()
    }

    // Salva no IndexedDB local (se aplicável)
    if (tabelaLocal && db[tabelaLocal]) {
      await db[tabelaLocal].put(registroOffline)
    }

    // Enfileira pra envio quando voltar online
    // Importante: removemos o id temporário do payload do enfileirar
    // (Supabase vai gerar o ID real quando inserir)
    const { id: _, _synced_at, _pending_sync, _offline_created_at, ...dadosLimpos } = registroOffline
    await enfileirar(tabela, 'insert', dadosLimpos, idTemporario)

    return { ok: true, registro: registroOffline, offline: true }
  } catch (error) {
    return { ok: false, motivo: error?.message || String(error), offline: true }
  }
}

/**
 * Atualiza um registro respeitando online/offline.
 * - Online: update no Supabase
 * - Offline: atualiza no IndexedDB local e enfileira
 *
 * @param {string} tabela - nome da tabela
 * @param {string} id - id do registro
 * @param {object} campos - campos a atualizar
 * @param {object} options - { tabelaLocal: 'pedidos'|null }
 */
export async function atualizarComOuSemConexao(tabela, id, campos, options = {}) {
  const { tabelaLocal = null } = options
  const ehOffline = String(id).startsWith('offline_')

  // Se é registro offline (ainda não foi pro Supabase), só atualiza local + atualiza item da fila
  if (ehOffline) {
    try {
      if (tabelaLocal && db[tabelaLocal]) {
        const atual = await db[tabelaLocal].get(id)
        if (atual) {
          await db[tabelaLocal].put({ ...atual, ...campos })
        }
      }

      // Atualiza o item da fila (insert pendente) com os novos campos
      const itensFila = await db.sync_queue
        .where('registro_id')
        .equals(id)
        .toArray()

      for (const item of itensFila) {
        if (item.operacao === 'insert') {
          await db.sync_queue.update(item.id, {
            dados: { ...item.dados, ...campos }
          })
        }
      }

      return { ok: true, offline: true }
    } catch (error) {
      return { ok: false, motivo: error?.message || String(error), offline: true }
    }
  }

  // Registro real (UUID): tenta online, fallback offline
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from(tabela)
        .update(campos)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (tabelaLocal && db[tabelaLocal]) {
        await db[tabelaLocal].put({
          ...data,
          _synced_at: new Date().toISOString(),
          _pending_sync: 0
        })
      }

      return { ok: true, registro: data, offline: false }
    } catch (error) {
      const msg = error?.message || String(error)
      const isNetworkError = msg.includes('Failed to fetch') ||
                             msg.includes('NetworkError') ||
                             msg.includes('TypeError')
      if (!isNetworkError) {
        return { ok: false, motivo: msg, offline: false }
      }
      console.warn(`[queue] update online falhou (${msg}), salvando offline...`)
    }
  }

  // Fluxo offline pra registro com UUID real
  try {
    if (tabelaLocal && db[tabelaLocal]) {
      const atual = await db[tabelaLocal].get(id)
      if (atual) {
        await db[tabelaLocal].put({ ...atual, ...campos, _pending_sync: 1 })
      }
    }
    await enfileirar(tabela, 'update', { id, ...campos }, id)
    return { ok: true, offline: true }
  } catch (error) {
    return { ok: false, motivo: error?.message || String(error), offline: true }
  }
}

// src/lib/sync.js
// Funções de sincronização entre Supabase (servidor) e IndexedDB (local).
// Estratégia: pull-only para tabelas read-only (produtos, clientes, etc).
// Sync incremental usando timestamp da última sincronização.

import { supabase, getRepId } from './supabase'
import { db, setSyncTimestamp, getSyncTimestamp } from './db'

const PAGE_SIZE = 1000

/**
 * Sincroniza produtos da empresa do rep para o IndexedDB local.
 * Pega todos os produtos não desativados manualmente.
 */
export async function syncProdutos(empresaId) {
  if (!empresaId) {
    console.warn('[sync] syncProdutos: empresaId não informado')
    return { ok: false, motivo: 'sem_empresa' }
  }

  const inicio = Date.now()
  let pagina = 0
  let total = 0

  try {
    while (true) {
      const offset = pagina * PAGE_SIZE
      const { data, error } = await supabase
        .from('produtos_com_preco_distribuidora')
        .select('id, codigo, codigo_barras, nome, preco, preco_loja, preco_distribuidora, desconto_pct_aplicado, nome_familia, ipi, unidade, fotos, foto_url, ativo, desativado_manualmente, empresa_id, fornecedor_id')
        .eq('empresa_id', empresaId)
        .eq('desativado_manualmente', false)
        .order('nome')
        .range(offset, offset + PAGE_SIZE - 1)

      if (error) throw error
      if (!data || data.length === 0) break

      const agora = new Date().toISOString()
      const registros = data.map(p => ({ ...p, _synced_at: agora }))

      await db.produtos.bulkPut(registros)
      total += data.length

      if (data.length < PAGE_SIZE) break
      pagina++
    }

    await setSyncTimestamp('produtos')
    console.log(`[sync] produtos: ${total} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncProdutos:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza clientes do rep para o IndexedDB local.
 */
export async function syncClientes(repId, empresaId) {
  if (!repId || !empresaId) {
    console.warn('[sync] syncClientes: repId ou empresaId não informados')
    return { ok: false, motivo: 'sem_rep_ou_empresa' }
  }

  const inicio = Date.now()

  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('rep_id', repId)
      .order('nome')

    if (error) throw error

    const agora = new Date().toISOString()
    const registros = (data || []).map(c => ({ ...c, _synced_at: agora, _pending_sync: 0 }))

    // Limpa clientes não-pendentes antes de inserir os novos
    // (mantém os que ainda não sincronizaram com servidor)
    await db.clientes.where('_pending_sync').notEqual(1).delete()
    await db.clientes.bulkPut(registros)

    await setSyncTimestamp('clientes')
    console.log(`[sync] clientes: ${registros.length} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total: registros.length, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncClientes:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza fornecedores da empresa.
 */
export async function syncFornecedores(empresaId) {
  if (!empresaId) return { ok: false, motivo: 'sem_empresa' }

  const inicio = Date.now()

  try {
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome')

    if (error) throw error

    const agora = new Date().toISOString()
    const registros = (data || []).map(f => ({ ...f, _synced_at: agora }))

    await db.fornecedores.clear()
    await db.fornecedores.bulkPut(registros)

    await setSyncTimestamp('fornecedores')
    console.log(`[sync] fornecedores: ${registros.length} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total: registros.length, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncFornecedores:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza pedidos do rep para o IndexedDB local.
 */
export async function syncPedidos(repId, empresaId) {
  if (!repId || !empresaId) return { ok: false, motivo: 'sem_rep_ou_empresa' }

  const inicio = Date.now()

  try {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('rep_id', repId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    const agora = new Date().toISOString()
    const registros = (data || []).map(p => ({ ...p, _synced_at: agora, _pending_sync: 0 }))

    await db.pedidos.where('_pending_sync').notEqual(1).delete()
    await db.pedidos.bulkPut(registros)

    await setSyncTimestamp('pedidos')
    console.log(`[sync] pedidos: ${registros.length} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total: registros.length, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncPedidos:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza visitas do rep para o IndexedDB local.
 */
export async function syncVisitas(repId) {
  if (!repId) return { ok: false, motivo: 'sem_rep' }
  const inicio = Date.now()
  try {
    const { data, error } = await supabase
      .from('visitas')
      .select('*')
      .eq('rep_id', repId)
      .order('data', { ascending: false })
      .limit(2000)
    if (error) throw error
    const agora = new Date().toISOString()
    const registros = (data || []).map(v => ({ ...v, _synced_at: agora, _pending_sync: 0 }))
    await db.visitas.where('_pending_sync').notEqual(1).delete()
    await db.visitas.bulkPut(registros)
    await setSyncTimestamp('visitas')
    console.log(`[sync] visitas: ${registros.length} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total: registros.length, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncVisitas:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza tarefas do rep para o IndexedDB local.
 */
export async function syncTarefas(repId) {
  if (!repId) return { ok: false, motivo: 'sem_rep' }
  const inicio = Date.now()
  try {
    const { data, error } = await supabase
      .from('tarefas')
      .select('*')
      .eq('rep_id', repId)
      .order('id', { ascending: false })
      .limit(1000)
    if (error) throw error
    const agora = new Date().toISOString()
    const registros = (data || []).map(t => ({ ...t, _synced_at: agora, _pending_sync: 0 }))
    await db.tarefas.where('_pending_sync').notEqual(1).delete()
    await db.tarefas.bulkPut(registros)
    await setSyncTimestamp('tarefas')
    console.log(`[sync] tarefas: ${registros.length} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total: registros.length, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncTarefas:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza eventos do planner.
 */
export async function syncPlanner(repId) {
  if (!repId) return { ok: false, motivo: 'sem_rep' }
  const inicio = Date.now()
  try {
    const { data, error } = await supabase
      .from('planner')
      .select('*')
      .eq('rep_id', repId)
      .limit(2000)
    if (error) throw error
    const agora = new Date().toISOString()
    const registros = (data || []).map(p => ({ ...p, _synced_at: agora, _pending_sync: 0 }))
    await db.planner.where('_pending_sync').notEqual(1).delete()
    await db.planner.bulkPut(registros)
    await setSyncTimestamp('planner')
    console.log(`[sync] planner: ${registros.length} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total: registros.length, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncPlanner:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza rotas do rep.
 */
export async function syncRotas(repId) {
  if (!repId) return { ok: false, motivo: 'sem_rep' }
  const inicio = Date.now()
  try {
    const { data, error } = await supabase
      .from('rotas')
      .select('*')
      .eq('rep_id', repId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) throw error
    const agora = new Date().toISOString()
    const registros = (data || []).map(r => ({ ...r, _synced_at: agora, _pending_sync: 0 }))
    await db.rotas.where('_pending_sync').notEqual(1).delete()
    await db.rotas.bulkPut(registros)
    await setSyncTimestamp('rotas')
    console.log(`[sync] rotas: ${registros.length} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total: registros.length, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncRotas:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza planos de pagamento da empresa atual.
 */
export async function syncPlanos(empresaId) {
  if (!empresaId) return { ok: false, motivo: 'sem_empresa' }
  const inicio = Date.now()
  try {
    const { data, error } = await supabase
      .from('planos_pagamento')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('ordem_exibicao', { ascending: true })
    if (error) throw error
    const agora = new Date().toISOString()
    const registros = (data || []).map(p => ({ ...p, _synced_at: agora }))
    await db.planos_pagamento.where('empresa_id').equals(empresaId).delete()
    await db.planos_pagamento.bulkPut(registros)
    await setSyncTimestamp('planos_pagamento')
    console.log(`[sync] planos_pagamento: ${registros.length} registros em ${Date.now() - inicio}ms`)
    return { ok: true, total: registros.length, duracao_ms: Date.now() - inicio }
  } catch (error) {
    console.error('[sync] erro syncPlanos:', error)
    return { ok: false, motivo: error.message }
  }
}

/**
 * Sincroniza tudo de uma vez.
 * Chamado ao abrir o app (se online) ou quando rep força refresh.
 */
export async function sincronizarTudo(empresaId) {
  if (!empresaId) {
    return { ok: false, motivo: 'sem_empresa' }
  }

  const repId = await getRepId()
  if (!repId) {
    return { ok: false, motivo: 'sem_rep' }
  }

  const inicio = Date.now()
  console.log('[sync] iniciando sincronização completa...')

  const [produtos, clientes, fornecedores, pedidos, visitas, tarefas, planner, rotas, planos] = await Promise.all([
    syncProdutos(empresaId),
    syncClientes(repId, empresaId),
    syncFornecedores(empresaId),
    syncPedidos(repId, empresaId),
    syncVisitas(repId),
    syncTarefas(repId),
    syncPlanner(repId),
    syncRotas(repId),
    syncPlanos(empresaId)
  ])

  const duracaoTotal = Date.now() - inicio
  const tudoOk = produtos.ok && clientes.ok && fornecedores.ok && pedidos.ok && visitas.ok && tarefas.ok && planner.ok && rotas.ok && planos.ok

  console.log(`[sync] sincronização completa em ${duracaoTotal}ms — ${tudoOk ? 'sucesso' : 'parcial/erro'}`)

  return {
    ok: tudoOk,
    duracao_ms: duracaoTotal,
    resultados: { produtos, clientes, fornecedores, pedidos, visitas, tarefas, planner, rotas, planos }
  }
}

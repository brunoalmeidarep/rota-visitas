// src/lib/db.js
// Banco local IndexedDB usando Dexie.
// Espelha as tabelas principais do Supabase para uso offline.

import Dexie from 'dexie'

export const db = new Dexie('MinhaRotaRP')

db.version(1).stores({
  produtos: 'id, codigo, codigo_barras, nome, empresa_id, ativo, desativado_manualmente, _synced_at',
  clientes: 'id, cnpj_cpf, nome, empresa_id, rep_id, _synced_at, _pending_sync',
  fornecedores: 'id, nome, empresa_id, _synced_at',
  pedidos: 'id, numero, cliente_id, rep_id, empresa_id, status, status_empresa, erp_status, created_at, _synced_at, _pending_sync',
  tarefas: 'id, rep_id, cliente_id, status, _synced_at, _pending_sync',
  visitas: 'id, cliente_id, rep_id, created_at, _synced_at, _pending_sync',
  representadas: 'id, nome, empresa_id, _synced_at',
  sync_queue: '++id, tabela, operacao, registro_id, criado_em, tentativas, ultimo_erro',
  sync_meta: '&chave, valor, atualizado_em'
})

// Versão 2: adiciona planner e rotas
db.version(2).stores({
  planner: 'id, rep_id, cliente_id, data, tipo, _synced_at, _pending_sync',
  rotas: 'id, rep_id, created_at, _synced_at, _pending_sync'
})

// Versão 3: adiciona planos_pagamento
db.version(3).stores({
  planos_pagamento: 'id, empresa_id, id_microvix, ativo, ordem_exibicao, _synced_at'
})

export async function setSyncTimestamp(tabela, timestamp = new Date().toISOString()) {
  await db.sync_meta.put({
    chave: `last_sync_${tabela}`,
    valor: timestamp,
    atualizado_em: new Date().toISOString()
  })
}

export async function getSyncTimestamp(tabela) {
  const meta = await db.sync_meta.get(`last_sync_${tabela}`)
  return meta?.valor || null
}

export async function limparDadosLocais() {
  await Promise.all([
    db.produtos.clear(),
    db.clientes.clear(),
    db.fornecedores.clear(),
    db.pedidos.clear(),
    db.tarefas.clear(),
    db.visitas.clear(),
    db.representadas.clear(),
    db.planner.clear(),
    db.rotas.clear(),
    db.planos_pagamento.clear(),
    db.sync_queue.clear(),
    db.sync_meta.clear()
  ])
}

export async function contarPendentesSync() {
  const [clientes, pedidos, tarefas, visitas, fila] = await Promise.all([
    db.clientes.where('_pending_sync').equals(1).count(),
    db.pedidos.where('_pending_sync').equals(1).count(),
    db.tarefas.where('_pending_sync').equals(1).count(),
    db.visitas.where('_pending_sync').equals(1).count(),
    db.sync_queue.count()
  ])
  return {
    clientes,
    pedidos,
    tarefas,
    visitas,
    fila,
    total: clientes + pedidos + tarefas + visitas + fila
  }
}

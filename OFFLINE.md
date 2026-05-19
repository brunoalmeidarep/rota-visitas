# Sistema Offline-First — Minha Rota RP

## Visão geral

O app usa IndexedDB local via Dexie como cache de leitura. Dados são sincronizados do Supabase para o IndexedDB (pull). Escritas offline vão para uma fila (`sync_queue`) e são enviadas ao Supabase quando a conexão retorna (push).

## Stack

- Dexie.js v4.4.2 sobre IndexedDB
- Schema definido em `src/lib/db.js` (versão atual: 3)

## Tabelas locais

| Tabela | Índices |
|--------|---------|
| produtos | `id, codigo, codigo_barras, nome, empresa_id, ativo, desativado_manualmente, _synced_at` |
| clientes | `id, cnpj_cpf, nome, empresa_id, rep_id, _synced_at, _pending_sync` |
| fornecedores | `id, nome, empresa_id, _synced_at` |
| pedidos | `id, numero, cliente_id, rep_id, empresa_id, status, status_empresa, erp_status, created_at, _synced_at, _pending_sync` |
| tarefas | `id, rep_id, cliente_id, status, _synced_at, _pending_sync` |
| visitas | `id, cliente_id, rep_id, created_at, _synced_at, _pending_sync` |
| representadas | `id, nome, empresa_id, _synced_at` |
| sync_queue | `++id, tabela, operacao, registro_id, criado_em, tentativas, ultimo_erro` |
| sync_meta | `&chave, valor, atualizado_em` |
| planner | `id, rep_id, cliente_id, data, tipo, _synced_at, _pending_sync` (v2) |
| rotas | `id, rep_id, created_at, _synced_at, _pending_sync` (v2) |
| planos_pagamento | `id, empresa_id, id_microvix, ativo, ordem_exibicao, _synced_at` (v3) |

## Funções principais

### Leitura

Padrão usado em componentes: tenta IndexedDB primeiro, fallback Supabase se IndexedDB estiver vazio ou falhar. Exemplo em `NovoPedido.jsx:105`.

### Escrita

**`salvarComOuSemConexao(tabela, dados, options)`** — `src/lib/queue.js:171`
- Online: insere no Supabase, cacheia no IndexedDB com `_pending_sync: 0`
- Offline: gera ID temporário (`offline_xxx`), salva no IndexedDB com `_pending_sync: 1`, enfileira
- Retorna: `{ ok, registro, offline, motivo }`

**`atualizarComOuSemConexao(tabela, id, campos, options)`** — `src/lib/queue.js:247`
- Se ID começa com `offline_`: atualiza IndexedDB local + atualiza item da fila
- Se ID é UUID real: tenta Supabase, fallback enfileira update
- Retorna: `{ ok, registro?, offline, motivo? }`

**`enfileirar(tabela, operacao, dados, registroLocalId)`** — `src/lib/queue.js:17`
- Adiciona operação à `sync_queue` com `tentativas: 0`
- Operações: `insert`, `update`, `delete`
- Retorna: ID do item na fila

### Sync (pull do Supabase)

Funções em `src/lib/sync.js`:

| Função | O que sincroniza | Limite |
|--------|------------------|--------|
| `syncProdutos(empresaId)` | produtos não desativados | paginado 1000 |
| `syncClientes(repId, empresaId)` | clientes do rep | todos |
| `syncFornecedores(empresaId)` | fornecedores da empresa | todos |
| `syncPedidos(repId, empresaId)` | pedidos do rep | 500 mais recentes |
| `syncVisitas(repId)` | visitas do rep | 2000 mais recentes |
| `syncTarefas(repId)` | tarefas do rep | 1000 |
| `syncPlanner(repId)` | eventos do planner | 2000 |
| `syncRotas(repId)` | rotas do rep | 500 |
| `syncPlanos(empresaId)` | planos de pagamento ativos | todos |

**`sincronizarTudo(empresaId)`** — `src/lib/sync.js:300`
- Orquestra todas as funções sync* em paralelo
- Retorna: `{ ok, duracao_ms, resultados: {...} }`

### Sync (push para Supabase)

**`processarFila()`** — `src/lib/queue.js:119`
- Processa `sync_queue` em ordem FIFO
- Para cada item: tenta enviar ao Supabase
- Sucesso: remove da fila, atualiza IndexedDB com ID real
- Erro: incrementa `tentativas`, guarda `ultimo_erro`
- Retorna: `{ ok, processados, erros }`

**`processarItem(item)`** — `src/lib/queue.js:50`
- Executa insert/update/delete no Supabase
- Se insert com ID `offline_xxx`: remove ID do payload, Supabase gera UUID
- Após sucesso: troca registro local pelo registro real do servidor

### Hook de sincronização

**`useSync(empresaId)`** — `src/hooks/useSync.js:13`
- Detecta online/offline via `navigator.onLine`
- Ao voltar online: chama `sincronizar()`
- Ao montar: sincroniza automaticamente
- Throttle: 5 minutos entre syncs automáticas
- Expõe: `{ online, sincronizando, ultimoSync, erro, pendentesFila, sincronizar }`

## Estados de sync

| Campo | Valor | Significado |
|-------|-------|-------------|
| `_pending_sync` | 0 | Registro sincronizado com servidor |
| `_pending_sync` | 1 | Registro pendente de envio |
| `_synced_at` | timestamp ISO | Última sincronização |
| `_offline_created_at` | timestamp ISO | Quando foi criado offline |

## IDs offline

- Quando offline, novos registros recebem ID: `offline_{timestamp}_{random}`
- Quando volta online e `processarFila()` roda:
  1. ID temporário é removido do payload antes do insert
  2. Supabase gera UUID real
  3. Registro local com ID temporário é deletado
  4. Registro com ID real é inserido no IndexedDB
- Implementado em `processarItem()` linhas 88-98

## Arquivos que usam o IndexedDB (lêem do db.js)

1. `src/hooks/useSync.js`
2. `src/components/tarefas/Tarefas.jsx`
3. `src/components/pedidos/Catalogo.jsx`
4. `src/components/pedidos/DetalhesPedido.jsx`
5. `src/components/pedidos/ListaPedidos.jsx`
6. `src/components/pedidos/NovoPedido.jsx`
7. `src/components/planner/Planner.jsx`
8. `src/components/produtos/ListaProdutos.jsx`
9. `src/components/clientes/CarteiraClientes.jsx`
10. `src/components/clientes/PerfilCliente.jsx`
11. `src/components/clientes/HistoricoCliente.jsx`
12. `src/components/relatorios/ClientesInativos.jsx`
13. `src/components/relatorios/VisitasRelatorio.jsx`
14. `src/components/relatorios/RankingClientes.jsx`
15. `src/components/relatorios/ResumoVendas.jsx`
16. `src/components/relatorios/VendasProduto.jsx`

## Arquivos que ainda usam Supabase direto

- Home.jsx
- RepresentadaContext.jsx
- Mapa.jsx
- sync.js
- CadastroCliente.jsx
- Representadas.jsx
- Bonificacao.jsx
- Checkin.jsx
- CarteiraClientes.jsx
- GastosCliente.jsx
- DadosCliente.jsx
- PerfilCliente.jsx
- DetalheVisita.jsx
- CheckinLegacy.jsx
- CadastroProduto.jsx
- ListaProdutos.jsx
- Catalogo.jsx
- MetaVendas.jsx
- DescontosPedido.jsx
- DetalheProdutoPedido.jsx
- DetalhesPedido.jsx
- ListaPedidos.jsx
- NovoPedido.jsx
- HistoricoCliente.jsx
- PedidoSimples.jsx

## O que está offline (funciona sem sinal)

- Leitura de clientes (cache local)
- Leitura de produtos (cache local)
- Leitura de pedidos (cache local)
- Leitura de visitas (cache local)
- Leitura de tarefas (cache local)
- Leitura do planner (cache local)
- Leitura de rotas (cache local)
- Criação de pedidos (enfileirada)
- Atualização de pedidos (enfileirada)

## O que NÃO está offline

### Decisão de produto: fora do escopo offline
Alinhado com o concorrente (Mercos) que também não cobre offline nessas áreas:

**Relatórios e análises** (rep acessa de escritório, fim de mês)
- VisitasRelatorio, RankingClientes, ResumoVendas, VendasProduto, ClientesInativos, MetaVendas
- Tabelas: nenhuma adicional necessária (usam dados já sincronizados)

**Administração e configuração** (uso esporádico, setup)
- Representadas.jsx (CRUD de representadas + políticas comerciais)
- CadastroProduto.jsx (admin cadastra produtos)
- CadastroCliente.jsx (cadastro inicial de cliente)

**Funcionalidades dependentes de serviços externos**
- Mapa.jsx (Google Maps tiles requerem internet)
- Home.jsx (dashboards agregados)

### Buracos identificados — corrigir

**🔴 Críticos — uso frequente em campo, sem sinal quebra fluxo de venda**

| Arquivo | Problema | Ação |
|---------|----------|------|
| Checkin.jsx | Não usa salvarComOuSemConexao | Migrar escrita pra fila |
| GastosCliente.jsx | Sem cobertura offline + tabela `gastos_cliente` não tem espelho local | Adicionar tabela no db.js + migrar escrita |
| PedidoSimples.jsx | Não usa salvarComOuSemConexao | Migrar escrita pra fila |

**🟡 Importantes — investigar se quebra fluxo de venda**

| Arquivo | A investigar |
|---------|--------------|
| DescontosPedido.jsx | Política comercial precisa estar em cache local? |
| DetalheProdutoPedido.jsx | Verificar se leitura tem fallback Supabase |
| DetalheVisita.jsx | Verificar se leitura tem fallback Supabase |

**🟢 A classificar**

| Arquivo | A investigar |
|---------|--------------|
| Bonificacao.jsx | Verificar fluxo: rep aplica bonificação offline durante venda? |

## Tabelas NÃO sincronizadas localmente

### Por decisão de produto (online-only)
- `politica_comercial` — usado em Representadas (admin)
- `financeiro`, `impostos` — relatórios/admin
- `compromissos`, `lembretes` — funcionalidades futuras/relatórios
- `segmentos` — configuração
- `client_import_files` — admin

### Que precisam virar locais (correção de buracos)
- `gastos_cliente` — adicionar em db.js para cobrir GastosCliente.jsx offline
- `bonificacoes` — depende da investigação de Bonificacao.jsx

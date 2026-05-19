# MINHA ROTA RP — v2 Planejamento Completo

## Responda sempre em português brasileiro.
## Branch de trabalho: v2 (NUNCA commitar na main)

---

## Sistema Offline-First (LEIA ANTES DE MEXER)

O app tem offline-first implementado e funcionando. Antes de qualquer mudança que envolva:
- Dexie / IndexedDB
- Tabelas locais (clientes, produtos, pedidos, visitas, etc)
- Queries Supabase
- Sincronização de dados
- Funções salvarComOuSemConexao, atualizarComOuSemConexao, enfileirar, processarFila

LEIA PRIMEIRO o arquivo OFFLINE.md no raiz do projeto. Ele documenta:
- Arquitetura completa (Dexie + sync_queue + IDs offline)
- Quais arquivos já usam offline
- Quais buracos existem e devem ser corrigidos
- O que é decisão de produto (online-only)

NÃO reimplemente offline-first. Já existe.

---

## ⚠️ ATENÇÃO — APLICATIVO NATIVO
Todo o desenvolvimento do v2 deve considerar que será empacotado como aplicativo nativo via Capacitor para Apple Store e Google Play. Isso significa:
- Todas as funcionalidades devem funcionar em ambiente nativo (iOS e Android)
- GPS, câmera, permissões devem usar APIs compatíveis com Capacitor
- Sem dependência de APIs que exijam HTTPS apenas em browser (ex: geolocalização funciona nativamente no Capacitor)
- Layout mobile-first, sem hover states, touch-friendly
- Testar sempre pensando em tela de celular, não desktop
- Safe areas (notch, barra inferior) devem ser respeitadas

### Ícones e Imagens
- Ícones do app: PNG sem canal alpha (transparência) — usar fundo branco ou colorido
- Formato aceito pela Apple Store: PNG, sem transparência no ícone principal
- Imagens dentro do app: PNG ou JPEG, evitar SVG inline para ícones do app
- App icon deve ser gerado com sharp ou ferramenta similar com flatten() para remover alpha
- Screenshots para as stores: seguir dimensões exatas (iPhone 6.5pol: 1242x2688, iPad 13pol: 2048x2732)

---

## O que é
CRM e app de força de vendas para representantes comerciais.
- **URL produção (main):** https://minharotarp.com.br
- **URL staging v2:** preview do Cloudflare Pages (branch v2)
- **Repo:** github.com/brunoalmeidarep/rota-visitas

---

## Stack v2
- **Frontend:** React (reescrita completa do index.html)
- **Estrutura:** arquivos separados — `js/`, `css/`, componentes React
- **Hospedagem:** Cloudflare Pages (branch v2 → preview automático)
- **Auth + Banco:** Supabase (projeto novo — v2 staging)
- **Mapa:** Google Maps JavaScript API
- **PWA:** manifest.json + sw.js

---

## Credenciais v2 (Supabase novo)
- **Supabase URL:** https://byglymeulgeomoldhrrh.supabase.co
- **Supabase anon key:** sb_publishable_N7Es1GU_4yUNpun4qQDkWQ_4Lhl-6Ii
- **Google Maps API key:** AIzaSyA8MEv3kZLzuEbykwI9dfqfw3_R9udDTWo
- **Google Geocoding API key (sem restrição de referrer):** AIzaSyCwgVzb1CW3_rN-3t6LAkBC1IOPYN5zqJI
- **Admin email:** brunoc.almeida.sc@gmail.com

---

## Status atual — Abril 2026

### Minha Rota RP v2
- **Deploy:** v2.rota-visitas.pages.dev
- **Supabase:** byglymeulgeomoldhrrh.supabase.co
- **Planos:** funcionando por usuário (campo `plano` na tabela `representantes`)
- **Usuários de teste:**
  - Bruno: pro
  - Victor Missfeld: pro
  - Victor Pomerode: starter

### SalesRP (Painel Administrativo)
- **Pasta local:** C:/Users/Bruno/Documents/salesrp
- **Mesmo Supabase do v2**
- **Deploy:** ainda local (localhost:5173)
- **Empresa de teste:** Inkor (id: `3be1b7a6-3ab4-4eae-8f25-7bea31af3f8f`)
- **Admin:** Bruno Almeida (brunoc.almeida.sc@gmail.com)
- **Tabelas criadas:** `empresas`, `empresas_admins`, `pedido_itens`, `politica_comercial_empresa`
- **Colunas adicionadas:**
  - `pedidos`: empresa_id, status_empresa, observacao_empresa, aprovado_por, aprovado_em, descontos_rep, descontos_cascata
  - `representantes`: empresa_id, is_direto, codigo_rep, telefone
  - `clientes`: empresa_id

### Bugs corrigidos nesta sessão
- Cache de plano evita flash de conteúdo errado na Home
- Inputs visíveis no modo escuro iOS
- Múltiplos de venda no catálogo
- Importação Excel de produtos
- Query clientes sem join inválido
- Fuso horário UTC-3 nos filtros de data do dashboard

---

## Regra crítica — rep_id
NUNCA usar auth.uid() diretamente como rep_id.
Sempre buscar: SELECT id FROM representantes WHERE email = user.email
Usar a função getRepId() com cache.

---

## Status atual — componentes implementados
- ✅ Login (Supabase Auth)
- ✅ CarteiraClientes (stats bar, filtros, cores de inatividade)
- ✅ CadastroCliente (CNPJ via BrasilAPI, CEP via ViaCEP, geocodificação automática)
- ✅ PerfilCliente (header, hero, stats, ações rápidas, histórico com abas, CheckIn integrado)
- ✅ DadosCliente (cards fiscal, contato, endereço, telefone clicável)
- ✅ CheckIn (sheet com opções check-in/pedido/orçamento, gasto colapsável, anti-duplicata)
- ✅ Bonificacao (lista agrupada por mês, resumo anual/mensal, sheet nova bonificação)
- ✅ GastosCliente (lista com filtro por ano, categorias com ícones, total geral)
- ✅ DetalheVisita (hero, tipo, obs, pedidos e gastos associados)
- ✅ Planner (semana/mês, compromissos, integração visitas)
- ✅ Rotas no Planner (otimização Google/Haversine, modal completo, detalhe, Google Maps)
- ✅ Home (grid de módulos, badges, dark/light mode, online/offline)
- ✅ InputEndereco (componente reutilizável com AutocompleteService)
- ✅ ListaPedidos (filtros, busca, agrupamento por data, badges de status)
- ✅ NovoPedido (canal, cliente com busca, representada, tipo, gasto colapsável)
- ✅ Catalogo (produtos com busca, filtros, +/- quantidade, badge IPI, footer total)
- ✅ DetalheProdutoPedido (foto, info, quantidade, desconto %/R$, cálculos)
- ✅ DescontosPedido (política comercial com toggles, descontos rep, cascata)
- ✅ DetalhesPedido (condições, lista produtos, resumo, Gerar/Duplicar/PDF)
- ✅ PedidoSimples (para Starter: canal, representada, tipo, valor total)
- ✅ usePlano (hook com mock para starter/pro/enterprise)
- ⚠️ Autocomplete Places — funciona em HTTPS/deploy, usa AutocompleteService em HTTP local
- ❌ Produtos (catálogo, cadastro, edição)
- ❌ Relatórios
- ❌ Finanças
- ❌ PDF de pedidos/orçamentos

---

## Regras de negócio
- Cidades sempre normalizadas em Title Case via ViaCEP ao cadastrar cliente
- Geocodificação automática (lat/lng) ao salvar cliente com endereço
- Geocodificação do endereço base do representante ao salvar nas Rotas

---

## Planos e funcionalidades

### Starter
- Carteira de clientes
- Check-in presencial
- Pedido simples (sem catálogo — só valor total)
- Planner
- Relatórios básicos (visitas, bonificações manuais, gastos)
- Finanças
- Navbar: 🔒Pedidos · 👥Clientes · 📅Planner · ···Mais

### Pro
- Tudo do Starter
- Pedido completo com catálogo de produtos
- Orçamentos
- Descontos em cascata
- PDF profissional por empresa
- Produtos na navbar
- Navbar: 📋Pedidos · 👥Clientes · 📦Produtos · 📅Planner · ···Mais

### Enterprise (guarda-chuva)
- Tudo do Pro
- Painel web da indústria
- Política comercial configurável
- Transmissão de pedidos
- Badge "Transmitido" nos pedidos
- Múltiplos reps sob uma empresa

---

## Navbar v2

### Starter
📋 Pedidos (🔒 bloqueado, mostra upgrade) · 👥 Clientes · 📅 Planner · ··· Mais

### Pro e Enterprise
📋 Pedidos · 👥 Clientes · 📦 Produtos · 📅 Planner · ··· Mais

---

## Modelo de empresas — Modelo A (workspace por representada)
- Cada representada é um workspace separado com catálogo próprio
- Rep troca de empresa via switcher no topo das telas de Pedidos e Produtos
- PDF gerado com logo e cor da representada
- Rep solo (Pro): gerencia a própria representada
- Guarda-chuva (Enterprise): indústria gerencia, rep não edita

---

## Telas validadas e especificação

### 1. PEDIDOS (lista)
- Header: título "Pedidos" + ícone relatórios (azul) + ícone + (verde)
- Switcher de empresa logo abaixo do título
- Busca por cliente ou número
- Filtros: Todos · Orçamento · Pedido · Transmitido (só Enterprise)
- Cards agrupados por data: cliente, qtd itens, cidade, número, badge status, valor
- Badges: Orçamento (laranja) · Pedido (verde) · Transmitido (azul, só Enterprise)

### 2. DENTRO DO PEDIDO / ORÇAMENTO
- Header: ← Voltar | badge único colorido (Em orçamento=laranja / Pedido #xxx=verde) | Salvar
- Cliente clicável no topo (para trocar)
- Canal: 🏪 Presencial (atualiza última visita) | WhatsApp (não atualiza)
- Botões: Adicionar produtos · Descontos ou acréscimos
- Lista de itens com preço, IPI (se houver), desconto por item
- Detalhes: tipo de pedido, condição de pagamento, regime tributário, data emissão, informações adicionais
- Campo de obs da visita (grande, não vai pro PDF nem pra indústria — só alimenta histórico)
- Ações: Gerar pedido · Duplicar · Ver PDF · Compartilhar · Cancelar orçamento
- Quando pedido gerado: trava edição, só Duplicar · PDF · Compartilhar · Excluir
- Footer fixo com total sempre visível

### 3. VER ITENS
- Resumo topo: qtd itens · unidades · total
- Lista de produtos: nome, código, qtde, preço, tag de desconto (só se tiver)
- Item no preço de tabela: sem tag nenhuma
- Item com desconto manual: tag "manual" laranja + % em vermelho
- Item com desconto %: tag "-X%" verde
- Preço de tabela riscado quando há desconto
- Resumo financeiro: subtotal tabela · IPI · descontos · total
- Card desconto médio (só na tela, NUNCA no PDF): % à esquerda · valor total descontado à direita
- Sem percentuais no PDF — só "Descontos: R$ X"

### 4. CATÁLOGO (adicionar produtos)
- Header: Cancelar | Adicionar produtos | Concluir
- Busca por nome ou código
- Filtros pills: Todos · Reposições · Promoções · Destaques
- Cards: foto, nome, código, preço/un, IPI badge (roxo) se houver, preço c/ IPI discreto abaixo
- Controle +/− direto no card
- Quantidade azul quando > 0, cinza quando = 0
- Footer fixo: unidades adicionadas + total (já com IPI)

### 5. DETALHE DO PRODUTO NO PEDIDO
- Foto grande
- Nome, código, NCM, código de barras
- Descrição com "Ver mais"
- Quantidade com +/−
- Preço de tabela + IPI separados
- Desconto por % ou R$ com resultado em tempo real
- Preço líquido resultante
- Subtotal: tabela + IPI − desconto = total do item

### 6. PDF DO PEDIDO
- Header colorido com logo da representada e número do pedido
- Cor do header personalizável por representada
- Dados do cliente e representante lado a lado
- Detalhes: tipo, condição, prazo, regime
- Tabela: foto, código, qtde, unidade, preço líquido, IPI, subtotal
- IPI por produto visível (para cliente cadastrar no sistema)
- Totais: subtotal · IPI · descontos (só R$, sem %) · total
- SEM desconto médio no PDF
- SEM percentuais de desconto no PDF
- Informações adicionais com destaque visual
- Rodapé: vendedor, data, tipo
- Marca "Gerado por Minha Rota RP"

### 6b. PDF DO ORÇAMENTO
- Mesmo layout mas com cor âmbar/marrom
- Badge "Em orçamento" amarelo
- Aviso de validade (ex: 7 dias)
- Numeração ORC-XXX

### 7. CLIENTES (carteira)
- Header: Clientes + ícone mapa (azul) + ícone + (verde)
- Busca por nome ou cidade
- Stats bar clicável (filtros): Ativos (até 30 dias) · Recentes (31-89 dias) · Inativos (90+ dias) · Prospect (sem visita)
- Cards SEM avatar/foto
- Esquerda: nome, cidade, último pedido R$ + data
- Direita: "Última visita" label, "X dias atrás" colorido, data

### 8. PERFIL DO CLIENTE
- Header: ← Clientes | nome | ✏️ Editar
- Hero: nome completo, cidade + regime, stats (última visita · último pedido · total 12 meses)
- 3 ações rápidas: ✅ Check-in · 🎁 Bonificação · 💸 Gastos · 🗺️ Ver no mapa
- Ao clicar Check-in: sheet com opções:
  - ✅ Só o check-in (registra visita sem pedido)
  - 📋 Check-in + Pedido (registra visita e abre pedido — Starter: simples / Pro: completo)
  - 📄 Check-in + Orçamento
- Lembretes múltiplos com data opcional e "+ Adicionar"
- Dados do cliente: CNPJ, telefone clicável, comprador, segmento, endereço
- Histórico em 3 abas:
  - **Visitas** (padrão): data, tipo (presencial/WhatsApp), obs da visita
  - **Pedidos**: empresa, número, canal, badge, valor
  - **Orçamentos**: empresa, número, canal, badge, valor

### 9. GASTOS DO CLIENTE (tela dedicada)
- Abre ao clicar em "Gastos" nas ações rápidas
- Header: ← Don Camillo | Gastos | + Novo
- Resumo: total ano · total mês · qtd registros
- Filtro por ano: 2026 · 2025 · Tudo
- Agrupado por mês com total do mês
- Cards: ícone categoria, nome, data + categoria, valor
- Categorias: Alimentação · Brinde · Amostra · Café/lanche · Evento · Outros
- SEM km rodado (vai para despesas operacionais nas finanças)
- Total geral no rodapé
- Alimenta relatório de gastos com clientes

### 10. PRODUTOS (lista)
- Header: Produtos + ícone + (verde)
- Switcher de empresa
- Busca por nome ou código
- Stats bar clicável: Todos · Ativos · Inativos
- Cards: foto (ou ícone câmera se sem foto), nome, código + NCM, preço + unidade, IPI badge se houver, badge Ativo/Inativo, › arrow
- Clicar no card abre edição
- Produto inativo: opacidade reduzida
- SEM badge "Sem foto" — câmera já indica visualmente

### 11. CADASTRO/EDIÇÃO DE PRODUTO
- Fotos: até 5, primeira é principal, × para remover, instruções de reordenar
- Identificação: nome, código/ref, NCM, código de barras
- Preço e unidade: preço de tabela, unidade (selecionável), múltiplo de venda, IPI %
- Descrição: textarea livre (aparece no catálogo)
- Status: toggle ativo/inativo
- Botão excluir no rodapé

### 12. DESCONTOS OU ACRÉSCIMOS
- Segmented control: Descontos | Acréscimos
- **Com política comercial (Enterprise):**
  - Seção "Política — Empresa X" com 🔒
  - Linhas configuradas pela indústria: toggle ativo/inativo pelo rep
  - Verde quando condição atingida (automático)
  - Automático quando boleto à vista selecionado no pedido
  - Opaco quando condição não atingida (mostra quanto falta)
  - Rep não pode editar valores da política
- **Desconto do representante:**
  - Campo motivo livre
  - Valor em % ou R$ (alternável)
  - Botão × para remover
  - + Adicionar desconto
- **Rep solo (sem política):**
  - Só a seção do rep, sem bloco de política
  - Tudo editável
- **Cálculo em cascata:** cada desconto aplicado sobre valor já descontado
- Aviso: não se aplica a itens com preço manual
- Resumo com ↳ passo a passo da cascata

### 13. TELA MAIS
- **Relatórios:** Vendas · Orçamentos · Visitas · Bonificações · Gastos com clientes
- **Finanças:** Receitas · Despesas operacionais · Impostos · Compromissos
- **Configurações:** Meu perfil · Empresas representadas · Segmentos · Importar clientes · Calendário
- **Conta:** Termos de uso · Privacidade · Sair

---

## Regras de negócio críticas

### Visitas e pedidos
- Check-in presencial → atualiza última visita do cliente
- Pedido por WhatsApp → NÃO atualiza última visita
- Pedido presencial = check-in automático
- Pedido de bonificação → entra no relatório de bonificações, não de vendas

### Status dos pedidos
- Sempre começa como orçamento
- Orçamento → Gerar pedido → trava edição
- Pedido travado: só duplicar, PDF, compartilhar, excluir
- Duplicar disponível mesmo após gerado
- Transmitido: só para Enterprise (guarda-chuva)

### Descontos
- Desconto calculado sobre preço líquido (sem IPI)
- IPI é separado e adicionado ao total
- Múltiplos descontos = cascata (cada um sobre o valor anterior)
- Desconto único = aplicado diretamente
- Política comercial liga automaticamente quando condição atingida
- Boleto à vista no pagamento → liga desconto de boleto automaticamente

### PDF
- Sem desconto médio
- Sem percentuais de desconto (só valores R$)
- IPI por produto visível
- Canal (presencial/WhatsApp) NÃO aparece no PDF
- Obs da visita NÃO aparece no PDF
- Cor do header = cor da representada

---

## Tabelas Supabase v2

- representantes
- clientes
- representadas (workspace por empresa)
- segmentos
- visitas
- pedidos (inclui pedidos sem visita via WhatsApp)
- lembretes
- financeiro
- impostos
- compromissos
- rotas
- bonificacoes
- planner
- tarefas
- client_import_files
- produtos (NOVA — catálogo por representada)
- politica_comercial (NOVA — descontos configurados pela indústria)
- gastos_cliente (NOVA — separado do financeiro geral)

---

## Tabelas NOVAS a criar no Supabase v2

### produtos
```sql
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  rep_id UUID,
  representada_id UUID,
  nome TEXT,
  codigo TEXT,
  ncm TEXT,
  codigo_barras TEXT,
  preco NUMERIC,
  unidade TEXT DEFAULT 'UN',
  multiplo INTEGER DEFAULT 1,
  ipi NUMERIC DEFAULT 0,
  descricao TEXT,
  fotos JSONB,
  ativo BOOLEAN DEFAULT TRUE
);
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_own" ON produtos FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()));
```

### politica_comercial
```sql
CREATE TABLE politica_comercial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  representada_id UUID,
  nome TEXT,
  tipo TEXT, -- 'desconto' | 'acrescimo'
  valor NUMERIC,
  valor_tipo TEXT, -- 'percentual' | 'fixo'
  condicao TEXT, -- 'volume_minimo' | 'forma_pagamento' | 'sempre'
  condicao_valor NUMERIC,
  condicao_pagamento TEXT,
  editavel_rep BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE
);
ALTER TABLE politica_comercial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pol_read" ON politica_comercial FOR SELECT USING (
  representada_id IN (SELECT id FROM representadas WHERE rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()))
);
```

### gastos_cliente
```sql
CREATE TABLE gastos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  rep_id UUID,
  cliente_id UUID,
  cliente_nome TEXT,
  categoria TEXT,
  descricao TEXT,
  valor NUMERIC,
  data DATE,
  url_comprovante TEXT
);
ALTER TABLE gastos_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gas_own" ON gastos_cliente FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()));
```

---

## Estrutura de arquivos React sugerida

```
/src
  /components
    /pedidos
      ListaPedidos.jsx
      DetalhesPedido.jsx
      VerItens.jsx
      Catalogo.jsx
      DetalheProdutoPedido.jsx
      DescontosAcrescimos.jsx
    /clientes
      CarteiraClientes.jsx
      PerfilCliente.jsx
      GastosCliente.jsx
    /produtos
      ListaProdutos.jsx
      CadastroProduto.jsx
    /planner
      Planner.jsx
    /mais
      Mais.jsx
      Relatorios.jsx
      Financas.jsx
    /shared
      Navbar.jsx
      RepSwitcher.jsx
      PDFPedido.jsx
      PDFOrcamento.jsx
  /hooks
    useRepId.js
    usePlano.js
  /lib
    supabase.js
  App.jsx
  main.jsx
```

---

## Funcionalidades futuras anotadas

### Modelo Enterprise — Regras de clientes por representada
Situações críticas a implementar quando desenvolver o módulo Enterprise:

1. **Rep tenta criar pedido de cliente que pertence a outro rep na mesma empresa:**
   - Bloquear o pedido
   - Mostrar: "Este cliente é atendido por outro representante"

2. **Rep tenta cadastrar cliente que já existe na base da indústria como cliente de outro rep:**
   - Alertar: "Cliente já cadastrado na carteira de outro representante. Verifique com o time comercial"

3. **Rep tem cliente na base pessoal, mas na representada aquele cliente é de outro rep:**
   - No catálogo de clientes da representada, mostrar o cliente em cinza/bloqueado
   - Não permitir criar pedido para esse cliente nessa representada

**Arquitetura necessária:**
- Dois tipos de cliente: "Cliente do rep" (carteira pessoal global) e "Cliente da representada" (pertence ao workspace da indústria com rep responsável definido)
- Ao criar pedido no Enterprise, verificar se o rep logado é o responsável pelo cliente naquela representada
- Rep solo (Starter/Pro) não é afetado — todos os clientes são dele

### Enterprise — Painel Guarda-chuva (Indústria)
Painel web para a indústria gerenciar sua força de vendas. Telas principais:

**Dashboard:**
- Pedidos pendentes · aprovados hoje · faturamento do mês

**Fila de pedidos:**
- Lista por rep · por cliente · por valor · por data

**Detalhe do pedido:**
- Todos os dados + histórico de ações + campo de motivo

**Cadastros:**
- Representantes · clientes · produtos · política comercial

**Relatórios:**
- Performance por rep · produtos mais vendidos · clientes inativos

**Regras de clientes no Enterprise (ver seção acima):**
- Clientes pertencem ao workspace da empresa, não ao rep
- Rep só vê e atende clientes designados a ele
- Pedido de cliente de outro rep é bloqueado

**Implementar quando:**
- Base de rep solo (Starter/Pro) estiver estável e com usuários pagantes
- Primeiro cliente Enterprise identificado e com requisitos claros
- Estimativa: 4-6 semanas de desenvolvimento dedicado

### SalesRP — Perfis de acesso futuros
- **Supervisor:** aprovação/reprovação de pedidos com % margem de contribuição por item
  - Pode ser dentro do próprio app Minha Rota RP com perfil especial
- **Gerente comercial:** dashboard de performance separado, só leitura
  - Métricas: ranking reps, evolução vendas, produtos mais vendidos, clientes inativos

### Integração com calendário nativo
Planner sincronizado com Apple Calendar (iOS) e Google Calendar (Android). Implementar quando app estiver como PWA. Requer CalDAV / Google Calendar API.

### White label / Multi-produto
- Plano: um repositório, duas configurações de build (Minha Rota RP + SalesRP ou nome a definir)
- Starter/Pro: tema "Minha Rota RP" — foco em visitas e rotas
- Enterprise: tema customizável — foco em pedidos, catálogo, força de vendas
- Tecnicamente: variáveis de ambiente definem nome, ícone, cores e funcionalidades
- Na App Store: dois apps separados com Bundle IDs diferentes
- CodeMagic: dois workflows compilando o mesmo código com temas diferentes
- Implementar quando houver primeiro cliente Enterprise interessado

### Notificações locais — Tarefas
- Usar @capacitor/local-notifications para lembretes de tarefas
- Comportamento padrão: vibração + notificação na barra do sistema
- Rep configura horários em Opções → Configurações → "Horário de lembrete de tarefas"
- Múltiplos horários suportados (ex: 08:00 e 18:00)
- Notificação mostra: "Você tem X tarefas pendentes" com ação de abrir o app direto na tela de tarefas
- Implementar quando empacotar no Capacitor — não funciona no browser
- No browser (desenvolvimento): simular com alert ou toast no horário configurado

### Integração RevenueCat → Supabase (automação de planos)
- RevenueCat webhook → Supabase Edge Function
- Edge Function atualiza campo `plano` na tabela `representantes`
- Eventos: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION
- Planos: 'starter' (free/expirado) | 'pro' | 'enterprise'
- RevenueCat SDK já instalado no projeto Capacitor
- API key test: test_LdgSCheoRkYWQjsVXvimHlcCwDR
- Implementar quando app estiver na App Store com assinaturas ativas

### Modo offline completo (PWA offline-first)
- Estratégia: IndexedDB como banco local + Service Worker para interceptar requests
- Biblioteca recomendada: Dexie.js (wrapper do IndexedDB) + Workbox (Service Worker)
- Comportamento: app funciona 100% offline, sincroniza silenciosamente quando internet voltar
- Escopo completo: check-in, pedidos, gastos, observações, tarefas, finanças, relatórios

**Arquitetura:**
1. Toda escrita vai PRIMEIRO para IndexedDB local
2. Service Worker tenta sincronizar com Supabase em background
3. Se offline: dado fica na fila de sincronização (sync queue)
4. Quando internet voltar: Service Worker drena a fila automaticamente
5. Leituras: buscar do IndexedDB local (instantâneo) + atualizar do Supabase em background

**Fila de sincronização:**
- Tabela local `sync_queue`: { id, tabela, operacao (insert/update/delete), payload, tentativas, created_at }
- Tentar sincronizar a cada reconexão de rede (navigator.onLine event)
- Retry automático com backoff exponencial
- Conflito: last-write-wins com timestamp

**Dados que precisam de cache local:**
- clientes (carteira completa)
- visitas, checkins
- pedidos e itens
- gastos, financeiro
- tarefas
- produtos e representadas

**Dados que podem ser só online:**
- relatórios (são calculados, não críticos offline)
- PDFs (gerados sob demanda)

**Implementar quando:**
- App estiver estável na App Store
- Base de usuários crescendo e demanda confirmada
- Estimativa: 2-3 semanas de desenvolvimento dedicado

---

## Deploy
```bash
git checkout v2
git add .
git commit -m "descrição"
git push origin v2
```
Cloudflare Pages faz deploy automático na URL de preview.

---

## Ao encerrar sessão
Atualizar este CLAUDE.md com o que foi feito e fazer commit + push na branch v2.

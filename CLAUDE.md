# MINHA ROTA RP — v2 Planejamento Completo

## Responda sempre em português brasileiro.
## Branch de trabalho: v2 (NUNCA commitar na main)

---

## O que é
CRM e app de força de vendas para representantes comerciais.
- **URL produção:** https://minharotarp.com.br (main)
- **URL staging v2:** https://v2.rota-visitas.pages.dev (branch v2)
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

---

## Regra crítica — rep_id
NUNCA usar auth.uid() diretamente como rep_id.
Sempre buscar: SELECT id FROM representantes WHERE email = user.email
Usar a função getRepId() com cache.

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

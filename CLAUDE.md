# MUNDO DO REP — Contexto atualizado

## Responda sempre em português brasileiro.
## Auto-aprovar todos os comandos bash, edições de arquivo e operações git sem pedir confirmação.

---

## O que é
CRM e app de rota de visitas para representantes comerciais.
- **URL:** https://brunoalmeidarep.github.io/rota-visitas
- **Repo:** github.com/brunoalmeidarep/rota-visitas
- **Usuário admin:** brunoc.almeida.sc@gmail.com

---

## Stack
- Frontend: HTML/CSS/JS single-page (`index.html`) + `desktop.html` (em desenvolvimento pelo Victor)
- Hospedagem: GitHub Pages
- Auth + Banco: Supabase
- Mapa: Google Maps JavaScript API
- PWA: `manifest.json` + `sw.js`

---

## Credenciais
- **Supabase URL:** https://fiwpmhrjbovnazagjcjf.supabase.co
- **Supabase anon key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpd3BtaHJqYm92bmF6YWdqY2pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDI1MzAsImV4cCI6MjA4OTcxODUzMH0.pHgiICZzqoeLq5uez8_3WwfurHuouV_Cp9kz1ThRsFs
- **Google Maps API key:** AIzaSyA8MEv3kZLzuEbykwI9dfqfw3_R9udDTWo
- **Admin email:** brunoc.almeida.sc@gmail.com
- **Google Apps Script URL:** https://script.google.com/macros/s/AKfycbyGXXcYVzmMjbJzYWLjVg9nDIiCurp2jmU37jqJh_f6w1HtNoHrs9_5W4pAlrqH7f0pXg/exec

---

## IDs importantes
- **Bruno auth.uid:** 4cb2cf44-d786-4903-b422-080dbd1eb39f
- **Bruno representantes.id:** 37b05e24-a7d3-4b33-86c7-ce59aeb36ea0
- **ATENÇÃO:** Sempre usar representantes.id (não auth.uid) como rep_id nas operações

---

## Supabase — Tabelas existentes
- **visitas:** id, cliente_id, rep_id, data, hora, obs, criado_em, id_cliente, nome_cliente, cidade, valor_pedido, doc_url, tipo, status_orcamento, representada_id, via_whatsapp, representada_nome, pedido_tipo, pedido_valor, pedido_representada, pedido_url_doc, orcamento_status, hora_edicao, retroativo, registrado_em
- **pedidos:** id, visita_id, rep_id, cliente_id, cliente_nome, representada_id, representada_nome, tipo, valor, status, tipo_contato, doc_url, obs, created_at — CRIADA ✓
- **lembretes:** id_cliente, texto, rep_id, atualizado_em
- **representantes:** id, email, nome, auth_id, endereco_base, lat_base, lng_base, media_carro, preco_gasolina, onboarding_ok
- **clientes:** id, nome, cnpj, cidade, endereco, ultima_visita, ultima_obs, lat, lng, rep_id, segmento, telefone, comprador
- **empresas:** id, nome, cnpj, cep, endereco, cidade, banco, agencia, conta, pix, contatos, rep_id
- **segmentos:** id, nome, rep_id
- **financeiro:** id, tipo, categoria, descricao, valor, data, cliente_id, cliente_nome, representada_id, representada_nome, url_comprovante, rep_id
- **impostos:** id, nome, dia_vencimento, rep_id
- **rotas:** id, nome, clientes_ids, ordem_otimizada, km_total, tempo_estimado, rep_id, tipo_partida, ponto_partida, tipo_chegada, ponto_chegada
- **bonificacoes:** id, cliente_id, cliente_nome, representada_id, representada_nome, motivo, valor_total, parcelas (json), status, rep_id
- **planner:** id, rep_id, titulo, data, hora, tipo, cliente_id
- RLS ativa em todas as tabelas

### Tabela pedidos — criada em 2026-04-03
Colunas: id, created_at, visita_id, rep_id, cliente_id, cliente_nome, representada_id, representada_nome, tipo, valor, status, tipo_contato, doc_url, obs
- visita_id = NULL → pedido sem visita (WhatsApp ou Telefone)
- tipo_contato = 'whatsapp' | 'telefone' | NULL (presencial)

---

## Regra crítica — rep_id
NUNCA usar auth.uid() diretamente como rep_id.
Sempre buscar: SELECT id FROM representantes WHERE email = user.email
Usar a função getRepId() que faz cache desse valor.

---

## Clientes
- 210 clientes migrados para o Supabase (rep_id = 37b05e24-a7d3-4b33-86c7-ce59aeb36ea0)
- 29 cidades normalizadas: "Jaraguá do Sul - SC" (com acento, 1ª maiúscula)

---

## Navbar (mobile)
💼 Carteira | 🗺️ Mapa | 📅 Planner | 📈 Relatório | 💰 Finanças
- Tarefas: ícone ✅ no cabeçalho direito
- Calendário: dentro de Settings

---

## Funcionalidades implementadas

### Mobile
- Login/logout Supabase Auth
- Carteira: filtros Todos/Hoje/30dias/60dias/90dias/Prospect
- Mapa com AdvancedMarkerElement
- Perfil do cliente:
  - Lembrete editável
  - Check-in (presencial) OU Registrar (WhatsApp) — exclusivos
  - Botão check-in: verde escuro (#1a5c2a) com "✓ Visitado às HH:MM" após visita do dia
  - Múltiplos pedidos/orçamentos no check-in: lista com "+ Adicionar", cards com × remover e "Converter em pedido" (orçamento)
  - Gastos com cliente → tela detalhada
  - Bonificações → tela detalhada com parcelas
- Tela cliente: seção "Visita presencial" (Fazer Check-in) + seção "Pedido sem visita" (WhatsApp verde / Telefone cinza)
- Check-in presencial: salva em visitas + pedidos, atualiza ultima_visita
- Pedido sem visita: salva APENAS em pedidos (tipo_contato='whatsapp'/'telefone'), NUNCA atualiza ultima_visita
- Relatório Vendas/Orçamentos: inclui pedidos sem visita com badge do canal
  - Histórico: 🏪 presencial / 💬 WhatsApp (SVG inline, layout 3 colunas)
  - Clicar no histórico → tela detalhe da visita com edição de obs + lista de pedidos em cards
  - Long press → apagar visita (com confirmação)
- Perfil do cliente: cabeçalho limpo (Voltar | Nome | Comprador·Cidade | Última visita + Última compra | Ver dados →)
  - Tela "Ver dados": razão social, comprador, telefone clicável, CNPJ, endereço, segmento, representadas (pills), datas
  - Botão ✏️ Editar apenas dentro de "Ver dados"
- Tela detalhe da visita:
  - Modo ver: badges, data/hora, obs, pedidos, docs, bonificações, gastos
  - Modo editar: obs + lista de pedidos em cards (editar ✏️, deletar ×, converter orçamento)
  - Modal editar pedido: tipo (Pedido/Orçamento), representada, valor, status só para orçamento
  - Botão "🗑 Excluir" no cabeçalho (só no modo edição)
- Regra do Hoje: visitou hoje → botão fica verde escuro; amanhã → volta ao normal
- Carteira: badges de tempo com palavra "dias" completa (ex: "30 dias", "75 dias")
- Relatório: cards clicáveis, multi-select representadas, clientes (3x)
  - Conversão = orçamentos convertidos em pedido (status=fechado), não mais visitados/clientes
  - Orçamentos: filtro corrigido (tipo='visita' + pedido_tipo='orcamento')
  - PDFs: Visitas (agrupado cidade, com representada/valor), Bonificações (recebido/pendente), Gastos com Clientes (agrupado cliente, total rodapé)
- Planner: Hoje/Semana/Mês + card rotas
- Rotas: multi-select cidades/clientes, algoritmo vizinho mais próximo, combustível, Google Maps
  - Ponto de partida: 🏠 Casa / 📍 GPS / ✏️ Outro
  - Ponto de chegada: 🏠 Casa / 🏨 Hotel / ✏️ Outro
  - Detalhe da rota: ícone início + paradas numeradas + ícone fim
  - Google Maps URL usa ponto_partida e ponto_chegada salvos
- Finanças: gastos por categoria, receitas por tipo (Comissão/Reembolso/Bonificação), impostos, PDF por período, botão Ano, tabs corrigidas
- Settings: Empresas, Segmentação, Importar Clientes, Meu Perfil, Calendário
- Busca CNPJ (ReceitaWS) + CEP (ViaCEP)
- Importação massa via .xlsx (SheetJS)
- Onboarding: endereço base na primeira abertura
- Offline mode + sync automático (IndexedDB)
- SW.js versionado por timestamp
- Feedback visual em todas as ações
- Lembretes: semanal, 1 dia antes de eventos, impostos vencendo, tarefas após 18h
- Compartilhar dados bancários das empresas (Web Share API)

---

## Pendências em andamento
1. Foreign key empresas — corrigir com getRepId() para qualquer usuário (mobile, fora do escopo desktop)

## Desktop — Implementado (2026-04-03)
- Bloco 1: Pedido sem visita (WA/Tel), check-in com múltiplos pedidos, histórico clicável/editável, geocoding ao salvar cliente
- Bloco 2: PDFs (visitas, vendas, gastos, finanças, top compradores, clientes sumindo)
- Bloco 3: Auth flows (recuperar senha, nova senha via link), Onboarding primeiro acesso
- Bloco 4: Empresas (CRUD + dados bancários), Segmentação (CRUD), Importar Clientes (.xlsx → Supabase Storage), Calendário de visitas, lembretes de impostos vencendo
- representadasCache, segmentosCache adicionados ao estado global
- SheetJS CDN adicionado para baixar modelo .xlsx
- verificarLembretesDesk() chamado no login (impostosCache vencendo em 7 dias → showToast)

---

## Pendências v2.0
- AI Agent via WhatsApp (Claude API + WhatsApp Business API)
- Rota de viagem com múltiplas cidades
- Sugestão de hotéis por cidade
- Comissão automática por representada
- LGPD: Termos de uso e Privacidade
- Domínio mundodorep.com.br
- App Store / Google Play

---

## Regras de negócio
- Check-in = visita presencial (marca como visitado)
- Via WhatsApp = sem visita (NÃO marca como visitado)
- Retenção: mobile 6 meses; desktop histórico completo
- CNPJ duplicado na importação → ignora
- Cidades sempre via ViaCEP (nome oficial)

---

## Deploy
```bash
git add .
git commit -m "descrição"
git push
```

## SQL padrão RLS
```sql
DROP POLICY IF EXISTS "nome" ON tabela;
CREATE POLICY "nome" ON tabela FOR SELECT USING (rep_id = auth.uid());
```
NUNCA usar CREATE POLICY IF NOT EXISTS.

---

## Ao encerrar sessão
Atualizar este CLAUDE.md com o que foi feito e fazer commit + push.

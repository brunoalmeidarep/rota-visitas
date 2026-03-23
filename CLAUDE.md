# MUNDO DO REP — Contexto do Projeto

Sempre responda em português brasileiro, independente do idioma usado na pergunta.

## O que é
App de rota de visitas comerciais para representante Menegotti (Bruno Almeida, Pomerode/SC).
- **URL:** https://brunoalmeidarep.github.io/rota-visitas
- **Repo:** github.com/brunoalmeidarep/rota-visitas

---

## Stack
- **Frontend:** HTML/CSS/JS single-page (`index.html`)
- **Hospedagem:** GitHub Pages (gratuito)
- **Auth + Banco:** Supabase
- **Mapa:** Google Maps JavaScript API
- **PWA:** `manifest.json` + `sw.js` (service worker simplificado, sem cache)

---

## Credenciais
- **Supabase URL:** https://fiwpmhrjbovnazagjcjf.supabase.co
- **Supabase anon key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpd3BtaHJqYm92bmF6YWdqY2pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDI1MzAsImV4cCI6MjA4OTcxODUzMH0.pHgiICZzqoeLq5uez8_3WwfurHuouV_Cp9kz1ThRsFs
- **Google Maps API key:** AIzaSyA8MEv3kZLzuEbykwI9dfqfw3_R9udDTWo (restrita ao domínio brunoalmeidarep.github.io)
- **Admin email:** brunoc.almeida.sc@gmail.com
- **Google Apps Script URL:** https://script.google.com/macros/s/AKfycbyGXXcYVzmMjbJzYWLjVg9nDIiCurp2jmU37jqJh_f6w1HtNoHrs9_5W4pAlrqH7f0pXg/exec

---

## Supabase — Tabelas
- **visitas:** id_cliente, nome_cliente, cidade, data, hora, obs, rep_id
- **lembretes:** id_cliente, texto, rep_id, atualizado_em (UNIQUE: id_cliente+rep_id)
- **representantes:** dados dos reps
- **clientes:** tabela criada, ainda não populada (migração pendente)
- Políticas RLS ativas em todas as tabelas

---

## Clientes
- 210 clientes no array hardcoded no JS (função `loadDemo`)
- Campos: id, nome, cnpj, cidade, endereco, ultimaVisita, ultimaObs, lat, lng
- Nome com comprador entre parênteses ex: "Julio Mat. Construção (Julho)"
- Status por cor: hoje=verde, ≤30d=azul, 31-60d=laranja, >60d=vermelho, nunca=roxo
- Cidades normalizadas com acento e só 1ª maiúscula: "Jaraguá do Sul - SC"

---

## Funcionalidades implementadas (mobile ✅)
- Login/logout com Supabase Auth
- Lista de clientes com separadores por grupo e busca
- Filtro por cidade (pill clicável)
- Mapa Google Maps com pins coloridos
- Perfil do cliente: lembrete fixo editável, obs da visita, histórico
- Check-in salvo no Supabase (tabela visitas)
- Lembretes salvos no Supabase (tabela lembretes)
- Relatório: grid Hoje/Semana/Mês, progresso do mês, visitados hoje, cidades
- Calendário: navega meses, dias coloridos por qtd visitas, lista do dia
- Menu configurações: admin, novo cliente, exportar coords, versão, logout
- Painel Admin: lista reps, criar novo representante
- Cadastro de novo cliente com GPS + busca automática por CEP (ViaCEP)
- Navegação segura: ESC fecha qualquer tela
- Histórico carregado do Supabase ao abrir perfil
- Tema claro/escuro automático (prefers-color-scheme)
- PWA instalável no iPhone
- Segmento de cliente (mat. construção, construtora, tintas, distribuidora)

## Desktop (⚠️ em ajuste)
- Layout 3 colunas: sidebar lista | mapa central | painel detalhe
- Abas: Mapa & Lista | Planner | Tarefas | Relatório
- Sistema unificado: dtInit, dtRenderList, dtSelectCliente, dtMostrarDetalhe, dtCheckin, dtTab
- Contadores no header: Carteira | Hoje | 1m | 2m | +2m | Novos
- Lembrete editável e campo de obs no painel detalhe
- Relatório desktop com grid 3 colunas
- **PRÓXIMO PASSO:** separar em desktop.html independente

---

## Arquivos no repositório
```
index.html       — app principal mobile (~4500 linhas)
manifest.json    — PWA manifest
sw.js            — service worker (sem cache, passa tudo direto)
icon-192.png
icon-512.png
CLAUDE.md        — este arquivo
```

---

## Próximas tarefas (prioridade)
1. **Migrar clientes pro Supabase** — tirar array hardcoded do JS, buscar do banco
2. **Criar desktop.html separado** — interface desktop independente, mesma base Supabase
3. **Rota otimizada** — Google Routes API com waypoints, o rep seleciona cidade + clientes do dia e o app sugere a ordem de visita
4. **Ajustes desktop** — layout ainda não está 100%

---

## Regras de negócio
- Semana sempre de domingo a sábado
- Progresso do relatório = clientes visitados no mês / total carteira
- Check-in do dia: visitadoHoje=true, horaHoje="HH:MM"
- Lembrete = fixo por cliente (não por visita)
- Obs = por visita (salva no check-in)
- Cliente PEKA: a cada Extrakolla 2 vendida, bonificar R$0,90; a cada Hiperkolla 3 vendida, bonificar R$1,20

---

## Como fazer deploy
Após qualquer alteração nos arquivos:
```bash
git add .
git commit -m "descrição da alteração"
git push
```
GitHub Pages publica automaticamente em ~1 minuto.

Para testar no Chrome após deploy:
- F12 → Application → Clear site data → Ctrl+Shift+R

Para testar no iPhone:
- Ajustes → Apps → Safari → Limpar histórico e dados

---

## Tech notes
- SDK Supabase: cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.js
- Google Maps: carregado dinamicamente no INIT (não no head)
- `activeFilter` declarado como `var` (não `let`) para evitar TDZ
- `#dt-wrap` fica `display:none` fora do media query, `display:flex` dentro do @media (min-width:768px)
- Service worker desativado (passa tudo direto, sem cache)
- CEP: usa API ViaCEP gratuita (viacep.com.br), sem chave

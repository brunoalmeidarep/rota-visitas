-- =====================================================
-- SUPABASE FINAL — Mundo do Rep
-- Execute no SQL Editor do painel Supabase
-- Seguro para re-executar: só cria o que não existe.
-- =====================================================

-- ── 0. COLUNAS EXTRAS em representantes ──────────────
-- (caso não tenham sido adicionadas pelos scripts anteriores)
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS endereco_base  TEXT;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS lat_base       NUMERIC;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS lng_base       NUMERIC;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS media_carro    NUMERIC DEFAULT 10;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS preco_gasolina NUMERIC DEFAULT 6.0;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS onboarding_ok  BOOLEAN DEFAULT FALSE;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS impostos_ok    BOOLEAN DEFAULT FALSE;

-- ── 1. TABELA clientes ────────────────────────────────
-- rep_id → auth.users (usa auth.uid() no app)
CREATE TABLE IF NOT EXISTS clientes (
  id            BIGINT PRIMARY KEY,
  rep_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  razao_social  TEXT,
  fantasia      TEXT,
  cnpj          TEXT,
  comprador     TEXT,
  telefone      TEXT,
  email         TEXT,
  endereco      TEXT,
  cidade        TEXT,
  cep           TEXT,
  lat           NUMERIC,
  lng           NUMERIC,
  segmento      TEXT,
  ultima_visita DATE,
  ultima_obs    TEXT DEFAULT '',
  criado_em     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rep lê seus clientes"       ON clientes;
DROP POLICY IF EXISTS "Rep insere seus clientes"   ON clientes;
DROP POLICY IF EXISTS "Rep atualiza seus clientes" ON clientes;
DROP POLICY IF EXISTS "Rep deleta seus clientes"   ON clientes;
CREATE POLICY "Rep lê seus clientes"
  ON clientes FOR SELECT TO authenticated
  USING (rep_id = auth.uid());
CREATE POLICY "Rep insere seus clientes"
  ON clientes FOR INSERT TO authenticated
  WITH CHECK (rep_id = auth.uid());
-- UPDATE: permite também rep_id IS NULL para auto-migração via app
CREATE POLICY "Rep atualiza seus clientes"
  ON clientes FOR UPDATE TO authenticated
  USING (rep_id = auth.uid() OR rep_id IS NULL)
  WITH CHECK (rep_id = auth.uid());
CREATE POLICY "Rep deleta seus clientes"
  ON clientes FOR DELETE TO authenticated
  USING (rep_id = auth.uid());

-- ── 2. TABELA segmentos ───────────────────────────────
-- rep_id → auth.users (usa auth.uid() no app)
CREATE TABLE IF NOT EXISTS segmentos (
  id        BIGSERIAL PRIMARY KEY,
  rep_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE segmentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep acessa seus segmentos" ON segmentos;
CREATE POLICY "rep acessa seus segmentos"
  ON segmentos FOR ALL TO authenticated
  USING (rep_id = auth.uid())
  WITH CHECK (rep_id = auth.uid());

-- ── 3. TABELA representadas (Empresas) ───────────────
-- rep_id → auth.users (app usa currentUser.id)
CREATE TABLE IF NOT EXISTS representadas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cnpj        TEXT,
  cep         TEXT,
  endereco    TEXT,
  cidade      TEXT,
  banco       TEXT,
  agencia     TEXT,
  conta       TEXT,
  pix         TEXT,
  fin_nome    TEXT,
  fin_tel     TEXT,
  com_nome    TEXT,
  com_tel     TEXT,
  fis_nome    TEXT,
  fis_tel     TEXT,
  fat_nome    TEXT,
  fat_tel     TEXT,
  criado_em   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE representadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep acessa suas empresas"   ON representadas;
DROP POLICY IF EXISTS "rep owns representadas"     ON representadas;
DROP POLICY IF EXISTS "rep acessa suas representadas" ON representadas;
CREATE POLICY "rep acessa suas empresas"
  ON representadas FOR ALL TO authenticated
  USING (rep_id = auth.uid())
  WITH CHECK (rep_id = auth.uid());

-- ── 4. TABELA financeiro ──────────────────────────────
-- rep_id → representantes.id (app usa currentRep.id)
CREATE TABLE IF NOT EXISTS financeiro (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo             TEXT NOT NULL CHECK (tipo IN ('receita','gasto')),
  categoria        TEXT NOT NULL,
  descricao        TEXT,
  valor            NUMERIC(10,2) NOT NULL,
  data             DATE NOT NULL DEFAULT CURRENT_DATE,
  representada_id  UUID REFERENCES representadas(id) ON DELETE SET NULL,
  cliente_id       TEXT,
  url_comprovante  TEXT,
  mes_referencia   TEXT,
  hotel_nome       TEXT,
  hotel_cidade     TEXT,
  hotel_estrelas   SMALLINT CHECK (hotel_estrelas BETWEEN 1 AND 5),
  rep_id           UUID REFERENCES representantes(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep owns financeiro" ON financeiro;
CREATE POLICY "rep owns financeiro"
  ON financeiro FOR ALL
  USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));
-- Índice para busca de hospedagem por cidade (modal de rota)
CREATE INDEX IF NOT EXISTS idx_financeiro_hospedagem
  ON financeiro (rep_id, categoria, hotel_cidade)
  WHERE categoria = 'Hospedagem';

-- ── 5. TABELA impostos ────────────────────────────────
-- rep_id → representantes.id (app usa currentRep.id)
CREATE TABLE IF NOT EXISTS impostos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome            TEXT NOT NULL,
  dia_vencimento  INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  rep_id          UUID REFERENCES representantes(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE impostos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep owns impostos" ON impostos;
CREATE POLICY "rep owns impostos"
  ON impostos FOR ALL
  USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

-- ── 6. TABELA rotas ───────────────────────────────────
-- rep_id → representantes.id (app usa currentRep.id)
CREATE TABLE IF NOT EXISTS rotas (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome             TEXT NOT NULL,
  clientes_ids     TEXT[] DEFAULT '{}',
  ordem_otimizada  TEXT[] DEFAULT '{}',
  km_total         NUMERIC(8,2),
  tempo_estimado   INTEGER,
  status           TEXT DEFAULT 'ativa',
  rep_id           UUID REFERENCES representantes(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep owns rotas" ON rotas;
CREATE POLICY "rep owns rotas"
  ON rotas FOR ALL
  USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

-- ── 7. COLUNAS de hospedagem em financeiro ────────────
-- (caso a tabela já existia sem essas colunas)
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS hotel_nome     TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS hotel_cidade   TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS hotel_estrelas SMALLINT CHECK (hotel_estrelas BETWEEN 1 AND 5);

-- ── 8. FK representada_id em visitas ─────────────────
-- (coluna adicionada em versão posterior)
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS representada_id UUID REFERENCES representadas(id) ON DELETE SET NULL;

-- =====================================================
-- DIAGNÓSTICO (opcional — rode para verificar)
-- =====================================================
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT count(*) FROM clientes;
-- SELECT rep_id, count(*) FROM clientes GROUP BY rep_id;
-- SELECT id, email FROM auth.users WHERE email = 'brunoc.almeida.sc@gmail.com';

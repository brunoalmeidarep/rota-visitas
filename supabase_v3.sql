-- =====================================================
-- SUPABASE V3 — Mundo do Rep
-- Execute no SQL Editor do painel Supabase
-- =====================================================

-- ── 1. TABELA representadas (Empresas / Representadas) ──
CREATE TABLE IF NOT EXISTS representadas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
  rep_id      UUID REFERENCES representantes(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE representadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "rep owns representadas" ON representadas
  FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

-- ── 2. COLUNAS NOVAS em representantes ──
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS endereco_base  TEXT;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS lat_base       NUMERIC;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS lng_base       NUMERIC;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS media_carro    NUMERIC DEFAULT 10;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS preco_gasolina NUMERIC DEFAULT 6.0;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS onboarding_ok  BOOLEAN DEFAULT FALSE;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS impostos_ok    BOOLEAN DEFAULT FALSE;

-- ── 3. TABELA financeiro ──
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
  rep_id           UUID REFERENCES representantes(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "rep owns financeiro" ON financeiro
  FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

-- ── 4. TABELA impostos ──
CREATE TABLE IF NOT EXISTS impostos (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome            TEXT NOT NULL,
  dia_vencimento  INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  rep_id          UUID REFERENCES representantes(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE impostos ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "rep owns impostos" ON impostos
  FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

-- ── 5. TABELA rotas ──
CREATE TABLE IF NOT EXISTS rotas (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome              TEXT NOT NULL,
  clientes_ids      TEXT[] DEFAULT '{}',
  ordem_otimizada   TEXT[] DEFAULT '{}',
  km_total          NUMERIC(8,2),
  tempo_estimado    INTEGER,
  status            TEXT DEFAULT 'ativa',
  rep_id            UUID REFERENCES representantes(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "rep owns rotas" ON rotas
  FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

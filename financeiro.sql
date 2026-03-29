-- =====================================================
-- TABELA financeiro — Mundo do Rep
-- Execute no SQL Editor do painel Supabase
-- Seguro para re-executar (IF NOT EXISTS + ADD COLUMN IF NOT EXISTS)
-- =====================================================

CREATE TABLE IF NOT EXISTS financeiro (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo             TEXT NOT NULL CHECK (tipo IN ('receita','gasto')),
  categoria        TEXT NOT NULL,
  descricao        TEXT,
  valor            NUMERIC(10,2) NOT NULL,
  data             DATE NOT NULL DEFAULT CURRENT_DATE,
  cliente_id       TEXT,
  cliente_nome     TEXT,
  representada_id  UUID REFERENCES representadas(id) ON DELETE SET NULL,
  representada_nome TEXT,
  url_comprovante  TEXT,
  mes_referencia   TEXT,
  hotel_nome       TEXT,
  hotel_cidade     TEXT,
  hotel_estrelas   SMALLINT CHECK (hotel_estrelas BETWEEN 1 AND 5),
  rep_id           UUID REFERENCES representantes(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Colunas que podem faltar em instalações anteriores
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS cliente_nome      TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS cliente_id        TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS representada_nome TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS hotel_nome        TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS hotel_cidade      TEXT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS hotel_estrelas    SMALLINT;
ALTER TABLE financeiro ADD COLUMN IF NOT EXISTS mes_referencia    TEXT;

ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rep owns financeiro" ON financeiro;
CREATE POLICY "rep owns financeiro"
  ON financeiro FOR ALL
  USING  (rep_id = (SELECT id FROM representantes WHERE email = auth.email()))
  WITH CHECK (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

-- Índices
CREATE INDEX IF NOT EXISTS idx_financeiro_rep_cat
  ON financeiro (rep_id, categoria);

CREATE INDEX IF NOT EXISTS idx_financeiro_hospedagem
  ON financeiro (rep_id, categoria, hotel_cidade)
  WHERE categoria = 'Hospedagem';

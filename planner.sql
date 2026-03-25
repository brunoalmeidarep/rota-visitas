-- =====================================================
-- TABELA planner — Mundo do Rep
-- Execute no SQL Editor do painel Supabase
-- =====================================================

CREATE TABLE IF NOT EXISTS planner (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_id        UUID REFERENCES representantes(id) ON DELETE CASCADE,
  data          DATE NOT NULL,
  cidades       TEXT,
  notas         TEXT,
  eventos       JSONB DEFAULT '[]',
  titulo        TEXT,
  hora          TEXT,
  tipo          TEXT DEFAULT 'compromisso',
  cliente_id    INTEGER,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rep_id, data)
);

ALTER TABLE planner ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rep owns planner" ON planner;
CREATE POLICY "rep owns planner"
  ON planner FOR ALL
  USING  (rep_id = (SELECT id FROM representantes WHERE email = auth.email()))
  WITH CHECK (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

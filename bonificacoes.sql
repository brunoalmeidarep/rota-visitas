-- =====================================================
-- TABELA bonificacoes — Mundo do Rep
-- Execute no SQL Editor do painel Supabase
-- =====================================================

CREATE TABLE IF NOT EXISTS bonificacoes (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id       TEXT NOT NULL,
  cliente_nome     TEXT,
  representada_id  UUID REFERENCES representadas(id) ON DELETE SET NULL,
  representada_nome TEXT,
  motivo           TEXT NOT NULL,
  valor_total      NUMERIC(10,2) NOT NULL,
  data_combinada   DATE,
  parcelas         JSONB DEFAULT '[]',
  status           TEXT DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluida')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bonificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rep lê suas bonificacoes"    ON bonificacoes;
DROP POLICY IF EXISTS "rep insere bonificacoes"     ON bonificacoes;
DROP POLICY IF EXISTS "rep atualiza bonificacoes"   ON bonificacoes;
DROP POLICY IF EXISTS "rep deleta bonificacoes"     ON bonificacoes;

CREATE POLICY "rep lê suas bonificacoes"
  ON bonificacoes FOR SELECT TO authenticated
  USING (rep_id = auth.uid());

CREATE POLICY "rep insere bonificacoes"
  ON bonificacoes FOR INSERT TO authenticated
  WITH CHECK (rep_id = auth.uid());

CREATE POLICY "rep atualiza bonificacoes"
  ON bonificacoes FOR UPDATE TO authenticated
  USING (rep_id = auth.uid())
  WITH CHECK (rep_id = auth.uid());

CREATE POLICY "rep deleta bonificacoes"
  ON bonificacoes FOR DELETE TO authenticated
  USING (rep_id = auth.uid());

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_bonificacoes_rep_cliente
  ON bonificacoes (rep_id, cliente_id);

CREATE INDEX IF NOT EXISTS idx_bonificacoes_status
  ON bonificacoes (rep_id, status);

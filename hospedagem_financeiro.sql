-- =====================================================
-- HOSPEDAGEM: colunas extras na tabela financeiro
-- Execute no SQL Editor do painel Supabase
-- =====================================================

ALTER TABLE financeiro
  ADD COLUMN IF NOT EXISTS hotel_nome    TEXT,
  ADD COLUMN IF NOT EXISTS hotel_cidade  TEXT,
  ADD COLUMN IF NOT EXISTS hotel_estrelas SMALLINT CHECK (hotel_estrelas BETWEEN 1 AND 5);

-- Índice para busca de histórico de hospedagem por cidade (usada no modal de rota)
CREATE INDEX IF NOT EXISTS idx_financeiro_hospedagem
  ON financeiro (rep_id, categoria, hotel_cidade)
  WHERE categoria = 'Hospedagem';

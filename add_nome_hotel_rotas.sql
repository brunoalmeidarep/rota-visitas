-- Adicionar colunas à tabela rotas (se não existirem)
-- Execute no SQL Editor do painel Supabase
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS tipo_partida text DEFAULT 'casa';
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS ponto_partida text;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS tipo_chegada text DEFAULT 'casa';
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS ponto_chegada text;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS nome_hotel text;

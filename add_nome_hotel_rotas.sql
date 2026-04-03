-- Adicionar colunas à tabela rotas (se não existirem)
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS ponto_partida text DEFAULT 'casa';
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS ponto_chegada text DEFAULT 'casa';
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS nome_hotel text;

-- =====================================================
-- FIX: colunas faltando na tabela visitas
-- Execute no SQL Editor do painel Supabase
-- Seguro para re-executar (IF NOT EXISTS).
-- =====================================================

-- Colunas novas usadas pelo checkin principal (tela de perfil)
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS pedido_tipo        TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS pedido_valor       NUMERIC(12,2);
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS pedido_representada TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS pedido_url_doc     TEXT;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS orcamento_status   TEXT;

-- =====================================================
-- DIAGNÓSTICO (opcional)
-- =====================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'visitas'
-- ORDER BY ordinal_position;

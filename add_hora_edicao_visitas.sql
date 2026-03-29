-- =====================================================
-- Adiciona coluna hora_edicao na tabela visitas
-- Execute no SQL Editor do painel Supabase
-- Seguro para re-executar.
-- =====================================================
-- Guarda o horário da última edição do check-in do dia.
-- Exibido no histórico como "editado às HH:MM".
-- Null = não houve edição após o check-in original.
-- =====================================================

ALTER TABLE visitas ADD COLUMN IF NOT EXISTS hora_edicao text;

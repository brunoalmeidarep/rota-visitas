-- ============================================================
-- MUNDO DO REP — Setup Supabase
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- 1. Adicionar colunas na tabela existente "visitas"
--    (executa apenas se ainda não existirem)

ALTER TABLE visitas
  ADD COLUMN IF NOT EXISTS valor_pedido  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS doc_url       TEXT,
  ADD COLUMN IF NOT EXISTS tipo          TEXT DEFAULT 'visita',  -- 'visita' | 'remoto' | 'orcamento'
  ADD COLUMN IF NOT EXISTS status_orcamento TEXT;               -- 'aberto' | 'fechado' | 'perdido'

-- Índice para consultas por tipo
CREATE INDEX IF NOT EXISTS idx_visitas_tipo ON visitas(tipo);
CREATE INDEX IF NOT EXISTS idx_visitas_status_orc ON visitas(status_orcamento) WHERE tipo = 'orcamento';

-- ============================================================
-- 2. Bucket "documentos" no Supabase Storage
-- ============================================================
-- Execute via SQL (usando a extensão storage):

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Política: representante autenticado pode fazer upload
CREATE POLICY "Rep pode upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Política: leitura pública dos documentos
CREATE POLICY "Leitura pública" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'documentos');

-- ============================================================
-- 3. RLS na tabela visitas (caso ainda não tenha)
-- ============================================================
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;

-- Rep lê apenas suas próprias visitas
DROP POLICY IF EXISTS "Rep lê suas visitas" ON visitas;
CREATE POLICY "Rep lê suas visitas" ON visitas
  FOR SELECT TO authenticated USING (rep_id = auth.uid());

-- Rep insere apenas suas visitas
DROP POLICY IF EXISTS "Rep insere suas visitas" ON visitas;
CREATE POLICY "Rep insere suas visitas" ON visitas
  FOR INSERT TO authenticated WITH CHECK (rep_id = auth.uid());

-- Rep atualiza apenas suas visitas
DROP POLICY IF EXISTS "Rep atualiza suas visitas" ON visitas;
CREATE POLICY "Rep atualiza suas visitas" ON visitas
  FOR UPDATE TO authenticated USING (rep_id = auth.uid());

-- ============================================================
-- OBSERVAÇÕES:
-- • O bucket "documentos" é público (URL pública para visualizar anexos)
-- • Os arquivos são armazenados com o path: {rep_id}/{prefixo}_{timestamp}.{ext}
-- • O código usa sb.storage.from('documentos') para upload
--   (ou sb.storage.from('pedidos') — ajuste conforme o bucket criado)
-- ============================================================

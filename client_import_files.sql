-- =====================================================
-- Infraestrutura base para importação em massa de clientes
-- Execute no SQL Editor do painel Supabase
-- Seguro para re-executar (ON CONFLICT / IF NOT EXISTS).
--
-- O que este script faz:
--   1. Cria o bucket privado no Storage para armazenar os
--      arquivos Excel originais enviados pelos usuários.
--   2. Cria as policies de Storage (upload e leitura por pasta
--      própria do usuário).
--   3. Cria a tabela de controle client_import_files.
--   4. Ativa RLS na tabela.
--   5. Cria policies de tabela (INSERT + SELECT + UPDATE).
--
-- PRÓXIMOS PASSOS (não implementados aqui de propósito):
--   - Parsing do Excel
--   - Webhook/observação pelo Make
--   - Processamento e padronização dos dados
--   - Inserção na tabela final de clientes
-- =====================================================


-- =====================================================
-- 1. BUCKET — client-import-originals
-- =====================================================
-- Bucket privado (public = false): arquivos só são acessíveis
-- por quem tem permissão explícita via Storage policies abaixo.
-- Limite de 10 MB por arquivo — suficiente para planilhas grandes.
-- Tipos aceitos: .xlsx e .xls apenas.
-- =====================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-import-originals',
  'client-import-originals',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  -- .xlsx
    'application/vnd.ms-excel'                                            -- .xls
  ]
)
ON CONFLICT (id) DO NOTHING;


-- =====================================================
-- 2. STORAGE POLICIES — client-import-originals
-- =====================================================
-- Convenção de path: {auth.uid()}/{filename}
-- Cada usuário só acessa sua própria pasta.
-- Sem policy pública de leitura ou escrita.
-- =====================================================

-- Remove policies anteriores se existirem
DROP POLICY IF EXISTS "users can upload own imports"  ON storage.objects;
DROP POLICY IF EXISTS "users can read own imports"    ON storage.objects;
DROP POLICY IF EXISTS "users can delete own imports"  ON storage.objects;

-- Usuário autenticado pode fazer upload na sua pasta
CREATE POLICY "users can upload own imports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-import-originals'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuário autenticado pode ler apenas arquivos da sua própria pasta
CREATE POLICY "users can read own imports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-import-originals'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuário autenticado pode deletar apenas os próprios arquivos
-- (útil para reenvio ou limpeza, sem depender de serviço externo)
CREATE POLICY "users can delete own imports"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-import-originals'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- =====================================================
-- 3. TABELA — client_import_files
-- =====================================================
-- Registra cada importação realizada: quem enviou, onde está
-- o arquivo, qual o status e métricas de linhas.
-- Campos de status previstos (não todos usados agora):
--   uploaded       → arquivo recebido, aguardando processamento
--   processing     → Make está processando
--   processed      → dados tratados e inseridos com sucesso
--   failed         → falha no processamento
--   needs_review   → processado mas com itens para revisar
-- =====================================================

CREATE TABLE IF NOT EXISTS client_import_files (
  id                uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid         NOT NULL,                   -- auth.uid() de quem fez o upload
  original_filename text         NOT NULL,                   -- nome original do arquivo (.xlsx)
  storage_bucket    text         NOT NULL,                   -- 'client-import-originals'
  storage_path      text         NOT NULL,                   -- '{user_id}/{filename}' no bucket
  status            text         NOT NULL DEFAULT 'uploaded',-- ciclo de vida da importação
  total_rows        integer      DEFAULT 0,
  valid_rows        integer      DEFAULT 0,
  error_rows        integer      DEFAULT 0,
  created_at        timestamptz  DEFAULT now(),
  processed_at      timestamptz  NULL
);


-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE client_import_files ENABLE ROW LEVEL SECURITY;

-- Remove policies anteriores
DROP POLICY IF EXISTS "user insere propria importacao"    ON client_import_files;
DROP POLICY IF EXISTS "user ve proprias importacoes"      ON client_import_files;
DROP POLICY IF EXISTS "user atualiza propria importacao"  ON client_import_files;


-- =====================================================
-- 5. POLICIES DE TABELA
-- =====================================================

-- INSERT: usuário só pode registrar com o próprio user_id
CREATE POLICY "user insere propria importacao"
  ON client_import_files FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- SELECT: usuário só vê suas próprias importações
CREATE POLICY "user ve proprias importacoes"
  ON client_import_files FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- UPDATE: permitido apenas nas próprias importações.
-- Decisão: habilitado mesmo nesta fase porque o Make vai precisar
-- atualizar status e métricas (total_rows, valid_rows, etc.)
-- depois do processamento — e o app pode querer mostrar o progresso.
-- Sem WITH CHECK extra: basta o USING garantir que é a própria linha.
CREATE POLICY "user atualiza propria importacao"
  ON client_import_files FOR UPDATE TO authenticated
  USING (user_id = auth.uid());


-- =====================================================
-- DIAGNÓSTICO (opcional — rode para verificar)
-- =====================================================
-- SELECT id, name, public FROM storage.buckets WHERE id = 'client-import-originals';
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'client_import_files';
-- SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'client_import_files' ORDER BY ordinal_position;

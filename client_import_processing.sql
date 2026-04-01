-- =====================================================
-- Preparação do backend para processamento automatizado
-- de importações de clientes (fase 2 — Make integration)
-- Execute no SQL Editor do painel Supabase
-- Seguro para re-executar.
--
-- O que este script faz:
--   1. Adiciona colunas de rastreabilidade em client_import_files
--        started_at   — quando o Make iniciou o processamento
--        error_summary — resumo legível de falha (preenchido pelo Make)
--   2. Adiciona CHECK constraint nos valores válidos de status
--   3. Cria index parcial em status para polling eficiente pelo Make
--   4. Adiciona COMMENTs na tabela e colunas
--   5. Ajusta a UPDATE policy do usuário (restringe a cancelar apenas)
--   6. Cria tabela client_import_errors para erros por linha do Excel
--   7. Ativa RLS em client_import_errors e cria policy de leitura
--
-- Contexto de segurança:
--   O Make usa a service role key do Supabase, que bypassa RLS.
--   As policies abaixo protegem apenas o lado do app (usuário autenticado).
--   O Make pode UPDATE/INSERT livremente via service role.
-- =====================================================


-- =====================================================
-- 1. NOVAS COLUNAS em client_import_files
-- =====================================================

ALTER TABLE client_import_files
  ADD COLUMN IF NOT EXISTS started_at    timestamptz  NULL,
  ADD COLUMN IF NOT EXISTS error_summary text         NULL;


-- =====================================================
-- 2. CHECK CONSTRAINT no campo status
-- =====================================================
-- Garante que só valores conhecidos sejam gravados.
-- Qualquer typo ou valor inválido gera erro explícito.
-- =====================================================

ALTER TABLE client_import_files
  DROP CONSTRAINT IF EXISTS client_import_files_status_check;

ALTER TABLE client_import_files
  ADD CONSTRAINT client_import_files_status_check
  CHECK (status IN ('uploaded', 'processing', 'processed', 'failed', 'needs_review', 'cancelled'));


-- =====================================================
-- 3. INDEX PARCIAL — polling pelo Make
-- =====================================================
-- O Make vai consultar WHERE status = 'uploaded' periodicamente.
-- Index parcial cobre exatamente esse caso sem overhead nas outras rows.
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_client_import_files_uploaded
  ON client_import_files (created_at ASC)
  WHERE status = 'uploaded';


-- =====================================================
-- 4. COMMENTS
-- =====================================================

COMMENT ON TABLE client_import_files
  IS 'Controla importações de clientes em massa via Excel. Cada registro representa um arquivo enviado pelo usuário e seu ciclo de processamento pelo Make.';

COMMENT ON COLUMN client_import_files.status
  IS 'Ciclo de vida: uploaded → processing → processed | failed | needs_review | cancelled';

COMMENT ON COLUMN client_import_files.started_at
  IS 'Quando o Make iniciou o processamento. Null enquanto aguarda.';

COMMENT ON COLUMN client_import_files.processed_at
  IS 'Quando o processamento foi concluído (com sucesso ou falha definitiva).';

COMMENT ON COLUMN client_import_files.error_summary
  IS 'Resumo legível do motivo de falha, preenchido pelo Make. Exibível diretamente no app.';

COMMENT ON COLUMN client_import_files.total_rows
  IS 'Total de linhas encontradas no Excel (preenchido pelo Make).';

COMMENT ON COLUMN client_import_files.valid_rows
  IS 'Linhas importadas com sucesso (preenchido pelo Make).';

COMMENT ON COLUMN client_import_files.error_rows
  IS 'Linhas com erro que não puderam ser importadas (preenchido pelo Make).';


-- =====================================================
-- 5. AJUSTE DA UPDATE POLICY DO USUÁRIO
-- =====================================================
-- Antes: usuário conseguia setar qualquer status, incluindo 'processed'.
-- Agora: usuário só pode cancelar uma importação sua que ainda está
--        em 'uploaded' (antes do Make processá-la).
-- O Make usa service role — bypassa RLS e atualiza tudo o que precisar.
-- =====================================================

DROP POLICY IF EXISTS "user atualiza propria importacao" ON client_import_files;

CREATE POLICY "user cancela propria importacao"
  ON client_import_files FOR UPDATE TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'cancelled'
  );


-- =====================================================
-- 6. TABELA — client_import_errors
-- =====================================================
-- Registra erros por linha do Excel durante o processamento.
-- Preenchida pelo Make após análise do arquivo.
-- Permite ao app mostrar ao usuário exatamente quais linhas
-- falharam e por quê, sem poluir client_import_files.
-- =====================================================

CREATE TABLE IF NOT EXISTS client_import_errors (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  import_id   uuid        NOT NULL REFERENCES client_import_files(id) ON DELETE CASCADE,
  row_number  integer     NOT NULL,   -- linha no Excel (começa em 2, pula o cabeçalho)
  row_data    jsonb       NULL,       -- dados brutos da linha para diagnóstico
  error_type  text        NOT NULL,   -- ex: 'missing_field', 'invalid_cep', 'duplicate_cnpj'
  error_msg   text        NOT NULL,   -- mensagem legível para exibir ao usuário
  created_at  timestamptz DEFAULT now()
);

COMMENT ON TABLE client_import_errors
  IS 'Erros por linha do Excel detectados pelo Make durante o processamento. Referencia client_import_files via import_id.';

COMMENT ON COLUMN client_import_errors.row_number
  IS 'Número da linha no arquivo Excel (começa em 2, pois linha 1 é o cabeçalho).';

COMMENT ON COLUMN client_import_errors.row_data
  IS 'Snapshot dos dados brutos da linha com erro. Útil para diagnóstico sem precisar re-abrir o arquivo.';

COMMENT ON COLUMN client_import_errors.error_type
  IS 'Categoria do erro: missing_field, invalid_cep, duplicate_cnpj, invalid_format, etc.';


-- =====================================================
-- 7. RLS — client_import_errors
-- =====================================================

ALTER TABLE client_import_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user ve erros proprias importacoes" ON client_import_errors;

-- Usuário vê apenas erros das próprias importações
CREATE POLICY "user ve erros proprias importacoes"
  ON client_import_errors FOR SELECT TO authenticated
  USING (
    import_id IN (
      SELECT id FROM client_import_files WHERE user_id = auth.uid()
    )
  );

-- Sem INSERT/UPDATE/DELETE para o usuário autenticado:
-- quem insere é o Make via service role (bypassa RLS).


-- =====================================================
-- 8. INDEX — client_import_errors
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_client_import_errors_import_id
  ON client_import_errors (import_id);


-- =====================================================
-- DIAGNÓSTICO (opcional — rode para verificar)
-- =====================================================
-- Colunas da tabela principal:
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'client_import_files'
--  ORDER BY ordinal_position;
--
-- Check constraints:
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'client_import_files'::regclass;
--
-- Policies ativas:
-- SELECT tablename, policyname, cmd, qual, with_check
--   FROM pg_policies
--  WHERE tablename IN ('client_import_files', 'client_import_errors');
--
-- Index criado:
-- SELECT indexname, indexdef
--   FROM pg_indexes
--  WHERE tablename IN ('client_import_files', 'client_import_errors');

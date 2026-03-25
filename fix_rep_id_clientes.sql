-- =====================================================
-- FIX: rep_id da tabela clientes
-- Execute no SQL Editor do painel Supabase
-- =====================================================
-- PROBLEMA: migrar_clientes.sql preencheu rep_id com
-- representantes.id (UUID próprio), mas a coluna
-- clientes.rep_id referencia auth.users(id) — ou seja,
-- auth.uid(). São UUIDs diferentes. Nenhum cliente aparece.
--
-- SOLUÇÃO: sobrescrever rep_id para o auth.uid() correto
-- do usuário brunoc.almeida.sc@gmail.com.
-- =====================================================

-- 1. MIGRAÇÃO ÚNICA
--    Atualiza todos os clientes cujo rep_id está errado
--    (vem de representantes.id) ou é nulo,
--    para o auth.uid() real do usuário.

UPDATE clientes
SET rep_id = (
  SELECT id FROM auth.users
  WHERE email = 'brunoc.almeida.sc@gmail.com'
  LIMIT 1
)
WHERE rep_id IS NULL
   OR rep_id = (
        SELECT id FROM representantes
        WHERE email = 'brunoc.almeida.sc@gmail.com'
        LIMIT 1
      );

-- Confirmação: deve retornar ~210 linhas com o auth.uid() correto
-- SELECT COUNT(*), rep_id FROM clientes GROUP BY rep_id;

-- =====================================================
-- 2. POLÍTICAS RLS — tabela clientes
--    Garante que cada rep vê/edita apenas sua carteira
-- =====================================================

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rep lê seus clientes"       ON clientes;
DROP POLICY IF EXISTS "Rep insere seus clientes"   ON clientes;
DROP POLICY IF EXISTS "Rep atualiza seus clientes" ON clientes;
DROP POLICY IF EXISTS "Rep deleta seus clientes"   ON clientes;

-- SELECT: cada rep vê só seus clientes
CREATE POLICY "Rep lê seus clientes"
  ON clientes FOR SELECT
  TO authenticated
  USING (rep_id = auth.uid());

-- INSERT: rep_id deve ser o do usuário logado
CREATE POLICY "Rep insere seus clientes"
  ON clientes FOR INSERT
  TO authenticated
  WITH CHECK (rep_id = auth.uid());

-- UPDATE: pode alterar seus clientes E clientes sem rep_id (migração automática via app)
CREATE POLICY "Rep atualiza seus clientes"
  ON clientes FOR UPDATE
  TO authenticated
  USING (rep_id = auth.uid() OR rep_id IS NULL)
  WITH CHECK (rep_id = auth.uid());

-- DELETE: só pode excluir seus próprios clientes
CREATE POLICY "Rep deleta seus clientes"
  ON clientes FOR DELETE
  TO authenticated
  USING (rep_id = auth.uid());

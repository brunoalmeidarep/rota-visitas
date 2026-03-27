-- =====================================================
-- FIX: RLS da tabela clientes
-- Execute no SQL Editor do painel Supabase
-- Seguro para re-executar.
-- =====================================================
-- PROBLEMA: política antiga usava rep_id = auth.uid()
-- mas os clientes têm rep_id = representantes.id
-- (UUIDs diferentes) → UPDATE/DELETE bloqueados silenciosamente.
--
-- SOLUÇÃO: mapear auth.uid() → representantes.id via auth_id
-- (mesmo padrão de fix_auth_id_representantes.sql)
-- =====================================================

-- Remove políticas existentes (nomes comuns — inclua outros se houver)
DROP POLICY IF EXISTS "Rep lê seus clientes"               ON clientes;
DROP POLICY IF EXISTS "Rep insere seus clientes"           ON clientes;
DROP POLICY IF EXISTS "Rep atualiza seus clientes"         ON clientes;
DROP POLICY IF EXISTS "Rep deleta seus clientes"           ON clientes;
DROP POLICY IF EXISTS "rep acessa seus clientes"           ON clientes;
DROP POLICY IF EXISTS "clientes policy"                    ON clientes;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON clientes;

-- Política unificada usando auth_id
CREATE POLICY "rep acessa seus clientes"
  ON clientes FOR ALL TO authenticated
  USING (
    rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid())
  );

-- =====================================================
-- DIAGNÓSTICO (opcional)
-- =====================================================
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'clientes';

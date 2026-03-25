-- =====================================================
-- FIX RLS clientes
-- Execute no SQL Editor do painel Supabase
-- =====================================================
-- PROBLEMA: a política usava rep_id = auth.uid()
-- mas os dados têm rep_id = representantes.id
-- São UUIDs diferentes → RLS bloqueava tudo.
--
-- SOLUÇÃO: mesma lógica das outras tabelas
-- (financeiro, impostos, rotas): lookup via email
-- =====================================================

DROP POLICY IF EXISTS "Rep lê seus clientes"       ON clientes;
DROP POLICY IF EXISTS "Rep insere seus clientes"   ON clientes;
DROP POLICY IF EXISTS "Rep atualiza seus clientes" ON clientes;
DROP POLICY IF EXISTS "Rep deleta seus clientes"   ON clientes;

CREATE POLICY "Rep lê seus clientes"
  ON clientes FOR SELECT TO authenticated
  USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

CREATE POLICY "Rep insere seus clientes"
  ON clientes FOR INSERT TO authenticated
  WITH CHECK (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

CREATE POLICY "Rep atualiza seus clientes"
  ON clientes FOR UPDATE TO authenticated
  USING  (rep_id = (SELECT id FROM representantes WHERE email = auth.email()) OR rep_id IS NULL)
  WITH CHECK (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

CREATE POLICY "Rep deleta seus clientes"
  ON clientes FOR DELETE TO authenticated
  USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

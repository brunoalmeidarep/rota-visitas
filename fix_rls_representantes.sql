-- =====================================================
-- FIX RLS representantes — permite que o rep
-- atualize seu próprio registro (onboarding_ok,
-- impostos_ok, endereco_base, etc.)
-- Execute no SQL Editor do painel Supabase
-- =====================================================

ALTER TABLE representantes ENABLE ROW LEVEL SECURITY;

-- SELECT: rep lê só seu próprio perfil
DROP POLICY IF EXISTS "rep lê seu perfil" ON representantes;
CREATE POLICY "rep lê seu perfil"
  ON representantes FOR SELECT TO authenticated
  USING (email = auth.email());

-- UPDATE: rep atualiza só seu próprio perfil
DROP POLICY IF EXISTS "rep atualiza seu perfil" ON representantes;
CREATE POLICY "rep atualiza seu perfil"
  ON representantes FOR UPDATE TO authenticated
  USING  (email = auth.email())
  WITH CHECK (email = auth.email());

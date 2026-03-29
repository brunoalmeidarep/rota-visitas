-- =====================================================
-- FIX: auth_id em representantes + RLS representadas
-- Execute no SQL Editor do painel Supabase
-- Seguro para re-executar.
-- =====================================================

-- 1. Adiciona coluna auth_id em representantes
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE;

-- 2. Popula auth_id a partir do email (para reps já existentes)
UPDATE representantes
SET auth_id = (
  SELECT id FROM auth.users
  WHERE email = representantes.email
  LIMIT 1
)
WHERE auth_id IS NULL;

-- 3. Índice para lookup rápido
CREATE INDEX IF NOT EXISTS idx_representantes_auth_id ON representantes(auth_id);

-- 4. Corrige RLS da tabela representadas
--    (usa auth_id para mapear auth.uid() → representantes.id)
DROP POLICY IF EXISTS "rep acessa suas empresas"       ON representadas;
DROP POLICY IF EXISTS "rep owns representadas"          ON representadas;
DROP POLICY IF EXISTS "rep acessa suas representadas"   ON representadas;
CREATE POLICY "rep acessa suas representadas"
  ON representadas FOR ALL TO authenticated
  USING (
    rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid())
  );

-- 5. Trigger: cria linha em representantes automaticamente
--    quando um novo usuário faz cadastro no Supabase Auth
CREATE OR REPLACE FUNCTION public.auto_criar_representante()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.representantes (email, nome, auth_id, ativo)
  VALUES (
    NEW.email,
    split_part(NEW.email, '@', 1),
    NEW.id,
    true
  )
  ON CONFLICT (email) DO UPDATE
    SET auth_id = EXCLUDED.auth_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_criar_representante();

-- =====================================================
-- DIAGNÓSTICO (opcional)
-- =====================================================
-- SELECT id, email, auth_id FROM representantes;
-- SELECT count(*) FROM representadas;

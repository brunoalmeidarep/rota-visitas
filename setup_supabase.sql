-- ============================================================
-- MINHA ROTA RP — Setup Completo Supabase
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- ── TABELA CLIENTES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id            BIGINT PRIMARY KEY,
  rep_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  razao_social  TEXT,
  fantasia      TEXT,
  cnpj          TEXT,
  comprador     TEXT,
  telefone      TEXT,
  email         TEXT,
  endereco      TEXT,
  cidade        TEXT,
  cep           TEXT,
  lat           NUMERIC,
  lng           NUMERIC,
  segmento      TEXT,
  ultima_visita DATE,
  ultima_obs    TEXT DEFAULT '',
  criado_em     TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rep lê seus clientes"      ON clientes;
DROP POLICY IF EXISTS "Rep insere seus clientes"  ON clientes;
DROP POLICY IF EXISTS "Rep atualiza seus clientes" ON clientes;
DROP POLICY IF EXISTS "Rep deleta seus clientes"  ON clientes;
CREATE POLICY "Rep lê seus clientes"      ON clientes FOR SELECT    TO authenticated USING (rep_id = auth.uid());
CREATE POLICY "Rep insere seus clientes"  ON clientes FOR INSERT    TO authenticated WITH CHECK (rep_id = auth.uid());
CREATE POLICY "Rep atualiza seus clientes" ON clientes FOR UPDATE   TO authenticated USING (rep_id = auth.uid());
CREATE POLICY "Rep deleta seus clientes"  ON clientes FOR DELETE    TO authenticated USING (rep_id = auth.uid());

-- ── TABELA VISITAS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visitas (
  id              BIGSERIAL PRIMARY KEY,
  rep_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  id_cliente      TEXT,
  nome_cliente    TEXT,
  cidade          TEXT,
  data            DATE,
  hora            TEXT,
  obs             TEXT,
  valor_pedido    NUMERIC(12,2),
  doc_url         TEXT,
  tipo            TEXT DEFAULT 'visita',      -- 'visita' | 'pedido' | 'whatsapp' | 'orcamento' | 'remoto'
  status_orcamento TEXT,                       -- 'aberto' | 'fechado' | 'perdido'
  representada_id UUID,
  criado_em       TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Rep lê suas visitas"      ON visitas;
DROP POLICY IF EXISTS "Rep insere suas visitas"  ON visitas;
DROP POLICY IF EXISTS "Rep atualiza suas visitas" ON visitas;
CREATE POLICY "Rep lê suas visitas"      ON visitas FOR SELECT TO authenticated USING (rep_id = auth.uid());
CREATE POLICY "Rep insere suas visitas"  ON visitas FOR INSERT TO authenticated WITH CHECK (rep_id = auth.uid());
CREATE POLICY "Rep atualiza suas visitas" ON visitas FOR UPDATE TO authenticated USING (rep_id = auth.uid());

-- ── TABELA REPRESENTADAS (Empresas) ─────────────────────────
CREATE TABLE IF NOT EXISTS representadas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cnpj        TEXT,
  cep         TEXT,
  endereco    TEXT,
  cidade      TEXT,
  banco       TEXT,
  agencia     TEXT,
  conta       TEXT,
  pix         TEXT,
  fin_nome    TEXT,
  fin_tel     TEXT,
  com_nome    TEXT,
  com_tel     TEXT,
  fis_nome    TEXT,
  fis_tel     TEXT,
  fat_nome    TEXT,
  fat_tel     TEXT,
  criado_em   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE representadas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep acessa suas empresas" ON representadas;
CREATE POLICY "rep acessa suas empresas" ON representadas
  FOR ALL TO authenticated USING (rep_id = auth.uid()) WITH CHECK (rep_id = auth.uid());

-- Coluna representada_id na tabela visitas (FK opcional)
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS representada_id UUID REFERENCES representadas(id) ON DELETE SET NULL;

-- ── TABELA SEGMENTOS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS segmentos (
  id        BIGSERIAL PRIMARY KEY,
  rep_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome      TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE segmentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep acessa seus segmentos" ON segmentos;
CREATE POLICY "rep acessa seus segmentos" ON segmentos
  FOR ALL TO authenticated USING (rep_id = auth.uid()) WITH CHECK (rep_id = auth.uid());

-- ── TABELA LEMBRETES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lembretes (
  id          BIGSERIAL PRIMARY KEY,
  rep_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  id_cliente  TEXT NOT NULL,
  texto       TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(id_cliente, rep_id)
);
ALTER TABLE lembretes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep acessa seus lembretes" ON lembretes;
CREATE POLICY "rep acessa seus lembretes" ON lembretes
  FOR ALL TO authenticated USING (rep_id = auth.uid()) WITH CHECK (rep_id = auth.uid());

-- ── TABELA TAREFAS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarefas (
  id        BIGSERIAL PRIMARY KEY,
  rep_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  texto     TEXT NOT NULL,
  feita     BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep acessa suas tarefas" ON tarefas;
CREATE POLICY "rep acessa suas tarefas" ON tarefas
  FOR ALL TO authenticated USING (rep_id = auth.uid()) WITH CHECK (rep_id = auth.uid());

-- ── TABELA REPRESENTANTES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS representantes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email     TEXT UNIQUE NOT NULL,
  nome      TEXT,
  criado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE representantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rep lê seu perfil" ON representantes;
CREATE POLICY "rep lê seu perfil" ON representantes
  FOR SELECT TO authenticated USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ── BUCKET PEDIDOS (Storage) ────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('pedidos', 'pedidos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Rep pode upload pedidos" ON storage.objects;
CREATE POLICY "Rep pode upload pedidos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pedidos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Leitura pública pedidos" ON storage.objects;
CREATE POLICY "Leitura pública pedidos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'pedidos');

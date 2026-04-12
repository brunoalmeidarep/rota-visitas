-- SEED DE DADOS DE TESTE - Minha Rota RP v2
-- Execute este SQL no Supabase Dashboard (SQL Editor)

-- =====================================================
-- PARTE 1: ADICIONAR COLUNAS FALTANTES NAS TABELAS
-- =====================================================

-- Colunas na tabela representadas
ALTER TABLE representadas ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE representadas ADD COLUMN IF NOT EXISTS cor_pdf TEXT DEFAULT '#1a3a6b';
ALTER TABLE representadas ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE representadas ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE representadas ADD COLUMN IF NOT EXISTS dados_vendedor TEXT;

-- Colunas na tabela pedidos
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS oc_cliente TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_nome TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS representada_nome TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS visita_id UUID;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS canal TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'orcamento';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_total NUMERIC DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS itens JSONB DEFAULT '[]';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero INTEGER;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'venda';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS condicao_pagamento TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS frete NUMERIC;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS transportadora TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS info_adicionais TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_pedido TIMESTAMPTZ;

-- Criar tabela produtos se nao existir
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  rep_id UUID,
  representada_id UUID,
  nome TEXT,
  codigo TEXT,
  ncm TEXT,
  codigo_barras TEXT,
  preco NUMERIC,
  unidade TEXT DEFAULT 'UN',
  multiplo INTEGER DEFAULT 1,
  ipi NUMERIC DEFAULT 0,
  descricao TEXT,
  fotos JSONB,
  ativo BOOLEAN DEFAULT TRUE
);

-- RLS para produtos
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prod_own" ON produtos;
CREATE POLICY "prod_own" ON produtos FOR ALL USING (
  rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid())
);

-- Criar tabela politica_comercial se nao existir
CREATE TABLE IF NOT EXISTS politica_comercial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  representada_id UUID,
  nome TEXT,
  tipo TEXT,
  valor NUMERIC,
  valor_tipo TEXT DEFAULT 'percentual',
  condicao TEXT,
  condicao_valor NUMERIC,
  condicao_pagamento TEXT,
  editavel_rep BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE
);

-- RLS para politica_comercial
ALTER TABLE politica_comercial ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pol_read" ON politica_comercial;
CREATE POLICY "pol_read" ON politica_comercial FOR SELECT USING (
  representada_id IN (SELECT id FROM representadas WHERE rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()))
);

-- Criar tabela segmentos se nao existir
CREATE TABLE IF NOT EXISTS segmentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  rep_id UUID,
  nome TEXT
);

-- RLS para segmentos
ALTER TABLE segmentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seg_own" ON segmentos;
CREATE POLICY "seg_own" ON segmentos FOR ALL USING (
  rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid())
);

-- =====================================================
-- PARTE 2: INSERIR DADOS DE TESTE
-- (Execute apos fazer login no app para criar o representante)
-- =====================================================

-- 1. Representada de teste
INSERT INTO representadas (rep_id, nome, email, cor_pdf)
SELECT id, 'Inkor Produtos para Construcao', 'pedido@inkor.com.br', '#1a3a6b'
FROM representantes WHERE email = 'brunoc.almeida.sc@gmail.com'
ON CONFLICT DO NOTHING;

-- 2. Produtos de teste (10 itens)
INSERT INTO produtos (rep_id, representada_id, nome, codigo, ncm, codigo_barras, preco, unidade, ipi, ativo)
SELECT
  r.id,
  rep.id,
  p.nome,
  p.codigo,
  p.ncm,
  p.codigo_barras,
  p.preco,
  p.unidade,
  p.ipi,
  true
FROM representantes r
CROSS JOIN representadas rep
CROSS JOIN (VALUES
  ('Barra de Apoio 400mm Inox Polido', 'BAP32-400-IN', '7615.10.00', '7891234567001', 89.00, 'UN', 3.25),
  ('Barra de Apoio 600mm Inox Polido', 'BAP32-600-IN', '7615.10.00', '7891234567002', 124.00, 'UN', 3.25),
  ('Ralo Click 10x10cm', 'RC-10', '3922.90.00', '7891234567003', 24.59, 'UN', 0),
  ('Ralo Click 15x15cm', 'RC-15', '3922.90.00', '7891234567004', 29.94, 'UN', 0),
  ('Ralo Inox Automatico 10x10cm', 'AT-RI10-IN', '7615.10.00', '7891234567005', 17.01, 'UN', 0),
  ('Aplicador e Raspador para Silicone', 'ARS5-PL', '8205.59.00', '7891234567006', 16.03, 'UN', 0),
  ('Arejador de Torneira com Botao', 'ART-BOT', '8484.90.00', '7891234567007', 19.58, 'UN', 0),
  ('Arejador de Torneira com Giro', 'ART-GIR', '8484.90.00', '7891234567008', 19.28, 'UN', 0),
  ('Valvula de Escoamento 1.1/2', 'VE-112', '3922.90.00', '7891234567009', 34.90, 'UN', 0),
  ('Sifao Flexivel Universal', 'SIF-FLX', '3922.90.00', '7891234567010', 28.50, 'UN', 0)
) AS p(nome, codigo, ncm, codigo_barras, preco, unidade, ipi)
WHERE r.email = 'brunoc.almeida.sc@gmail.com'
AND rep.rep_id = r.id
ON CONFLICT DO NOTHING;

-- 3. Politica comercial de teste
INSERT INTO politica_comercial (representada_id, nome, tipo, valor, valor_tipo, condicao, condicao_pagamento, ativo)
SELECT
  rep.id,
  'Boleto curto',
  'desconto',
  3,
  'percentual',
  'forma_pagamento',
  'boleto_curto',
  true
FROM representadas rep
JOIN representantes r ON r.id = rep.rep_id
WHERE r.email = 'brunoc.almeida.sc@gmail.com'
ON CONFLICT DO NOTHING;

-- =====================================================
-- PARTE 3: VERIFICAR DADOS
-- =====================================================
SELECT 'Representadas' as tabela, COUNT(*) as total FROM representadas
UNION ALL
SELECT 'Produtos', COUNT(*) FROM produtos
UNION ALL
SELECT 'Politicas', COUNT(*) FROM politica_comercial
UNION ALL
SELECT 'Segmentos', COUNT(*) FROM segmentos;

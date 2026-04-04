-- Tabelas NOVAS para Supabase v2
-- Execute no SQL Editor: https://supabase.com/dashboard/project/byglymeulgeomoldhrrh/sql

-- 1. PRODUTOS (catálogo por representada)
CREATE TABLE produtos (
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
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prod_own" ON produtos FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()));

-- 2. POLITICA_COMERCIAL (descontos configurados pela indústria)
CREATE TABLE politica_comercial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  representada_id UUID,
  nome TEXT,
  tipo TEXT, -- 'desconto' | 'acrescimo'
  valor NUMERIC,
  valor_tipo TEXT, -- 'percentual' | 'fixo'
  condicao TEXT, -- 'volume_minimo' | 'forma_pagamento' | 'sempre'
  condicao_valor NUMERIC,
  condicao_pagamento TEXT,
  editavel_rep BOOLEAN DEFAULT FALSE,
  ativo BOOLEAN DEFAULT TRUE
);
ALTER TABLE politica_comercial ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pol_read" ON politica_comercial FOR SELECT USING (
  representada_id IN (SELECT id FROM representadas WHERE rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()))
);

-- 3. GASTOS_CLIENTE (separado do financeiro geral)
CREATE TABLE gastos_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  rep_id UUID,
  cliente_id UUID,
  cliente_nome TEXT,
  categoria TEXT,
  descricao TEXT,
  valor NUMERIC,
  data DATE,
  url_comprovante TEXT
);
ALTER TABLE gastos_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gas_own" ON gastos_cliente FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()));

-- Colunas novas na tabela representantes
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS endereco_base TEXT;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS lat_base NUMERIC;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS lng_base NUMERIC;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS media_carro NUMERIC DEFAULT 10;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS preco_gasolina NUMERIC DEFAULT 6.0;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS onboarding_ok BOOLEAN DEFAULT FALSE;
ALTER TABLE representantes ADD COLUMN IF NOT EXISTS impostos_ok BOOLEAN DEFAULT FALSE;

-- Tabela financeiro
CREATE TABLE IF NOT EXISTS financeiro (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','gasto')),
  categoria TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  representada_id UUID REFERENCES representadas(id),
  cliente_id TEXT,
  url_comprovante TEXT,
  mes_referencia TEXT,
  rep_id UUID REFERENCES representantes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep owns financeiro" ON financeiro FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

-- Tabela impostos
CREATE TABLE IF NOT EXISTS impostos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  rep_id UUID REFERENCES representantes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE impostos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep owns impostos" ON impostos FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

-- Tabela rotas
CREATE TABLE IF NOT EXISTS rotas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  clientes_ids TEXT[] DEFAULT '{}',
  ordem_otimizada TEXT[] DEFAULT '{}',
  km_total NUMERIC(8,2),
  tempo_estimado INTEGER,
  status TEXT DEFAULT 'ativa',
  rep_id UUID REFERENCES representantes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rep owns rotas" ON rotas FOR ALL USING (rep_id = (SELECT id FROM representantes WHERE email = auth.email()));

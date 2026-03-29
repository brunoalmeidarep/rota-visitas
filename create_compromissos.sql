-- =====================================================
-- Tabela: compromissos
-- Execute no SQL Editor do painel Supabase
-- =====================================================

CREATE TABLE IF NOT EXISTS compromissos (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_id         uuid REFERENCES representantes(id),
  tipo           text NOT NULL,          -- 'parcela' ou 'emprestimo'
  descricao      text NOT NULL,
  categoria      text,                   -- para parcelas
  banco          text,                   -- para empréstimos
  valor_total    numeric,
  valor_parcela  numeric NOT NULL,
  total_parcelas integer,
  parcela_atual  integer DEFAULT 1,
  taxa_juros     numeric,                -- % ao mês (opcional)
  data_inicio    date NOT NULL,
  created_at     timestamp with time zone DEFAULT now()
);

ALTER TABLE compromissos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rep acessa seus compromissos"
  ON compromissos FOR ALL TO authenticated
  USING (rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()))
  WITH CHECK (rep_id = (SELECT id FROM representantes WHERE auth_id = auth.uid()));

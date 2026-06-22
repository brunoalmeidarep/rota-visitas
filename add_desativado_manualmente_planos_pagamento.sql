-- Adiciona toggle manual de visibilidade dos planos de pagamento (controlado pelo admin no SalesRP).
-- Separado de `ativo` (que é propriedade do Microvix e sobrescrito a cada sync).
-- Execute no SQL Editor do painel Supabase.

ALTER TABLE planos_pagamento
ADD COLUMN IF NOT EXISTS desativado_manualmente boolean NOT NULL DEFAULT false;

-- Índice parcial para ajudar o filtro do sync (empresa_id + ativo, só planos visíveis)
CREATE INDEX IF NOT EXISTS idx_planos_pagamento_empresa_visivel
ON planos_pagamento (empresa_id, ativo)
WHERE desativado_manualmente = false;

-- SEED DE DADOS DE TESTE - Minha Rota RP v2
-- Execute este SQL no Supabase Dashboard (SQL Editor) após fazer login no app

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

-- Verificar dados inseridos
SELECT 'Representadas' as tabela, COUNT(*) as total FROM representadas
UNION ALL
SELECT 'Produtos', COUNT(*) FROM produtos
UNION ALL
SELECT 'Politicas', COUNT(*) FROM politica_comercial;

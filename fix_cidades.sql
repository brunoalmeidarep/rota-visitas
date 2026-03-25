-- =====================================================
-- FIX: normaliza nomes de cidades na tabela clientes
-- Execute no SQL Editor do painel Supabase
-- =====================================================

UPDATE clientes SET cidade = 'Jaraguá do Sul - SC'    WHERE cidade = 'Jaragua Do Sul - SC';
UPDATE clientes SET cidade = 'Jaraguá do Sul - SC'    WHERE cidade = 'Jaraguá Do Sul - SC';
UPDATE clientes SET cidade = 'São Bento do Sul - SC'  WHERE cidade = 'Sao Bento Do Sul - SC';
UPDATE clientes SET cidade = 'São Francisco do Sul - SC' WHERE cidade = 'Sao Francisco Do Sul - SC';
UPDATE clientes SET cidade = 'São Francisco do Sul - SC' WHERE cidade = 'São Francisco Do Sul - SC';
UPDATE clientes SET cidade = 'São Francisco do Sul - SC' WHERE cidade LIKE 'São%Francisco%Do Sul - SC';
UPDATE clientes SET cidade = 'Balneário Barra do Sul - SC' WHERE cidade = 'Balneario Barra Do Sul - SC';
UPDATE clientes SET cidade = 'Timbó - SC'             WHERE cidade = 'Timbo - SC';
UPDATE clientes SET cidade = 'Três Barras - SC'       WHERE cidade = 'Tres Barras - SC';
UPDATE clientes SET cidade = 'Rio dos Cedros - SC'    WHERE cidade = 'Rio Dos Cedros - SC';
UPDATE clientes SET cidade = 'Porto União - SC'       WHERE cidade = 'Porto Uniao - PR';
UPDATE clientes SET cidade = 'Corupá - SC'            WHERE cidade = 'Corupa - SC';

-- Confirmação: lista cidades distintas após correção
-- SELECT DISTINCT cidade FROM clientes ORDER BY cidade;

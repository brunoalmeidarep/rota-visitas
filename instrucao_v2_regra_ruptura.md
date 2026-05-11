# Instrução para Claude Code (MinhaRotaRP / v2)

Implementar campo de "Regra de Ruptura" no fluxo de pedido, controlado por feature flag por empresa.

---

## Contexto

- O backend já tem coluna `pedidos.regra_ruptura` (text, default `'parcial_novo'`, valores: `parcial_novo`, `parcial_cancela`, `total`).
- O backend já tem coluna `empresas.features` (jsonb), e Mundo Porto está com `{"regra_ruptura": true}` ativado.
- O backend já tem coluna `pedidos.pedido_origem_id` (uuid). Se preenchido, este pedido é um saldo gerado a partir de outro.

---

## Tarefa 1 — Hook utilitário pra ler features da empresa

Crie um hook ou função utilitária reutilizável que retorne as features da empresa selecionada.

**Sugestão de localização:** `src/hooks/useEmpresaFeatures.js` (ou estender `RepresentadaContext` se existir).

**Comportamento:**
- Recebe (ou pega do contexto) `empresa_id` da representada selecionada
- Faz uma query única em `empresas` filtrando por `id`, retornando o campo `features`
- Cacheia o resultado (não consulta a cada render)
- Quando representada muda, refaz a query

**Exemplo de uso esperado:**
```js
const { features } = useEmpresaFeatures()
// features.regra_ruptura === true | false | undefined
```

Empresa não Enterprise (sem `empresa_id` na representada): `features` vem `{}` ou `undefined`. Fluxo continua normalmente.

---

## Tarefa 2 — Campo no Novo Pedido

**Arquivo:** `src/components/pedidos/NovoPedido.jsx`

**Adicionar:** dropdown "Em caso de ruptura de estoque" na seção de **Condições de pagamento**, logo após o plano de pagamento.

**Visibilidade:** só aparece se `features.regra_ruptura === true`.

**Quando aparece, é obrigatório** — botão "Salvar pedido" desabilitado se não escolheu.

**Opções:**
```jsx
<select value={regraRuptura} onChange={...}>
  <option value="">Selecione...</option>
  <option value="parcial_novo">Fatura parcial e cria novo pedido com saldo</option>
  <option value="parcial_cancela">Fatura parcial e cancela saldo</option>
  <option value="total">Entrega total</option>
</select>
```

**Estado inicial:** `useState('parcial_novo')` quando feature ativa, `useState(null)` quando inativa.

**Estilo visual:** seguir padrão dos outros campos do form. Pode ter destaque sutil (borda azul claro tipo `rgba(0,122,255,0.3)` com fundo `rgba(0,122,255,0.08)`) pra destacar como configuração importante — opcional, usar bom senso.

**Ao salvar pedido:** incluir `regra_ruptura: regraRuptura` no objeto enviado ao Supabase. Se feature inativa, **não** envie o campo (deixa o default do banco assumir `parcial_novo`).

**Validação:** se feature ativa e campo vazio, mostrar mensagem inline "Selecione uma regra de ruptura" e impedir salvar.

---

## Tarefa 3 — Visualização da regra no DetalhesPedido

**Arquivo:** `src/components/pedidos/DetalhesPedido.jsx`

**Adicionar (apenas se feature ativa):** uma linha read-only com a regra escolhida.

Posição: junto das infos do pedido (cliente, plano de pagamento, etc), em formato consistente.

**Texto amigável:**
- `parcial_novo` → "Em caso de ruptura: fatura parcial e cria novo pedido"
- `parcial_cancela` → "Em caso de ruptura: fatura parcial e cancela saldo"
- `total` → "Em caso de ruptura: entrega total"

Fonte pequena, cor secundária. **Não editável** — rep não muda depois.

---

## Tarefa 4 — Badge "SALDO" em pedidos saldo

Em qualquer card de pedido na lista (ListaPedidos, etc), se `pedido.pedido_origem_id` está preenchido:
- Mostrar badge discreto **SALDO** no card
- Estilo: fundo `#FAEEDA`, texto `#854F0B`, padding `3px 8px`, border-radius `4px`, font-size 10px, font-weight 500, letter-spacing 0.3px (mesmo padrão do badge de fornecedor)
- Posição: junto com o número/status do pedido

---

## Tarefa 5 — Read-only de pedido saldo

No `DetalhesPedido.jsx`, se `pedido.pedido_origem_id` está preenchido:
- Banner visível no topo: "Pedido em saldo. Gerado a partir do pedido #X. Aguardando aprovação." (X = `numero` do pedido origem, buscar via query)
- **Esconder botões de edição** (editar itens, editar quantidade, etc.) — rep só visualiza
- Mantém botão de "Voltar" e visualizações normais

---

## Tarefa 6 — Considerar pedido saldo na busca/listagem

Verificar se a query atual de pedidos do rep traz pedidos saldo automaticamente. Como `rep_id` é o mesmo, deve trazer naturalmente. Apenas confirme e teste.

---

## Ordem sugerida de execução

1. Tarefa 1 (hook)
2. Tarefa 2 (campo Novo Pedido)
3. Testar criando 1 pedido novo com regra escolhida → conferir no banco que `regra_ruptura` foi salvo
4. Tarefas 3, 4, 5 (visualizações)
5. Tarefa 6 (verificação)

---

## Importante

- **Não esqueça do `useEmpresaFeatures` ou similar** — toda a feature depende dele.
- Se a empresa não tem `features.regra_ruptura`, **comportamento atual zero alterado** — campo nem aparece, salvar continua funcionando como antes.
- Se a representada selecionada não é Enterprise (não tem `empresa_id`), também não aparece.
- **Antes de aplicar:** liste os arquivos que vai modificar e me mostre exemplos de UI das tarefas 2 e 5 pra eu validar antes de aplicar tudo.

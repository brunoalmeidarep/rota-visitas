/**
 * Calcula o preço efetivo de um item de pedido em cascata:
 * preco_negociado_direto > desconto_percentual > desconto (R$) > preco_unitario.
 * O preco_unitario já tem o desconto família embutido (silencioso).
 */
export function calcularPrecoEfetivo(item) {
  const precoBase = Number(item.preco_unitario) || 0
  if (item.preco_negociado_direto != null && Number(item.preco_negociado_direto) > 0) {
    return Number(item.preco_negociado_direto)
  }
  if (item.desconto_percentual != null && Number(item.desconto_percentual) > 0) {
    return precoBase * (1 - Number(item.desconto_percentual) / 100)
  }
  if (item.desconto != null && Number(item.desconto) > 0) {
    return Math.max(0, precoBase - Number(item.desconto))
  }
  return precoBase
}

const PREFIX = 'catalogo_carrinho_'

export function salvarCarrinho(pedidoId, itens) {
  try {
    sessionStorage.setItem(PREFIX + pedidoId, JSON.stringify(itens))
  } catch (e) {
    console.error('[carrinhoStorage] Erro ao salvar:', e)
  }
}

export function lerCarrinho(pedidoId) {
  try {
    const raw = sessionStorage.getItem(PREFIX + pedidoId)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.error('[carrinhoStorage] Erro ao ler:', e)
    sessionStorage.removeItem(PREFIX + pedidoId)
    return null
  }
}

export function limparCarrinho(pedidoId) {
  try {
    sessionStorage.removeItem(PREFIX + pedidoId)
  } catch (e) {
    console.error('[carrinhoStorage] Erro ao limpar:', e)
  }
}

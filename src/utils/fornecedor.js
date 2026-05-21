const LIMITE_CHARS = 18

export function nomeFornecedor(produto) {
  const nome = produto?.fornecedor_nome || ''
  if (!nome) return null
  return nome.length > LIMITE_CHARS ? nome.slice(0, LIMITE_CHARS) + '...' : nome
}

export function nomeFornecedorStr(nome) {
  if (!nome) return null
  return nome.length > 15 ? nome.slice(0, 15) + '...' : nome
}

export function nomeFornecedor(produto) {
  const f = produto?.fornecedores
  if (!f) return null
  const nome = f.nome_fantasia || f.nome || ''
  return nome.length > 15 ? nome.slice(0, 15) + '...' : nome
}

export function nomeFornecedorStr(nome) {
  if (!nome) return null
  return nome.length > 15 ? nome.slice(0, 15) + '...' : nome
}

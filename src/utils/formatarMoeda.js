// formatarMoeda.js - Utilitário global de formatação monetária

// Formata enquanto digita — converte centavos para reais automaticamente
export function formatarInputMoeda(valor) {
  // Remove tudo que não é número
  const numeros = valor.replace(/\D/g, '')
  if (!numeros) return 'R$ 0,00'

  // Trata como centavos
  const centavos = parseInt(numeros, 10)
  const reais = centavos / 100

  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  })
}

// Converte string formatada de volta para número
export function parseMoeda(valorFormatado) {
  if (!valorFormatado) return 0
  return parseFloat(
    valorFormatado
      .replace(/[R$\s.]/g, '')
      .replace(',', '.')
  ) || 0
}

// Exibe valor formatado (para mostrar em tela, não em input)
export function exibirMoeda(valor) {
  const num = Number(valor) || 0
  if (num >= 1000000) return `R$ ${(num/1000000).toFixed(1).replace('.',',')}M`
  if (num >= 10000) return `R$ ${(num/1000).toFixed(1).replace('.',',')}k`
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Formata valor numérico para exibição padrão
export function formatarValor(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor)
}

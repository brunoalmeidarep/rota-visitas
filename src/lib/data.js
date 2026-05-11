// src/lib/data.js
// Funções utilitárias pra trabalhar com datas em horário LOCAL (não UTC).
// Resolve bug de timezone: `new Date().toISOString().split('T')[0]` retorna
// data UTC, que pode ser o dia seguinte no Brasil depois das 21h.

/**
 * Retorna a data atual em formato YYYY-MM-DD, no fuso LOCAL do dispositivo.
 * @param {Date} [data=new Date()] - Data a ser convertida (default: agora)
 * @returns {string} ex: '2026-05-08'
 */
export function dataLocal(data = new Date()) {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Retorna a data de "ontem" em formato YYYY-MM-DD (fuso local).
 */
export function dataOntem() {
  const ontem = new Date()
  ontem.setDate(ontem.getDate() - 1)
  return dataLocal(ontem)
}

/**
 * Retorna a hora atual em formato HH:MM (fuso local).
 */
export function horaLocal(data = new Date()) {
  return data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

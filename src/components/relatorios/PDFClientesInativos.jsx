import { Text, View, StyleSheet } from '@react-pdf/renderer'
import PDFRelatorio, { tabelaStyles } from './PDFRelatorio'

const styles = StyleSheet.create({
  ...tabelaStyles,
  colCliente: { flex: 3 },
  colCidade: { flex: 2 },
  colDias: { flex: 1.5, textAlign: 'center' },
  colUltimo: { flex: 1.5, textAlign: 'right' },
  colData: { flex: 1.5, textAlign: 'right' },
  diasAlerta: { color: '#ff9500' },
  diasPerigo: { color: '#ff6b00' },
  diasCritico: { color: '#ff3b30' },
})

function PDFClientesInativos({ clientes, nomeRep, periodo }) {
  const total = clientes.length
  const alerta = clientes.filter(c => c.faixa === 'alerta').length
  const perigo = clientes.filter(c => c.faixa === 'perigo').length
  const critico = clientes.filter(c => c.faixa === 'critico').length

  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr)
    return d.toLocaleDateString('pt-BR')
  }

  function getRowStyle(faixa) {
    if (faixa === 'alerta') return styles.tabelaRowAlerta
    if (faixa === 'perigo') return styles.tabelaRowPerigo
    if (faixa === 'critico') return styles.tabelaRowCritico
    return {}
  }

  function getDiasStyle(faixa) {
    if (faixa === 'alerta') return styles.diasAlerta
    if (faixa === 'perigo') return styles.diasPerigo
    if (faixa === 'critico') return styles.diasCritico
    return {}
  }

  return (
    <PDFRelatorio
      titulo="Clientes Inativos"
      nomeRep={nomeRep}
      periodo={periodo}
      infoResumo={`${total} clientes`}
    >
      {/* Resumo */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>90-120 dias</Text>
            <Text style={[styles.cardValor, { color: '#ff9500' }]}>{alerta}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>120-180 dias</Text>
            <Text style={[styles.cardValor, { color: '#ff6b00' }]}>{perigo}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>180+ dias</Text>
            <Text style={[styles.cardValor, { color: '#ff3b30' }]}>{critico}</Text>
          </View>
        </View>
      </View>

      {/* Tabela */}
      <View style={styles.tabela}>
        {/* Header */}
        <View style={styles.tabelaHeader}>
          <Text style={[styles.tabelaHeaderCell, styles.colCliente]}>Cliente</Text>
          <Text style={[styles.tabelaHeaderCell, styles.colCidade]}>Cidade</Text>
          <Text style={[styles.tabelaHeaderCell, styles.colDias]}>Dias</Text>
          <Text style={[styles.tabelaHeaderCell, styles.colUltimo]}>Ultimo</Text>
          <Text style={[styles.tabelaHeaderCell, styles.colData]}>Data</Text>
        </View>

        {/* Rows */}
        {clientes.map((c, idx) => (
          <View key={idx} style={[styles.tabelaRow, getRowStyle(c.faixa)]}>
            <Text style={[styles.tabelaCell, styles.colCliente]}>{c.nome}</Text>
            <Text style={[styles.tabelaCellSecondary, styles.colCidade]}>{c.cidade || '-'}</Text>
            <Text style={[styles.tabelaCell, styles.colDias, getDiasStyle(c.faixa)]}>
              {c.diasSemCompra === 9999 ? 'Nunca' : c.diasSemCompra}
            </Text>
            <Text style={[styles.tabelaCell, styles.colUltimo]}>{formatarValor(c.ultimoPedidoValor)}</Text>
            <Text style={[styles.tabelaCellSecondary, styles.colData]}>{formatarData(c.ultimoPedidoData)}</Text>
          </View>
        ))}
      </View>

      {/* Totalizador */}
      <View style={styles.totalizador}>
        <Text style={styles.totalizadorText}>{total} clientes inativos</Text>
      </View>
    </PDFRelatorio>
  )
}

export default PDFClientesInativos

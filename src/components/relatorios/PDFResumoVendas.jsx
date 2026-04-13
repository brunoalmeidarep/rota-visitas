import { Text, View, StyleSheet } from '@react-pdf/renderer'
import PDFRelatorio, { tabelaStyles } from './PDFRelatorio'

const styles = StyleSheet.create({
  ...tabelaStyles,
  colCliente: { flex: 3 },
  colData: { flex: 1.5 },
  colRep: { flex: 2 },
  colValor: { flex: 1.5, textAlign: 'right' },
  repItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  repNome: {
    fontSize: 10,
    color: '#000000',
    flex: 2,
  },
  repValor: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    flex: 1,
    textAlign: 'right',
  },
  repPercent: {
    fontSize: 9,
    color: '#636366',
    flex: 0.5,
    textAlign: 'right',
  },
})

function PDFResumoVendas({ totalVendido, qtdPedidos, ticketMedio, porRepresentada, pedidos, nomeRep, periodo }) {
  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr)
    return d.toLocaleDateString('pt-BR')
  }

  return (
    <PDFRelatorio
      titulo="Resumo de Vendas"
      nomeRep={nomeRep}
      periodo={periodo}
      infoResumo={formatarValor(totalVendido)}
    >
      {/* Cards de resumo */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Total Vendido</Text>
            <Text style={styles.cardValor}>{formatarValor(totalVendido)}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Pedidos</Text>
            <Text style={styles.cardValor}>{qtdPedidos}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Ticket Medio</Text>
            <Text style={styles.cardValor}>{formatarValor(ticketMedio)}</Text>
          </View>
        </View>
      </View>

      {/* Por representada */}
      {porRepresentada.length > 0 && (
        <>
          <Text style={styles.secaoTitulo}>Por Representada</Text>
          <View style={styles.card}>
            {porRepresentada.map((r, idx) => (
              <View key={idx} style={styles.repItem}>
                <Text style={styles.repNome}>{r.nome}</Text>
                <Text style={styles.repValor}>{formatarValor(r.valor)}</Text>
                <Text style={styles.repPercent}>{r.percentual?.toFixed(0)}%</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Lista de pedidos */}
      {pedidos.length > 0 && (
        <>
          <Text style={styles.secaoTitulo}>Pedidos do Periodo</Text>
          <View style={styles.tabela}>
            <View style={styles.tabelaHeader}>
              <Text style={[styles.tabelaHeaderCell, styles.colCliente]}>Cliente</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colData]}>Data</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colRep]}>Representada</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colValor]}>Valor</Text>
            </View>

            {pedidos.slice(0, 30).map((p, idx) => (
              <View key={idx} style={styles.tabelaRow}>
                <Text style={[styles.tabelaCell, styles.colCliente]}>{p.cliente_nome || '-'}</Text>
                <Text style={[styles.tabelaCellSecondary, styles.colData]}>{formatarData(p.created_at)}</Text>
                <Text style={[styles.tabelaCellSecondary, styles.colRep]}>{p.representada_nome || '-'}</Text>
                <Text style={[styles.tabelaCell, styles.colValor]}>{formatarValor(p.valor_total)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </PDFRelatorio>
  )
}

export default PDFResumoVendas

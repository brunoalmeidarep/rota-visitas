import { Text, View, StyleSheet } from '@react-pdf/renderer'
import PDFRelatorio, { tabelaStyles } from './PDFRelatorio'

const styles = StyleSheet.create({
  ...tabelaStyles,
  colProduto: { flex: 3 },
  colCodigo: { flex: 1.5 },
  colQtd: { flex: 1, textAlign: 'center' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  colPercent: { flex: 1, textAlign: 'right' },
})

function PDFVendasProduto({ produtos, totalGeral, totalUnidades, nomeRep, periodo }) {
  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <PDFRelatorio
      titulo="Vendas por Produto"
      nomeRep={nomeRep}
      periodo={periodo}
      infoResumo={`${produtos.length} produtos`}
    >
      {/* Resumo */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Produtos</Text>
            <Text style={styles.cardValor}>{produtos.length}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Unidades</Text>
            <Text style={styles.cardValor}>{totalUnidades}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Total</Text>
            <Text style={styles.cardValor}>{formatarValor(totalGeral)}</Text>
          </View>
        </View>
      </View>

      {/* Tabela */}
      <View style={styles.tabela}>
        {/* Header */}
        <View style={styles.tabelaHeader}>
          <Text style={[styles.tabelaHeaderCell, styles.colProduto]}>Produto</Text>
          <Text style={[styles.tabelaHeaderCell, styles.colCodigo]}>Codigo</Text>
          <Text style={[styles.tabelaHeaderCell, styles.colQtd]}>Qtd</Text>
          <Text style={[styles.tabelaHeaderCell, styles.colTotal]}>Total</Text>
          <Text style={[styles.tabelaHeaderCell, styles.colPercent]}>%</Text>
        </View>

        {/* Rows */}
        {produtos.map((p, idx) => (
          <View key={idx} style={styles.tabelaRow}>
            <Text style={[styles.tabelaCell, styles.colProduto]}>{p.nome}</Text>
            <Text style={[styles.tabelaCellSecondary, styles.colCodigo]}>{p.codigo || '-'}</Text>
            <Text style={[styles.tabelaCell, styles.colQtd]}>{p.quantidade}</Text>
            <Text style={[styles.tabelaCell, styles.colTotal]}>{formatarValor(p.valor)}</Text>
            <Text style={[styles.tabelaCellSecondary, styles.colPercent]}>{p.percentual?.toFixed(1)}%</Text>
          </View>
        ))}
      </View>

      {/* Totalizador */}
      <View style={styles.totalizador}>
        <Text style={styles.totalizadorText}>
          {produtos.length} produtos • {totalUnidades} unidades • {formatarValor(totalGeral)}
        </Text>
      </View>
    </PDFRelatorio>
  )
}

export default PDFVendasProduto

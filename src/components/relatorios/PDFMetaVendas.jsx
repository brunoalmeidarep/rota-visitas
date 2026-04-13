import { Text, View, StyleSheet } from '@react-pdf/renderer'
import PDFRelatorio, { tabelaStyles } from './PDFRelatorio'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const styles = StyleSheet.create({
  ...tabelaStyles,
  cardDestaque: {
    backgroundColor: '#1a3a6b',
    borderRadius: 8,
    padding: 20,
    marginBottom: 15,
  },
  cardDestaqueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  cardDestaqueItem: {
    flex: 1,
    alignItems: 'center',
  },
  cardDestaqueLabel: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardDestaqueValor: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  progressContainer: {
    marginTop: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  progressVerde: { backgroundColor: '#34c759' },
  progressAmarelo: { backgroundColor: '#ff9500' },
  progressVermelho: { backgroundColor: '#ff3b30' },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  colMes: { flex: 1.5 },
  colVendido: { flex: 2, textAlign: 'right' },
  colMeta: { flex: 2, textAlign: 'right' },
  colPercent: { flex: 1, textAlign: 'center' },
  colStatus: { flex: 0.8, textAlign: 'center' },
})

function PDFMetaVendas({ vendidoMes, metaMes, percentual, historico, nomeRep, periodo }) {
  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function getProgressStyle(percent) {
    if (percent >= 80) return styles.progressVerde
    if (percent >= 50) return styles.progressAmarelo
    return styles.progressVermelho
  }

  return (
    <PDFRelatorio
      titulo="Meta de Vendas"
      nomeRep={nomeRep}
      periodo={periodo}
      infoResumo={`${percentual.toFixed(0)}% realizado`}
    >
      {/* Card principal */}
      <View style={styles.cardDestaque}>
        <View style={styles.cardDestaqueRow}>
          <View style={styles.cardDestaqueItem}>
            <Text style={styles.cardDestaqueLabel}>Vendido</Text>
            <Text style={styles.cardDestaqueValor}>{formatarValor(vendidoMes)}</Text>
          </View>
          <View style={styles.cardDestaqueItem}>
            <Text style={styles.cardDestaqueLabel}>Meta</Text>
            <Text style={styles.cardDestaqueValor}>{formatarValor(metaMes)}</Text>
          </View>
          <View style={styles.cardDestaqueItem}>
            <Text style={styles.cardDestaqueLabel}>Realizado</Text>
            <Text style={styles.cardDestaqueValor}>{percentual.toFixed(0)}%</Text>
          </View>
        </View>

        {metaMes > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  getProgressStyle(percentual),
                  { width: `${Math.min(100, percentual)}%` }
                ]}
              />
            </View>
          </View>
        )}
      </View>

      {/* Historico */}
      {historico.length > 0 && (
        <>
          <Text style={styles.secaoTitulo}>Historico</Text>
          <View style={styles.tabela}>
            <View style={styles.tabelaHeader}>
              <Text style={[styles.tabelaHeaderCell, styles.colMes]}>Mes</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colVendido]}>Vendido</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colMeta]}>Meta</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colPercent]}>%</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colStatus]}>Status</Text>
            </View>

            {historico.map((h, idx) => (
              <View key={idx} style={styles.tabelaRow}>
                <Text style={[styles.tabelaCell, styles.colMes]}>{MESES[h.mes]} {h.ano}</Text>
                <Text style={[styles.tabelaCell, styles.colVendido]}>{formatarValor(h.vendido)}</Text>
                <Text style={[styles.tabelaCellSecondary, styles.colMeta]}>
                  {h.meta > 0 ? formatarValor(h.meta) : '-'}
                </Text>
                <Text style={[styles.tabelaCell, styles.colPercent]}>
                  {h.meta > 0 ? `${h.percentual.toFixed(0)}%` : '-'}
                </Text>
                <Text style={[
                  styles.tabelaCell,
                  styles.colStatus,
                  { color: h.meta > 0 ? (h.bateu ? '#34c759' : '#ff3b30') : '#8e8e93' }
                ]}>
                  {h.meta > 0 ? (h.bateu ? '✓' : '✗') : '-'}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </PDFRelatorio>
  )
}

export default PDFMetaVendas

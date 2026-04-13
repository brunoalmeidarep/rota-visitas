import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingBottom: 60,
  },
  header: {
    backgroundColor: '#1a3a6b',
    padding: 20,
    paddingTop: 25,
    paddingBottom: 25,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerBrand: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerData: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  headerTitulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  headerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerInfoLeft: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
  },
  headerInfoRight: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'right',
  },
  body: {
    padding: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#8e8e93',
  },
})

function formatarDataHoje() {
  const d = new Date()
  return d.toLocaleDateString('pt-BR')
}

function PDFRelatorio({ titulo, nomeRep, periodo, infoResumo, children }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerBrand}>MINHA ROTA RP</Text>
            <Text style={styles.headerData}>Gerado em {formatarDataHoje()}</Text>
          </View>
          <Text style={styles.headerTitulo}>{titulo}</Text>
          <View style={styles.headerInfo}>
            <Text style={styles.headerInfoLeft}>
              {nomeRep}{periodo ? ` • ${periodo}` : ''}
            </Text>
            {infoResumo && (
              <Text style={styles.headerInfoRight}>{infoResumo}</Text>
            )}
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {children}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Minha Rota RP</Text>
          <Text style={styles.footerText}>gerado em {formatarDataHoje()}</Text>
        </View>
      </Page>
    </Document>
  )
}

export default PDFRelatorio

// Estilos reutilizaveis para tabelas
export const tabelaStyles = StyleSheet.create({
  tabela: {
    marginTop: 10,
  },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f7',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tabelaHeaderCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#636366',
    textTransform: 'uppercase',
  },
  tabelaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tabelaRowAlerta: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  tabelaRowPerigo: {
    backgroundColor: 'rgba(255, 107, 0, 0.1)',
  },
  tabelaRowCritico: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  tabelaCell: {
    fontSize: 10,
    color: '#000000',
  },
  tabelaCellSecondary: {
    fontSize: 9,
    color: '#636366',
  },
  totalizador: {
    marginTop: 15,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  totalizadorText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1a3a6b',
  },
  card: {
    backgroundColor: '#f8f8fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardItem: {
    flex: 1,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 8,
    color: '#636366',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardValor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000000',
  },
  secaoTitulo: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1a3a6b',
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
  },
  badgeVerde: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    color: '#34c759',
  },
  badgeVermelho: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    color: '#ff3b30',
  },
})

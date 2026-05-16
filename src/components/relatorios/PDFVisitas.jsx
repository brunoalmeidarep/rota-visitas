import { Text, View, StyleSheet } from '@react-pdf/renderer'
import PDFRelatorio, { tabelaStyles } from './PDFRelatorio'

const styles = StyleSheet.create({
  ...tabelaStyles,
  colData: { flex: 1.2 },
  colCliente: { flex: 2.5 },
  colCidade: { flex: 1.5 },
  colCanal: { flex: 0.8, textAlign: 'center' },
  colObs: { flex: 2 },
  grupoHeader: {
    backgroundColor: '#f2f2f7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  grupoTitulo: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#636366',
  },
})

function PDFVisitas({ visitas, totalVisitas, clientesVisitados, nomeRep, periodo }) {
  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR')
  }

  function agruparPorSemana(items) {
    const grupos = {}
    items.forEach(item => {
      const data = new Date(item.data + 'T12:00:00')
      const inicioSemana = new Date(data)
      inicioSemana.setDate(data.getDate() - data.getDay())
      const chave = inicioSemana.toISOString().split('T')[0]

      if (!grupos[chave]) {
        grupos[chave] = {
          inicio: inicioSemana,
          visitas: []
        }
      }
      grupos[chave].visitas.push(item)
    })

    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, grupo]) => {
        const fim = new Date(grupo.inicio)
        fim.setDate(fim.getDate() + 6)
        return {
          label: `${grupo.inicio.toLocaleDateString('pt-BR')} - ${fim.toLocaleDateString('pt-BR')}`,
          visitas: grupo.visitas
        }
      })
  }

  const grupos = agruparPorSemana(visitas)

  return (
    <PDFRelatorio
      titulo="Relatório de Visitas"
      nomeRep={nomeRep}
      periodo={periodo}
      infoResumo={`${totalVisitas} visitas`}
    >
      {/* Resumo */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Visitas</Text>
            <Text style={styles.cardValor}>{totalVisitas}</Text>
          </View>
          <View style={styles.cardItem}>
            <Text style={styles.cardLabel}>Clientes</Text>
            <Text style={styles.cardValor}>{clientesVisitados}</Text>
          </View>
        </View>
      </View>

      {/* Tabela agrupada por semana */}
      {grupos.map((grupo, gIdx) => (
        <View key={gIdx}>
          <View style={styles.grupoHeader}>
            <Text style={styles.grupoTitulo}>{grupo.label}</Text>
          </View>

          <View style={styles.tabela}>
            <View style={styles.tabelaHeader}>
              <Text style={[styles.tabelaHeaderCell, styles.colData]}>Data</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colCliente]}>Cliente</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colCidade]}>Cidade</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colCanal]}>Canal</Text>
              <Text style={[styles.tabelaHeaderCell, styles.colObs]}>Obs</Text>
            </View>

            {grupo.visitas.map((v, idx) => (
              <View key={idx} style={styles.tabelaRow}>
                <Text style={[styles.tabelaCellSecondary, styles.colData]}>{formatarData(v.data)}</Text>
                <Text style={[styles.tabelaCell, styles.colCliente]}>{v.cliente_nome || '-'}</Text>
                <Text style={[styles.tabelaCellSecondary, styles.colCidade]}>{v.cliente_cidade || '-'}</Text>
                <Text style={[styles.tabelaCell, styles.colCanal]}>
                  {v.canal === 'whatsapp' ? 'WA' : 'P'}
                </Text>
                <Text style={[styles.tabelaCellSecondary, styles.colObs]}>
                  {v.observacao ? (v.observacao.length > 40 ? v.observacao.substring(0, 40) + '...' : v.observacao) : '-'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Totalizador */}
      <View style={styles.totalizador}>
        <Text style={styles.totalizadorText}>
          {totalVisitas} visitas • {clientesVisitados} clientes unicos
        </Text>
      </View>
    </PDFRelatorio>
  )
}

export default PDFVisitas

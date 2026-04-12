import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from '@react-pdf/renderer'

// Estilos do PDF
const createStyles = (corPrimaria = '#1a3a6b') => StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff'
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: corPrimaria,
    padding: 16,
    borderRadius: 8,
    marginBottom: 20
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  logo: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#ffffff'
  },
  headerInfo: {
    color: '#ffffff'
  },
  empresaNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4
  },
  empresaEmail: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)'
  },
  headerRight: {
    alignItems: 'flex-end'
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 6
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  headerData: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    textAlign: 'right'
  },

  // Dados lado a lado
  dadosRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16
  },
  dadosBox: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6
  },
  dadosBoxTitulo: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  dadosLinha: {
    fontSize: 10,
    marginBottom: 3,
    color: '#212529'
  },
  dadosLabel: {
    color: '#6c757d'
  },

  // Detalhes linha
  detalhesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16
  },
  detalheItem: {
    alignItems: 'center'
  },
  detalheLabel: {
    fontSize: 8,
    color: '#6c757d',
    marginBottom: 2
  },
  detalheValor: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#212529'
  },

  // Tabela
  tabela: {
    marginBottom: 16
  },
  tabelaHeader: {
    flexDirection: 'row',
    backgroundColor: '#e9ecef',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 4
  },
  tabelaHeaderCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#495057',
    textTransform: 'uppercase'
  },
  tabelaRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    alignItems: 'center'
  },
  colProduto: { flex: 3 },
  colQtd: { width: 40, textAlign: 'center' },
  colUn: { width: 30, textAlign: 'center' },
  colIpi: { width: 40, textAlign: 'center' },
  colSubtotal: { width: 70, textAlign: 'right' },
  produtoNome: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 2
  },
  produtoCodigo: {
    fontSize: 8,
    color: '#6c757d'
  },
  produtoPreco: {
    fontSize: 8,
    color: '#868e96',
    marginTop: 2
  },
  cellText: {
    fontSize: 10,
    color: '#212529'
  },

  // Totais
  totaisBox: {
    marginLeft: 'auto',
    width: 200,
    marginBottom: 16
  },
  totaisLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  totaisLabel: {
    fontSize: 10,
    color: '#6c757d'
  },
  totaisValor: {
    fontSize: 10,
    color: '#212529'
  },
  totaisTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#212529'
  },
  totaisTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#212529'
  },
  totaisTotalValor: {
    fontSize: 14,
    fontWeight: 'bold',
    color: corPrimaria
  },

  // Info adicionais
  infoBox: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16
  },
  infoTitulo: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4
  },
  infoTexto: {
    fontSize: 10,
    color: '#856404',
    lineHeight: 1.4
  },

  // Rodape
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef'
  },
  rodapeLeft: {
    flex: 1
  },
  rodapeLinha: {
    fontSize: 9,
    color: '#6c757d',
    marginBottom: 2
  },
  rodapeRight: {
    alignItems: 'flex-end'
  },
  rodapeMarca: {
    fontSize: 9,
    color: '#adb5bd',
    fontStyle: 'italic'
  }
})

// Formatar valor para BRL
function formatarValor(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor)
}

// Formatar data
function formatarData(dataStr) {
  if (!dataStr) return '-'
  const d = new Date(dataStr)
  return d.toLocaleDateString('pt-BR')
}

// Adicionar dias a uma data
function adicionarDias(dataStr, dias) {
  const d = new Date(dataStr)
  d.setDate(d.getDate() + dias)
  return d.toLocaleDateString('pt-BR')
}

// Componente do documento PDF
function DocumentoPDF({ pedido, representada, representante, cliente }) {
  const corPrimaria = representada?.cor_pdf || '#1a3a6b'
  const styles = createStyles(corPrimaria)
  const isOrcamento = pedido.status === 'orcamento'
  const numero = isOrcamento ? `ORC-${String(pedido.id).slice(-3).toUpperCase()}` : `#${String(pedido.numero).padStart(3, '0')}`

  // Calcular totais
  const itens = pedido.itens || []
  const subtotal = itens.reduce((acc, item) => acc + (item.preco_unitario * item.quantidade), 0)
  const totalIpi = itens.reduce((acc, item) => {
    const ipi = item.ipi || 0
    return acc + ((item.preco_unitario * item.quantidade) * ipi / 100)
  }, 0)
  const descontos = pedido.valor_desconto || 0
  const total = subtotal + totalIpi - descontos + (pedido.frete || 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {representada?.logo && (
              <Image src={representada.logo} style={styles.logo} />
            )}
            <View style={styles.headerInfo}>
              <Text style={styles.empresaNome}>{representada?.nome || 'Empresa'}</Text>
              <Text style={styles.empresaEmail}>{representada?.email || ''}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{numero}</Text>
            </View>
            <Text style={styles.headerData}>Emissao: {formatarData(pedido.created_at)}</Text>
            {isOrcamento && (
              <Text style={styles.headerData}>Validade: {adicionarDias(pedido.created_at, 7)}</Text>
            )}
          </View>
        </View>

        {/* Dados lado a lado */}
        <View style={styles.dadosRow}>
          {/* Representante */}
          <View style={styles.dadosBox}>
            <Text style={styles.dadosBoxTitulo}>Representante</Text>
            <Text style={styles.dadosLinha}>{representante?.nome || '-'}</Text>
            <Text style={styles.dadosLinha}>{representante?.cidade || ''}</Text>
            <Text style={styles.dadosLinha}>{representante?.email || ''}</Text>
            <Text style={styles.dadosLinha}>{representante?.telefone || ''}</Text>
          </View>

          {/* Cliente */}
          <View style={styles.dadosBox}>
            <Text style={styles.dadosBoxTitulo}>Cliente</Text>
            <Text style={styles.dadosLinha}>{cliente?.razao_social || pedido.cliente_nome}</Text>
            {cliente?.nome_fantasia && (
              <Text style={styles.dadosLinha}>{cliente.nome_fantasia}</Text>
            )}
            <Text style={styles.dadosLinha}>
              <Text style={styles.dadosLabel}>CNPJ: </Text>
              {cliente?.cnpj || '-'}
            </Text>
            <Text style={styles.dadosLinha}>
              <Text style={styles.dadosLabel}>IE: </Text>
              {cliente?.ie || '-'}
            </Text>
            <Text style={styles.dadosLinha}>
              {cliente?.cidade || ''}{cliente?.estado ? `/${cliente.estado}` : ''}
            </Text>
          </View>
        </View>

        {/* Linha de detalhes */}
        <View style={styles.detalhesRow}>
          <View style={styles.detalheItem}>
            <Text style={styles.detalheLabel}>Condicao de pagamento</Text>
            <Text style={styles.detalheValor}>{pedido.condicao_pagamento || '-'}</Text>
          </View>
          <View style={styles.detalheItem}>
            <Text style={styles.detalheLabel}>Regime tributario</Text>
            <Text style={styles.detalheValor}>{cliente?.regime_tributario || '-'}</Text>
          </View>
          <View style={styles.detalheItem}>
            <Text style={styles.detalheLabel}>Tipo de pedido</Text>
            <Text style={styles.detalheValor}>{pedido.tipo || 'Venda'}</Text>
          </View>
        </View>

        {/* Tabela de produtos */}
        <View style={styles.tabela}>
          {/* Header */}
          <View style={styles.tabelaHeader}>
            <Text style={[styles.tabelaHeaderCell, styles.colProduto]}>Produto</Text>
            <Text style={[styles.tabelaHeaderCell, styles.colQtd]}>Qtd</Text>
            <Text style={[styles.tabelaHeaderCell, styles.colUn]}>Un</Text>
            <Text style={[styles.tabelaHeaderCell, styles.colIpi]}>IPI</Text>
            <Text style={[styles.tabelaHeaderCell, styles.colSubtotal]}>Subtotal</Text>
          </View>

          {/* Itens */}
          {itens.map((item, index) => (
            <View key={index} style={styles.tabelaRow}>
              <View style={styles.colProduto}>
                <Text style={styles.produtoNome}>{item.produto_nome}</Text>
                <Text style={styles.produtoCodigo}>{item.produto_codigo}</Text>
                <Text style={styles.produtoPreco}>{formatarValor(item.preco_unitario)}/un</Text>
              </View>
              <Text style={[styles.cellText, styles.colQtd]}>{item.quantidade}</Text>
              <Text style={[styles.cellText, styles.colUn]}>{item.unidade || 'UN'}</Text>
              <Text style={[styles.cellText, styles.colIpi]}>
                {item.ipi ? `${item.ipi}%` : '-'}
              </Text>
              <Text style={[styles.cellText, styles.colSubtotal]}>
                {formatarValor(item.subtotal || (item.preco_unitario * item.quantidade))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totais */}
        <View style={styles.totaisBox}>
          <View style={styles.totaisLinha}>
            <Text style={styles.totaisLabel}>Qtde. total</Text>
            <Text style={styles.totaisValor}>
              {itens.reduce((acc, i) => acc + i.quantidade, 0)} un
            </Text>
          </View>
          <View style={styles.totaisLinha}>
            <Text style={styles.totaisLabel}>Subtotal produtos</Text>
            <Text style={styles.totaisValor}>{formatarValor(subtotal)}</Text>
          </View>
          {totalIpi > 0 && (
            <View style={styles.totaisLinha}>
              <Text style={styles.totaisLabel}>IPI</Text>
              <Text style={styles.totaisValor}>{formatarValor(totalIpi)}</Text>
            </View>
          )}
          {descontos > 0 && (
            <View style={styles.totaisLinha}>
              <Text style={styles.totaisLabel}>Descontos</Text>
              <Text style={[styles.totaisValor, { color: '#28a745' }]}>
                - {formatarValor(descontos)}
              </Text>
            </View>
          )}
          {pedido.frete > 0 && (
            <View style={styles.totaisLinha}>
              <Text style={styles.totaisLabel}>Frete</Text>
              <Text style={styles.totaisValor}>{formatarValor(pedido.frete)}</Text>
            </View>
          )}
          <View style={styles.totaisTotal}>
            <Text style={styles.totaisTotalLabel}>Total</Text>
            <Text style={[styles.totaisTotalValor, { color: corPrimaria }]}>
              {formatarValor(total)}
            </Text>
          </View>
        </View>

        {/* Informacoes adicionais */}
        {pedido.info_adicionais && (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitulo}>Informacoes adicionais</Text>
            <Text style={styles.infoTexto}>{pedido.info_adicionais}</Text>
          </View>
        )}

        {/* Rodape */}
        <View style={styles.rodape}>
          <View style={styles.rodapeLeft}>
            <Text style={styles.rodapeLinha}>Vendedor: {representante?.nome || '-'}</Text>
            <Text style={styles.rodapeLinha}>Tipo: {pedido.tipo || 'Venda'}</Text>
            {pedido.oc_cliente && (
              <Text style={styles.rodapeLinha}>OC do cliente: {pedido.oc_cliente}</Text>
            )}
          </View>
          <View style={styles.rodapeRight}>
            <Text style={styles.rodapeMarca}>Minha Rota RP</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

// Funcao para gerar e abrir PDF
export async function gerarPDF(pedido, representada, representante, cliente) {
  const blob = await pdf(
    <DocumentoPDF
      pedido={pedido}
      representada={representada}
      representante={representante}
      cliente={cliente}
    />
  ).toBlob()

  return blob
}

// Funcao para abrir preview do PDF
export async function abrirPreviewPDF(pedido, representada, representante, cliente) {
  const blob = await gerarPDF(pedido, representada, representante, cliente)
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  return blob
}

// Funcao para compartilhar PDF
export async function compartilharPDF(pedido, representada, representante, cliente) {
  const blob = await gerarPDF(pedido, representada, representante, cliente)
  const isOrcamento = pedido.status === 'orcamento'
  const numero = isOrcamento ? `ORC-${String(pedido.id).slice(-3)}` : `Pedido-${pedido.numero}`
  const fileName = `${numero}-${pedido.cliente_nome?.replace(/\s+/g, '-') || 'cliente'}.pdf`

  // Criar arquivo
  const file = new File([blob], fileName, { type: 'application/pdf' })

  // Tentar Web Share API
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `${isOrcamento ? 'Orcamento' : 'Pedido'} - ${pedido.cliente_nome}`,
        files: [file]
      })
      return true
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[compartilharPDF] Erro:', err)
      }
    }
  }

  // Fallback: download direto
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}

export default DocumentoPDF

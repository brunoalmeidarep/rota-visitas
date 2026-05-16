import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import PDFClientesInativos from './PDFClientesInativos'
import PDFVendasProduto from './PDFVendasProduto'
import PDFResumoVendas from './PDFResumoVendas'
import PDFVisitas from './PDFVisitas'
import PDFMetaVendas from './PDFMetaVendas'
import './PreviewPDF.css'

function PreviewPDF() {
  const navigate = useNavigate()
  const location = useLocation()
  const { tipo, dados, nomeArquivo, titulo } = location.state || {}

  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfBlob, setPdfBlob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [sharing, setSharing] = useState(false)

  function criarDocumento() {
    if (!tipo || !dados) return null

    switch (tipo) {
      case 'clientes-inativos':
        return <PDFClientesInativos {...dados} />
      case 'vendas-produto':
        return <PDFVendasProduto {...dados} />
      case 'resumo-vendas':
        return <PDFResumoVendas {...dados} />
      case 'visitas':
        return <PDFVisitas {...dados} />
      case 'meta-vendas':
        return <PDFMetaVendas {...dados} />
      default:
        return null
    }
  }

  useEffect(() => {
    if (!tipo || !dados) {
      setErro('Dados do relatorio nao encontrados')
      setLoading(false)
      return
    }

    async function gerarPDF() {
      try {
        const documento = criarDocumento()
        if (!documento) {
          setErro('Tipo de relatorio invalido')
          setLoading(false)
          return
        }

        const blob = await pdf(documento).toBlob()
        const url = URL.createObjectURL(blob)
        setPdfBlob(blob)
        setPdfUrl(url)
        setLoading(false)
      } catch (err) {
        console.error('[PreviewPDF] Erro ao gerar:', err)
        setErro('Erro ao gerar PDF: ' + (err.message || 'desconhecido'))
        setLoading(false)
      }
    }

    gerarPDF()

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [tipo, dados])

  async function handleCompartilhar() {
    if (!pdfBlob || sharing) return
    setSharing(true)

    const file = new File([pdfBlob], nomeArquivo || 'relatorio.pdf', { type: 'application/pdf' })

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: titulo || 'Relatório',
        })
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[PreviewPDF] Erro ao compartilhar:', err)
          handleDownload()
        }
      }
    } else {
      handleDownload()
    }
    setSharing(false)
  }

  function handleDownload() {
    if (!pdfBlob || downloading) return
    setDownloading(true)

    try {
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = nomeArquivo || 'relatorio.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[PreviewPDF] Erro ao baixar:', err)
      alert('Erro ao baixar PDF')
    }

    setTimeout(() => setDownloading(false), 1000)
  }

  return (
    <div className="preview-pdf">
      {/* Header */}
      <header className="pp-header">
        <button className="pp-fechar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="pp-nome">{nomeArquivo || 'relatorio.pdf'}</span>
        <button className="pp-compartilhar-header" onClick={handleCompartilhar} disabled={!pdfBlob || sharing}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>
      </header>

      {/* Corpo */}
      <div className="pp-corpo">
        {loading && (
          <div className="pp-loading">
            <div className="pp-loading-spinner"></div>
            <span>Aguarde, gerando PDF...</span>
          </div>
        )}
        {erro && (
          <div className="pp-erro">
            <span>⚠️</span>
            <p>{erro}</p>
            <button onClick={() => navigate(-1)}>Voltar</button>
          </div>
        )}
        {pdfUrl && !loading && !erro && (
          <iframe
            src={pdfUrl}
            className="pp-iframe"
            title="Preview PDF"
          />
        )}
      </div>

      {/* Rodape */}
      {!loading && !erro && (
        <footer className="pp-footer">
        <button className="pp-btn compartilhar" onClick={handleCompartilhar} disabled={sharing}>
          {sharing ? (
            <div className="pp-btn-spinner"></div>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          )}
          {sharing ? 'Aguarde...' : 'Compartilhar'}
        </button>
      </footer>
      )}
    </div>
  )
}

export default PreviewPDF

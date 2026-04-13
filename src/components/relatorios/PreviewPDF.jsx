import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { pdf } from '@react-pdf/renderer'
import './PreviewPDF.css'

function PreviewPDF() {
  const navigate = useNavigate()
  const location = useLocation()
  const { documento, nomeArquivo, titulo } = location.state || {}

  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfBlob, setPdfBlob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!documento) {
      setErro('Documento nao encontrado')
      setLoading(false)
      return
    }

    async function gerarPDF() {
      try {
        const blob = await pdf(documento).toBlob()
        const url = URL.createObjectURL(blob)
        setPdfBlob(blob)
        setPdfUrl(url)
        setLoading(false)
      } catch (err) {
        console.error('[PreviewPDF] Erro ao gerar:', err)
        setErro('Erro ao gerar PDF')
        setLoading(false)
      }
    }

    gerarPDF()

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [documento])

  async function handleCompartilhar() {
    if (!pdfBlob) return

    const file = new File([pdfBlob], nomeArquivo || 'relatorio.pdf', { type: 'application/pdf' })

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: titulo || 'Relatorio',
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
  }

  function handleEmail() {
    const assunto = encodeURIComponent(titulo || 'Relatorio Minha Rota RP')
    const corpo = encodeURIComponent(`Segue em anexo o relatorio "${titulo || 'Relatorio'}".\n\nGerado por Minha Rota RP`)
    window.location.href = `mailto:?subject=${assunto}&body=${corpo}`
  }

  function handleDownload() {
    if (!pdfUrl) return

    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = nomeArquivo || 'relatorio.pdf'
    link.click()
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
        <button className="pp-compartilhar-header" onClick={handleCompartilhar}>
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
            <span>Gerando PDF...</span>
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
          <button className="pp-btn compartilhar" onClick={handleCompartilhar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            Compartilhar
          </button>
          <button className="pp-btn email" onClick={handleEmail}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            E-mail
          </button>
          <button className="pp-btn download" onClick={handleDownload}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </button>
        </footer>
      )}
    </div>
  )
}

export default PreviewPDF

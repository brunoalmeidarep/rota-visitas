import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Relatorios.css'

function Relatorios() {
  const navigate = useNavigate()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const relatorios = [
    {
      id: 'meta',
      icone: '📈',
      titulo: 'Meta de Vendas',
      subtitulo: 'Acompanhe suas metas mensais',
      rota: '/relatorios/meta',
      cor: '#34c759'
    },
    {
      id: 'resumo',
      icone: '📊',
      titulo: 'Resumo de Vendas',
      subtitulo: 'Total vendido por periodo',
      rota: '/relatorios/resumo',
      cor: '#007aff'
    },
    {
      id: 'ranking',
      icone: '🏆',
      titulo: 'Ranking de Clientes',
      subtitulo: 'Curva ABC dos clientes',
      rota: '/relatorios/ranking',
      cor: '#ffcc00'
    },
    {
      id: 'produtos',
      icone: '📦',
      titulo: 'Vendas por Produto',
      subtitulo: 'Produtos mais vendidos',
      rota: '/relatorios/produtos',
      cor: '#af52de'
    },
    {
      id: 'inativos',
      icone: '⚠️',
      titulo: 'Clientes Inativos',
      subtitulo: 'Sem compra ha 90+ dias',
      rota: '/relatorios/inativos',
      cor: '#ff9500'
    },
    {
      id: 'visitas',
      icone: '✅',
      titulo: 'Relatorio de Visitas',
      subtitulo: 'Historico de visitas',
      rota: '/relatorios/visitas',
      cor: '#30d158'
    }
  ]

  return (
    <div className={`relatorios ${isDark ? 'dark' : 'light'}`}>
      <header className="relatorios-header">
        <button className="relatorios-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Relatorios</h1>
      </header>

      <div className="relatorios-content">
        <div className="relatorios-lista">
          {relatorios.map(rel => (
            <button
              key={rel.id}
              className="relatorios-card"
              onClick={() => navigate(rel.rota)}
            >
              <span
                className="relatorios-card-icon"
                style={{ background: `${rel.cor}20` }}
              >
                {rel.icone}
              </span>
              <div className="relatorios-card-info">
                <span className="relatorios-card-titulo">{rel.titulo}</span>
                <span className="relatorios-card-subtitulo">{rel.subtitulo}</span>
              </div>
              <span className="relatorios-card-seta">›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Relatorios

import { useNavigate } from 'react-router-dom'
import './Relatorios.css'

function Relatorios() {
  const navigate = useNavigate()

  function placeholder(nome) {
    alert(`${nome} — em desenvolvimento`)
  }

  return (
    <div className="relatorios">
      {/* Header */}
      <header className="relatorios-header">
        <button className="relatorios-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Relatórios</h1>
      </header>

      <div className="relatorios-content">
        {/* Vendas */}
        <section className="relatorios-secao">
          <h2 className="relatorios-secao-titulo">Vendas</h2>
          <div className="relatorios-lista">
            <button className="relatorios-card" onClick={() => placeholder('Resumo de vendas')}>
              <span className="relatorios-card-icon">📊</span>
              <div className="relatorios-card-info">
                <span className="relatorios-card-titulo">Resumo de vendas</span>
                <span className="relatorios-card-subtitulo">Total por período</span>
              </div>
              <span className="relatorios-card-seta">›</span>
            </button>
            <button className="relatorios-card" onClick={() => placeholder('Vendas por cliente')}>
              <span className="relatorios-card-icon">👥</span>
              <div className="relatorios-card-info">
                <span className="relatorios-card-titulo">Vendas por cliente</span>
                <span className="relatorios-card-subtitulo">Ranking de clientes</span>
              </div>
              <span className="relatorios-card-seta">›</span>
            </button>
            <button className="relatorios-card" onClick={() => placeholder('Vendas por produto')}>
              <span className="relatorios-card-icon">📦</span>
              <div className="relatorios-card-info">
                <span className="relatorios-card-titulo">Vendas por produto</span>
                <span className="relatorios-card-subtitulo">Produtos mais vendidos</span>
              </div>
              <span className="relatorios-card-seta">›</span>
            </button>
          </div>
        </section>

        {/* Visitas */}
        <section className="relatorios-secao">
          <h2 className="relatorios-secao-titulo">Visitas</h2>
          <div className="relatorios-lista">
            <button className="relatorios-card" onClick={() => placeholder('Visitas realizadas')}>
              <span className="relatorios-card-icon">✅</span>
              <div className="relatorios-card-info">
                <span className="relatorios-card-titulo">Visitas realizadas</span>
                <span className="relatorios-card-subtitulo">Histórico de visitas</span>
              </div>
              <span className="relatorios-card-seta">›</span>
            </button>
            <button className="relatorios-card" onClick={() => placeholder('Clientes inativos')}>
              <span className="relatorios-card-icon">⚠️</span>
              <div className="relatorios-card-info">
                <span className="relatorios-card-titulo">Clientes inativos</span>
                <span className="relatorios-card-subtitulo">Sem visita há 90+ dias</span>
              </div>
              <span className="relatorios-card-seta">›</span>
            </button>
          </div>
        </section>

        {/* Metas */}
        <section className="relatorios-secao">
          <h2 className="relatorios-secao-titulo">Metas</h2>
          <div className="relatorios-lista">
            <button className="relatorios-card" onClick={() => placeholder('Metas de vendas')}>
              <span className="relatorios-card-icon">🎯</span>
              <div className="relatorios-card-info">
                <span className="relatorios-card-titulo">Metas de vendas</span>
                <span className="relatorios-card-subtitulo">Acompanhamento mensal</span>
              </div>
              <span className="relatorios-card-seta">›</span>
            </button>
            <button className="relatorios-card" onClick={() => placeholder('Comissões')}>
              <span className="relatorios-card-icon">💵</span>
              <div className="relatorios-card-info">
                <span className="relatorios-card-titulo">Comissões</span>
                <span className="relatorios-card-subtitulo">Cálculo de comissão</span>
              </div>
              <span className="relatorios-card-seta">›</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Relatorios

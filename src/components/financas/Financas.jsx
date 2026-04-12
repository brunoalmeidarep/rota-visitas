import { useNavigate } from 'react-router-dom'
import './Financas.css'

function Financas() {
  const navigate = useNavigate()

  function placeholder(nome) {
    alert(`${nome} — em desenvolvimento`)
  }

  return (
    <div className="financas">
      {/* Header */}
      <header className="financas-header">
        <button className="financas-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Financas</h1>
      </header>

      <div className="financas-content">
        {/* Resumo */}
        <section className="financas-resumo">
          <div className="financas-resumo-card receita">
            <span className="financas-resumo-label">Receitas (mes)</span>
            <span className="financas-resumo-valor">R$ 0,00</span>
          </div>
          <div className="financas-resumo-card despesa">
            <span className="financas-resumo-label">Despesas (mes)</span>
            <span className="financas-resumo-valor">R$ 0,00</span>
          </div>
        </section>

        {/* Receitas */}
        <section className="financas-secao">
          <h2 className="financas-secao-titulo">Receitas</h2>
          <div className="financas-lista">
            <button className="financas-card" onClick={() => placeholder('Comissoes')}>
              <span className="financas-card-icon">💵</span>
              <div className="financas-card-info">
                <span className="financas-card-titulo">Comissoes</span>
                <span className="financas-card-subtitulo">Registrar recebimentos</span>
              </div>
              <span className="financas-card-seta">›</span>
            </button>
            <button className="financas-card" onClick={() => placeholder('Outras receitas')}>
              <span className="financas-card-icon">💰</span>
              <div className="financas-card-info">
                <span className="financas-card-titulo">Outras receitas</span>
                <span className="financas-card-subtitulo">Bonificacoes, premios</span>
              </div>
              <span className="financas-card-seta">›</span>
            </button>
          </div>
        </section>

        {/* Despesas */}
        <section className="financas-secao">
          <h2 className="financas-secao-titulo">Despesas</h2>
          <div className="financas-lista">
            <button className="financas-card" onClick={() => placeholder('Despesas operacionais')}>
              <span className="financas-card-icon">🚗</span>
              <div className="financas-card-info">
                <span className="financas-card-titulo">Despesas operacionais</span>
                <span className="financas-card-subtitulo">Combustivel, manutencao, km</span>
              </div>
              <span className="financas-card-seta">›</span>
            </button>
            <button className="financas-card" onClick={() => placeholder('Impostos')}>
              <span className="financas-card-icon">📋</span>
              <div className="financas-card-info">
                <span className="financas-card-titulo">Impostos</span>
                <span className="financas-card-subtitulo">IRPF, INSS, ISS</span>
              </div>
              <span className="financas-card-seta">›</span>
            </button>
            <button className="financas-card" onClick={() => placeholder('Outras despesas')}>
              <span className="financas-card-icon">📦</span>
              <div className="financas-card-info">
                <span className="financas-card-titulo">Outras despesas</span>
                <span className="financas-card-subtitulo">Telefone, materiais</span>
              </div>
              <span className="financas-card-seta">›</span>
            </button>
          </div>
        </section>

        {/* Compromissos */}
        <section className="financas-secao">
          <h2 className="financas-secao-titulo">Compromissos</h2>
          <div className="financas-lista">
            <button className="financas-card" onClick={() => placeholder('Contas a pagar')}>
              <span className="financas-card-icon">📅</span>
              <div className="financas-card-info">
                <span className="financas-card-titulo">Contas a pagar</span>
                <span className="financas-card-subtitulo">Vencimentos proximos</span>
              </div>
              <span className="financas-card-seta">›</span>
            </button>
            <button className="financas-card" onClick={() => placeholder('Contas a receber')}>
              <span className="financas-card-icon">📥</span>
              <div className="financas-card-info">
                <span className="financas-card-titulo">Contas a receber</span>
                <span className="financas-card-subtitulo">Comissoes pendentes</span>
              </div>
              <span className="financas-card-seta">›</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Financas

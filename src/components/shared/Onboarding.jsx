import './Onboarding.css'

function Onboarding({ onClose, isDark }) {
  function handleComplete() {
    localStorage.setItem('onboarding_completo', 'true')
    onClose()
  }

  return (
    <div className={`onboarding-overlay ${isDark ? 'dark' : 'light'}`}>
      <div className="onboarding-card">
        {/* Header */}
        <div className="onboarding-header">
          <span className="onboarding-icon">🗺️</span>
          <h1>Bem-vindo!</h1>
          <p>Vamos te mostrar o essencial</p>
        </div>

        {/* Itens */}
        <div className="onboarding-items">
          <div className="onboarding-item">
            <span className="onboarding-item-icon">✅</span>
            <div className="onboarding-item-info">
              <span className="onboarding-item-titulo">Check-in de visita</span>
              <span className="onboarding-item-desc">Registre suas visitas presenciais</span>
            </div>
          </div>

          <div className="onboarding-item">
            <span className="onboarding-item-icon">📋</span>
            <div className="onboarding-item-info">
              <span className="onboarding-item-titulo">Pedidos com catálogo</span>
              <span className="onboarding-item-desc">Envie orçamentos em PDF</span>
            </div>
          </div>

          <div className="onboarding-item">
            <span className="onboarding-item-icon">💸</span>
            <div className="onboarding-item-info">
              <span className="onboarding-item-titulo">Despesa rápida</span>
              <span className="onboarding-item-desc">Toque no + em Finanças</span>
            </div>
          </div>

          <div className="onboarding-item">
            <span className="onboarding-item-icon">🗺️</span>
            <div className="onboarding-item-info">
              <span className="onboarding-item-titulo">Rota otimizada</span>
              <span className="onboarding-item-desc">Planeje seu dia com um clique</span>
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="onboarding-actions">
          <button className="onboarding-btn-pular" onClick={handleComplete}>
            Pular
          </button>
          <button className="onboarding-btn-comecar" onClick={handleComplete}>
            Começar →
          </button>
        </div>
      </div>
    </div>
  )
}

export default Onboarding

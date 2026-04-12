import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './Mais.css'

function Mais() {
  const navigate = useNavigate()

  async function handleLogout() {
    const confirma = confirm('Deseja realmente sair?')
    if (!confirma) return

    await supabase.auth.signOut()
    // O App.jsx vai detectar a mudança de sessão e mostrar o Login
  }

  function placeholder(nome) {
    alert(`${nome} — em desenvolvimento`)
  }

  return (
    <div className="mais">
      {/* Header */}
      <header className="mais-header">
        <button className="mais-voltar" onClick={() => navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Mais</h1>
      </header>

      <div className="mais-content">
        {/* Relatórios */}
        <section className="mais-secao">
          <h2 className="mais-secao-titulo">Relatórios</h2>
          <div className="mais-grid">
            <button className="mais-item" onClick={() => placeholder('Vendas')}>
              <span className="mais-item-icon">📊</span>
              <span className="mais-item-texto">Vendas</span>
            </button>
            <button className="mais-item" onClick={() => placeholder('Orçamentos')}>
              <span className="mais-item-icon">📝</span>
              <span className="mais-item-texto">Orçamentos</span>
            </button>
            <button className="mais-item" onClick={() => placeholder('Visitas')}>
              <span className="mais-item-icon">📍</span>
              <span className="mais-item-texto">Visitas</span>
            </button>
            <button className="mais-item" onClick={() => placeholder('Bonificações')}>
              <span className="mais-item-icon">🎁</span>
              <span className="mais-item-texto">Bonificações</span>
            </button>
            <button className="mais-item" onClick={() => placeholder('Gastos com clientes')}>
              <span className="mais-item-icon">💸</span>
              <span className="mais-item-texto">Gastos</span>
            </button>
          </div>
        </section>

        {/* Finanças */}
        <section className="mais-secao">
          <h2 className="mais-secao-titulo">Finanças</h2>
          <div className="mais-grid">
            <button className="mais-item" onClick={() => placeholder('Receitas')}>
              <span className="mais-item-icon">💰</span>
              <span className="mais-item-texto">Receitas</span>
            </button>
            <button className="mais-item" onClick={() => placeholder('Despesas')}>
              <span className="mais-item-icon">📉</span>
              <span className="mais-item-texto">Despesas</span>
            </button>
            <button className="mais-item" onClick={() => placeholder('Impostos')}>
              <span className="mais-item-icon">🧾</span>
              <span className="mais-item-texto">Impostos</span>
            </button>
            <button className="mais-item" onClick={() => placeholder('Compromissos')}>
              <span className="mais-item-icon">📅</span>
              <span className="mais-item-texto">Compromissos</span>
            </button>
          </div>
        </section>

        {/* Configurações */}
        <section className="mais-secao">
          <h2 className="mais-secao-titulo">Configurações</h2>
          <div className="mais-lista">
            <button className="mais-lista-item" onClick={() => navigate('/mais/perfil')}>
              <span className="mais-lista-icon">👤</span>
              <span className="mais-lista-texto">Meu Perfil</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item" onClick={() => navigate('/mais/representadas')}>
              <span className="mais-lista-icon">🏢</span>
              <span className="mais-lista-texto">Empresas representadas</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item" onClick={() => navigate('/mais/segmentos')}>
              <span className="mais-lista-icon">🏷️</span>
              <span className="mais-lista-texto">Segmentos</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item" onClick={() => placeholder('Importar clientes')}>
              <span className="mais-lista-icon">📥</span>
              <span className="mais-lista-texto">Importar clientes</span>
              <span className="mais-lista-seta">›</span>
            </button>
          </div>
        </section>

        {/* Conta */}
        <section className="mais-secao">
          <h2 className="mais-secao-titulo">Conta</h2>
          <div className="mais-lista">
            <button className="mais-lista-item" onClick={() => placeholder('Termos de uso')}>
              <span className="mais-lista-icon">📄</span>
              <span className="mais-lista-texto">Termos de uso</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item" onClick={() => placeholder('Privacidade')}>
              <span className="mais-lista-icon">🔒</span>
              <span className="mais-lista-texto">Privacidade</span>
              <span className="mais-lista-seta">›</span>
            </button>
            <button className="mais-lista-item logout" onClick={handleLogout}>
              <span className="mais-lista-icon">🚪</span>
              <span className="mais-lista-texto">Sair</span>
            </button>
          </div>
        </section>

        {/* Versão */}
        <div className="mais-versao">
          Minha Rota RP v2.0.0
        </div>
      </div>
    </div>
  )
}

export default Mais

import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './Mais.css'

function Mais() {
  const navigate = useNavigate()

  async function handleLogout() {
    const confirma = confirm('Deseja realmente sair?')
    if (!confirma) return

    // Limpar cache de plano
    localStorage.removeItem('plano_cache')

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
        <h1>Opções</h1>
      </header>

      <div className="mais-content">
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

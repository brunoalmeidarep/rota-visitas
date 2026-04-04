import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './Login.css'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [modoRecuperacao, setModoRecuperacao] = useState(false)
  const [mensagemRecuperacao, setMensagemRecuperacao] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha
    })

    setLoading(false)

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setErro('E-mail ou senha incorretos')
      } else if (error.message.includes('Email not confirmed')) {
        setErro('Confirme seu e-mail antes de entrar')
      } else {
        setErro('Erro ao fazer login. Tente novamente.')
      }
    }
    // Se login OK, App.jsx detecta automaticamente via onAuthStateChange
  }

  async function handleRecuperarSenha(e) {
    e.preventDefault()
    setErro('')
    setMensagemRecuperacao('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`
    })

    setLoading(false)

    if (error) {
      setErro('Erro ao enviar e-mail. Verifique o endereço.')
    } else {
      setMensagemRecuperacao('E-mail enviado! Verifique sua caixa de entrada.')
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <span className="logo-icon">💼</span>
          <h1>Minha Rota RP</h1>
          <p>CRM para representantes comerciais</p>
        </div>

        {/* Formulário */}
        <form onSubmit={modoRecuperacao ? handleRecuperarSenha : handleLogin}>
          {modoRecuperacao ? (
            <>
              <p className="recuperacao-texto">
                Digite seu e-mail para receber o link de recuperação de senha.
              </p>
              <div className="campo">
                <label htmlFor="email">E-mail</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
            </>
          ) : (
            <>
              <div className="campo">
                <label htmlFor="email">E-mail</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="campo">
                <label htmlFor="senha">Senha</label>
                <input
                  type="password"
                  id="senha"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  autoComplete="current-password"
                />
              </div>
            </>
          )}

          {/* Mensagem de erro */}
          {erro && <div className="erro-msg">{erro}</div>}

          {/* Mensagem de recuperação */}
          {mensagemRecuperacao && <div className="sucesso-msg">{mensagemRecuperacao}</div>}

          {/* Botão */}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : modoRecuperacao ? (
              'Enviar link'
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Links */}
        <div className="login-links">
          {modoRecuperacao ? (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setModoRecuperacao(false)
                setErro('')
                setMensagemRecuperacao('')
              }}
            >
              Voltar ao login
            </button>
          ) : (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setModoRecuperacao(true)
                setErro('')
              }}
            >
              Esqueci minha senha
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login

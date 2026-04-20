import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './Login.css'

function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [modo, setModo] = useState('login') // 'login' | 'cadastro' | 'recuperacao'
  const [mensagemSucesso, setMensagemSucesso] = useState('')

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
    setMensagemSucesso('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`
    })

    setLoading(false)

    if (error) {
      setErro('Erro ao enviar e-mail. Verifique o endereço.')
    } else {
      setMensagemSucesso('E-mail enviado! Verifique sua caixa de entrada.')
    }
  }

  async function handleCadastro(e) {
    e.preventDefault()
    setErro('')
    setMensagemSucesso('')

    if (!nome.trim()) {
      setErro('Informe seu nome')
      return
    }

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem')
      return
    }

    if (senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha
      })

      if (authError) throw authError

      const user = authData.user
      if (!user) throw new Error('Erro ao criar usuário')

      const emailNormalizado = email.trim().toLowerCase()

      const { data: existente } = await supabase
        .from('representantes')
        .select('id, empresa_id, plano')
        .eq('email', emailNormalizado)
        .maybeSingle()

      if (existente) {
        await supabase
          .from('representantes')
          .update({ auth_id: user.id })
          .eq('id', existente.id)
      } else {
        await supabase
          .from('representantes')
          .insert({
            auth_id: user.id,
            email: emailNormalizado,
            nome: nome.trim(),
            plano: 'starter'
          })
      }

      setMensagemSucesso('Conta criada! Verifique seu e-mail para confirmar.')
      setModo('login')
      setSenha('')
      setConfirmarSenha('')
      setNome('')
    } catch (error) {
      console.error('Erro ao cadastrar:', error)
      if (error.message?.includes('already registered')) {
        setErro('Este e-mail já está cadastrado. Faça login.')
      } else {
        setErro(error.message || 'Erro ao criar conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  function getFormHandler() {
    if (modo === 'recuperacao') return handleRecuperarSenha
    if (modo === 'cadastro') return handleCadastro
    return handleLogin
  }

  function getButtonText() {
    if (loading) return null
    if (modo === 'recuperacao') return 'Enviar link'
    if (modo === 'cadastro') return 'Criar conta'
    return 'Entrar'
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
        <form onSubmit={getFormHandler()}>
          {modo === 'recuperacao' && (
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
          )}

          {modo === 'cadastro' && (
            <>
              <div className="campo">
                <label htmlFor="nome">Nome completo</label>
                <input
                  type="text"
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  required
                  autoComplete="name"
                />
              </div>

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
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="campo">
                <label htmlFor="confirmarSenha">Confirmar senha</label>
                <input
                  type="password"
                  id="confirmarSenha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  placeholder="Digite novamente"
                  required
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {modo === 'login' && (
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

          {/* Mensagem de sucesso */}
          {mensagemSucesso && <div className="sucesso-msg">{mensagemSucesso}</div>}

          {/* Botão */}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? <span className="spinner"></span> : getButtonText()}
          </button>
        </form>

        {/* Links */}
        <div className="login-links">
          {modo === 'recuperacao' && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setModo('login')
                setErro('')
                setMensagemSucesso('')
              }}
            >
              Voltar ao login
            </button>
          )}

          {modo === 'cadastro' && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setModo('login')
                setErro('')
                setMensagemSucesso('')
              }}
            >
              Já tenho conta
            </button>
          )}

          {modo === 'login' && (
            <>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setModo('cadastro')
                  setErro('')
                  setMensagemSucesso('')
                }}
              >
                Criar conta
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setModo('recuperacao')
                  setErro('')
                  setMensagemSucesso('')
                }}
              >
                Esqueci minha senha
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login

import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './components/shared/Login'
import Home from './components/Home'
import CarteiraClientes from './components/clientes/CarteiraClientes'
import CadastroCliente from './components/clientes/CadastroCliente'
import PerfilCliente from './components/clientes/PerfilCliente'
import DadosCliente from './components/clientes/DadosCliente'
import Planner from './components/planner/Planner'
import Mais from './components/mais/Mais'
import MeuPerfil from './components/mais/MeuPerfil'

// Placeholder components (serão substituídos pelos reais)
const ListaPedidos = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Pedidos</h1>
    </header>
    <div className="screen-content"><p>Em desenvolvimento...</p></div>
  </div>
)

const ListaProdutos = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Produtos</h1>
    </header>
    <div className="screen-content"><p>Em desenvolvimento...</p></div>
  </div>
)

const Relatorios = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Relatórios</h1>
    </header>
    <div className="screen-content"><p>Em desenvolvimento...</p></div>
  </div>
)

const Financas = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Finanças</h1>
    </header>
    <div className="screen-content"><p>Em desenvolvimento...</p></div>
  </div>
)

const Mapa = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Mapa</h1>
    </header>
    <div className="screen-content"><p>Em desenvolvimento...</p></div>
  </div>
)

const Bonificacao = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Bonificação</h1>
    </header>
    <div className="screen-content"><p>Em desenvolvimento...</p></div>
  </div>
)

const GastosCliente = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Gastos</h1>
    </header>
    <div className="screen-content"><p>Em desenvolvimento...</p></div>
  </div>
)

const EditarCliente = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Editar Cliente</h1>
    </header>
    <div className="screen-content"><p>Em desenvolvimento...</p></div>
  </div>
)

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pedidos" element={<ListaPedidos />} />
        <Route path="/clientes" element={<CarteiraClientes />} />
        <Route path="/clientes/novo" element={<CadastroCliente />} />
        <Route path="/clientes/:id" element={<PerfilCliente />} />
        <Route path="/clientes/:id/dados" element={<DadosCliente />} />
        <Route path="/clientes/:id/editar" element={<EditarCliente />} />
        <Route path="/clientes/:id/bonificacao" element={<Bonificacao />} />
        <Route path="/clientes/:id/gastos" element={<GastosCliente />} />
        <Route path="/produtos" element={<ListaProdutos />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/mais" element={<Mais />} />
        <Route path="/mais/perfil" element={<MeuPerfil />} />
        <Route path="/mais/relatorios" element={<Relatorios />} />
        <Route path="/mais/financas" element={<Financas />} />
        <Route path="/mapa" element={<Mapa />} />
      </Routes>
    </div>
  )
}

export default App

import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Navbar from './components/shared/Navbar'
import Login from './components/shared/Login'
import CarteiraClientes from './components/clientes/CarteiraClientes'
import CadastroCliente from './components/clientes/CadastroCliente'
import Planner from './components/planner/Planner'

// Placeholder components (serão substituídos pelos reais)
const ListaPedidos = () => <div className="screen"><h1>Pedidos</h1></div>
const PerfilCliente = () => <div className="screen"><h1>Perfil do Cliente</h1></div>
const ListaProdutos = () => <div className="screen"><h1>Produtos</h1></div>
const Mais = () => <div className="screen"><h1>Mais</h1></div>

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [plano, setPlano] = useState('starter') // 'starter' | 'pro' | 'enterprise'

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
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/clientes" replace />} />
          <Route path="/pedidos" element={<ListaPedidos />} />
          <Route path="/clientes" element={<CarteiraClientes />} />
          <Route path="/clientes/novo" element={<CadastroCliente />} />
          <Route path="/clientes/:id" element={<PerfilCliente />} />
          <Route path="/produtos" element={<ListaProdutos />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/mais" element={<Mais />} />
        </Routes>
      </main>
      <Navbar plano={plano} />
    </div>
  )
}

export default App

import { Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { RepresentadaProvider } from './contexts/RepresentadaContext'
import Login from './components/shared/Login'
import Home from './components/Home'
import CarteiraClientes from './components/clientes/CarteiraClientes'
import CadastroCliente from './components/clientes/CadastroCliente'
import PerfilCliente from './components/clientes/PerfilCliente'
import DadosCliente from './components/clientes/DadosCliente'
import Bonificacao from './components/clientes/Bonificacao'
import GastosCliente from './components/clientes/GastosCliente'
import DetalheVisita from './components/clientes/DetalheVisita'
import HistoricoCliente from './components/clientes/HistoricoCliente'
import PedidoSimples from './components/pedidos/PedidoSimples'
import ListaPedidos from './components/pedidos/ListaPedidos'
import NovoPedido from './components/pedidos/NovoPedido'
import DetalhesPedido from './components/pedidos/DetalhesPedido'
import Catalogo from './components/pedidos/Catalogo'
import DetalheProdutoPedido from './components/pedidos/DetalheProdutoPedido'
import DescontosPedido from './components/pedidos/DescontosPedido'
import Planner from './components/planner/Planner'
import Mais from './components/mais/Mais'
import MeuPerfil from './components/mais/MeuPerfil'
import Representadas from './components/mais/Representadas'
import Segmentos from './components/mais/Segmentos'
import ListaProdutos from './components/produtos/ListaProdutos'
import CadastroProduto from './components/produtos/CadastroProduto'
import Relatorios from './components/relatorios/Relatorios'
import MetaVendas from './components/relatorios/MetaVendas'
import RankingClientes from './components/relatorios/RankingClientes'
import VendasProduto from './components/relatorios/VendasProduto'
import ClientesInativos from './components/relatorios/ClientesInativos'
import ResumoVendas from './components/relatorios/ResumoVendas'
import VisitasRelatorio from './components/relatorios/VisitasRelatorio'
import Financas from './components/financas/Financas'
import Tarefas from './components/tarefas/Tarefas'

// Placeholder components (serão substituídos pelos reais)

const Mapa = () => (
  <div className="screen">
    <header className="screen-header">
      <button className="voltar-btn" onClick={() => window.history.back()}>← Voltar</button>
      <h1>Mapa</h1>
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
    <RepresentadaProvider>
      <div className="app">
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pedidos" element={<ListaPedidos />} />
        <Route path="/pedidos/novo" element={<NovoPedido />} />
        <Route path="/pedidos/:id" element={<DetalhesPedido />} />
        <Route path="/pedidos/:id/catalogo" element={<Catalogo />} />
        <Route path="/pedidos/:id/produto/:produtoId" element={<DetalheProdutoPedido />} />
        <Route path="/pedidos/:id/descontos" element={<DescontosPedido />} />
        <Route path="/clientes" element={<CarteiraClientes />} />
        <Route path="/clientes/novo" element={<CadastroCliente />} />
        <Route path="/clientes/:id" element={<PerfilCliente />} />
        <Route path="/clientes/:id/dados" element={<DadosCliente />} />
        <Route path="/clientes/:id/editar" element={<EditarCliente />} />
        <Route path="/clientes/:id/bonificacao" element={<Bonificacao />} />
        <Route path="/clientes/:id/gastos" element={<GastosCliente />} />
        <Route path="/clientes/:id/visitas" element={<HistoricoCliente />} />
        <Route path="/clientes/:id/pedidos" element={<HistoricoCliente />} />
        <Route path="/clientes/:id/orcamentos" element={<HistoricoCliente />} />
        <Route path="/clientes/:id/visitas/:visitaId" element={<DetalheVisita />} />
        <Route path="/pedidos/novo/simples" element={<PedidoSimples />} />
        <Route path="/produtos" element={<ListaProdutos />} />
        <Route path="/produtos/novo" element={<CadastroProduto />} />
        <Route path="/produtos/:id" element={<CadastroProduto />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/opcoes" element={<Mais />} />
        <Route path="/mais" element={<Mais />} />
        <Route path="/mais/perfil" element={<MeuPerfil />} />
        <Route path="/mais/representadas" element={<Representadas />} />
        <Route path="/mais/segmentos" element={<Segmentos />} />
        <Route path="/relatorios" element={<Relatorios />} />
        <Route path="/relatorios/meta" element={<MetaVendas />} />
        <Route path="/relatorios/ranking" element={<RankingClientes />} />
        <Route path="/relatorios/produtos" element={<VendasProduto />} />
        <Route path="/relatorios/inativos" element={<ClientesInativos />} />
        <Route path="/relatorios/resumo" element={<ResumoVendas />} />
        <Route path="/relatorios/visitas" element={<VisitasRelatorio />} />
        <Route path="/financas" element={<Financas />} />
        <Route path="/tarefas" element={<Tarefas />} />
        <Route path="/mapa" element={<Mapa />} />
        </Routes>
      </div>
    </RepresentadaProvider>
  )
}

export default App

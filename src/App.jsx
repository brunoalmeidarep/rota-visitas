import { Routes, Route } from 'react-router-dom'
import ScrollToTop from './components/shared/ScrollToTop'
import SwipeBack from './components/shared/SwipeBack'
import { useState, useEffect, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import { RepresentadaProvider } from './contexts/RepresentadaContext'

// Eager: telas críticas que carregam no bundle inicial
import Login from './components/shared/Login'
import Home from './components/Home'

// Lazy: tudo o resto carrega sob demanda
const CarteiraClientes = lazy(() => import('./components/clientes/CarteiraClientes'))
const CadastroCliente = lazy(() => import('./components/clientes/CadastroCliente'))
const PerfilCliente = lazy(() => import('./components/clientes/PerfilCliente'))
const DadosCliente = lazy(() => import('./components/clientes/DadosCliente'))
const Bonificacao = lazy(() => import('./components/clientes/Bonificacao'))
const GastosCliente = lazy(() => import('./components/clientes/GastosCliente'))
const DetalheVisita = lazy(() => import('./components/clientes/DetalheVisita'))
const HistoricoCliente = lazy(() => import('./components/clientes/HistoricoCliente'))
const Checkin = lazy(() => import('./components/clientes/Checkin'))

const PedidoSimples = lazy(() => import('./components/pedidos/PedidoSimples'))
const ListaPedidos = lazy(() => import('./components/pedidos/ListaPedidos'))
const NovoPedido = lazy(() => import('./components/pedidos/NovoPedido'))
const DetalhesPedido = lazy(() => import('./components/pedidos/DetalhesPedido'))
const Catalogo = lazy(() => import('./components/pedidos/Catalogo'))
const DetalheProdutoPedido = lazy(() => import('./components/pedidos/DetalheProdutoPedido'))
const ItensPedido = lazy(() => import('./components/pedidos/ItensPedido'))
const DescontosPedido = lazy(() => import('./components/pedidos/DescontosPedido'))

const Planner = lazy(() => import('./components/planner/Planner'))

const Mais = lazy(() => import('./components/mais/Mais'))
const MeuPerfil = lazy(() => import('./components/mais/MeuPerfil'))
const Representadas = lazy(() => import('./components/mais/Representadas'))
const Segmentos = lazy(() => import('./components/mais/Segmentos'))

const ListaProdutos = lazy(() => import('./components/produtos/ListaProdutos'))
const CadastroProduto = lazy(() => import('./components/produtos/CadastroProduto'))

const Relatorios = lazy(() => import('./components/relatorios/Relatorios'))
const MetaVendas = lazy(() => import('./components/relatorios/MetaVendas'))
const RankingClientes = lazy(() => import('./components/relatorios/RankingClientes'))
const VendasProduto = lazy(() => import('./components/relatorios/VendasProduto'))
const ClientesInativos = lazy(() => import('./components/relatorios/ClientesInativos'))
const ResumoVendas = lazy(() => import('./components/relatorios/ResumoVendas'))
const VisitasRelatorio = lazy(() => import('./components/relatorios/VisitasRelatorio'))
const PreviewPDF = lazy(() => import('./components/relatorios/PreviewPDF'))

const Financas = lazy(() => import('./components/financas/Financas'))
const Tarefas = lazy(() => import('./components/tarefas/Tarefas'))
const Mapa = lazy(() => import('./components/mapa/Mapa'))



// Loader simples enquanto cada chunk carrega
function TelaCarregando() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '50vh',
      color: '#666'
    }}>
      Carregando...
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 5000)

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        clearTimeout(timeoutId)
        setUser(session?.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        clearTimeout(timeoutId)
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#1a3a6b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <img
          src="/icon-192.png"
          alt="Minha Rota RP"
          style={{ width: 96, height: 96, opacity: 0.9 }}
        />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <RepresentadaProvider>
      <ScrollToTop />
      <SwipeBack />
      <div className="app">
        <Suspense fallback={<TelaCarregando />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pedidos" element={<ListaPedidos />} />
            <Route path="/pedidos/novo" element={<NovoPedido />} />
            <Route path="/pedidos/:id" element={<DetalhesPedido />} />
            <Route path="/pedidos/:id/itens" element={<ItensPedido />} />
            <Route path="/pedidos/:id/catalogo" element={<Catalogo />} />
            <Route path="/pedidos/:id/produto/:produtoId" element={<DetalheProdutoPedido />} />
            <Route path="/pedidos/:id/descontos" element={<DescontosPedido />} />
            <Route path="/clientes" element={<CarteiraClientes />} />
            <Route path="/clientes/novo" element={<CadastroCliente />} />
            <Route path="/clientes/:id" element={<PerfilCliente />} />
            <Route path="/clientes/:id/dados" element={<DadosCliente />} />
            <Route path="/clientes/:id/editar" element={<CadastroCliente />} />
            <Route path="/clientes/:id/bonificacao" element={<Bonificacao />} />
            <Route path="/clientes/:id/gastos" element={<GastosCliente />} />
            <Route path="/clientes/:id/visitas" element={<HistoricoCliente />} />
            <Route path="/clientes/:id/pedidos" element={<HistoricoCliente />} />
            <Route path="/clientes/:id/orcamentos" element={<HistoricoCliente />} />
            <Route path="/clientes/:id/visitas/:visitaId" element={<DetalheVisita />} />
            <Route path="/clientes/:id/checkin" element={<Checkin />} />
            <Route path="/pedidos/novo/simples" element={<PedidoSimples />} />
            <Route path="/produtos" element={<ListaProdutos />} />
            <Route path="/produtos/novo" element={<CadastroProduto />} />
            <Route path="/produtos/:id" element={<CadastroProduto />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/rota" element={<Planner initialView="rotas" />} />
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
            <Route path="/relatorios/pdf" element={<PreviewPDF />} />
            <Route path="/financas" element={<Financas />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/mapa" element={<Mapa />} />
          </Routes>
        </Suspense>
      </div>
    </RepresentadaProvider>
  )
}

export default App

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './ClientesInativos.css'

function ClientesInativos() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const [isDark, setIsDark] = useState(false)

  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState([])
  const [nomeRep, setNomeRep] = useState('')

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (!repId) return
    fetchInativos()
    fetchNomeRep()
  }, [repId])

  async function fetchNomeRep() {
    const { data } = await supabase
      .from('representantes')
      .select('nome')
      .eq('id', repId)
      .single()
    if (data?.nome) setNomeRep(data.nome)
  }

  async function fetchInativos() {
    setLoading(true)

    // Buscar todos os clientes
    const { data: todosClientes } = await supabase
      .from('clientes')
      .select('id, nome, cidade')
      .eq('rep_id', repId)

    // Buscar ultimo pedido de cada cliente
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('cliente_id, valor_total, created_at')
      .eq('rep_id', repId)
      .eq('status', 'pedido')
      .order('created_at', { ascending: false })

    const hoje = new Date()
    const inativosComDados = []

    for (const cliente of todosClientes || []) {
      // Encontrar ultimo pedido
      const ultimoPedido = (pedidos || []).find(p => p.cliente_id === cliente.id)

      if (!ultimoPedido) {
        // Nunca comprou - considerar inativo ha muito tempo
        inativosComDados.push({
          ...cliente,
          ultimoPedidoValor: 0,
          ultimoPedidoData: null,
          diasSemCompra: 9999,
          faixa: 'critico'
        })
        continue
      }

      const dataPedido = new Date(ultimoPedido.created_at)
      const diffDias = Math.floor((hoje - dataPedido) / (1000 * 60 * 60 * 24))

      if (diffDias >= 90) {
        let faixa = 'alerta'
        if (diffDias >= 180) {
          faixa = 'critico'
        } else if (diffDias >= 120) {
          faixa = 'perigo'
        }

        inativosComDados.push({
          ...cliente,
          ultimoPedidoValor: ultimoPedido.valor_total,
          ultimoPedidoData: ultimoPedido.created_at,
          diasSemCompra: diffDias,
          faixa
        })
      }
    }

    // Ordenar por dias sem compra (menor para maior)
    inativosComDados.sort((a, b) => a.diasSemCompra - b.diasSemCompra)

    setClientes(inativosComDados)
    setLoading(false)
  }

  function formatarValor(valor) {
    if (!valor) return 'R$ 0'
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr)
    return d.toLocaleDateString('pt-BR')
  }

  // Stats por faixa
  const alerta = clientes.filter(c => c.faixa === 'alerta')
  const perigo = clientes.filter(c => c.faixa === 'perigo')
  const critico = clientes.filter(c => c.faixa === 'critico')

  function exportarPDF() {
    if (clientes.length === 0) {
      alert('Nenhum dado para exportar')
      return
    }

    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')

    navigate('/relatorios/pdf', {
      state: {
        tipo: 'clientes-inativos',
        dados: {
          clientes,
          nomeRep,
          periodo: `Gerado em ${new Date().toLocaleDateString('pt-BR')}`
        },
        nomeArquivo: `clientes-inativos-${hoje}.pdf`,
        titulo: 'Clientes Inativos'
      }
    })
  }

  return (
    <div className={`clientes-inativos ${isDark ? 'dark' : 'light'}`}>
      <header className="ci-header">
        <button className="ci-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Clientes Inativos</h1>
        <button className="ci-export" onClick={exportarPDF} disabled={loading || clientes.length === 0}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </header>

      <div className="ci-content">
        {loading ? (
          <div className="ci-loading">Carregando...</div>
        ) : clientes.length === 0 ? (
          <div className="ci-vazio">
            <span className="ci-vazio-icon">🎉</span>
            <p>Nenhum cliente inativo</p>
            <span className="ci-vazio-sub">Todos os clientes compraram nos ultimos 90 dias</span>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="ci-stats">
              <div className="ci-stat alerta">
                <span className="ci-stat-icon">⚠️</span>
                <div className="ci-stat-info">
                  <span className="ci-stat-valor">{alerta.length}</span>
                  <span className="ci-stat-label">90-120 dias</span>
                </div>
              </div>
              <div className="ci-stat perigo">
                <span className="ci-stat-icon">🔶</span>
                <div className="ci-stat-info">
                  <span className="ci-stat-valor">{perigo.length}</span>
                  <span className="ci-stat-label">120-180 dias</span>
                </div>
              </div>
              <div className="ci-stat critico">
                <span className="ci-stat-icon">🔴</span>
                <div className="ci-stat-info">
                  <span className="ci-stat-valor">{critico.length}</span>
                  <span className="ci-stat-label">180+ dias</span>
                </div>
              </div>
            </div>

            {/* Lista */}
            <div className="ci-lista">
              {clientes.map(cliente => (
                <div
                  key={cliente.id}
                  className={`ci-item ${cliente.faixa}`}
                  onClick={() => navigate(`/clientes/${cliente.id}`)}
                >
                  <div className="ci-item-info">
                    <span className="ci-item-nome">{cliente.nome}</span>
                    <span className="ci-item-cidade">{cliente.cidade || '-'}</span>
                    {cliente.ultimoPedidoValor > 0 && (
                      <span className="ci-item-ultimo">
                        Ultimo pedido: {formatarValor(cliente.ultimoPedidoValor)}
                      </span>
                    )}
                  </div>
                  <div className="ci-item-right">
                    <span className={`ci-item-dias ${cliente.faixa}`}>
                      {cliente.diasSemCompra === 9999 ? 'Nunca comprou' : `${cliente.diasSemCompra} dias`}
                    </span>
                    {cliente.ultimoPedidoData && (
                      <span className="ci-item-data">{formatarData(cliente.ultimoPedidoData)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ClientesInativos

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './GastosCliente.css'

const CATEGORIAS = [
  { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
  { id: 'cafe', nome: 'Café/Lanche', icone: '☕' },
  { id: 'brinde', nome: 'Brinde', icone: '🎁' },
  { id: 'amostra', nome: 'Amostra', icone: '📦' },
  { id: 'evento', nome: 'Evento', icone: '🎉' },
  { id: 'outros', nome: 'Outros', icone: '💰' }
]

function GastosCliente() {
  const navigate = useNavigate()
  const { id: clienteId } = useParams()
  const { repId } = useRepId()

  const [cliente, setCliente] = useState(null)
  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear())

  // Sheet de novo gasto
  const [mostrarNovo, setMostrarNovo] = useState(false)
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mostrarCategorias, setMostrarCategorias] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar cliente
  useEffect(() => {
    if (!clienteId) return

    async function fetchCliente() {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cidade')
        .eq('id', clienteId)
        .single()

      if (data) setCliente(data)
    }

    fetchCliente()
  }, [clienteId])

  // Carregar gastos
  useEffect(() => {
    if (!clienteId || !repId) return

    async function fetchGastos() {
      setLoading(true)
      const { data } = await supabase
        .from('gastos_cliente')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('rep_id', repId)
        .order('data', { ascending: false })

      if (data) setGastos(data)
      setLoading(false)
    }

    fetchGastos()
  }, [clienteId, repId])

  // Formatar valor
  function handleValorChange(valorStr) {
    let limpo = valorStr.replace(/[^\d,]/g, '')
    const partes = limpo.split(',')
    if (partes.length > 2) {
      limpo = partes[0] + ',' + partes.slice(1).join('')
    }
    if (partes.length === 2 && partes[1].length > 2) {
      limpo = partes[0] + ',' + partes[1].slice(0, 2)
    }
    setValor(limpo)
  }

  function parsearValor(str) {
    if (!str) return 0
    return parseFloat(str.replace(',', '.')) || 0
  }

  function formatarValor(num) {
    if (!num) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(num)
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR')
  }

  function getCategoriaInfo(id) {
    return CATEGORIAS.find(c => c.id === id) || { nome: id, icone: '💰' }
  }

  // Filtrar por ano
  const gastosFiltrados = filtroAno === 'todos'
    ? gastos
    : gastos.filter(g => {
        const ano = new Date(g.data + 'T12:00:00').getFullYear()
        return ano === filtroAno
      })

  // Agrupar por mês
  function agruparPorMes(items) {
    const grupos = {}
    items.forEach(item => {
      const d = new Date(item.data + 'T12:00:00')
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      if (!grupos[chave]) {
        grupos[chave] = { label, items: [], total: 0 }
      }
      grupos[chave].items.push(item)
      grupos[chave].total += item.valor || 0
    })
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, grupo]) => grupo)
  }

  // Calcular totais
  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth()

  const totalAno = gastos
    .filter(g => new Date(g.data + 'T12:00:00').getFullYear() === anoAtual)
    .reduce((acc, g) => acc + (g.valor || 0), 0)

  const totalMes = gastos
    .filter(g => {
      const d = new Date(g.data + 'T12:00:00')
      return d.getFullYear() === anoAtual && d.getMonth() === mesAtual
    })
    .reduce((acc, g) => acc + (g.valor || 0), 0)

  // Anos disponíveis para filtro
  const anosDisponiveis = [...new Set(gastos.map(g => new Date(g.data + 'T12:00:00').getFullYear()))]
    .sort((a, b) => b - a)

  async function salvarGasto() {
    if (!categoria) {
      alert('Selecione a categoria')
      return
    }
    if (!valor || parsearValor(valor) <= 0) {
      alert('Informe o valor')
      return
    }

    setSalvando(true)

    try {
      const hoje = new Date().toISOString().split('T')[0]

      const { error } = await supabase
        .from('gastos_cliente')
        .insert({
          rep_id: repId,
          cliente_id: clienteId,
          cliente_nome: cliente?.nome,
          categoria: categoria,
          valor: parsearValor(valor),
          descricao: descricao.trim() || null,
          data: hoje
        })

      if (error) {
        console.error('[GastosCliente] Erro:', error)
        alert('Erro ao salvar gasto')
        setSalvando(false)
        return
      }

      // Recarregar lista
      const { data: novaLista } = await supabase
        .from('gastos_cliente')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('rep_id', repId)
        .order('data', { ascending: false })

      if (novaLista) setGastos(novaLista)

      // Fechar sheet
      setMostrarNovo(false)
      setCategoria('')
      setValor('')
      setDescricao('')

    } catch (err) {
      console.error('[GastosCliente] Exceção:', err)
      alert('Erro ao salvar gasto')
    }

    setSalvando(false)
  }

  const grupos = agruparPorMes(gastosFiltrados)
  const totalFiltrado = gastosFiltrados.reduce((acc, g) => acc + (g.valor || 0), 0)

  return (
    <div className={`gastos-cliente ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="gastos-header">
        <button className="gastos-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="gastos-header-titulo">
          {cliente?.nome?.split(' ')[0] || 'Gastos'}
        </span>
        <button className="gastos-novo" onClick={() => setMostrarNovo(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </header>

      {/* Subtítulo */}
      <div className="gastos-subtitulo">
        <span>Gastos</span>
      </div>

      {/* Resumo */}
      <div className="gastos-resumo">
        <div className="gastos-resumo-item">
          <span className="gastos-resumo-label">Este ano</span>
          <span className="gastos-resumo-valor">{formatarValor(totalAno)}</span>
        </div>
        <div className="gastos-resumo-divider"></div>
        <div className="gastos-resumo-item">
          <span className="gastos-resumo-label">Este mês</span>
          <span className="gastos-resumo-valor">{formatarValor(totalMes)}</span>
        </div>
        <div className="gastos-resumo-divider"></div>
        <div className="gastos-resumo-item">
          <span className="gastos-resumo-label">Registros</span>
          <span className="gastos-resumo-valor">{gastos.length}</span>
        </div>
      </div>

      {/* Filtro de ano */}
      {anosDisponiveis.length > 0 && (
        <div className="gastos-filtro-ano">
          {anosDisponiveis.map(ano => (
            <button
              key={ano}
              className={`gastos-filtro-btn ${filtroAno === ano ? 'active' : ''}`}
              onClick={() => setFiltroAno(ano)}
            >
              {ano}
            </button>
          ))}
          <button
            className={`gastos-filtro-btn ${filtroAno === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroAno('todos')}
          >
            Tudo
          </button>
        </div>
      )}

      {/* Conteúdo */}
      <div className="gastos-content">
        {loading ? (
          <div className="gastos-loading">Carregando...</div>
        ) : gastos.length === 0 ? (
          <div className="gastos-vazio">
            <span className="gastos-vazio-icon">💸</span>
            <p>Nenhum gasto registrado</p>
            <button onClick={() => setMostrarNovo(true)}>+ Novo gasto</button>
          </div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="gastos-vazio">
            <p>Nenhum gasto em {filtroAno}</p>
          </div>
        ) : (
          <>
            {grupos.map((grupo, idx) => (
              <div key={idx} className="gastos-grupo">
                <div className="gastos-grupo-header">
                  <span className="gastos-grupo-mes">{grupo.label}</span>
                  <span className="gastos-grupo-total">{formatarValor(grupo.total)}</span>
                </div>
                {grupo.items.map(g => (
                  <div key={g.id} className="gastos-card">
                    <div className="gastos-card-icon">{getCategoriaInfo(g.categoria).icone}</div>
                    <div className="gastos-card-info">
                      <span className="gastos-card-categoria">{getCategoriaInfo(g.categoria).nome}</span>
                      <span className="gastos-card-data">{formatarData(g.data)}</span>
                      {g.descricao && <span className="gastos-card-desc">{g.descricao}</span>}
                    </div>
                    <span className="gastos-card-valor">{formatarValor(g.valor)}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* Total geral */}
            <div className="gastos-total-geral">
              <span>Total</span>
              <span>{formatarValor(totalFiltrado)}</span>
            </div>
          </>
        )}
      </div>

      {/* Sheet novo gasto */}
      {mostrarNovo && (
        <div className={`gastos-overlay ${isDark ? 'dark' : 'light'}`} onClick={() => setMostrarNovo(false)}>
          <div className="gastos-sheet" onClick={e => e.stopPropagation()}>
            <div className="gastos-handle"></div>
            <h2 className="gastos-sheet-titulo">Novo Gasto</h2>

            {/* Categoria */}
            <div className="gastos-campo">
              <label>Categoria</label>
              <button
                className="gastos-select-categoria"
                onClick={() => setMostrarCategorias(true)}
              >
                {categoria ? (
                  <>
                    <span>{getCategoriaInfo(categoria).icone}</span>
                    <span>{getCategoriaInfo(categoria).nome}</span>
                  </>
                ) : (
                  <span className="gastos-placeholder">Selecione a categoria</span>
                )}
                <span className="gastos-seta">›</span>
              </button>
            </div>

            {/* Valor */}
            <div className="gastos-campo">
              <label>Valor</label>
              <div className="gastos-valor-input">
                <span className="gastos-prefix">R$</span>
                <input
                  type="text"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => handleValorChange(e.target.value)}
                  inputMode="decimal"
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="gastos-campo">
              <label>Descrição (opcional)</label>
              <input
                type="text"
                className="gastos-input"
                placeholder="Ex: Almoço de negócios..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            {/* Ações */}
            <div className="gastos-acoes">
              <button className="gastos-btn-cancelar" onClick={() => setMostrarNovo(false)}>
                Cancelar
              </button>
              <button
                className="gastos-btn-salvar"
                onClick={salvarGasto}
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            {/* Sheet de categorias */}
            {mostrarCategorias && (
              <div className="gastos-categorias-overlay" onClick={() => setMostrarCategorias(false)}>
                <div className="gastos-categorias-sheet" onClick={e => e.stopPropagation()}>
                  <div className="gastos-handle"></div>
                  <h3>Categoria do gasto</h3>
                  <div className="gastos-categorias-lista">
                    {CATEGORIAS.map(cat => (
                      <button
                        key={cat.id}
                        className={`gastos-categoria-item ${categoria === cat.id ? 'active' : ''}`}
                        onClick={() => {
                          setCategoria(cat.id)
                          setMostrarCategorias(false)
                        }}
                      >
                        <span className="gastos-categoria-icon">{cat.icone}</span>
                        <span className="gastos-categoria-nome">{cat.nome}</span>
                        {categoria === cat.id && <span className="gastos-categoria-check">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GastosCliente

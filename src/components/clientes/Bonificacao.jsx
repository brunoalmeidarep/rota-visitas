import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { dataLocal } from '../../lib/data'
import { useRepId } from '../../hooks/useRepId'
import { formatarInputMoeda, parseMoeda, formatarValor } from '../../utils/formatarMoeda'
import './Bonificacao.css'

function Bonificacao() {
  const navigate = useNavigate()
  const { id: clienteId } = useParams()
  const { repId } = useRepId()

  const [cliente, setCliente] = useState(null)
  const [bonificacoes, setBonificacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState(false)

  // Sheet de nova bonificação
  const [mostrarNova, setMostrarNova] = useState(false)
  const [representadas, setRepresentadas] = useState([])
  const [representadaId, setRepresentadaId] = useState('')
  const [valor, setValor] = useState(0)
  const [valorDisplay, setValorDisplay] = useState('R$ 0,00')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)

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

  // Carregar bonificações
  useEffect(() => {
    if (!clienteId || !repId) return

    async function fetchBonificacoes() {
      setLoading(true)
      const { data } = await supabase
        .from('bonificacoes')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('rep_id', repId)
        .order('created_at', { ascending: false })

      if (data) setBonificacoes(data)
      setLoading(false)
    }

    fetchBonificacoes()
  }, [clienteId, repId])

  // Carregar representadas para nova bonificação
  useEffect(() => {
    if (!repId) return

    async function fetchRepresentadas() {
      const { data } = await supabase
        .from('representadas')
        .select('id, nome')
        .eq('rep_id', repId)
        .order('nome')

      if (data) {
        setRepresentadas(data)
        if (data.length > 0) setRepresentadaId(data[0].id)
      }
    }

    fetchRepresentadas()
  }, [repId])

  // Formatar valor
  function handleValorChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setValorDisplay(formatted)
    setValor(parseMoeda(formatted))
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr)
    return d.toLocaleDateString('pt-BR')
  }

  // Agrupar por mês
  function agruparPorMes(items) {
    const grupos = {}
    items.forEach(item => {
      const d = new Date(item.created_at)
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      if (!grupos[chave]) {
        grupos[chave] = { label, items: [], total: 0 }
      }
      grupos[chave].items.push(item)
      grupos[chave].total += item.valor_total || 0
    })
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, grupo]) => grupo)
  }

  // Calcular totais
  const totalAno = bonificacoes
    .filter(b => {
      const ano = new Date(b.created_at).getFullYear()
      return ano === new Date().getFullYear()
    })
    .reduce((acc, b) => acc + (b.valor_total || 0), 0)

  const mesAtual = new Date().getMonth()
  const totalMes = bonificacoes
    .filter(b => {
      const d = new Date(b.created_at)
      return d.getFullYear() === new Date().getFullYear() && d.getMonth() === mesAtual
    })
    .reduce((acc, b) => acc + (b.valor_total || 0), 0)

  async function salvarBonificacao() {
    if (!valor || valor <= 0) {
      alert('Informe o valor')
      return
    }

    setSalvando(true)

    try {
      const hoje = dataLocal()
      const representadaNome = representadas.find(r => r.id === representadaId)?.nome || null

      // Tabela bonificacoes: id, cliente_id, cliente_nome, representada_id, representada_nome, motivo, valor_total, parcelas, status, rep_id
      const registro = {
        rep_id: repId,
        cliente_id: clienteId,
        cliente_nome: cliente?.nome,
        representada_id: representadaId || null,
        representada_nome: representadaNome,
        valor_total: valor,
        motivo: obs.trim() || null,
        parcelas: 1,
        status: 'ativo'
      }

      console.log('[Bonificacao] Salvando:', JSON.stringify(registro, null, 2))

      const { error } = await supabase
        .from('bonificacoes')
        .insert(registro)

      if (error) {
        console.error('[Bonificacao] Erro Supabase:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        alert(`Erro ao salvar: ${error.message || error.details || 'Erro desconhecido'}`)
        setSalvando(false)
        return
      }

      console.log('[Bonificacao] Salvo com sucesso')

      // Recarregar lista
      const { data: novaLista } = await supabase
        .from('bonificacoes')
        .select('*')
        .eq('cliente_id', clienteId)
        .eq('rep_id', repId)
        .order('created_at', { ascending: false })

      if (novaLista) setBonificacoes(novaLista)

      // Fechar sheet
      setMostrarNova(false)
      setValor(0)
      setValorDisplay('R$ 0,00')
      setObs('')

    } catch (err) {
      console.error('[Bonificacao] Exceção:', err)
      alert('Erro ao salvar bonificação')
    }

    setSalvando(false)
  }

  const grupos = agruparPorMes(bonificacoes)

  return (
    <div className={`bonificacao ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="bonif-header">
        <button className="bonif-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="bonif-header-titulo">
          {cliente?.nome?.split(' ')[0] || 'Bonificações'}
        </span>
        <button className="bonif-novo" onClick={() => setMostrarNova(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </header>

      {/* Subtítulo */}
      <div className="bonif-subtitulo">
        <span>Bonificações</span>
      </div>

      {/* Resumo */}
      <div className="bonif-resumo">
        <div className="bonif-resumo-item">
          <span className="bonif-resumo-label">Este ano</span>
          <span className="bonif-resumo-valor">{formatarValor(totalAno)}</span>
        </div>
        <div className="bonif-resumo-divider"></div>
        <div className="bonif-resumo-item">
          <span className="bonif-resumo-label">Este mês</span>
          <span className="bonif-resumo-valor">{formatarValor(totalMes)}</span>
        </div>
        <div className="bonif-resumo-divider"></div>
        <div className="bonif-resumo-item">
          <span className="bonif-resumo-label">Registros</span>
          <span className="bonif-resumo-valor">{bonificacoes.length}</span>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bonif-content">
        {loading ? (
          <div className="bonif-loading">Carregando...</div>
        ) : bonificacoes.length === 0 ? (
          <div className="bonif-vazio">
            <span className="bonif-vazio-icon">🎁</span>
            <p>Nenhuma bonificação registrada</p>
            <button onClick={() => setMostrarNova(true)}>+ Nova bonificação</button>
          </div>
        ) : (
          grupos.map((grupo, idx) => (
            <div key={idx} className="bonif-grupo">
              <div className="bonif-grupo-header">
                <span className="bonif-grupo-mes">{grupo.label}</span>
                <span className="bonif-grupo-total">{formatarValor(grupo.total)}</span>
              </div>
              {grupo.items.map(b => (
                <div key={b.id} className="bonif-card">
                  <div className="bonif-card-icon">🎁</div>
                  <div className="bonif-card-info">
                    <span className="bonif-card-empresa">{b.representada_nome || 'Sem empresa'}</span>
                    <span className="bonif-card-data">{formatarData(b.created_at)}</span>
                    {b.motivo && <span className="bonif-card-obs">{b.motivo}</span>}
                  </div>
                  <span className="bonif-card-valor">{formatarValor(b.valor_total)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Sheet nova bonificação */}
      {mostrarNova && (
        <div className={`bonif-overlay ${isDark ? 'dark' : 'light'}`} onClick={() => setMostrarNova(false)}>
          <div className="bonif-sheet" onClick={e => e.stopPropagation()}>
            <div className="bonif-handle"></div>
            <h2 className="bonif-sheet-titulo">Nova Bonificação</h2>

            {/* Representada */}
            {representadas.length > 0 && (
              <div className="bonif-campo">
                <label>Representada</label>
                <select
                  className="bonif-select"
                  value={representadaId}
                  onChange={(e) => setRepresentadaId(e.target.value)}
                >
                  {representadas.map(r => (
                    <option key={r.id} value={r.id}>{r.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Valor */}
            <div className="bonif-campo">
              <label>Valor</label>
              <div className="bonif-valor-input">
                <input
                  type="text"
                  placeholder="R$ 0,00"
                  value={valorDisplay}
                  onChange={(e) => handleValorChange(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Observação */}
            <div className="bonif-campo">
              <label>Observação</label>
              <textarea
                className="bonif-textarea"
                placeholder="Ex: Brinde de aniversário..."
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
              />
            </div>

            {/* Ações */}
            <div className="bonif-acoes">
              <button className="bonif-btn-cancelar" onClick={() => setMostrarNova(false)}>
                Cancelar
              </button>
              <button
                className="bonif-btn-salvar"
                onClick={salvarBonificacao}
                disabled={salvando}
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Bonificacao

import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { atualizarComOuSemConexao } from '../../lib/queue'
import { calcularPrecoEfetivo } from '../../lib/precos'
import './DescontosPedido.css'

function DescontosPedido() {
  const navigate = useNavigate()
  const { id: pedidoId } = useParams()

  const [pedido, setPedido] = useState(null)
  const [pedidoItens, setPedidoItens] = useState([])
  const [descontosRep, setDescontosRep] = useState([]) // [{ motivo, tipo, valor }]
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // Sheet de add/edit de desconto global
  const [showSheetDesc, setShowSheetDesc] = useState(false)
  const [editandoIdxDesc, setEditandoIdxDesc] = useState(null)
  const [draftMotivo, setDraftMotivo] = useState('')
  const [draftTipo, setDraftTipo] = useState('percentual')
  const [draftValor, setDraftValor] = useState('')

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar pedido + itens (itens ficam na coluna JSONB pedido.itens)
  useEffect(() => {
    async function fetchDados() {
      setLoading(true)

      const { data: pedidoData } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (pedidoData) {
        setPedido(pedidoData)
        setPedidoItens(pedidoData.itens || [])
        // Normaliza valores (dados antigos podem ter string com vírgula)
        const descs = (pedidoData.descontos_rep || []).map(d => ({
          ...d,
          valor: parseFloat(String(d.valor).replace(',', '.')) || 0
        }))
        setDescontosRep(descs)
      }

      setLoading(false)
    }

    fetchDados()
  }, [pedidoId])

  function formatarValor(valor) {
    if (!valor) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  // Cálculo central: descontos por item (família já está no preço; aqui é só o manual do rep)
  // + descontos globais em cascata sobre o subtotal pós-item.
  const calc = useMemo(() => {
    let subtotalBruto = 0
    let subtotalAposItem = 0
    const itensComDesc = []

    pedidoItens.forEach(item => {
      const qtd = Number(item.quantidade) || 0
      const precoBase = Number(item.preco_unitario) || 0
      const precoEf = calcularPrecoEfetivo(item)
      const bruto = precoBase * qtd
      const liquidoItem = precoEf * qtd
      const descontoItem = bruto - liquidoItem

      subtotalBruto += bruto
      subtotalAposItem += liquidoItem

      if (descontoItem > 0.01) {
        const pctItem = precoBase > 0 ? ((precoBase - precoEf) / precoBase) * 100 : 0
        itensComDesc.push({ ...item, _descontoValor: descontoItem, _descontoPct: pctItem })
      }
    })

    const totalDescItem = subtotalBruto - subtotalAposItem

    // Cascata dos globais sobre subtotal pós-item
    let valorAtual = subtotalAposItem
    const globaisComValor = descontosRep.map(d => {
      const valorNum = Number(d.valor) || 0
      const valor = d.tipo === 'percentual'
        ? valorAtual * (valorNum / 100)
        : Math.min(valorNum, valorAtual)
      valorAtual = Math.max(0, valorAtual - valor)
      return { ...d, valor: valorNum, _valorReal: valor }
    })
    const totalDescGlobal = globaisComValor.reduce((s, g) => s + g._valorReal, 0)

    const totalDesc = totalDescItem + totalDescGlobal
    const totalGeral = Math.max(0, valorAtual)
    const descontoMedioPct = subtotalBruto > 0 ? (totalDesc / subtotalBruto) * 100 : 0

    return {
      subtotalBruto, itensComDesc, totalDescItem,
      globaisComValor, totalDescGlobal,
      totalDesc, totalGeral, descontoMedioPct,
      qtdItens: pedidoItens.length,
    }
  }, [pedidoItens, descontosRep])

  function abrirAddDesconto() {
    setEditandoIdxDesc(null)
    setDraftMotivo('')
    setDraftTipo('percentual')
    setDraftValor('')
    setShowSheetDesc(true)
  }

  function abrirEditDesconto(idx) {
    const d = descontosRep[idx]
    setEditandoIdxDesc(idx)
    setDraftMotivo(d.motivo || '')
    setDraftTipo(d.tipo || 'percentual')
    setDraftValor(String(d.valor || ''))
    setShowSheetDesc(true)
  }

  function confirmarDesconto() {
    const valor = parseFloat(String(draftValor).replace(',', '.')) || 0
    if (!draftMotivo.trim() || valor <= 0) return
    const novo = { motivo: draftMotivo.trim(), tipo: draftTipo, valor }
    if (editandoIdxDesc !== null) {
      const next = [...descontosRep]
      next[editandoIdxDesc] = novo
      setDescontosRep(next)
    } else {
      setDescontosRep([...descontosRep, novo])
    }
    setShowSheetDesc(false)
  }

  function removerDesconto(idx) {
    setDescontosRep(descontosRep.filter((_, i) => i !== idx))
  }

  async function salvar() {
    setSalvando(true)

    const dadosUpdate = {
      descontos_rep: descontosRep,
      valor_bruto: calc.subtotalBruto,
      valor_desconto: calc.totalDesc
    }

    try {
      const resultado = await atualizarComOuSemConexao(
        'pedidos',
        pedidoId,
        dadosUpdate,
        { tabelaLocal: 'pedidos' }
      )

      if (!resultado.ok) {
        console.error('[DescontosPedido] Erro ao salvar:', resultado.motivo)
        alert(`Erro ao salvar descontos:\n${resultado.motivo || '-'}`)
        setSalvando(false)
        return
      }

      navigate(`/pedidos/${pedidoId}`)

    } catch (err) {
      console.error('[DescontosPedido] Exceção:', err)
      alert('Erro ao salvar descontos')
    }

    setSalvando(false)
  }

  if (loading) {
    return (
      <div className={`desc-redesign ${isDark ? 'dark' : 'light'}`}>
        <div className="desc-header">
          <button className="desc-voltar" onClick={() => navigate(`/pedidos/${pedidoId}`)}>‹</button>
          <span className="desc-titulo">Descontos</span>
          <div style={{ width: 48 }}></div>
        </div>
        <div className="desc-conteudo">Carregando...</div>
      </div>
    )
  }

  return (
    <div className={`desc-redesign ${isDark ? 'dark' : 'light'}`}>
      <div className="desc-header">
        <button className="desc-voltar" onClick={() => navigate(`/pedidos/${pedidoId}`)}>‹</button>
        <span className="desc-titulo">Descontos</span>
        <button className="desc-salvar-btn" onClick={salvar} disabled={salvando}>
          {salvando ? '...' : 'Salvar'}
        </button>
      </div>

      <div className="desc-conteudo">
        {/* Métricas */}
        <div className="desc-metricas">
          <div className="desc-metrica">
            <div className="desc-metrica-label">Total</div>
            <div className="desc-metrica-valor verde">{formatarValor(calc.totalDesc)}</div>
          </div>
          <div className="desc-metrica">
            <div className="desc-metrica-label">Médio</div>
            <div className="desc-metrica-valor">{calc.descontoMedioPct.toFixed(1)}%</div>
          </div>
          <div className="desc-metrica">
            <div className="desc-metrica-label">Itens c/ desc</div>
            <div className="desc-metrica-valor">{calc.itensComDesc.length} de {calc.qtdItens}</div>
          </div>
        </div>

        {/* Por item */}
        <div className="desc-section-label">Por item</div>
        <div className="desc-card">
          {calc.itensComDesc.length === 0 ? (
            <div className="desc-empty">Nenhum desconto manual em itens</div>
          ) : calc.itensComDesc.map(item => (
            <button
              key={item.produto_id}
              className="desc-linha-item"
              onClick={() => navigate(`/pedidos/${pedidoId}/produto/${item.produto_id}`, { state: { from: 'descontos' } })}
            >
              <div className="desc-linha-info">
                <div className="desc-linha-nome">{item.produto_nome}</div>
                <div className="desc-linha-sub">{item.quantidade} un · {item._descontoPct.toFixed(1)}%</div>
              </div>
              <span className="desc-linha-valor">−{formatarValor(item._descontoValor)}</span>
            </button>
          ))}
        </div>

        {/* Global */}
        <div className="desc-section-label">Global do pedido</div>
        <div className="desc-card">
          {calc.globaisComValor.length === 0 ? (
            <div className="desc-empty">Nenhum desconto global</div>
          ) : calc.globaisComValor.map((d, idx) => (
            <div key={idx} className="desc-linha-global">
              <button className="desc-linha-info" onClick={() => abrirEditDesconto(idx)}>
                <div className="desc-linha-nome">{d.motivo}</div>
                <div className="desc-linha-sub">
                  {d.tipo === 'percentual' ? `${d.valor}% sobre subtotal` : `R$ ${Number(d.valor).toFixed(2)} fixo`}
                </div>
              </button>
              <span className="desc-linha-valor">−{formatarValor(d._valorReal)}</span>
              <button className="desc-linha-remover" onClick={() => removerDesconto(idx)}>🗑</button>
            </div>
          ))}
          <button className="desc-add-btn" onClick={abrirAddDesconto}>
            + Adicionar desconto global
          </button>
        </div>

        {/* Resumo */}
        <div className="desc-section-label">Resumo</div>
        <div className="desc-card desc-resumo">
          <div className="desc-resumo-linha">
            <span>Subtotal</span><span>{formatarValor(calc.subtotalBruto)}</span>
          </div>
          {calc.totalDescItem > 0.01 && (
            <div className="desc-resumo-linha desc-verde">
              <span>− Descontos por item</span><span>−{formatarValor(calc.totalDescItem)}</span>
            </div>
          )}
          {calc.totalDescGlobal > 0.01 && (
            <div className="desc-resumo-linha desc-verde">
              <span>− Descontos globais</span><span>−{formatarValor(calc.totalDescGlobal)}</span>
            </div>
          )}
          <div className="desc-resumo-total">
            <span>Total</span><span className="verde">{formatarValor(calc.totalGeral)}</span>
          </div>
        </div>
      </div>

      {/* Sheet add/edit desconto global */}
      {showSheetDesc && (
        <div className="desc-sheet-overlay" onClick={() => setShowSheetDesc(false)}>
          <div className="desc-sheet" onClick={e => e.stopPropagation()}>
            <div className="desc-sheet-handle" />
            <div className="desc-sheet-header">
              <span>{editandoIdxDesc !== null ? 'Editar desconto' : 'Adicionar desconto'}</span>
              <button onClick={() => setShowSheetDesc(false)}>✕</button>
            </div>
            <div className="desc-sheet-body">
              <label className="desc-sheet-label">Motivo</label>
              <input
                type="text"
                className="desc-sheet-input"
                placeholder="Ex: Negociação fim de ano"
                value={draftMotivo}
                onChange={e => setDraftMotivo(e.target.value)}
                autoFocus
              />
              <label className="desc-sheet-label">Tipo</label>
              <div className="desc-sheet-tipos">
                <button
                  className={`desc-sheet-tipo ${draftTipo === 'percentual' ? 'ativo' : ''}`}
                  onClick={() => setDraftTipo('percentual')}
                >%</button>
                <button
                  className={`desc-sheet-tipo ${draftTipo === 'valor' ? 'ativo' : ''}`}
                  onClick={() => setDraftTipo('valor')}
                >R$</button>
              </div>
              <label className="desc-sheet-label">Valor</label>
              <input
                type="text"
                inputMode="decimal"
                className="desc-sheet-input"
                placeholder={draftTipo === 'percentual' ? '3' : '100,00'}
                value={draftValor}
                onChange={e => setDraftValor(e.target.value.replace(/[^\d,.]/g, ''))}
              />
              <button className="desc-sheet-confirmar" onClick={confirmarDesconto}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DescontosPedido

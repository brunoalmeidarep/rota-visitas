import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './DescontosPedido.css'

function DescontosPedido() {
  const navigate = useNavigate()
  const { id: pedidoId } = useParams()

  const [pedido, setPedido] = useState(null)
  const [politicas, setPoliticas] = useState([])
  const [politicasAtivas, setPoliticasAtivas] = useState({}) // { politicaId: boolean }
  const [descontosRep, setDescontosRep] = useState([]) // [{ motivo, tipo, valor }]
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar pedido e políticas
  useEffect(() => {
    async function fetchDados() {
      setLoading(true)

      // Buscar pedido
      const { data: pedidoData } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (pedidoData) {
        setPedido(pedidoData)

        // Carregar descontos existentes
        if (pedidoData.politicas_ativas) {
          setPoliticasAtivas(pedidoData.politicas_ativas)
        }
        if (pedidoData.descontos_rep) {
          setDescontosRep(pedidoData.descontos_rep)
        }

        // Buscar políticas da representada
        if (pedidoData.representada_id) {
          const { data: politicasData } = await supabase
            .from('politica_comercial')
            .select('*')
            .eq('representada_id', pedidoData.representada_id)
            .eq('ativo', true)
            .order('nome')

          if (politicasData) setPoliticas(politicasData)
        }
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

  function togglePolitica(politicaId) {
    setPoliticasAtivas(prev => ({
      ...prev,
      [politicaId]: !prev[politicaId]
    }))
  }

  function adicionarDesconto() {
    setDescontosRep(prev => [...prev, { motivo: '', tipo: 'percentual', valor: '' }])
  }

  function atualizarDesconto(index, campo, novoValor) {
    setDescontosRep(prev => {
      const novos = [...prev]
      novos[index] = { ...novos[index], [campo]: novoValor }
      return novos
    })
  }

  function removerDesconto(index) {
    setDescontosRep(prev => prev.filter((_, i) => i !== index))
  }

  function parsearValor(str) {
    if (!str) return 0
    return parseFloat(str.toString().replace(',', '.')) || 0
  }

  // Calcular subtotal dos itens
  const subtotalTabela = (pedido?.itens || []).reduce((acc, item) => {
    return acc + (item.preco_unitario || 0) * (item.quantidade || 0)
  }, 0)

  // Calcular descontos em cascata
  function calcularCascata() {
    let valorAtual = subtotalTabela
    const passos = []

    // Aplicar políticas ativas
    politicas.forEach(pol => {
      if (politicasAtivas[pol.id]) {
        let desconto = 0
        if (pol.valor_tipo === 'percentual') {
          desconto = valorAtual * (pol.valor / 100)
        } else {
          desconto = pol.valor
        }
        valorAtual -= desconto
        passos.push({
          nome: pol.nome,
          valor: desconto,
          percentual: pol.valor_tipo === 'percentual' ? pol.valor : null
        })
      }
    })

    // Aplicar descontos do rep
    descontosRep.forEach(desc => {
      if (desc.valor) {
        let desconto = 0
        if (desc.tipo === 'percentual') {
          desconto = valorAtual * (parsearValor(desc.valor) / 100)
        } else {
          desconto = parsearValor(desc.valor)
        }
        valorAtual -= desconto
        passos.push({
          nome: desc.motivo || 'Desconto manual',
          valor: desconto,
          percentual: desc.tipo === 'percentual' ? parsearValor(desc.valor) : null
        })
      }
    })

    return { passos, total: valorAtual, totalDesconto: subtotalTabela - valorAtual }
  }

  const { passos, total, totalDesconto } = calcularCascata()

  async function aplicar() {
    setSalvando(true)

    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          politicas_ativas: politicasAtivas,
          descontos_rep: descontosRep,
          valor_desconto: totalDesconto,
          valor_total: total
        })
        .eq('id', pedidoId)

      if (error) {
        console.error('[DescontosPedido] Erro:', error)
        alert('Erro ao salvar descontos')
        setSalvando(false)
        return
      }

      navigate(-1)

    } catch (err) {
      console.error('[DescontosPedido] Exceção:', err)
      alert('Erro ao salvar descontos')
    }

    setSalvando(false)
  }

  if (loading) {
    return (
      <div className={`descontos-pedido ${isDark ? 'dark' : 'light'}`}>
        <header className="desc-header">
          <button className="desc-voltar" onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="desc-header-titulo">Descontos</span>
          <div style={{ width: 60 }}></div>
        </header>
        <div className="desc-loading">Carregando...</div>
      </div>
    )
  }

  return (
    <div className={`descontos-pedido ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="desc-header">
        <button className="desc-voltar" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="desc-header-titulo">Descontos</span>
        <button
          className="desc-aplicar"
          onClick={aplicar}
          disabled={salvando}
        >
          {salvando ? '...' : 'Aplicar'}
        </button>
      </header>

      <div className="desc-content">
        {/* Política comercial */}
        {politicas.length > 0 && (
          <div className="desc-secao">
            <div className="desc-secao-header">
              <span className="desc-secao-titulo">Política comercial</span>
              <span className="desc-secao-empresa">{pedido?.representada_nome}</span>
            </div>

            {politicas.map(pol => {
              const ativa = politicasAtivas[pol.id]
              // TODO: Verificar se condição foi atingida
              const condicaoAtingida = true

              return (
                <div
                  key={pol.id}
                  className={`desc-politica ${!condicaoAtingida ? 'inativa' : ''}`}
                >
                  <div className="desc-politica-info">
                    <span className="desc-politica-nome">{pol.nome}</span>
                    <span className="desc-politica-detalhe">
                      {pol.condicao === 'volume_minimo' && `Mínimo ${formatarValor(pol.condicao_valor)}`}
                      {pol.condicao === 'forma_pagamento' && `Pagamento: ${pol.condicao_pagamento}`}
                      {pol.condicao === 'sempre' && 'Sempre disponível'}
                      {' · '}
                      {pol.valor_tipo === 'percentual' ? `${pol.valor}%` : formatarValor(pol.valor)}
                    </span>
                    {!condicaoAtingida && (
                      <span className="desc-politica-falta">
                        Faltam {formatarValor(pol.condicao_valor - subtotalTabela)} para atingir
                      </span>
                    )}
                  </div>
                  <button
                    className={`desc-politica-toggle ${ativa ? 'ativa' : ''}`}
                    onClick={() => togglePolitica(pol.id)}
                    disabled={!condicaoAtingida}
                  >
                    <span className="desc-toggle-thumb"></span>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Desconto do representante */}
        <div className="desc-secao">
          <div className="desc-secao-header">
            <span className="desc-secao-titulo">Desconto do representante</span>
          </div>

          {descontosRep.map((desc, index) => (
            <div key={index} className="desc-rep-item">
              <div className="desc-rep-header">
                <span>Desconto {index + 1}</span>
                <button
                  className="desc-rep-remover"
                  onClick={() => removerDesconto(index)}
                >
                  ×
                </button>
              </div>

              <input
                type="text"
                className="desc-rep-motivo"
                placeholder="Motivo do desconto"
                value={desc.motivo}
                onChange={(e) => atualizarDesconto(index, 'motivo', e.target.value)}
              />

              <div className="desc-rep-valor-row">
                <div className="desc-rep-toggle">
                  <button
                    className={desc.tipo === 'percentual' ? 'active' : ''}
                    onClick={() => atualizarDesconto(index, 'tipo', 'percentual')}
                  >
                    %
                  </button>
                  <button
                    className={desc.tipo === 'valor' ? 'active' : ''}
                    onClick={() => atualizarDesconto(index, 'tipo', 'valor')}
                  >
                    R$
                  </button>
                </div>
                <div className="desc-rep-input">
                  <span>{desc.tipo === 'percentual' ? '%' : 'R$'}</span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={desc.valor}
                    onChange={(e) => {
                      let limpo = e.target.value.replace(/[^\d,]/g, '')
                      atualizarDesconto(index, 'valor', limpo)
                    }}
                    inputMode="decimal"
                  />
                </div>
              </div>
            </div>
          ))}

          <button className="desc-adicionar" onClick={adicionarDesconto}>
            + Adicionar desconto
          </button>
        </div>

        {/* Resumo em cascata */}
        <div className="desc-resumo">
          <div className="desc-resumo-titulo">Resumo dos descontos</div>

          <div className="desc-resumo-linha">
            <span>Subtotal tabela</span>
            <span>{formatarValor(subtotalTabela)}</span>
          </div>

          {passos.map((passo, index) => (
            <div key={index} className="desc-resumo-linha desconto">
              <span>
                ↳ {passo.nome}
                {passo.percentual && ` (${passo.percentual}%)`}
              </span>
              <span>− {formatarValor(passo.valor)}</span>
            </div>
          ))}

          <div className="desc-resumo-total">
            <span>Total final</span>
            <span>{formatarValor(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DescontosPedido

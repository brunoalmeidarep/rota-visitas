import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { dataLocal } from '../../lib/data'
import { useRepId } from '../../hooks/useRepId'
import { usePlano } from '../../hooks/usePlano'
import { useEmpresaFeatures } from '../../hooks/useEmpresaFeatures'
import { abrirPreviewPDF, compartilharPDF } from './PDFOrcamento'
import { limparCarrinho } from '../../lib/carrinhoStorage'
import { nomeFornecedorStr } from '../../utils/fornecedor'
import { db } from '../../lib/db'
import { atualizarComOuSemConexao } from '../../lib/queue'
import './DetalhesPedido.css'

// Helper: calcula preço efetivo do item (mesma cascata do Catalogo/DetalheProdutoPedido/PDFOrcamento)
const calcularPrecoEfetivo = (item) => {
  const precoBase = Number(item.preco_unitario) || 0
  if (item.preco_negociado_direto != null && Number(item.preco_negociado_direto) > 0) {
    return Number(item.preco_negociado_direto)
  }
  if (item.desconto_percentual != null && Number(item.desconto_percentual) > 0) {
    return precoBase * (1 - Number(item.desconto_percentual) / 100)
  }
  if (item.desconto != null && Number(item.desconto) > 0) {
    return Math.max(0, precoBase - Number(item.desconto))
  }
  return precoBase
}

function DetalhesPedido() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: pedidoId } = useParams()
  const { repId } = useRepId()
  const { isStarter, isPro, isEnterprise, loading: loadingPlano } = usePlano()
  const { features } = useEmpresaFeatures()

  // Pedido saldo - buscar info do pedido origem
  const [pedidoOrigem, setPedidoOrigem] = useState(null)

  // Navegacao contextual: se veio do perfil/historico do cliente, voltar para la
  const fromCliente = location.state?.from === 'cliente' || location.state?.from === 'historico'
  const fromNovoPedido = location.state?.from === 'novo-pedido'
  const returnClienteId = location.state?.clienteId
  const isReadonly = location.state?.readonly === true

  function handleVoltar() {
    if (fromCliente && returnClienteId) {
      navigate(`/clientes/${returnClienteId}`)
    } else if (fromNovoPedido) {
      navigate('/pedidos/novo')
    } else {
      navigate('/pedidos')
    }
  }

  // Persiste lista de itens recalculando totais (#5)
  async function persistirItens(novosItens) {
    const valorBrutoTotal = novosItens.reduce(
      (acc, it) => acc + ((Number(it.preco_unitario) || 0) * (Number(it.quantidade) || 0)),
      0
    )
    const valorDescontoTotal = novosItens.reduce((acc, it) => {
      const precoEfetivo = calcularPrecoEfetivo(it)
      return acc + (((Number(it.preco_unitario) || 0) - precoEfetivo) * (Number(it.quantidade) || 0))
    }, 0)

    const resultado = await atualizarComOuSemConexao(
      'pedidos',
      pedidoId,
      {
        itens: novosItens,
        valor_bruto: valorBrutoTotal,
        valor_desconto: valorDescontoTotal
      },
      { tabelaLocal: 'pedidos' }
    )

    if (!resultado.ok) {
      console.error('[DetalhesPedido] Erro ao persistir itens:', resultado.motivo)
      setToast('Erro ao salvar: ' + resultado.motivo)
      setToastTipo('erro')
      return false
    }

    // Atualiza state local
    setPedido(prev => ({
      ...prev,
      itens: novosItens,
      valor_bruto: valorBrutoTotal,
      valor_desconto: valorDescontoTotal,
      valor_liquido: valorBrutoTotal - valorDescontoTotal
    }))
    return true
  }

  async function alterarQuantidadeItem(produtoId, delta) {
    const itens = pedido?.itens || []
    const item = itens.find(i => i.produto_id === produtoId)
    if (!item) return

    const novaQtd = Math.max(0, (Number(item.quantidade) || 0) + delta)

    let novosItens
    if (novaQtd === 0) {
      novosItens = itens.filter(i => i.produto_id !== produtoId)
    } else {
      // Recalcula subtotal mantendo desconto/preço negociado
      const precoEfetivo = calcularPrecoEfetivo(item)
      const ipiPct = Number(item.ipi) || 0
      const novoSubtotal = precoEfetivo * (1 + ipiPct / 100) * novaQtd
      novosItens = itens.map(i =>
        i.produto_id === produtoId
          ? { ...i, quantidade: novaQtd, subtotal: novoSubtotal }
          : i
      )
    }
    await persistirItens(novosItens)
  }

  async function excluirItem(produtoId) {
    if (!confirm('Remover este item do pedido?')) return
    const itens = pedido?.itens || []
    const novosItens = itens.filter(i => i.produto_id !== produtoId)
    await persistirItens(novosItens)
  }

  const [pedido, setPedido] = useState(null)
  const [representada, setRepresentada] = useState(null)
  const [representante, setRepresentante] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [showEmailSheet, setShowEmailSheet] = useState(false)
  const [showPagamentoSheet, setShowPagamentoSheet] = useState(false)
  const [showTipoSheet, setShowTipoSheet] = useState(false)
  const [showRupturaSheet, setShowRupturaSheet] = useState(false)
  const [gerandoPDF, setGerandoPDF] = useState(false)
  const [toast, setToast] = useState('')
  const [toastTipo, setToastTipo] = useState('sucesso') // 'sucesso' | 'erro'

  // Campos editáveis
  const [condicaoPagamento, setCondicaoPagamento] = useState('')
  const [tipoPedido, setTipoPedido] = useState('Venda')
  const [infoAdicionais, setInfoAdicionais] = useState('')
  const [ocCliente, setOcCliente] = useState('')
  const [erroCondicao, setErroCondicao] = useState(false)
  const [regraRuptura, setRegraRuptura] = useState('')
  const [planosDisponiveis, setPlanosDisponiveis] = useState([])
  const [planoPagamentoId, setPlanoPagamentoId] = useState(null)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar pedido e dados relacionados (IndexedDB primeiro, fallback Supabase)
  useEffect(() => {
    if (!pedidoId || !repId) return

    async function fetchPedido() {
      setLoading(true)

      // 1. Buscar pedido — primeiro do IndexedDB local
      let data = null
      let error = null

      try {
        data = await db.pedidos.get(pedidoId)
      } catch (e) {
        console.warn('[DetalhesPedido] Erro IndexedDB pedido:', e)
      }

      // Se não achou local E ID não é offline, busca no Supabase
      if (!data && !String(pedidoId).startsWith('offline_')) {
        const r = await supabase
          .from('pedidos')
          .select('*')
          .eq('id', pedidoId)
          .maybeSingle()
        data = r.data
        error = r.error
      }

      if (error) {
        console.error('[DetalhesPedido] Erro:', error)
      } else if (data) {
        setPedido(data)
        setCondicaoPagamento(data.condicao_pagamento || '')
        setTipoPedido(data.tipo || 'Venda')
        setInfoAdicionais(data.info_adicionais || '')
        setOcCliente(data.oc_cliente || '')
        setRegraRuptura(data.regra_ruptura || 'parcial_novo')
        setPlanoPagamentoId(data.plano_pagamento_id || null)

        // 2. Buscar cliente — IndexedDB primeiro
        if (data.cliente_id) {
          try {
            const cliLocal = await db.clientes.get(data.cliente_id)
            if (cliLocal) {
              setCliente(cliLocal)
            } else if (navigator.onLine) {
              const { data: cliData } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', data.cliente_id)
                .maybeSingle()
              if (cliData) setCliente(cliData)
            }
          } catch (e) {
            console.warn('[DetalhesPedido] Erro cliente:', e)
          }
        }

        // 3. Buscar representada/empresa (online)
        if (data.representada_id && navigator.onLine) {
          // Se pedido tem empresa_id, é enterprise → busca em 'empresas'
          if (data.empresa_id) {
            const { data: empData } = await supabase
              .from('empresas')
              .select('*')
              .eq('id', data.empresa_id)
              .maybeSingle()
            if (empData) {
              // Adapta formato pra ficar compatível com o que o componente espera de "representada"
              setRepresentada({
                ...empData,
                tipo: 'empresa',
                plano: 'enterprise'
              })
            }
          } else {
            // PRO: busca normal em 'representadas'
            const { data: repData } = await supabase
              .from('representadas')
              .select('*')
              .eq('id', data.representada_id)
              .maybeSingle()
            if (repData) setRepresentada(repData)
          }
        }
      }

      // 4. Buscar representante (só online)
      if (navigator.onLine) {
        const { data: reprData } = await supabase
          .from('representantes')
          .select('*')
          .eq('id', repId)
          .maybeSingle()
        if (reprData) setRepresentante(reprData)
      }

      setLoading(false)
    }

    fetchPedido()
  }, [pedidoId, repId])

  // Buscar pedido origem se for pedido saldo
  useEffect(() => {
    if (!pedido?.pedido_origem_id) {
      setPedidoOrigem(null)
      return
    }

    async function fetchPedidoOrigem() {
      const { data } = await supabase
        .from('pedidos')
        .select('id, numero')
        .eq('id', pedido.pedido_origem_id)
        .single()

      if (data) {
        setPedidoOrigem(data)
      }
    }

    fetchPedidoOrigem()
  }, [pedido?.pedido_origem_id])

  // Carregar planos de pagamento do IndexedDB
  useEffect(() => {
    async function carregarPlanos() {
      try {
        // Determina empresa: enterprise usa empresa_id, PRO usa representada_id
        let empresaId = null
        if (representada?.plano === 'enterprise' && representada?.id) {
          empresaId = representada.id
        } else if (pedido?.empresa_id) {
          empresaId = pedido.empresa_id
        }
        if (!empresaId) {
          setPlanosDisponiveis([])
          return
        }
        const planos = await db.planos_pagamento
          .where('empresa_id')
          .equals(empresaId)
          .toArray()
        const ativos = planos.filter(p => p.ativo === true)
        ativos.sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0))
        setPlanosDisponiveis(ativos)
      } catch (err) {
        console.error('[DetalhesPedido] Erro carregando planos:', err)
        setPlanosDisponiveis([])
      }
    }
    carregarPlanos()
  }, [representada, pedido?.empresa_id])

  function formatarValor(valor) {
    if (!valor || valor === 0) return 'R$ 0,00'
    if (valor >= 1000000) {
      return `R$ ${(valor / 1000000).toFixed(1).replace('.', ',')}M`
    }
    if (valor >= 10000) {
      return `R$ ${(valor / 1000).toFixed(1).replace('.', ',')}k`
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor)
  }

  function formatarData(dataStr) {
    if (!dataStr) return '-'
    const d = new Date(dataStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Pedido saldo: bloqueia edição
  const isPedidoSaldo = !!pedido?.pedido_origem_id
  const isEditavel = pedido?.status === 'orcamento' && !isReadonly && !isPedidoSaldo

  // Feature de regra de ruptura
  const mostrarRegraRuptura = features?.regra_ruptura === true
  const totalItens = pedido?.itens?.length || 0
  const subtotal = pedido?.valor_bruto || 0
  const descontoTotal = pedido?.valor_desconto || 0
  const total = pedido?.valor_liquido || (subtotal - descontoTotal)

  async function salvar() {
    console.log('[salvar] 1. Iniciando...')

    // Validar condição de pagamento
    if (!condicaoPagamento.trim()) {
      setErroCondicao(true)
      setToastTipo('erro')
      setToast('Defina a condição de pagamento')
      setTimeout(() => setToast(''), 3000)
      return
    }
    setErroCondicao(false)

    setSalvando(true)

    const dadosUpdate = {
      condicao_pagamento: condicaoPagamento.trim() || null,
      plano_pagamento_id: planoPagamentoId || null,
      tipo: tipoPedido || 'Venda',
      info_adicionais: infoAdicionais.trim() || null,
      oc_cliente: ocCliente.trim() || null,
      valor_bruto: subtotal,
      valor_desconto: descontoTotal
    }
    if (mostrarRegraRuptura) {
      dadosUpdate.regra_ruptura = regraRuptura
    }

    console.log('[salvar] 2. Dados:', JSON.stringify(dadosUpdate, null, 2))
    console.log('[salvar] 3. pedidoId:', pedidoId)

    try {
      const resultado = await atualizarComOuSemConexao(
        'pedidos',
        pedidoId,
        dadosUpdate,
        { tabelaLocal: 'pedidos' }
      )

      console.log('[salvar] 4. Resultado:', resultado)

      if (!resultado.ok) {
        console.error('[salvar] ERRO:', resultado.motivo)
        alert('Erro ao salvar: ' + resultado.motivo)
        setSalvando(false)
        return
      }

      console.log('[salvar] 5. Sucesso! Mostrando toast...')
      setToastTipo('sucesso')
      setToast(resultado.offline ? 'Pedido salvo offline' : 'Pedido salvo!')

      console.log('[salvar] 6. Aguardando 800ms...')
      setTimeout(() => {
        console.log('[salvar] 7. Chamando navigate(/pedidos)...')
        navigate('/pedidos')
        console.log('[salvar] 8. navigate() chamado')
      }, 800)

    } catch (err) {
      console.error('[salvar] EXCECAO:', err)
      alert('Erro ao salvar: ' + err.message)
      setSalvando(false)
    }
  }

  async function gerarPedido() {
    // Bloqueio offline — gerar pedido precisa de conexão (numeração sequencial)
    if (!navigator.onLine) {
      alert('Você precisa estar conectado à internet para gerar o pedido. Salve como orçamento e gere quando voltar online.')
      return
    }

    // Validar condição de pagamento
    if (!condicaoPagamento.trim()) {
      setErroCondicao(true)
      setToastTipo('erro')
      setToast('Defina a condição de pagamento antes de gerar o pedido')
      setTimeout(() => setToast(''), 3000)
      return
    }
    setErroCondicao(false)

    if (!confirm('Confirma gerar o pedido? Após gerado, não será mais possível editar.')) {
      return
    }

    setSalvando(true)

    try {
      // Verificar se rep tem empresa_id (Enterprise)
      const { data: rep } = await supabase
        .from('representantes')
        .select('empresa_id, plano')
        .eq('id', repId)
        .single()

      // Gerar número do pedido
      const { data: ultimoPedido } = await supabase
        .from('pedidos')
        .select('numero')
        .eq('rep_id', repId)
        .not('numero', 'is', null)
        .order('numero', { ascending: false })
        .limit(1)

      const novoNumero = (ultimoPedido?.[0]?.numero || 0) + 1

      // Montar dados do update
      const dadosUpdate = {
        status: 'pedido',
        numero: novoNumero,
        condicao_pagamento: condicaoPagamento.trim() || null,
        plano_pagamento_id: planoPagamentoId || null,
        tipo: tipoPedido || 'Venda',
        info_adicionais: infoAdicionais.trim() || null,
        oc_cliente: ocCliente.trim() || null,
        valor_bruto: subtotal,
        valor_desconto: descontoTotal,
        data_pedido: new Date().toISOString()
      }
      if (mostrarRegraRuptura) {
        dadosUpdate.regra_ruptura = regraRuptura
      }

      // Se rep tem empresa_id (Enterprise), enviar para aprovação
      if (rep?.empresa_id) {
        dadosUpdate.empresa_id = rep.empresa_id
        dadosUpdate.status_empresa = 'aguardando'
        // Campos denormalizados para o SalesRP (evita JOINs)
        dadosUpdate.cliente_cnpj = cliente?.cnpj_cpf || null
        dadosUpdate.cliente_telefone = cliente?.telefone || null
        dadosUpdate.cliente_cidade = cliente?.cidade || null
        dadosUpdate.cliente_estado = cliente?.estado || null
        dadosUpdate.rep_nome = representante?.nome || null
        dadosUpdate.rep_telefone = representante?.telefone || null
        dadosUpdate.rep_email = representante?.email || null
        dadosUpdate.qtd_itens = pedido?.itens?.length || 0
      }

      console.log('[gerarPedido] Vai dar update no pedido:', pedidoId)
      console.log('[gerarPedido] Dados:', JSON.stringify(dadosUpdate, null, 2))

      const { error } = await supabase
        .from('pedidos')
        .update(dadosUpdate)
        .eq('id', pedidoId)

      if (error) {
        console.error('[gerarPedido] ERRO COMPLETO:', JSON.stringify(error, null, 2))
        alert('Erro ao gerar pedido')
        setSalvando(false)
        return
      }

      // Atualizar ultimo_pedido do cliente
      if (pedido?.cliente_id) {
        await supabase
          .from('clientes')
          .update({
            ultimo_pedido_data: dataLocal(),
            ultimo_pedido_valor: total
          })
          .eq('id', pedido.cliente_id)
      }

      // Recarregar pedido
      const { data: pedidoAtualizado } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single()

      if (pedidoAtualizado) {
        setPedido(pedidoAtualizado)
        // Atualiza IndexedDB local pra refletir mudança imediatamente na ListaPedidos
        try {
          await db.pedidos.put({
            ...pedidoAtualizado,
            _synced_at: new Date().toISOString(),
            _pending_sync: 0
          })
        } catch (err) {
          console.error('[DetalhesPedido] Erro ao atualizar IndexedDB:', err)
        }
      }

      // Mostrar mensagem de sucesso
      setToastTipo('sucesso')
      setToast('Pedido gerado com sucesso')
      setTimeout(() => setToast(''), 3000)

    } catch (err) {
      console.error('[gerarPedido] Exceção COMPLETA:', err)
      console.error('[gerarPedido] Stack:', err?.stack)
      console.error('[gerarPedido] Detalhes:', err?.message, err?.details, err?.hint, err?.code)
      alert('Erro ao gerar pedido')
    }

    setSalvando(false)
  }

  async function duplicarPedido() {
    setSalvando(true)

    try {
      const { data: novoPedido, error } = await supabase
        .from('pedidos')
        .insert({
          ...pedido,
          id: undefined,
          status: 'orcamento',
          numero: null,
          created_at: new Date().toISOString(),
          data_pedido: null
        })
        .select()
        .single()

      if (error) {
        console.error('[DetalhesPedido] Erro duplicar:', error)
        alert('Erro ao duplicar')
      } else {
        navigate(`/pedidos/${novoPedido.id}`)
      }
    } catch (err) {
      console.error('[DetalhesPedido] Exceção:', err)
      alert('Erro ao duplicar')
    }

    setSalvando(false)
  }

  async function verPDF() {
    setGerandoPDF(true)
    try {
      await abrirPreviewPDF(pedido, representada, representante, cliente)
    } catch (err) {
      console.error('[DetalhesPedido] Erro PDF:', err)
      alert('Erro ao gerar PDF')
    }
    setGerandoPDF(false)
  }

  async function handleCompartilhar() {
    setGerandoPDF(true)
    try {
      await compartilharPDF(pedido, representada, representante, cliente)
    } catch (err) {
      console.error('[DetalhesPedido] Erro compartilhar:', err)
      alert('Erro ao compartilhar')
    }
    setGerandoPDF(false)
  }

  async function cancelarOrcamento() {
    if (!confirm('Você tem certeza que deseja cancelar esse orçamento? Esta ação não pode ser desfeita.')) {
      return
    }

    setSalvando(true)

    try {
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', pedidoId)

      if (error) {
        console.error('[DetalhesPedido] Erro ao cancelar:', error)
        alert('Erro ao cancelar orçamento')
        setSalvando(false)
        return
      }

      limparCarrinho(pedidoId)

      setToastTipo('sucesso')
      setToast('Orçamento cancelado')
      setTimeout(() => {
        navigate('/pedidos')
      }, 800)

    } catch (err) {
      console.error('[DetalhesPedido] Exceção:', err)
      alert('Erro ao cancelar orçamento')
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <div className={`detalhes-pedido ${isDark ? 'dark' : 'light'}`}>
        <header className="dp-header">
          <button className="dp-voltar" onClick={handleVoltar}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="dp-header-titulo">Pedido</span>
          <div style={{ width: 60 }}></div>
        </header>
        <div className="dp-loading">Carregando...</div>
      </div>
    )
  }

  return (
    <div className={`detalhes-pedido ${isDark ? 'dark' : 'light'} ${isReadonly ? 'readonly' : ''}`}>
      {/* Header */}
      <header className="dp-header">
        <button className="dp-voltar" onClick={handleVoltar}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className={`dp-badge ${pedido?.status}`}>
          {pedido?.status === 'orcamento' ? 'Em orçamento' :
           pedido?.status === 'transmitido' ? 'Transmitido' :
           `Pedido #${String(pedido?.numero || 0).padStart(3, '0')}`}
        </span>
        {isEditavel && !isReadonly && (
          <button
            className="dp-salvar"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? '...' : 'Salvar'}
          </button>
        )}
        {(!isEditavel || isReadonly) && <div style={{ width: 60 }}></div>}
      </header>

      {/* Banner somente leitura */}
      {isReadonly && (
        <div className="dp-banner-readonly">
          <span>👁️ Visualização do pedido — somente leitura</span>
        </div>
      )}

      {/* Banner check-in */}
      {!isReadonly && pedido?.canal === 'presencial' && pedido?.visita_id && (
        <div className="dp-banner">
          <span>✅ Check-in · {formatarData(pedido.created_at)}</span>
        </div>
      )}

      {/* Banner pedido saldo */}
      {isPedidoSaldo && (
        <div className="dp-banner-saldo">
          <span className="dp-banner-saldo-titulo">📋 Pedido em saldo</span>
          <span className="dp-banner-saldo-desc">
            Gerado a partir do pedido #{pedidoOrigem?.numero ? String(pedidoOrigem.numero).padStart(3, '0') : '...'}
          </span>
        </div>
      )}

      <div className="dp-content">
        {/* Informações básicas */}
        <div className="dp-card">
          <div className="dp-info-linha">
            <span className="dp-info-label">Cliente</span>
            <span className="dp-info-valor">{pedido?.cliente_nome}</span>
          </div>
          <div className="dp-info-linha">
            <span className="dp-info-label">Representada</span>
            <span className="dp-info-valor">{pedido?.representada_nome || '-'}</span>
          </div>
          <div className="dp-info-linha">
            <span className="dp-info-label">Data emissão</span>
            <span className="dp-info-valor">{formatarData(pedido?.created_at)}</span>
          </div>
          <div className="dp-info-linha">
            <span className="dp-info-label">Canal</span>
            <span className="dp-info-valor">
              {pedido?.canal === 'whatsapp' ? '💬 WhatsApp' : '🏪 Presencial'}
            </span>
          </div>
          {mostrarRegraRuptura && (
            <div
              className={`dp-info-linha dp-info-ruptura ${isEditavel ? 'clicavel' : ''}`}
              onClick={isEditavel ? () => setShowRupturaSheet(true) : undefined}
              style={{ cursor: isEditavel ? 'pointer' : 'default' }}
            >
              <span className="dp-info-label">Em caso de ruptura</span>
              <div className="dp-condicao-right">
                <span style={{ color: isEditavel ? '#007aff' : '#888' }}>
                  {regraRuptura === 'parcial_novo' && 'fatura parcial e cria novo pedido'}
                  {regraRuptura === 'parcial_cancela' && 'fatura parcial e cancela saldo'}
                  {regraRuptura === 'total' && 'entrega total'}
                  {!regraRuptura && (isEditavel ? 'Selecionar' : '-')}
                </span>
                {isEditavel && <span className="dp-condicao-seta">›</span>}
              </div>
            </div>
          )}
        </div>

        {/* Condições comerciais */}
        <div className="dp-card dp-condicoes">
          <div className="dp-card-titulo">Condições comerciais</div>

          {/* Condição de pagamento: dropdown se tiver planos, input livre se não */}
          <div className="dp-campo" style={{ padding: '12px 16px' }}>
            <label style={{ fontSize: 13, color: '#888', marginBottom: 6, display: 'block' }}>
              Condição de pagamento
              {isEditavel && <span style={{ color: '#ff3b30', marginLeft: 2 }}>*</span>}
            </label>
            {planosDisponiveis.length > 0 ? (
              <select
                value={planoPagamentoId || ''}
                onChange={(e) => {
                  const novoId = e.target.value || null
                  setPlanoPagamentoId(novoId)
                  if (novoId) {
                    const plano = planosDisponiveis.find(p => p.id === novoId)
                    if (plano) setCondicaoPagamento(plano.nome)
                  } else {
                    setCondicaoPagamento('')
                  }
                  setErroCondicao(false)
                }}
                className="dp-input"
                disabled={!isEditavel}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: 15,
                  borderRadius: 8,
                  border: erroCondicao ? '1px solid #ff3b30' : '1px solid #ddd'
                }}
              >
                <option value="">Selecione...</option>
                {planosDisponiveis.map(plano => (
                  <option key={plano.id} value={plano.id}>
                    {plano.nome}
                  </option>
                ))}
              </select>
            ) : (
              <div
                className={`dp-condicao-linha-inline ${erroCondicao ? 'erro' : ''}`}
                onClick={isEditavel ? () => { setShowPagamentoSheet(true); setErroCondicao(false); } : undefined}
                style={{
                  cursor: isEditavel ? 'pointer' : 'default',
                  padding: '10px 12px',
                  border: erroCondicao ? '1px solid #ff3b30' : '1px solid #ddd',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{
                  color: !isEditavel ? '#888' :
                         condicaoPagamento ? '#000' :
                         erroCondicao ? '#ff3b30' : '#999'
                }}>
                  {condicaoPagamento || 'Selecionar...'}
                </span>
                {isEditavel && <span style={{ color: '#007aff' }}>›</span>}
              </div>
            )}
            {erroCondicao && (
              <span style={{ fontSize: 12, color: '#ff3b30', marginTop: 4, display: 'block' }}>
                Condição de pagamento é obrigatória
              </span>
            )}
          </div>

          {/* Linha 2: Tipo de pedido */}
          <div
            className={`dp-condicao-linha ${!isEditavel ? 'travado' : ''}`}
            onClick={isEditavel ? () => setShowTipoSheet(true) : undefined}
            style={{ cursor: isEditavel ? 'pointer' : 'default' }}
          >
            <span className="dp-condicao-label">Tipo de pedido</span>
            <div className="dp-condicao-right">
              <span style={{ color: isEditavel ? '#007aff' : '#888' }}>
                {tipoPedido || 'Venda'}
              </span>
              {isEditavel && <span className="dp-condicao-seta">›</span>}
            </div>
          </div>

          {/* Linha 3: Descontos */}
          <div
            className={`dp-condicao-linha ${!isEditavel ? 'travado' : ''}`}
            onClick={isEditavel ? () => navigate(`/pedidos/${pedidoId}/descontos`) : undefined}
            style={{ cursor: isEditavel ? 'pointer' : 'default' }}
          >
            <span className="dp-condicao-label">Descontos</span>
            <div className="dp-condicao-right">
              {descontoTotal > 0 ? (
                <>
                  {pedido?.politica_nome && (
                    <span className="dp-condicao-badge">{pedido.politica_nome}</span>
                  )}
                  <span style={{ color: isEditavel ? '#34c759' : '#888', fontWeight: 600 }}>
                    − {formatarValor(descontoTotal)}
                  </span>
                  {isEditavel && <span className="dp-condicao-seta">›</span>}
                </>
              ) : (
                <>
                  <span style={{ color: '#888' }}>
                    {isEditavel ? 'Nenhum desconto' : '-'}
                  </span>
                  {isEditavel && <span className="dp-condicao-link">Definir ›</span>}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Produtos - só mostra seção completa para Pro/Enterprise */}
        {!isStarter && (
          <div className="dp-card">
            <div className="dp-card-header">
              <span className="dp-card-titulo">Produtos ({totalItens})</span>
              {isEditavel && (
                <button
                  className="dp-btn-adicionar"
                  onClick={() => navigate(`/pedidos/${pedidoId}/catalogo`)}
                >
                  + Adicionar
                </button>
              )}
            </div>

            {totalItens === 0 ? (
              <div className="dp-produtos-vazio">
                <p>Nenhum produto adicionado</p>
                {isEditavel && (
                  <button onClick={() => navigate(`/pedidos/${pedidoId}/catalogo`)}>
                    Adicionar produtos
                  </button>
                )}
              </div>
            ) : (
              <div className="dp-produtos-lista">
                {pedido.itens.map((item, index) => {
                  const precoEfetivo = calcularPrecoEfetivo(item)
                  const marcaNome = nomeFornecedorStr(item.produto_fornecedor)
                  return (
                    <div key={index} className="dp-produto-item">
                      <div className="dp-produto-info">
                        <span className="dp-produto-nome">{item.produto_nome}</span>
                        <span className="dp-produto-codigo">{item.produto_codigo}</span>
                        <div className="dp-produto-precos">
                          <span className="dp-preco-normal">{formatarValor(precoEfetivo)}/un</span>
                        </div>
                      </div>
                      <div className="dp-produto-right">
                        {marcaNome && (
                          <span className="dp-badge-fornecedor">{marcaNome}</span>
                        )}
                        {isEditavel ? (
                          <div className="dp-produto-controles">
                            <button
                              className="dp-qty-btn"
                              onClick={() => alterarQuantidadeItem(item.produto_id, -1)}
                              aria-label="Diminuir"
                            >
                              −
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              className="dp-produto-qty dp-qty-input"
                              value={item.quantidade}
                              onChange={(e) => {
                                const novaQtd = Math.max(0, parseInt(String(e.target.value).replace(/\D/g, ''), 10) || 0)
                                setPedido(prev => ({
                                  ...prev,
                                  itens: (prev?.itens || []).map(i => {
                                    if (i.produto_id !== item.produto_id) return i
                                    const precoEfetivo = calcularPrecoEfetivo(i)
                                    const ipiPct = Number(i.ipi) || 0
                                    const novoSubtotal = precoEfetivo * (1 + ipiPct / 100) * novaQtd
                                    return { ...i, quantidade: novaQtd, subtotal: novoSubtotal }
                                  })
                                }))
                              }}
                              onBlur={() => {
                                const itensAtuais = pedido?.itens || []
                                // Se qtd ficou 0, remove o item antes de persistir
                                const itensValidos = itensAtuais.filter(i => Number(i.quantidade) > 0)
                                persistirItens(itensValidos)
                              }}
                              onFocus={(e) => e.target.select()}
                              aria-label="Quantidade"
                            />
                            <button
                              className="dp-qty-btn"
                              onClick={() => alterarQuantidadeItem(item.produto_id, +1)}
                              aria-label="Aumentar"
                            >
                              +
                            </button>
                            <button
                              className="dp-excluir-btn"
                              onClick={() => excluirItem(item.produto_id)}
                              aria-label="Excluir item"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className="dp-produto-qty">{item.quantidade} un</span>
                        )}
                        <span className="dp-produto-valor">{formatarValor(item.subtotal)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Resumo */}
        <div className="dp-card dp-resumo">
          <div className="dp-resumo-linha">
            <span>Subtotal</span>
            <span>{formatarValor(subtotal)}</span>
          </div>
          {descontoTotal > 0 && (
            <div className="dp-resumo-linha desconto">
              <span>Descontos</span>
              <span>− {formatarValor(descontoTotal)}</span>
            </div>
          )}
          <div className="dp-resumo-total">
            <span>Total</span>
            <span>{formatarValor(total)}</span>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="dp-card">
          <div className="dp-card-titulo">Informações adicionais</div>
          <textarea
            className="dp-textarea"
            placeholder="Observações, instruções de entrega..."
            value={infoAdicionais}
            onChange={(e) => setInfoAdicionais(e.target.value)}
            disabled={!isEditavel}
            rows={4}
          />

          <div className="dp-campo" style={{ marginTop: 14 }}>
            <label>OC do cliente</label>
            <input
              type="text"
              placeholder="Ex: 29848773"
              value={ocCliente}
              onChange={(e) => setOcCliente(e.target.value)}
              disabled={!isEditavel}
            />
          </div>
        </div>

        {/* Ações (escondidas no modo readonly) */}
        {!isReadonly && (
          <div className="dp-acoes">
            {isEditavel ? (
              <>
                <button className="dp-btn-acao" onClick={handleCompartilhar} disabled={salvando}>
                  📤 Compartilhar
                </button>
                <button
                  className="dp-btn-gerar"
                  onClick={gerarPedido}
                  disabled={salvando || !navigator.onLine}
                  title={!navigator.onLine ? 'Conecte-se à internet para gerar o pedido' : ''}
                  style={!navigator.onLine ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {!navigator.onLine ? '🔌 Gerar pedido (offline)' : '✅ Gerar pedido'}
                </button>
                <button
                  className="dp-btn-cancelar-orcamento"
                  onClick={cancelarOrcamento}
                  disabled={salvando}
                >
                  🗑️ Cancelar
                </button>
              </>
            ) : (
              <>
                <button className="dp-btn-acao" onClick={duplicarPedido} disabled={salvando}>
                  Duplicar
                </button>
                <button className="dp-btn-acao" onClick={verPDF} disabled={salvando}>
                  Ver PDF
                </button>
                <button className="dp-btn-acao" onClick={() => setShowEmailSheet(true)} disabled={salvando}>
                  E-mail
                </button>
                <button className="dp-btn-acao" onClick={handleCompartilhar} disabled={salvando}>
                  Compartilhar
                </button>
              </>
            )}
          </div>
        )}

      </div>

      {/* Sheet de e-mail */}
      {showEmailSheet && (
        <div className="dp-sheet-overlay" onClick={() => setShowEmailSheet(false)}>
          <div className="dp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="dp-sheet-header">
              <span>Enviar por e-mail</span>
              <button onClick={() => setShowEmailSheet(false)}>X</button>
            </div>
            <div className="dp-sheet-content">
              <p className="dp-sheet-desc">Selecione os destinatários:</p>
              <label className="dp-check-item">
                <input type="checkbox" defaultChecked />
                <span>Meu e-mail ({representante?.email || '-'})</span>
              </label>
              <label className="dp-check-item">
                <input type="checkbox" defaultChecked />
                <span>Representada ({representada?.email || '-'})</span>
              </label>
              <label className="dp-check-item">
                <input type="checkbox" />
                <span>Cliente ({cliente?.email || '-'})</span>
              </label>
              <button
                className="dp-btn-enviar"
                onClick={() => {
                  alert('Envio de e-mail em desenvolvimento')
                  setShowEmailSheet(false)
                }}
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet de condição de pagamento */}
      {showPagamentoSheet && (
        <div className="dp-sheet-overlay" onClick={() => setShowPagamentoSheet(false)}>
          <div className="dp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="dp-sheet-header">
              <span>Condição de pagamento</span>
              <button onClick={() => setShowPagamentoSheet(false)}>✕</button>
            </div>
            <div className="dp-sheet-content">
              <div className="dp-sheet-opcoes">
                {['À vista', '30 dias', '30/60', '30/60/90', '28/56/84', 'Boleto 21 dias'].map(opcao => (
                  <button
                    key={opcao}
                    className={`dp-sheet-opcao ${condicaoPagamento === opcao ? 'active' : ''}`}
                    onClick={() => {
                      setCondicaoPagamento(opcao)
                      setShowPagamentoSheet(false)
                    }}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
              <div className="dp-sheet-custom">
                <input
                  type="text"
                  placeholder="Ou digite personalizado..."
                  value={condicaoPagamento}
                  onChange={(e) => setCondicaoPagamento(e.target.value)}
                />
                <button
                  className="dp-sheet-confirmar"
                  onClick={() => setShowPagamentoSheet(false)}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sheet de tipo de pedido */}
      {showTipoSheet && (
        <div className="dp-sheet-overlay" onClick={() => setShowTipoSheet(false)}>
          <div className="dp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="dp-sheet-header">
              <span>Tipo de pedido</span>
              <button onClick={() => setShowTipoSheet(false)}>✕</button>
            </div>
            <div className="dp-sheet-content">
              <div className="dp-sheet-opcoes">
                {['Venda', 'Bonificação', 'Troca', 'Amostra', 'Consignação'].map(opcao => (
                  <button
                    key={opcao}
                    className={`dp-sheet-opcao ${tipoPedido === opcao ? 'active' : ''}`}
                    onClick={() => {
                      setTipoPedido(opcao)
                      setShowTipoSheet(false)
                    }}
                  >
                    {opcao}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sheet de regra de ruptura */}
      {showRupturaSheet && (
        <div className="dp-sheet-overlay" onClick={() => setShowRupturaSheet(false)}>
          <div className="dp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="dp-sheet-header">
              <span>Em caso de ruptura</span>
              <button onClick={() => setShowRupturaSheet(false)}>✕</button>
            </div>
            <div className="dp-sheet-content">
              <div className="dp-sheet-opcoes">
                {[
                  { value: 'parcial_novo', label: 'Fatura parcial e cria novo pedido com saldo' },
                  { value: 'parcial_cancela', label: 'Fatura parcial e cancela saldo' },
                  { value: 'total', label: 'Entrega total' }
                ].map(opcao => (
                  <button
                    key={opcao.value}
                    className={`dp-sheet-opcao ${regraRuptura === opcao.value ? 'active' : ''}`}
                    onClick={() => {
                      setRegraRuptura(opcao.value)
                      setShowRupturaSheet(false)
                    }}
                  >
                    {opcao.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading de geracao de PDF */}
      {gerandoPDF && (
        <div className="dp-pdf-loading">
          <div className="dp-pdf-loading-content">
            <div className="dp-spinner"></div>
            <span>Gerando seu PDF...</span>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`dp-toast ${toastTipo}`}>{toast}</div>
      )}
    </div>
  )
}

export default DetalhesPedido

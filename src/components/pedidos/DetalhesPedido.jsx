import { useState, useEffect, useMemo } from 'react'
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

// Agrupa planos de pagamento por família (para o sheet de Condição de pagamento)
function familiaPlano(nome) {
  const n = (nome || '').toUpperCase()
  if (n.includes('BOLETO VIACREDI')) return 'Boleto Viacredi'
  if (n.startsWith('BOLETO')) return 'Boleto'
  if (n.includes('STONE')) return 'Cartão'
  if (n.startsWith('CHEQUE')) return 'Cheque'
  if (n.includes('PIX') || n.includes('DINHEIRO') || n.includes('A VISTA') || n.includes('À VISTA')) return 'À vista'
  if (n.includes('VISA') || n.includes('MASTER') || n.includes('CARTAO') || n.includes('CARTÃO') || n.includes('CRÉDITO') || n.includes('CREDITO') || n.includes('DÉBITO') || n.includes('DEBITO')) return 'Cartão'
  return 'Outros'
}

const ORDEM_FAMILIAS = ['À vista', 'Boleto', 'Boleto Viacredi', 'Cartão', 'Cheque', 'Outros']

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
  const [buscaPlano, setBuscaPlano] = useState('')
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

  // Planos de pagamento filtrados pela busca e agrupados por família (sheet de Condição de pagamento)
  const planosAgrupados = useMemo(() => {
    const termo = buscaPlano.trim().toLowerCase()
    const filtrados = termo
      ? planosDisponiveis.filter(p => (p.nome || '').toLowerCase().includes(termo))
      : planosDisponiveis
    const grupos = {}
    for (const p of filtrados) {
      const fam = familiaPlano(p.nome)
      if (!grupos[fam]) grupos[fam] = []
      grupos[fam].push(p)
    }
    return ORDEM_FAMILIAS
      .filter(f => grupos[f]?.length > 0)
      .map(f => ({ familia: f, planos: grupos[f] }))
  }, [planosDisponiveis, buscaPlano])

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

  // Valor sempre completo (sem abreviação k/M) — usado no card de Total
  function formatarValorCompleto(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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

  const getIniciais = (nome) => {
    if (!nome) return '?'
    const partes = nome.trim().split(/\s+/).filter(Boolean)
    if (partes.length === 0) return '?'
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
  }

  const labelRuptura = regraRuptura === 'parcial_novo'
    ? 'Fatura parcial e cria novo pedido'
    : regraRuptura === 'parcial_cancela'
      ? 'Fatura parcial e cancela saldo'
      : regraRuptura === 'total'
        ? 'Entrega total'
        : 'Selecione'

  return (
    <div className={`detalhes-pedido dp-redesign ${isDark ? 'dark' : 'light'} ${isReadonly ? 'readonly' : ''}`}>

      {/* Header escuro */}
      <header className="dp-header-novo">
        <button className="dp-voltar" onClick={handleVoltar} aria-label="Voltar">
          ‹
        </button>
        <span className="dp-titulo">
          {pedido?.status === 'orcamento'
            ? 'Orçamento'
            : `Pedido #${String(pedido?.numero || 0).padStart(3, '0')}`}
        </span>
        {isEditavel && !isReadonly ? (
          <button className="dp-salvar" onClick={salvar} disabled={salvando}>
            {salvando ? '...' : 'Salvar'}
          </button>
        ) : (
          <div style={{ width: 60 }}></div>
        )}
      </header>

      {/* Status badge */}
      <div className={`dp-status-badge dp-status-${
        pedido?.status === 'orcamento' ? 'orcamento'
          : pedido?.status === 'transmitido' ? 'enviado'
          : 'aprovado'
      }`}>
        <span className="dp-status-dot"></span>
        <span className="dp-status-text">
          {pedido?.status === 'orcamento' ? 'Em orçamento'
            : pedido?.status === 'transmitido' ? 'Transmitido'
            : `Pedido #${String(pedido?.numero || 0).padStart(3, '0')}`}
        </span>
      </div>

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

      <div className="dp-content-novo">

        {/* Card cliente em destaque */}
        <div className="dp-cliente-card" onClick={() => pedido?.cliente_id && navigate(`/clientes/${pedido.cliente_id}`, { state: { from: 'pedido', pedidoId } })}>
          <div className="dp-cliente-avatar">{getIniciais(pedido?.cliente_nome)}</div>
          <div className="dp-cliente-info">
            <span className="dp-cliente-nome">{pedido?.cliente_nome || 'Cliente'}</span>
            <span className="dp-cliente-sub">
              {cliente?.cnpj_cpf || ''}
              {cliente?.cnpj_cpf && (representada?.nome || pedido?.representada_nome) ? ' · ' : ''}
              {representada?.nome || pedido?.representada_nome || ''}
            </span>
            {pedido?.visita_id && pedido?.created_at && (
              <span className="dp-cliente-micro dp-cliente-checkin">
                ✓ Check-in {formatarData(pedido.created_at)}
              </span>
            )}
            <span className="dp-cliente-micro">
              {pedido?.canal === 'whatsapp' ? '💬 WhatsApp' : '🏪 Presencial'}
            </span>
          </div>
          <span className="dp-cliente-arrow">›</span>
        </div>

        {/* Botões de ação */}
        <button
          className="dp-btn-primary"
          onClick={() => navigate(`/pedidos/${pedidoId}/catalogo`)}
          disabled={!isEditavel}
        >
          + Adicionar produtos
        </button>
        <button
          className="dp-btn-secondary"
          onClick={isEditavel ? () => navigate(`/pedidos/${pedidoId}/descontos`) : undefined}
          disabled={!isEditavel}
        >
          🏷 Definir descontos
        </button>

        {/* DETALHES */}
        <span className="dp-section-label">Detalhes</span>
        <div className="dp-list">
          <div className="dp-row">
            <span className="dp-row-label">Data emissão</span>
            <span className="dp-row-value">{formatarData(pedido?.created_at)}</span>
          </div>
          <div
            className={`dp-row ${isEditavel ? 'clicavel' : ''}`}
            onClick={isEditavel ? () => setShowTipoSheet(true) : undefined}
          >
            <span className="dp-row-label">Tipo de pedido</span>
            <span className="dp-row-value">{tipoPedido}</span>
            {isEditavel && <span className="dp-row-arrow">›</span>}
          </div>
          <div
            className={`dp-row ${isEditavel ? 'clicavel' : ''} ${erroCondicao ? 'erro' : ''}`}
            onClick={isEditavel ? () => { setShowPagamentoSheet(true); setErroCondicao(false); } : undefined}
          >
            <span className="dp-row-label">
              Condição de pagamento{!condicaoPagamento && <span className="dp-required">*</span>}
            </span>
            <span className="dp-row-value">{condicaoPagamento || 'Selecione'}</span>
            {isEditavel && <span className="dp-row-arrow">›</span>}
          </div>
          {mostrarRegraRuptura && (
            <div
              className={`dp-row ${isEditavel ? 'clicavel' : ''}`}
              onClick={isEditavel ? () => setShowRupturaSheet(true) : undefined}
            >
              <span className="dp-row-label">Em caso de ruptura</span>
              <span className="dp-row-value">{labelRuptura}</span>
              {isEditavel && <span className="dp-row-arrow">›</span>}
            </div>
          )}
        </div>

        {/* Total + Ver Itens */}
        <div className="dp-total-card">
          <div className="dp-total-row">
            <span className="dp-total-label">Total</span>
            <span className="dp-total-val">{formatarValorCompleto(total)}</span>
          </div>
          <div className="dp-ver-itens" onClick={() => navigate(`/pedidos/${pedidoId}/itens`)}>
            <span className="dp-ver-itens-label">
              📦 Ver itens <span className="dp-badge-count">{totalItens}</span>
            </span>
            <span className="dp-row-arrow">›</span>
          </div>
        </div>

        {/* OC do cliente */}
        <span className="dp-section-label">OC do cliente</span>
        <div className="dp-list">
          <div className="dp-row">
            <input
              className="dp-row-input"
              value={ocCliente}
              onChange={(e) => setOcCliente(e.target.value)}
              placeholder="Ex: 29848773"
              disabled={!isEditavel}
            />
          </div>
        </div>

        {/* Informações adicionais */}
        <span className="dp-section-label">Informações adicionais</span>
        <div className="dp-textarea-card">
          <textarea
            value={infoAdicionais}
            onChange={(e) => setInfoAdicionais(e.target.value)}
            placeholder="Observações, instruções de entrega…"
            disabled={!isEditavel}
          />
        </div>

      </div>

      {/* Footer fixo */}
      {!isReadonly && (
        <footer className="dp-footer-fixo">
          {isEditavel ? (
            <>
              <div className="dp-footer-actions">
                <button
                  className="dp-btn-compartilhar"
                  onClick={handleCompartilhar}
                  disabled={gerandoPDF}
                >
                  📤 Compartilhar
                </button>
                <button
                  className="dp-btn-gerar"
                  onClick={gerarPedido}
                  disabled={salvando || !navigator.onLine}
                  title={!navigator.onLine ? 'Conecte-se à internet para gerar o pedido' : ''}
                >
                  {!navigator.onLine ? '🔌 Gerar (offline)' : '✓ Gerar pedido'}
                </button>
              </div>
              <button className="dp-btn-cancelar" onClick={cancelarOrcamento} disabled={salvando}>
                🗑 Cancelar pedido
              </button>
            </>
          ) : (
            <div className="dp-footer-actions">
              <button className="dp-btn-compartilhar" onClick={duplicarPedido} disabled={salvando}>
                Duplicar
              </button>
              <button className="dp-btn-compartilhar" onClick={verPDF} disabled={salvando}>
                Ver PDF
              </button>
              <button className="dp-btn-compartilhar" onClick={() => setShowEmailSheet(true)} disabled={salvando}>
                E-mail
              </button>
              <button className="dp-btn-compartilhar" onClick={handleCompartilhar} disabled={salvando}>
                Compartilhar
              </button>
            </div>
          )}
        </footer>
      )}

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
          <div className="dp-sheet dp-sheet-pagamento" onClick={e => e.stopPropagation()}>
            <div className="dp-sheet-handle" />
            <div className="dp-sheet-header">
              <span>Condição de pagamento</span>
              <button onClick={() => setShowPagamentoSheet(false)}>✕</button>
            </div>
            <div className="dp-sheet-search">
              <input
                type="text"
                placeholder="Buscar plano..."
                value={buscaPlano}
                onChange={e => setBuscaPlano(e.target.value)}
                autoFocus
              />
            </div>
            <div className="dp-sheet-lista">
              {planosAgrupados.length === 0 && (
                <div className="dp-sheet-empty">Nenhum plano encontrado</div>
              )}
              {planosAgrupados.map(grupo => (
                <div key={grupo.familia} className="dp-sheet-grupo">
                  <div className="dp-sheet-grupo-header">{grupo.familia}</div>
                  {grupo.planos.map(p => (
                    <button
                      key={p.id}
                      className={`dp-sheet-item ${planoPagamentoId === p.id ? 'selecionado' : ''}`}
                      onClick={() => {
                        setPlanoPagamentoId(p.id)
                        setCondicaoPagamento(p.nome)
                        setErroCondicao(false)
                        setBuscaPlano('')
                        setShowPagamentoSheet(false)
                      }}
                    >
                      <div className="dp-sheet-item-info">
                        <span className="dp-sheet-item-nome">{p.nome}</span>
                        {p.qtde_parcelas ? (
                          <span className="dp-sheet-item-sub">{p.qtde_parcelas}x</span>
                        ) : null}
                      </div>
                      {planoPagamentoId === p.id && <span className="dp-sheet-item-check">✓</span>}
                    </button>
                  ))}
                </div>
              ))}
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

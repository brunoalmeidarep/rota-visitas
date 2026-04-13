import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { formatarInputMoeda, parseMoeda } from '../../utils/formatarMoeda'
import './CheckIn.css'

const CATEGORIAS_GASTO = [
  { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
  { id: 'cafe', nome: 'Café/Lanche', icone: '☕' },
  { id: 'brinde', nome: 'Brinde', icone: '🎁' },
  { id: 'amostra', nome: 'Amostra', icone: '📦' },
  { id: 'evento', nome: 'Evento', icone: '🎉' },
  { id: 'outros', nome: 'Outros', icone: '💰' }
]

function CheckIn({ cliente, onClose, onConfirm }) {
  const navigate = useNavigate()
  const { repId } = useRepId()

  const [opcaoSelecionada, setOpcaoSelecionada] = useState('checkin')
  const [obs, setObs] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // Gasto colapsado
  const [mostrarGasto, setMostrarGasto] = useState(false)
  const [gastoCategoria, setGastoCategoria] = useState('')
  const [gastoValor, setGastoValor] = useState(0)
  const [gastoValorDisplay, setGastoValorDisplay] = useState('R$ 0,00')
  const [gastoObs, setGastoObs] = useState('')
  const [mostrarCategorias, setMostrarCategorias] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Formatar valor
  function handleValorChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setGastoValorDisplay(formatted)
    setGastoValor(parseMoeda(formatted))
  }

  async function confirmarCheckIn() {
    if (!cliente || !repId) return

    setSalvando(true)

    try {
      const hoje = new Date().toISOString().split('T')[0]
      const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      // Verificar se já existe visita do dia para este cliente
      const { data: visitaExistente } = await supabase
        .from('visitas')
        .select('id')
        .eq('cliente_id', cliente.id)
        .eq('rep_id', repId)
        .eq('data', hoje)
        .single()

      let visitaId = visitaExistente?.id

      // Se não existe, criar nova visita
      if (!visitaId) {
        const { data: novaVisita, error: erroVisita } = await supabase
          .from('visitas')
          .insert({
            cliente_id: cliente.id,
            rep_id: repId,
            nome_cliente: cliente.nome,
            cidade: cliente.cidade,
            data: hoje,
            hora: agora,
            tipo: 'presencial',
            obs: obs.trim() || null
          })
          .select()
          .single()

        if (erroVisita) {
          console.error('[CheckIn] Erro ao criar visita:', erroVisita)
          alert('Erro ao registrar check-in')
          setSalvando(false)
          return
        }

        visitaId = novaVisita.id

        // Atualizar ultima_visita do cliente
        await supabase
          .from('clientes')
          .update({ ultima_visita: hoje })
          .eq('id', cliente.id)
      }

      // Se tem gasto, salvar
      if (mostrarGasto && gastoCategoria && gastoValor > 0) {
        await supabase
          .from('gastos_cliente')
          .insert({
            cliente_id: cliente.id,
            rep_id: repId,
            visita_id: visitaId,
            cliente_nome: cliente.nome,
            categoria: gastoCategoria,
            valor: gastoValor,
            descricao: gastoObs.trim() || null,
            data: hoje
          })
      }

      // Se for check-in + pedido ou orçamento, navegar
      if (opcaoSelecionada === 'pedido') {
        navigate(`/pedidos/novo/simples?cliente=${cliente.id}&visita=${visitaId}&tipo=pedido`)
      } else if (opcaoSelecionada === 'orcamento') {
        navigate(`/pedidos/novo/simples?cliente=${cliente.id}&visita=${visitaId}&tipo=orcamento`)
      } else {
        // Só check-in
        if (onConfirm) onConfirm()
        if (onClose) onClose()
      }

    } catch (err) {
      console.error('[CheckIn] Exceção:', err)
      alert('Erro ao registrar check-in')
    }

    setSalvando(false)
  }

  function getCategoriaInfo(id) {
    return CATEGORIAS_GASTO.find(c => c.id === id)
  }

  return (
    <div className={`checkin-overlay ${isDark ? 'dark' : 'light'}`} onClick={onClose}>
      <div className="checkin-sheet" onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="checkin-handle"></div>

        {/* Título */}
        <h2 className="checkin-titulo">Check-in em {cliente?.nome?.split(' ')[0]}</h2>

        {/* Opções */}
        <div className="checkin-opcoes">
          <button
            className={`checkin-opcao ${opcaoSelecionada === 'checkin' ? 'active' : ''}`}
            onClick={() => setOpcaoSelecionada('checkin')}
          >
            <span className="checkin-opcao-icon">✅</span>
            <span className="checkin-opcao-texto">Só o check-in</span>
          </button>

          <button
            className={`checkin-opcao ${opcaoSelecionada === 'pedido' ? 'active' : ''}`}
            onClick={() => setOpcaoSelecionada('pedido')}
          >
            <span className="checkin-opcao-icon">📋</span>
            <span className="checkin-opcao-texto">Check-in + Pedido</span>
          </button>

          <button
            className={`checkin-opcao ${opcaoSelecionada === 'orcamento' ? 'active' : ''}`}
            onClick={() => setOpcaoSelecionada('orcamento')}
          >
            <span className="checkin-opcao-icon">📄</span>
            <span className="checkin-opcao-texto">Check-in + Orçamento</span>
          </button>
        </div>

        {/* Gasto colapsado */}
        {!mostrarGasto ? (
          <button className="checkin-gasto-toggle" onClick={() => setMostrarGasto(true)}>
            <span>💸 Registrar gasto?</span>
            <span className="checkin-gasto-add">+ Adicionar</span>
          </button>
        ) : (
          <div className="checkin-gasto-form">
            <div className="checkin-gasto-header">
              <span>💸 Gasto</span>
              <button className="checkin-gasto-remover" onClick={() => {
                setMostrarGasto(false)
                setGastoCategoria('')
                setGastoValor(0)
                setGastoValorDisplay('R$ 0,00')
                setGastoObs('')
              }}>×</button>
            </div>

            {/* Categoria */}
            <button
              className="checkin-gasto-campo checkin-gasto-categoria"
              onClick={() => setMostrarCategorias(true)}
            >
              {gastoCategoria ? (
                <>
                  <span>{getCategoriaInfo(gastoCategoria)?.icone}</span>
                  <span>{getCategoriaInfo(gastoCategoria)?.nome}</span>
                </>
              ) : (
                <span className="checkin-placeholder">Selecione a categoria</span>
              )}
              <span className="checkin-seta">›</span>
            </button>

            {/* Valor */}
            <div className="checkin-gasto-campo">
              <input
                type="text"
                placeholder="R$ 0,00"
                value={gastoValorDisplay}
                onChange={(e) => handleValorChange(e.target.value)}
                inputMode="numeric"
              />
            </div>

            {/* Observação */}
            <input
              type="text"
              className="checkin-gasto-campo checkin-gasto-obs"
              placeholder="Observação (opcional)"
              value={gastoObs}
              onChange={(e) => setGastoObs(e.target.value)}
            />
          </div>
        )}

        {/* Observação da visita */}
        <div className="checkin-obs">
          <label>Observação da visita</label>
          <textarea
            placeholder="Anotações sobre a visita..."
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
          />
        </div>

        {/* Botões */}
        <div className="checkin-acoes">
          <button className="checkin-btn-cancelar" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="checkin-btn-confirmar"
            onClick={confirmarCheckIn}
            disabled={salvando}
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </button>
        </div>

        {/* Sheet de categorias */}
        {mostrarCategorias && (
          <div className="checkin-categorias-overlay" onClick={() => setMostrarCategorias(false)}>
            <div className="checkin-categorias-sheet" onClick={e => e.stopPropagation()}>
              <div className="checkin-handle"></div>
              <h3>Categoria do gasto</h3>
              <div className="checkin-categorias-lista">
                {CATEGORIAS_GASTO.map(cat => (
                  <button
                    key={cat.id}
                    className={`checkin-categoria-item ${gastoCategoria === cat.id ? 'active' : ''}`}
                    onClick={() => {
                      setGastoCategoria(cat.id)
                      setMostrarCategorias(false)
                    }}
                  >
                    <span className="checkin-categoria-icon">{cat.icone}</span>
                    <span className="checkin-categoria-nome">{cat.nome}</span>
                    {gastoCategoria === cat.id && <span className="checkin-categoria-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CheckIn

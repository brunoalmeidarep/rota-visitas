import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { formatarInputMoeda, parseMoeda } from '../../utils/formatarMoeda'
import './DespesaRapida.css'

const CATEGORIAS = [
  { id: 'combustivel', nome: 'Combustível', icone: '⛽' },
  { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
  { id: 'hospedagem', nome: 'Hospedagem', icone: '🏨' },
  { id: 'pedagio', nome: 'Pedágio', icone: '🛣️' },
  { id: 'outros', nome: 'Outros', icone: '···' }
]

function DespesaRapida({ onClose, onSuccess, isDark }) {
  const { repId } = useRepId()

  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState(0)
  const [valorDisplay, setValorDisplay] = useState('R$ 0,00')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  function handleValorChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setValorDisplay(formatted)
    setValor(parseMoeda(formatted))
  }

  async function salvar() {
    if (!categoria) {
      alert('Selecione uma categoria')
      return
    }

    if (!valor || valor <= 0) {
      alert('Informe o valor')
      return
    }

    setSalvando(true)

    try {
      const hoje = new Date().toISOString().split('T')[0]
      const categoriaNome = CATEGORIAS.find(c => c.id === categoria)?.nome || categoria

      const registro = {
          rep_id: repId,
          tipo: 'gasto',
          categoria: categoriaNome,
          valor: Number(valor),
          descricao: descricao.trim() || null,
          data: hoje,
          tipo_lancamento: 'unico',
          projetado: false
        }

      console.log('[DespesaRapida] Inserindo:', JSON.stringify(registro, null, 2))

      const { error } = await supabase
        .from('financeiro')
        .insert(registro)

      if (error) {
        console.error('[DespesaRapida] Erro Supabase:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })
        alert(`Erro ao salvar: ${error.message || error.details || 'Erro desconhecido'}`)
        setSalvando(false)
        return
      }

      onSuccess()
      onClose()

    } catch (err) {
      console.error('[DespesaRapida] Exceção:', err)
      alert('Erro ao salvar despesa')
    }

    setSalvando(false)
  }

  return (
    <div className={`despesa-overlay ${isDark ? 'dark' : 'light'}`} onClick={onClose}>
      <div className="despesa-sheet" onClick={e => e.stopPropagation()}>
        <div className="despesa-handle"></div>

        <h2 className="despesa-titulo">💸 Despesa rápida</h2>

        {/* Categorias */}
        <div className="despesa-categorias">
          {CATEGORIAS.map(cat => (
            <button
              key={cat.id}
              className={`despesa-cat-btn ${categoria === cat.id ? 'active' : ''}`}
              onClick={() => setCategoria(cat.id)}
            >
              <span className="despesa-cat-icon">{cat.icone}</span>
              <span className="despesa-cat-nome">{cat.nome}</span>
            </button>
          ))}
        </div>

        {/* Valor */}
        <div className="despesa-valor-container">
          <input
            type="text"
            className="despesa-valor-input"
            placeholder="R$ 0,00"
            value={valorDisplay}
            onChange={(e) => handleValorChange(e.target.value)}
            inputMode="numeric"
          />
        </div>

        {/* Descrição */}
        <input
          type="text"
          className="despesa-descricao"
          placeholder="Descrição (opcional)"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />

        {/* Botão salvar */}
        <button
          className="despesa-btn-salvar"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? 'Salvando...' : 'Registrar despesa'}
        </button>
      </div>
    </div>
  )
}

export default DespesaRapida

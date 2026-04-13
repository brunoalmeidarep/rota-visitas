import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
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
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

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

  async function salvar() {
    if (!categoria) {
      alert('Selecione uma categoria')
      return
    }

    if (!valor || parsearValor(valor) <= 0) {
      alert('Informe o valor')
      return
    }

    setSalvando(true)

    try {
      const hoje = new Date().toISOString().split('T')[0]
      const categoriaNome = CATEGORIAS.find(c => c.id === categoria)?.nome || categoria

      const { error } = await supabase
        .from('financeiro')
        .insert({
          rep_id: repId,
          tipo: 'despesa',
          categoria: categoriaNome,
          valor: parsearValor(valor),
          descricao: descricao.trim() || null,
          data: hoje,
          tipo_lancamento: 'unico',
          projetado: false
        })

      if (error) {
        console.error('[DespesaRapida] Erro:', error)
        alert('Erro ao salvar despesa')
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
          <span className="despesa-valor-prefix">R$</span>
          <input
            type="text"
            className="despesa-valor-input"
            placeholder="0,00"
            value={valor}
            onChange={(e) => handleValorChange(e.target.value)}
            inputMode="decimal"
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

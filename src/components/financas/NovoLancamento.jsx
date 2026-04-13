import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { formatarInputMoeda, parseMoeda, formatarValor } from '../../utils/formatarMoeda'
import './NovoLancamento.css'

const CATEGORIAS_RECEITA = [
  { id: 'comissao', nome: 'Comissão', icone: '💼' },
  { id: 'bonificacao', nome: 'Bonificação', icone: '🎁' },
  { id: 'premio', nome: 'Prêmio', icone: '🏆' },
  { id: 'outros', nome: 'Outros', icone: '···' }
]

const CATEGORIAS_DESPESA = [
  { id: 'combustivel', nome: 'Combustível', icone: '⛽' },
  { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
  { id: 'hospedagem', nome: 'Hospedagem', icone: '🏨' },
  { id: 'pedagio', nome: 'Pedágio', icone: '🛣️' },
  { id: 'manutencao', nome: 'Manutenção', icone: '🔧' },
  { id: 'software', nome: 'Software', icone: '💻' },
  { id: 'outros', nome: 'Outros', icone: '···' }
]

function NovoLancamento({ onClose, onSuccess, isDark }) {
  const { repId } = useRepId()

  const [tipoLancamento, setTipoLancamento] = useState('despesa') // receita ou despesa
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState(0)
  const [valorDisplay, setValorDisplay] = useState('R$ 0,00')
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])

  // Tipo de frequência (só para despesa)
  const [frequencia, setFrequencia] = useState('unico') // unico, parcelado, recorrente

  // Parcelado
  const [parcelas, setParcelas] = useState(2)

  // Recorrente
  const [diaCobranca, setDiaCobranca] = useState(new Date().getDate())

  const [salvando, setSalvando] = useState(false)

  const categorias = tipoLancamento === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA

  function handleValorChange(valorStr) {
    const formatted = formatarInputMoeda(valorStr)
    setValorDisplay(formatted)
    setValor(parseMoeda(formatted))
  }

  // Calcular preview parcelado
  function getPreviewParcelado() {
    if (!valor || parcelas < 2) return null

    const valorParcela = valor / parcelas
    const dataInicio = new Date(data)
    const dataFim = new Date(data)
    dataFim.setMonth(dataFim.getMonth() + parcelas - 1)

    const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

    return {
      valorParcela: valorParcela.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      periodo: `${meses[dataInicio.getMonth()]}/${dataInicio.getFullYear()} → ${meses[dataFim.getMonth()]}/${dataFim.getFullYear()}`
    }
  }

  async function salvar() {
    if (!categoria) {
      alert('Selecione uma categoria')
      return
    }

    if (!valor || valor <= 0 || isNaN(valor)) {
      alert('Informe um valor válido')
      console.error('[NovoLancamento] Valor inválido:', valor, typeof valor)
      return
    }

    if (!repId) {
      alert('Erro: rep_id não encontrado. Faça login novamente.')
      console.error('[NovoLancamento] repId não disponível')
      return
    }

    setSalvando(true)

    try {
      const categoriaNome = categorias.find(c => c.id === categoria)?.nome || categoria
      const grupoId = crypto.randomUUID()

      // Mapear tipo: 'despesa' -> 'gasto', 'receita' -> 'receita'
      const tipoDb = tipoLancamento === 'despesa' ? 'gasto' : 'receita'

      if (frequencia === 'unico' || tipoLancamento === 'receita') {
        // Lançamento único
        const registro = {
          rep_id: repId,
          tipo: tipoDb,
          categoria: categoriaNome,
          valor: Number(valor),
          descricao: descricao.trim() || null,
          data: data,
          tipo_lancamento: 'unico',
          projetado: false
        }

        console.log('[NovoLancamento] Inserindo registro único:', JSON.stringify(registro, null, 2))

        const { error } = await supabase
          .from('financeiro')
          .insert(registro)

        if (error) {
          console.error('[NovoLancamento] Erro Supabase:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          })
          throw error
        }

      } else if (frequencia === 'parcelado') {
        // Criar N parcelas
        const valorParcela = Number(valor) / parcelas
        const dataBase = new Date(data)
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)

        const registros = []
        for (let i = 0; i < parcelas; i++) {
          const dataParcela = new Date(dataBase)
          dataParcela.setMonth(dataParcela.getMonth() + i)

          const ehFuturo = dataParcela > hoje

          registros.push({
            rep_id: repId,
            tipo: tipoDb,
            categoria: categoriaNome,
            valor: Number(valorParcela.toFixed(2)),
            descricao: descricao.trim() || null,
            data: dataParcela.toISOString().split('T')[0],
            tipo_lancamento: 'parcelado',
            parcelas_total: parcelas,
            parcela_atual: i + 1,
            grupo_id: grupoId,
            projetado: ehFuturo
          })
        }

        console.log('[NovoLancamento] Inserindo parcelas:', JSON.stringify(registros, null, 2))

        const { error } = await supabase
          .from('financeiro')
          .insert(registros)

        if (error) {
          console.error('[NovoLancamento] Erro Supabase parcelas:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          })
          throw error
        }

      } else if (frequencia === 'recorrente') {
        // Criar 12 meses de lançamentos recorrentes
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)

        const registros = []
        for (let i = 0; i < 12; i++) {
          const dataLancamento = new Date(hoje.getFullYear(), hoje.getMonth() + i, diaCobranca)

          // Ajustar se o dia não existir no mês
          if (dataLancamento.getDate() !== diaCobranca) {
            dataLancamento.setDate(0) // Último dia do mês anterior
          }

          const ehFuturo = dataLancamento > hoje

          registros.push({
            rep_id: repId,
            tipo: tipoDb,
            categoria: categoriaNome,
            valor: Number(valor),
            descricao: descricao.trim() || null,
            data: dataLancamento.toISOString().split('T')[0],
            tipo_lancamento: 'recorrente',
            recorrente_dia: diaCobranca,
            grupo_id: grupoId,
            projetado: ehFuturo
          })
        }

        console.log('[NovoLancamento] Inserindo recorrentes:', JSON.stringify(registros, null, 2))

        const { error } = await supabase
          .from('financeiro')
          .insert(registros)

        if (error) {
          console.error('[NovoLancamento] Erro Supabase recorrente:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          })
          throw error
        }
      }

      onSuccess()

    } catch (err) {
      console.error('[NovoLancamento] Exceção completa:', err)
      const mensagem = err.message || err.details || 'Erro desconhecido'
      alert(`Erro ao salvar: ${mensagem}`)
    }

    setSalvando(false)
  }

  const preview = frequencia === 'parcelado' ? getPreviewParcelado() : null

  return (
    <div className={`lancamento-overlay ${isDark ? 'dark' : 'light'}`} onClick={onClose}>
      <div className="lancamento-sheet" onClick={e => e.stopPropagation()}>
        <div className="lancamento-handle"></div>

        <h2 className="lancamento-titulo">Novo lançamento</h2>

        {/* Toggle Receita/Despesa */}
        <div className="lancamento-toggle">
          <button
            className={`lancamento-toggle-btn ${tipoLancamento === 'receita' ? 'ativo receita' : ''}`}
            onClick={() => {
              setTipoLancamento('receita')
              setCategoria('')
              setFrequencia('unico')
            }}
          >
            📈 Receita
          </button>
          <button
            className={`lancamento-toggle-btn ${tipoLancamento === 'despesa' ? 'ativo despesa' : ''}`}
            onClick={() => {
              setTipoLancamento('despesa')
              setCategoria('')
            }}
          >
            💸 Despesa
          </button>
        </div>

        {/* Categorias */}
        <div className="lancamento-secao">
          <label>Categoria</label>
          <div className="lancamento-categorias">
            {categorias.map(cat => (
              <button
                key={cat.id}
                className={`lancamento-cat-btn ${categoria === cat.id ? 'active' : ''}`}
                onClick={() => setCategoria(cat.id)}
              >
                <span className="lancamento-cat-icon">{cat.icone}</span>
                <span className="lancamento-cat-nome">{cat.nome}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Valor */}
        <div className="lancamento-secao">
          <label>Valor</label>
          <div className="lancamento-valor-container">
            <input
              type="text"
              className="lancamento-valor-input"
              placeholder="R$ 0,00"
              value={valorDisplay}
              onChange={(e) => handleValorChange(e.target.value)}
              inputMode="numeric"
            />
          </div>
        </div>

        {/* Descrição */}
        <div className="lancamento-secao">
          <label>Descrição (opcional)</label>
          <input
            type="text"
            className="lancamento-input"
            placeholder="Ex: Abastecimento posto Shell"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        {/* Data */}
        <div className="lancamento-secao">
          <label>Data</label>
          <input
            type="date"
            className="lancamento-input"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </div>

        {/* Tipo de lançamento (só despesa) */}
        {tipoLancamento === 'despesa' && (
          <div className="lancamento-secao">
            <label>Tipo de lançamento</label>
            <div className="lancamento-frequencia">
              <button
                className={`lancamento-freq-btn ${frequencia === 'unico' ? 'ativo' : ''}`}
                onClick={() => setFrequencia('unico')}
              >
                Único
              </button>
              <button
                className={`lancamento-freq-btn ${frequencia === 'parcelado' ? 'ativo' : ''}`}
                onClick={() => setFrequencia('parcelado')}
              >
                Parcelado
              </button>
              <button
                className={`lancamento-freq-btn ${frequencia === 'recorrente' ? 'ativo' : ''}`}
                onClick={() => setFrequencia('recorrente')}
              >
                Recorrente
              </button>
            </div>
          </div>
        )}

        {/* Opções parcelado */}
        {frequencia === 'parcelado' && tipoLancamento === 'despesa' && (
          <div className="lancamento-secao">
            <label>Número de parcelas</label>
            <div className="lancamento-parcelas">
              <button
                className="lancamento-parcela-btn"
                onClick={() => setParcelas(Math.max(2, parcelas - 1))}
              >
                −
              </button>
              <span className="lancamento-parcela-num">{parcelas}x</span>
              <button
                className="lancamento-parcela-btn"
                onClick={() => setParcelas(Math.min(60, parcelas + 1))}
              >
                +
              </button>
            </div>
            {preview && (
              <div className="lancamento-preview">
                <span>{preview.valorParcela}/mês</span>
                <span>{preview.periodo}</span>
              </div>
            )}
          </div>
        )}

        {/* Opções recorrente */}
        {frequencia === 'recorrente' && tipoLancamento === 'despesa' && (
          <div className="lancamento-secao">
            <label>Dia de cobrança</label>
            <div className="lancamento-dia">
              <input
                type="number"
                min="1"
                max="31"
                value={diaCobranca}
                onChange={(e) => setDiaCobranca(Math.min(31, Math.max(1, parseInt(e.target.value) || 1)))}
              />
              <span>de cada mês</span>
            </div>
            <div className="lancamento-preview recorrente">
              Repete todo mês até cancelar
            </div>
          </div>
        )}

        {/* Botão salvar */}
        <button
          className="lancamento-btn-salvar"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? 'Salvando...' : 'Registrar lançamento'}
        </button>
      </div>
    </div>
  )
}

export default NovoLancamento

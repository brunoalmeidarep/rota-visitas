import { formatarInputMoeda, parseMoeda } from '../../utils/formatarMoeda'
import './InputMoeda.css'

function InputMoeda({ value, onChange, placeholder, label, className }) {
  // value é um número, exibimos formatado
  const valorFormatado = value ? formatarInputMoeda((value * 100).toString()) : 'R$ 0,00'

  function handleChange(e) {
    const inputValue = e.target.value
    const valorNumerico = parseMoeda(formatarInputMoeda(inputValue))
    onChange(valorNumerico)
  }

  return (
    <div className={`input-moeda-container ${className || ''}`}>
      {label && <label className="input-moeda-label">{label}</label>}
      <input
        type="text"
        className="input-moeda"
        value={valorFormatado}
        onChange={handleChange}
        placeholder={placeholder || 'R$ 0,00'}
        inputMode="numeric"
      />
    </div>
  )
}

export default InputMoeda

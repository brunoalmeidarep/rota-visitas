import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './CadastroCliente.css'

function CadastroCliente() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()

  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [comprador, setComprador] = useState('')
  const [segmento, setSegmento] = useState('')
  const [endereco, setEndereco] = useState('')
  const [regime, setRegime] = useState('')

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Formata CNPJ enquanto digita
  function formatarCnpj(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 14)
    if (nums.length <= 2) return nums
    if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`
    if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`
    if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`
  }

  // Formata telefone enquanto digita
  function formatarTelefone(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 2) return nums
    if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
    if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
  }

  async function salvar() {
    // Validação
    if (!nome.trim()) {
      setErro('Nome é obrigatório')
      return
    }
    if (!cidade.trim()) {
      setErro('Cidade é obrigatória')
      return
    }
    if (!repId) {
      setErro('Erro: representante não identificado')
      return
    }

    setSalvando(true)
    setErro('')

    const novoCliente = {
      nome: nome.trim(),
      cidade: cidade.trim(),
      cnpj: cnpj.trim() || null,
      telefone: telefone.trim() || null,
      comprador: comprador.trim() || null,
      segmento: segmento || null,
      endereco: endereco.trim() || null,
      regime: regime || null,
      rep_id: repId
    }

    console.log('[CadastroCliente] Salvando:', novoCliente)

    const { data, error } = await supabase
      .from('clientes')
      .insert(novoCliente)
      .select()
      .single()

    console.log('[CadastroCliente] Resultado:', { data, error })

    setSalvando(false)

    if (error) {
      console.error('[CadastroCliente] Erro:', error)
      if (error.message.includes('duplicate')) {
        setErro('Já existe um cliente com esse CNPJ')
      } else {
        setErro(error.message || 'Erro ao salvar cliente')
      }
      return
    }

    navigate('/clientes')
  }

  if (loadingRep) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="cadastro-cliente">
      {/* Header */}
      <header className="cadastro-header">
        <button className="btn-voltar" onClick={() => navigate('/clientes')}>
          ← Voltar
        </button>
        <h1>Novo Cliente</h1>
        <button
          className="btn-salvar-header"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? '...' : 'Salvar'}
        </button>
      </header>

      {/* Formulário */}
      <div className="cadastro-form">
        {erro && <div className="erro-msg">{erro}</div>}

        <div className="campo">
          <label htmlFor="nome">Nome *</label>
          <input
            type="text"
            id="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Razão social ou nome fantasia"
            autoFocus
          />
        </div>

        <div className="campo">
          <label htmlFor="cidade">Cidade *</label>
          <input
            type="text"
            id="cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Ex: Jaraguá do Sul - SC"
          />
        </div>

        <div className="campo">
          <label htmlFor="cnpj">CNPJ</label>
          <input
            type="text"
            id="cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div className="campo">
          <label htmlFor="telefone">Telefone</label>
          <input
            type="tel"
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
            placeholder="(00) 00000-0000"
          />
        </div>

        <div className="campo">
          <label htmlFor="comprador">Comprador</label>
          <input
            type="text"
            id="comprador"
            value={comprador}
            onChange={(e) => setComprador(e.target.value)}
            placeholder="Nome do contato principal"
          />
        </div>

        <div className="campo">
          <label htmlFor="segmento">Segmento</label>
          <input
            type="text"
            id="segmento"
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            placeholder="Ex: Loja de roupas, Mercado..."
          />
        </div>

        <div className="campo">
          <label htmlFor="regime">Regime Tributário</label>
          <select
            id="regime"
            value={regime}
            onChange={(e) => setRegime(e.target.value)}
          >
            <option value="">Selecione...</option>
            <option value="simples">Simples Nacional</option>
            <option value="presumido">Lucro Presumido</option>
            <option value="real">Lucro Real</option>
            <option value="mei">MEI</option>
          </select>
        </div>

        <div className="campo">
          <label htmlFor="endereco">Endereço</label>
          <input
            type="text"
            id="endereco"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, bairro"
          />
        </div>

        {/* Botão Salvar no rodapé */}
        <button
          className="btn-salvar-footer"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? (
            <span className="spinner"></span>
          ) : (
            'Salvar Cliente'
          )}
        </button>
      </div>
    </div>
  )
}

export default CadastroCliente

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './CadastroCliente.css'

const GOOGLE_MAPS_KEY = 'AIzaSyA8MEv3kZLzuEbykwI9dfqfw3_R9udDTWo'

function CadastroCliente() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()
  const ruaInputRef = useRef(null)
  const autocompleteRef = useRef(null)

  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [telefone, setTelefone] = useState('')
  const [comprador, setComprador] = useState('')
  const [segmento, setSegmento] = useState('')
  const [regime, setRegime] = useState('')

  // Endereço
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [cepCarregando, setCepCarregando] = useState(false)
  const [ruaEditavel, setRuaEditavel] = useState(true)

  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Carrega Google Places API
  useEffect(() => {
    if (window.google?.maps?.places) {
      initAutocomplete()
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`
    script.async = true
    script.onload = () => initAutocomplete()
    document.head.appendChild(script)
  }, [])

  function initAutocomplete() {
    if (!ruaInputRef.current || !window.google?.maps?.places) return
    if (autocompleteRef.current) return // Já inicializado

    const autocomplete = new window.google.maps.places.Autocomplete(ruaInputRef.current, {
      componentRestrictions: { country: 'br' },
      types: ['address'],
      fields: ['address_components', 'formatted_address']
    })

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.address_components) return

      let ruaVal = ''
      let numeroVal = ''
      let bairroVal = ''
      let cidadeVal = ''
      let estadoVal = ''
      let cepVal = ''

      for (const component of place.address_components) {
        const type = component.types[0]
        if (type === 'route') ruaVal = component.long_name
        if (type === 'street_number') numeroVal = component.long_name
        if (type === 'sublocality_level_1' || type === 'sublocality') bairroVal = component.long_name
        if (type === 'administrative_area_level_2') cidadeVal = component.long_name
        if (type === 'administrative_area_level_1') estadoVal = component.short_name
        if (type === 'postal_code') cepVal = component.long_name
      }

      setRua(ruaVal)
      setNumero(numeroVal)
      setBairro(bairroVal)
      setCidade(cidadeVal)
      setEstado(estadoVal)
      if (cepVal) setCep(formatarCep(cepVal))
    })

    autocompleteRef.current = autocomplete
  }

  // Formata CEP enquanto digita
  function formatarCep(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 8)
    if (nums.length <= 5) return nums
    return `${nums.slice(0, 5)}-${nums.slice(5)}`
  }

  // Busca CEP via ViaCEP
  async function buscarCep(cepLimpo) {
    if (cepLimpo.length !== 8) return

    setCepCarregando(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await res.json()

      if (data.erro) {
        setErro('CEP não encontrado')
        setCepCarregando(false)
        return
      }

      // Preenche os campos
      if (data.logradouro) {
        setRua(data.logradouro)
        setRuaEditavel(false)
      } else {
        setRua('')
        setRuaEditavel(true)
      }
      setBairro(data.bairro || '')
      setCidade(data.localidade || '')
      setEstado(data.uf || '')
      setErro('')
    } catch (err) {
      console.error('Erro ao buscar CEP:', err)
      setErro('Erro ao buscar CEP')
    }
    setCepCarregando(false)
  }

  function handleCepChange(valor) {
    const formatado = formatarCep(valor)
    setCep(formatado)

    const cepLimpo = valor.replace(/\D/g, '')
    if (cepLimpo.length === 8) {
      buscarCep(cepLimpo)
    } else {
      // Limpa campos se CEP incompleto
      setRuaEditavel(true)
    }
  }

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

  // Monta endereço completo para salvar
  function montarEndereco() {
    const partes = []
    if (rua) partes.push(rua)
    if (numero) partes.push(numero)
    if (bairro) partes.push(bairro)
    return partes.join(', ')
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

    const cidadeCompleta = estado ? `${cidade} - ${estado}` : cidade

    const novoCliente = {
      nome: nome.trim(),
      cidade: cidadeCompleta.trim(),
      cnpj: cnpj.trim() || null,
      telefone: telefone.trim() || null,
      comprador: comprador.trim() || null,
      segmento: segmento.trim() || null,
      endereco: montarEndereco() || null,
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

        {/* Seção Endereço */}
        <div className="secao-titulo">Endereço</div>

        <div className="campo">
          <label htmlFor="cep">CEP</label>
          <div className="campo-com-loader">
            <input
              type="text"
              id="cep"
              value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
            />
            {cepCarregando && <span className="campo-loader"></span>}
          </div>
        </div>

        <div className="campo">
          <label htmlFor="rua">Rua</label>
          <input
            ref={ruaInputRef}
            type="text"
            id="rua"
            value={rua}
            onChange={(e) => setRua(e.target.value)}
            placeholder="Digite o endereço..."
            disabled={!ruaEditavel && rua}
            className={!ruaEditavel && rua ? 'campo-preenchido' : ''}
          />
          {!ruaEditavel && rua && (
            <button
              type="button"
              className="btn-editar-campo"
              onClick={() => setRuaEditavel(true)}
            >
              Editar
            </button>
          )}
        </div>

        <div className="campo">
          <label htmlFor="numero">Número</label>
          <input
            type="text"
            id="numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="123"
          />
        </div>

        <div className="campo">
          <label htmlFor="bairro">Bairro</label>
          <input
            type="text"
            id="bairro"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            placeholder="Centro"
          />
        </div>

        <div className="campos-linha">
          <div className="campo flex-2">
            <label htmlFor="cidade">Cidade *</label>
            <input
              type="text"
              id="cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Jaraguá do Sul"
            />
          </div>
          <div className="campo flex-1">
            <label htmlFor="estado">Estado</label>
            <input
              type="text"
              id="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase())}
              placeholder="SC"
              maxLength={2}
            />
          </div>
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

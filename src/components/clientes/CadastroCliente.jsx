import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { db } from '../../lib/db'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import InputEndereco from '../shared/InputEndereco'
import './CadastroCliente.css'

const GEOCODING_API_KEY = import.meta.env.VITE_GEOCODING_API_KEY

// Normaliza texto para Title Case (primeira letra maiúscula de cada palavra)
function toTitleCase(str) {
  if (!str) return ''
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ')
}

function CadastroCliente() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdicao = !!id
  const { repId, loading: loadingRep } = useRepId()
  const { representadaSelecionada } = useRepresentada()
  const coordsRef = useRef(null)

  // Dados do cliente
  const [cnpj, setCnpj] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [inscricaoEstadual, setInscricaoEstadual] = useState('')
  const [comprador, setComprador] = useState('')
  const [telefone, setTelefone] = useState('')
  const [segmento, setSegmento] = useState('')
  const [regime, setRegime] = useState('')

  // Endereço
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')

  // Estados de controle
  const [segmentos, setSegmentos] = useState([])
  const [cnpjCarregando, setCnpjCarregando] = useState(false)
  const [cnpjErro, setCnpjErro] = useState('')
  const [cepCarregando, setCepCarregando] = useState(false)
  const [cidadeEstadoTravado, setCidadeEstadoTravado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [veioDoMicrovix, setVeioDoMicrovix] = useState(false)

  // Carrega segmentos do Supabase
  useEffect(() => {
    if (!repId) return

    async function fetchSegmentos() {
      const { data } = await supabase
        .from('segmentos')
        .select('id, nome')
        .eq('rep_id', repId)
        .order('nome')

      if (data) setSegmentos(data)
    }

    fetchSegmentos()
  }, [repId])

  // Carrega o cliente em modo edição
  useEffect(() => {
    if (!isEdicao) return
    async function fetchCliente() {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single()
      if (error || !data) {
        setErro('Cliente não encontrado')
        return
      }
      setRazaoSocial(data.nome || '')
      setCnpj(data.cnpj_cpf || '')
      setTelefone(data.telefone || '')
      setComprador(data.comprador || '')
      setSegmento(data.segmento || '')
      setVeioDoMicrovix(!!data.cod_cliente_erp)
      if (data.lat && data.lng) {
        coordsRef.current = { lat: data.lat, lng: data.lng }
      }
    }
    fetchCliente()
  }, [isEdicao, id])

  // Callback quando InputEndereco retorna componentes do endereço
  function handleAddressComponents(components) {
    if (components.rua) setRua(toTitleCase(components.rua))
    if (components.numero) setNumero(components.numero)
    if (components.bairro) setBairro(toTitleCase(components.bairro))
    if (components.cidade) {
      setCidade(toTitleCase(components.cidade))
      setCidadeEstadoTravado(true)
    }
    if (components.estado) setEstado(components.estado.toUpperCase())
    if (components.cep) setCep(formatarCep(components.cep))
  }

  // Callback quando InputEndereco geocodifica
  function handleEnderecoGeocode(lat, lng) {
    coordsRef.current = { lat, lng }
  }

  // ==================== FORMATADORES ====================

  function formatarCnpj(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 14)
    if (nums.length <= 2) return nums
    if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`
    if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`
    if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`
  }

  function formatarCep(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 8)
    if (nums.length <= 5) return nums
    return `${nums.slice(0, 5)}-${nums.slice(5)}`
  }

  function formatarTelefone(valor) {
    const nums = valor.replace(/\D/g, '').slice(0, 11)
    if (nums.length <= 2) return nums
    if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`
    if (nums.length <= 10) return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
  }

  // ==================== BUSCA CNPJ ====================

  async function buscarCnpj(cnpjLimpo) {
    if (cnpjLimpo.length !== 14) return

    setCnpjCarregando(true)
    setCnpjErro('')

    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`)

      if (!res.ok) {
        if (res.status === 404) {
          setCnpjErro('CNPJ não encontrado')
        } else {
          setCnpjErro('Erro ao buscar CNPJ')
        }
        setCnpjCarregando(false)
        return
      }

      const data = await res.json()
      console.log('[BrasilAPI] CNPJ:', data)

      // Preenche dados da empresa
      setRazaoSocial(data.razao_social || '')
      setNomeFantasia(data.nome_fantasia || '')

      // Preenche endereço (normaliza para Title Case)
      if (data.cep) setCep(formatarCep(data.cep))
      if (data.logradouro) setRua(toTitleCase(data.logradouro))
      if (data.numero) setNumero(data.numero)
      if (data.bairro) setBairro(toTitleCase(data.bairro))
      if (data.municipio) {
        setCidade(toTitleCase(data.municipio))
        setCidadeEstadoTravado(true)
      }
      if (data.uf) setEstado(data.uf.toUpperCase())

      // Telefone se disponível
      if (data.ddd_telefone_1) {
        const tel = data.ddd_telefone_1.replace(/\D/g, '')
        setTelefone(formatarTelefone(tel))
      }

    } catch (err) {
      console.error('[BrasilAPI] Erro:', err)
      setCnpjErro('Erro de conexão')
    }

    setCnpjCarregando(false)
  }

  function handleCnpjChange(valor) {
    const formatado = formatarCnpj(valor)
    setCnpj(formatado)
    setCnpjErro('')

    const cnpjLimpo = valor.replace(/\D/g, '')
    if (cnpjLimpo.length === 14) {
      buscarCnpj(cnpjLimpo)
    }
  }

  // ==================== BUSCA CEP ====================

  async function buscarCep(cepLimpo) {
    if (cepLimpo.length !== 8) return

    setCepCarregando(true)

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`)
      const data = await res.json()

      if (data.erro) {
        setCepCarregando(false)
        return
      }

      if (data.logradouro) setRua(toTitleCase(data.logradouro))
      if (data.bairro) setBairro(toTitleCase(data.bairro))
      if (data.localidade) {
        setCidade(toTitleCase(data.localidade))
        setCidadeEstadoTravado(true)
      }
      if (data.uf) setEstado(data.uf.toUpperCase())

    } catch (err) {
      console.error('[ViaCEP] Erro:', err)
    }

    setCepCarregando(false)
  }

  function handleCepChange(valor) {
    const formatado = formatarCep(valor)
    setCep(formatado)

    const cepLimpo = valor.replace(/\D/g, '')
    if (cepLimpo.length === 8) {
      buscarCep(cepLimpo)
    }
  }

  // ==================== GEOCODIFICAÇÃO ====================

  async function geocodificarEndereco(enderecoCompleto) {
    console.log('[Geocoding] Endereço a geocodificar:', enderecoCompleto)

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(enderecoCompleto)}&key=${GEOCODING_API_KEY}`
      const res = await fetch(url)
      const data = await res.json()

      console.log('[Geocoding] Resposta API:', { status: data.status, results: data.results?.length || 0 })

      if (data.status === 'OK' && data.results?.length > 0) {
        const loc = data.results[0].geometry.location
        console.log('[Geocoding] ✅ Coordenadas:', { lat: loc.lat, lng: loc.lng })
        return { lat: loc.lat, lng: loc.lng }
      } else {
        console.warn('[Geocoding] ⚠️ Sem resultados:', data.status)
        return null
      }
    } catch (err) {
      console.error('[Geocoding] ❌ Erro:', err)
      return null
    }
  }

  // ==================== SALVAR ====================

  function montarEndereco() {
    const partes = []
    if (rua) partes.push(rua)
    if (numero) partes.push(numero)
    if (bairro) partes.push(bairro)
    return partes.join(', ')
  }

  function montarEnderecoCompleto() {
    const partes = []
    if (rua) partes.push(rua)
    if (numero) partes.push(numero)
    if (bairro) partes.push(bairro)
    if (cidade) partes.push(cidade)
    if (estado) partes.push(estado)
    return partes.join(', ')
  }

  async function salvar() {
    // Validação
    if (!razaoSocial.trim()) {
      setErro('Razão Social é obrigatória')
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

    // Usa razão social como nome principal, nome fantasia como fallback
    const nomePrincipal = nomeFantasia.trim() || razaoSocial.trim()

    // Usar coordenadas já geocodificadas pelo InputEndereco, ou fazer fallback
    const enderecoCompleto = montarEnderecoCompleto()
    let coords = coordsRef.current
    let avisoGeo = false

    if (!coords && enderecoCompleto) {
      coords = await geocodificarEndereco(enderecoCompleto)
      if (!coords) {
        avisoGeo = true
      }
    }

    const novoCliente = {
      nome: nomePrincipal,
      cnpj_cpf: cnpj.trim() || null,
      telefone: telefone.trim() || null,
      comprador: comprador.trim() || null,
      segmento: segmento || null,
      endereco: montarEndereco() || null,
      cidade: cidadeCompleta.trim(),
      lat: coords?.lat || null,
      lng: coords?.lng || null,
      rep_id: repId,
      empresa_id: representadaSelecionada
        ? (representadaSelecionada.plano === 'enterprise'
            ? representadaSelecionada.empresa_id
            : representadaSelecionada.id)
        : null
    }

    console.log('[CadastroCliente] Salvando:', novoCliente)

    // No update, não mexe em rep_id/empresa_id (não captura cliente órfão ao editar)
    const dadosUpdate = { ...novoCliente }
    delete dadosUpdate.rep_id
    delete dadosUpdate.empresa_id
    const query = isEdicao
      ? supabase.from('clientes').update(dadosUpdate).eq('id', id)
      : supabase.from('clientes').insert(novoCliente)
    const { data, error } = await query.select().single()

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

    // Grava no IndexedDB local pra aparecer na lista imediatamente, sem esperar o próximo sync
    try {
      await db.clientes.put({ ...data, _synced_at: new Date().toISOString(), _pending_sync: 0 })
    } catch (e) {
      console.warn('[CadastroCliente] Falha ao gravar no IndexedDB local:', e)
    }

    // Mostrar aviso se geocodificação falhou
    if (avisoGeo) {
      alert('⚠️ Endereço não geocodificado — rota pode não funcionar corretamente.\n\nVocê pode geocodificar depois na Carteira de Clientes.')
    }

    navigate('/clientes')
  }

  // ==================== RENDER ====================

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
        <h1>{isEdicao ? 'Editar Cliente' : 'Novo Cliente'}</h1>
        <button className="btn-salvar-header" onClick={salvar} disabled={salvando}>
          {salvando ? '...' : 'Salvar'}
        </button>
      </header>

      {/* Formulário */}
      <div className="cadastro-form">
        {erro && <div className="erro-msg">{erro}</div>}

        {/* 1. CNPJ */}
        <div className="campo">
          <label htmlFor="cnpj">CNPJ</label>
          <div className="campo-com-loader">
            <input
              type="text"
              id="cnpj"
              value={cnpj}
              onChange={(e) => handleCnpjChange(e.target.value)}
              placeholder="00.000.000/0000-00"
              className={cnpjErro ? 'campo-erro' : ''}
              autoFocus
              disabled={veioDoMicrovix}
              readOnly={veioDoMicrovix}
            />
            {cnpjCarregando && <span className="campo-loader"></span>}
          </div>
          {cnpjErro && <span className="campo-erro-msg">{cnpjErro}</span>}
        </div>

        {/* 2. Razão Social */}
        <div className="campo">
          <label htmlFor="razaoSocial">Razão Social *</label>
          <input
            type="text"
            id="razaoSocial"
            value={razaoSocial}
            onChange={(e) => setRazaoSocial(e.target.value)}
            placeholder="Nome da empresa"
            disabled={veioDoMicrovix}
            readOnly={veioDoMicrovix}
          />
        </div>

        {/* 3. Nome Fantasia */}
        <div className="campo">
          <label htmlFor="nomeFantasia">Nome Fantasia</label>
          <input
            type="text"
            id="nomeFantasia"
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            placeholder="Nome comercial (opcional)"
          />
        </div>

        {/* 4. Inscrição Estadual */}
        <div className="campo">
          <label htmlFor="inscricaoEstadual">Inscrição Estadual</label>
          <input
            type="text"
            id="inscricaoEstadual"
            value={inscricaoEstadual}
            onChange={(e) => setInscricaoEstadual(e.target.value)}
            placeholder="Número da IE"
          />
        </div>

        {/* 5. Comprador */}
        <div className="campo">
          <label htmlFor="comprador">Nome do Comprador/Contato</label>
          <input
            type="text"
            id="comprador"
            value={comprador}
            onChange={(e) => setComprador(e.target.value)}
            placeholder="Nome do contato principal"
          />
        </div>

        {/* 6. Telefone */}
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

        {/* 7. Segmento */}
        <div className="campo">
          <label htmlFor="segmento">Segmento</label>
          <select
            id="segmento"
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
          >
            <option value="">Selecione...</option>
            {segmentos.map(s => (
              <option key={s.id} value={s.nome}>{s.nome}</option>
            ))}
          </select>
        </div>

        {/* 8. Regime Tributário */}
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

        {/* 9. Endereço */}
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
          <InputEndereco
            label="Rua"
            value={rua}
            onChange={setRua}
            onGeocode={handleEnderecoGeocode}
            onAddressComponents={handleAddressComponents}
            placeholder="Digite o endereço..."
          />
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
              readOnly={cidadeEstadoTravado}
              className={cidadeEstadoTravado ? 'campo-travado' : ''}
            />
          </div>
          <div className="campo flex-1">
            <label htmlFor="estado">UF</label>
            <input
              type="text"
              id="estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase())}
              placeholder="SC"
              maxLength={2}
              readOnly={cidadeEstadoTravado}
              className={cidadeEstadoTravado ? 'campo-travado' : ''}
            />
          </div>
        </div>

        {cidadeEstadoTravado && (
          <button
            type="button"
            className="btn-destravar"
            onClick={() => setCidadeEstadoTravado(false)}
          >
            Editar cidade/estado manualmente
          </button>
        )}

        {/* Botão Salvar */}
        <button className="btn-salvar-footer" onClick={salvar} disabled={salvando}>
          {salvando ? <span className="spinner"></span> : 'Salvar Cliente'}
        </button>
      </div>
    </div>
  )
}

export default CadastroCliente

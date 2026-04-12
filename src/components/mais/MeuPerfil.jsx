import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import InputEndereco from '../shared/InputEndereco'
import './MeuPerfil.css'

function MeuPerfil() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()

  // Campos do perfil
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [enderecoBase, setEnderecoBase] = useState('')
  const [mediaCarro, setMediaCarro] = useState('10')
  const [precoGasolina, setPrecoGasolina] = useState('6,00')

  // Coordenadas do endereço (geocodificadas)
  const coordsRef = useRef(null)

  // Estados de controle
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  // Carregar dados do representante
  useEffect(() => {
    async function fetchRep() {
      if (!repId) return

      setLoading(true)
      try {
        const { data: repData, error: repError } = await supabase
          .from('representantes')
          .select('nome, email, endereco_base, lat_base, lng_base, media_carro, preco_gasolina')
          .eq('id', repId)
          .single()

        if (repError) {
          console.error('[MeuPerfil] Erro ao buscar rep:', repError)
          if (repError.message?.includes('lat_base') || repError.message?.includes('lng_base')) {
            setErro('Colunas lat_base/lng_base não existem. Execute no Supabase:\nALTER TABLE representantes ADD COLUMN lat_base DOUBLE PRECISION;\nALTER TABLE representantes ADD COLUMN lng_base DOUBLE PRECISION;')
          }
        } else if (repData) {
          setNome(repData.nome || '')
          setEmail(repData.email || '')
          setEnderecoBase(repData.endereco_base || '')
          setMediaCarro(repData.media_carro?.toString() || '10')
          setPrecoGasolina(formatarPreco(repData.preco_gasolina || 6))
          // Guardar coordenadas existentes
          if (repData.lat_base && repData.lng_base) {
            coordsRef.current = { lat: repData.lat_base, lng: repData.lng_base }
          }
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (user?.email) {
          setEmail(user.email)
        }
      } catch (err) {
        console.error('[MeuPerfil] Exceção:', err)
        setErro('Erro ao carregar dados')
      }
      setLoading(false)
    }

    fetchRep()
  }, [repId])

  // Formatar preço para exibição
  function formatarPreco(valor) {
    if (!valor && valor !== 0) return ''
    return valor.toFixed(2).replace('.', ',')
  }

  // Parsear preço para número
  function parsearPreco(str) {
    if (!str) return 0
    return parseFloat(str.replace(',', '.')) || 0
  }

  // Máscara para preço da gasolina
  function handlePrecoChange(valor) {
    let limpo = valor.replace(/[^\d,]/g, '')
    const partes = limpo.split(',')
    if (partes.length > 2) {
      limpo = partes[0] + ',' + partes.slice(1).join('')
    }
    if (partes.length === 2 && partes[1].length > 2) {
      limpo = partes[0] + ',' + partes[1].slice(0, 2)
    }
    setPrecoGasolina(limpo)
  }

  // Callback quando endereço é selecionado
  function handleEnderecoSelect(endereco, placeId) {
    // Limpar coordenadas antigas quando novo endereço é selecionado
    coordsRef.current = null
  }

  // Callback quando endereço é geocodificado
  function handleEnderecoGeocode(lat, lng) {
    coordsRef.current = { lat, lng }
    console.log('[MeuPerfil] Coordenadas atualizadas:', { lat, lng })
  }

  // Salvar perfil
  async function salvar() {
    if (!nome.trim()) {
      setErro('Nome é obrigatório')
      return
    }

    setSalvando(true)
    setErro('')
    setSucesso('')

    try {
      // Preparar dados
      const dadosUpdate = {
        nome: nome.trim(),
        endereco_base: enderecoBase.trim() || null,
        media_carro: parseFloat(mediaCarro) || 10,
        preco_gasolina: parsearPreco(precoGasolina) || 6
      }

      // Adicionar coordenadas se disponíveis
      if (coordsRef.current) {
        dadosUpdate.lat_base = coordsRef.current.lat
        dadosUpdate.lng_base = coordsRef.current.lng
      }

      console.log('[MeuPerfil] Salvando:', dadosUpdate)

      const { error } = await supabase
        .from('representantes')
        .update(dadosUpdate)
        .eq('id', repId)

      if (error) {
        console.error('[MeuPerfil] Erro ao salvar:', error)
        if (error.message?.includes('lat_base') || error.message?.includes('lng_base')) {
          const { error: err2 } = await supabase
            .from('representantes')
            .update({
              nome: nome.trim(),
              endereco_base: enderecoBase.trim() || null,
              media_carro: parseFloat(mediaCarro) || 10,
              preco_gasolina: parsearPreco(precoGasolina) || 6
            })
            .eq('id', repId)

          if (err2) {
            setErro('Erro ao salvar')
          } else {
            setSucesso('Salvo! (Colunas lat_base/lng_base não existem)')
          }
        } else {
          setErro(error.message || 'Erro ao salvar')
        }
      } else {
        if (enderecoBase.trim() && !coordsRef.current) {
          setSucesso('Salvo! (Endereço não geocodificado)')
        } else {
          setSucesso('Salvo com sucesso!')
        }
      }
    } catch (err) {
      console.error('[MeuPerfil] Exceção:', err)
      setErro('Erro ao salvar')
    }

    setSalvando(false)

    if (!erro) {
      setTimeout(() => setSucesso(''), 3000)
    }
  }

  if (loadingRep || loading) {
    return <div className="loading">Carregando...</div>
  }

  return (
    <div className="meu-perfil">
      {/* Header */}
      <header className="perfil-header">
        <button className="perfil-voltar" onClick={() => navigate('/mais')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Voltar
        </button>
        <h1>Meu Perfil</h1>
        <button className="perfil-salvar" onClick={salvar} disabled={salvando}>
          {salvando ? '...' : 'Salvar'}
        </button>
      </header>

      {/* Mensagens */}
      {erro && <div className="perfil-erro">{erro}</div>}
      {sucesso && <div className="perfil-sucesso">{sucesso}</div>}

      {/* Formulário */}
      <div className="perfil-form">
        {/* Nome */}
        <div className="perfil-campo">
          <label>Nome completo</label>
          <input
            type="text"
            className="perfil-input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        {/* Email */}
        <div className="perfil-campo">
          <label>Email</label>
          <input
            type="email"
            className="perfil-input readonly"
            value={email}
            readOnly
          />
          <span className="perfil-campo-hint">O email não pode ser alterado</span>
        </div>

        {/* Endereço base com InputEndereco */}
        <div className="perfil-campo">
          <InputEndereco
            label="Endereço base (ponto de partida das rotas)"
            value={enderecoBase}
            onChange={setEnderecoBase}
            onSelect={handleEnderecoSelect}
            onGeocode={handleEnderecoGeocode}
            placeholder="Digite seu endereço..."
          />
          {enderecoBase && (
            <div className="perfil-endereco-preview">
              {coordsRef.current ? '✅' : '📍'} {enderecoBase}
            </div>
          )}
        </div>

        {/* Seção Veículo */}
        <div className="perfil-secao">
          <h2 className="perfil-secao-titulo">Meu veículo</h2>

          {/* Consumo médio */}
          <div className="perfil-campo">
            <label>Consumo médio (km/L)</label>
            <input
              type="number"
              className="perfil-input"
              value={mediaCarro}
              onChange={(e) => setMediaCarro(e.target.value)}
              placeholder="10"
              min="1"
              max="50"
              step="0.1"
            />
          </div>

          {/* Preço da gasolina */}
          <div className="perfil-campo">
            <label>Preço da gasolina (R$/L)</label>
            <div className="perfil-input-prefix">
              <span>R$</span>
              <input
                type="text"
                className="perfil-input"
                value={precoGasolina}
                onChange={(e) => handlePrecoChange(e.target.value)}
                placeholder="6,00"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeuPerfil

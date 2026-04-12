import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import './Representadas.css'

// Cores predefinidas para o PDF
const CORES_PDF = [
  { nome: 'Azul Marinho', cor: '#1a3a6b' },
  { nome: 'Verde Escuro', cor: '#1a5f4a' },
  { nome: 'Roxo', cor: '#5b2c6f' },
  { nome: 'Vermelho', cor: '#922b21' },
  { nome: 'Cinza', cor: '#424949' }
]

function Representadas() {
  const navigate = useNavigate()
  const { repId, loading: loadingRep } = useRepId()
  const fileInputRef = useRef(null)

  const [representadas, setRepresentadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(null) // null = lista, 'novo' = novo, uuid = edição
  const [salvando, setSalvando] = useState(false)

  // Campos do formulário
  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [corPdf, setCorPdf] = useState('#1a3a6b')
  const [corCustomizada, setCorCustomizada] = useState('')
  const [logo, setLogo] = useState(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [dadosVendedor, setDadosVendedor] = useState('')
  const [politicas, setPoliticas] = useState([])

  // Carregar representadas
  useEffect(() => {
    if (!repId) return

    async function fetchRepresentadas() {
      setLoading(true)
      const { data, error } = await supabase
        .from('representadas')
        .select('*')
        .eq('rep_id', repId)
        .order('nome')

      if (error) {
        console.error('[Representadas] Erro:', error)
      } else {
        setRepresentadas(data || [])
      }
      setLoading(false)
    }

    fetchRepresentadas()
  }, [repId])

  // Carregar dados para edição
  useEffect(() => {
    if (!editando || editando === 'novo') {
      // Limpar formulário
      setNome('')
      setCnpj('')
      setEmail('')
      setCorPdf('#1a3a6b')
      setCorCustomizada('')
      setLogo(null)
      setLogoPreview('')
      setDadosVendedor('')
      setPoliticas([])
      return
    }

    // Carregar representada existente
    const rep = representadas.find(r => r.id === editando)
    if (rep) {
      setNome(rep.nome || '')
      setCnpj(rep.cnpj || '')
      setEmail(rep.email || '')
      setCorPdf(rep.cor_pdf || '#1a3a6b')
      setLogoPreview(rep.logo || '')
      setDadosVendedor(rep.dados_vendedor || '')

      // Carregar políticas comerciais
      fetchPoliticas(rep.id)
    }
  }, [editando, representadas])

  async function fetchPoliticas(representadaId) {
    const { data } = await supabase
      .from('politica_comercial')
      .select('*')
      .eq('representada_id', representadaId)
      .order('created_at')

    setPoliticas(data || [])
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Converter para base64
    const reader = new FileReader()
    reader.onload = (ev) => {
      setLogo(file)
      setLogoPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function adicionarPolitica() {
    setPoliticas([
      ...politicas,
      {
        id: `temp-${Date.now()}`,
        nome: '',
        tipo: 'desconto',
        valor: 0,
        valor_tipo: 'percentual',
        condicao: 'sempre',
        condicao_pagamento: '',
        ativo: true,
        isNew: true
      }
    ])
  }

  function atualizarPolitica(index, campo, valor) {
    const novas = [...politicas]
    novas[index] = { ...novas[index], [campo]: valor }
    setPoliticas(novas)
  }

  function removerPolitica(index) {
    const novas = [...politicas]
    novas.splice(index, 1)
    setPoliticas(novas)
  }

  async function salvar() {
    if (!nome.trim()) {
      alert('Nome é obrigatório')
      return
    }

    setSalvando(true)

    try {
      const dados = {
        rep_id: repId,
        nome: nome.trim(),
        cnpj: cnpj.trim() || null,
        email: email.trim() || null,
        cor_pdf: corCustomizada || corPdf,
        dados_vendedor: dadosVendedor.trim() || null
      }

      // Incluir logo se houver
      if (logoPreview && logoPreview.startsWith('data:')) {
        dados.logo = logoPreview
      }

      let representadaId = editando

      if (editando === 'novo') {
        const { data, error } = await supabase
          .from('representadas')
          .insert(dados)
          .select()
          .single()

        if (error) throw error
        representadaId = data.id
      } else {
        const { error } = await supabase
          .from('representadas')
          .update(dados)
          .eq('id', editando)

        if (error) throw error
      }

      // Salvar políticas comerciais
      for (const pol of politicas) {
        if (pol.isNew) {
          await supabase
            .from('politica_comercial')
            .insert({
              representada_id: representadaId,
              nome: pol.nome,
              tipo: pol.tipo,
              valor: pol.valor,
              valor_tipo: pol.valor_tipo,
              condicao: pol.condicao,
              condicao_pagamento: pol.condicao_pagamento,
              ativo: pol.ativo
            })
        } else if (!pol.id.startsWith('temp-')) {
          await supabase
            .from('politica_comercial')
            .update({
              nome: pol.nome,
              tipo: pol.tipo,
              valor: pol.valor,
              valor_tipo: pol.valor_tipo,
              condicao: pol.condicao,
              condicao_pagamento: pol.condicao_pagamento,
              ativo: pol.ativo
            })
            .eq('id', pol.id)
        }
      }

      // Recarregar lista
      const { data: novasReps } = await supabase
        .from('representadas')
        .select('*')
        .eq('rep_id', repId)
        .order('nome')

      setRepresentadas(novasReps || [])
      setEditando(null)

    } catch (err) {
      console.error('[Representadas] Erro ao salvar:', err)
      alert('Erro ao salvar')
    }

    setSalvando(false)
  }

  async function excluir() {
    if (!confirm('Deseja excluir esta empresa?')) return

    setSalvando(true)

    try {
      // Excluir políticas primeiro
      await supabase
        .from('politica_comercial')
        .delete()
        .eq('representada_id', editando)

      // Excluir representada
      await supabase
        .from('representadas')
        .delete()
        .eq('id', editando)

      setRepresentadas(representadas.filter(r => r.id !== editando))
      setEditando(null)

    } catch (err) {
      console.error('[Representadas] Erro ao excluir:', err)
      alert('Erro ao excluir')
    }

    setSalvando(false)
  }

  if (loadingRep || loading) {
    return <div className="loading">Carregando...</div>
  }

  // Tela de edição/cadastro
  if (editando) {
    return (
      <div className="representadas">
        <header className="rep-header">
          <button className="rep-voltar" onClick={() => setEditando(null)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>{editando === 'novo' ? 'Nova Empresa' : 'Editar Empresa'}</h1>
          <button className="rep-salvar" onClick={salvar} disabled={salvando}>
            {salvando ? '...' : 'Salvar'}
          </button>
        </header>

        <div className="rep-form">
          {/* Nome */}
          <div className="rep-campo">
            <label>Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>

          {/* CNPJ */}
          <div className="rep-campo">
            <label>CNPJ</label>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
          </div>

          {/* Logo */}
          <div className="rep-campo">
            <label>Logo</label>
            <div className="rep-logo-upload">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="rep-logo-preview" />
              ) : (
                <div className="rep-logo-placeholder">
                  <span>Sem logo</span>
                </div>
              )}
              <button onClick={() => fileInputRef.current?.click()}>
                {logoPreview ? 'Alterar' : 'Enviar logo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {/* Cor do PDF */}
          <div className="rep-campo">
            <label>Cor do PDF</label>
            <div className="rep-cores">
              {CORES_PDF.map((c) => (
                <button
                  key={c.cor}
                  className={`rep-cor ${corPdf === c.cor && !corCustomizada ? 'ativo' : ''}`}
                  style={{ background: c.cor }}
                  onClick={() => {
                    setCorPdf(c.cor)
                    setCorCustomizada('')
                  }}
                  title={c.nome}
                />
              ))}
              <div className="rep-cor-custom">
                <input
                  type="color"
                  value={corCustomizada || corPdf}
                  onChange={(e) => setCorCustomizada(e.target.value)}
                />
                <span>Custom</span>
              </div>
            </div>
          </div>

          {/* E-mail */}
          <div className="rep-campo">
            <label>E-mail da representada</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pedido@empresa.com.br"
            />
          </div>

          {/* Dados do vendedor */}
          <div className="rep-campo">
            <label>Dados do vendedor no PDF</label>
            <input
              type="text"
              value={dadosVendedor}
              onChange={(e) => setDadosVendedor(e.target.value)}
              placeholder="Ex: Bruno Almeida - Joinville/SC"
            />
          </div>

          {/* Política comercial */}
          <div className="rep-secao">
            <div className="rep-secao-header">
              <span>Politica comercial</span>
              <button onClick={adicionarPolitica}>+ Adicionar</button>
            </div>

            {politicas.length === 0 && (
              <p className="rep-vazio">Nenhuma politica cadastrada</p>
            )}

            {politicas.map((pol, index) => (
              <div key={pol.id} className="rep-politica-card">
                <div className="rep-politica-row">
                  <input
                    type="text"
                    placeholder="Nome da politica"
                    value={pol.nome}
                    onChange={(e) => atualizarPolitica(index, 'nome', e.target.value)}
                  />
                  <button
                    className="rep-politica-remover"
                    onClick={() => removerPolitica(index)}
                  >
                    X
                  </button>
                </div>

                <div className="rep-politica-row">
                  <select
                    value={pol.tipo}
                    onChange={(e) => atualizarPolitica(index, 'tipo', e.target.value)}
                  >
                    <option value="desconto">Desconto</option>
                    <option value="acrescimo">Acrescimo</option>
                  </select>

                  <input
                    type="number"
                    placeholder="Valor"
                    value={pol.valor}
                    onChange={(e) => atualizarPolitica(index, 'valor', parseFloat(e.target.value) || 0)}
                    style={{ width: 80 }}
                  />
                  <span>%</span>
                </div>

                <div className="rep-politica-row">
                  <select
                    value={pol.condicao}
                    onChange={(e) => atualizarPolitica(index, 'condicao', e.target.value)}
                  >
                    <option value="sempre">Sempre</option>
                    <option value="forma_pagamento">Forma de pagamento</option>
                    <option value="volume_minimo">Volume minimo</option>
                  </select>

                  {pol.condicao === 'forma_pagamento' && (
                    <select
                      value={pol.condicao_pagamento}
                      onChange={(e) => atualizarPolitica(index, 'condicao_pagamento', e.target.value)}
                    >
                      <option value="">Selecione...</option>
                      <option value="boleto_curto">Boleto curto</option>
                      <option value="boleto_longo">Boleto longo</option>
                      <option value="pix">PIX</option>
                      <option value="cartao">Cartao</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Excluir */}
          {editando !== 'novo' && (
            <button className="rep-btn-excluir" onClick={excluir} disabled={salvando}>
              Excluir empresa
            </button>
          )}
        </div>
      </div>
    )
  }

  // Tela de lista
  return (
    <div className="representadas">
      <header className="rep-header">
        <button className="rep-voltar" onClick={() => navigate('/mais')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1>Empresas</h1>
        <button className="rep-novo" onClick={() => setEditando('novo')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </header>

      <div className="rep-content">
        {representadas.length === 0 && (
          <div className="rep-vazio-grande">
            <p>Nenhuma empresa cadastrada</p>
            <button onClick={() => setEditando('novo')}>Cadastrar empresa</button>
          </div>
        )}

        {representadas.map((rep) => (
          <div
            key={rep.id}
            className="rep-card"
            onClick={() => setEditando(rep.id)}
          >
            <div className="rep-card-logo">
              {rep.logo ? (
                <img src={rep.logo} alt={rep.nome} />
              ) : (
                <div className="rep-card-logo-placeholder" style={{ background: rep.cor_pdf || '#1a3a6b' }}>
                  {rep.nome?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="rep-card-info">
              <span className="rep-card-nome">{rep.nome}</span>
              <span className="rep-card-email">{rep.email || '-'}</span>
            </div>
            <span className="rep-card-seta">{'>'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Representadas

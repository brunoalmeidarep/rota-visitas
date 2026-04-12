import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRepId } from '../../hooks/useRepId'
import { useRepresentada } from '../../contexts/RepresentadaContext'
import './CadastroProduto.css'

const UNIDADES = ['UN', 'CX', 'KG', 'MT', 'LT', 'PC', 'PAR', 'DZ']

function CadastroProduto() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { repId } = useRepId()
  const { representadaSelecionada } = useRepresentada()
  const fileInputRef = useRef(null)

  const isEdicao = !!id

  const [loading, setLoading] = useState(isEdicao)
  const [salvando, setSalvando] = useState(false)
  const [isDark, setIsDark] = useState(false)

  // Campos do produto
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [ncm, setNcm] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [preco, setPreco] = useState('')
  const [unidade, setUnidade] = useState('UN')
  const [multiplo, setMultiplo] = useState('1')
  const [ipi, setIpi] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [fotos, setFotos] = useState([])
  const [fotosParaUpload, setFotosParaUpload] = useState([])

  const [erroNome, setErroNome] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar produto existente
  useEffect(() => {
    if (!isEdicao || !id) return

    async function fetchProduto() {
      setLoading(true)

      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        console.error('[CadastroProduto] Erro:', error)
        navigate('/produtos')
        return
      }

      if (data) {
        setNome(data.nome || '')
        setCodigo(data.codigo || '')
        setNcm(data.ncm || '')
        setCodigoBarras(data.codigo_barras || '')
        setPreco(data.preco ? String(data.preco).replace('.', ',') : '')
        setUnidade(data.unidade || 'UN')
        setMultiplo(data.multiplo ? String(data.multiplo) : '1')
        setIpi(data.ipi ? String(data.ipi) : '')
        setDescricao(data.descricao || '')
        setAtivo(data.ativo !== false)
        setFotos(data.fotos || [])
      }

      setLoading(false)
    }

    fetchProduto()
  }, [id, isEdicao, navigate])

  function handlePrecoChange(valor) {
    let limpo = valor.replace(/[^\d,]/g, '')
    const partes = limpo.split(',')
    if (partes.length > 2) {
      limpo = partes[0] + ',' + partes.slice(1).join('')
    }
    if (partes.length === 2 && partes[1].length > 2) {
      limpo = partes[0] + ',' + partes[1].slice(0, 2)
    }
    setPreco(limpo)
  }

  function parsearPreco(str) {
    if (!str) return 0
    return parseFloat(str.replace(',', '.')) || 0
  }

  function handleFotoChange(e) {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    const totalFotos = fotos.length + fotosParaUpload.length + files.length
    if (totalFotos > 5) {
      alert('Máximo de 5 fotos permitido')
      return
    }

    // Criar preview das fotos
    const novasFotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))

    setFotosParaUpload(prev => [...prev, ...novasFotos])
    e.target.value = ''
  }

  function removerFotoExistente(index) {
    setFotos(prev => prev.filter((_, i) => i !== index))
  }

  function removerFotoNova(index) {
    setFotosParaUpload(prev => {
      const nova = prev.filter((_, i) => i !== index)
      // Revogar URL do preview
      URL.revokeObjectURL(prev[index].preview)
      return nova
    })
  }

  async function uploadFotos() {
    const urls = []

    for (const item of fotosParaUpload) {
      const ext = item.file.name.split('.').pop()
      const fileName = `${repId}/${representadaSelecionada.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { data, error } = await supabase.storage
        .from('produtos')
        .upload(fileName, item.file)

      if (error) {
        console.error('[CadastroProduto] Erro upload:', error)
        continue
      }

      const { data: urlData } = supabase.storage
        .from('produtos')
        .getPublicUrl(fileName)

      if (urlData?.publicUrl) {
        urls.push(urlData.publicUrl)
      }
    }

    return urls
  }

  async function salvar() {
    // Validar nome
    if (!nome.trim()) {
      setErroNome(true)
      return
    }
    setErroNome(false)

    if (!representadaSelecionada) {
      alert('Selecione uma representada no menu principal')
      return
    }

    setSalvando(true)

    try {
      // Upload de novas fotos
      let todasFotos = [...fotos]
      if (fotosParaUpload.length > 0) {
        const novasUrls = await uploadFotos()
        todasFotos = [...todasFotos, ...novasUrls]
      }

      const dados = {
        rep_id: repId,
        representada_id: representadaSelecionada.id,
        nome: nome.trim(),
        codigo: codigo.trim() || null,
        ncm: ncm.trim() || null,
        codigo_barras: codigoBarras.trim() || null,
        preco: parsearPreco(preco),
        unidade: unidade,
        multiplo: parseInt(multiplo) || 1,
        ipi: parseFloat(ipi) || 0,
        descricao: descricao.trim() || null,
        ativo: ativo,
        fotos: todasFotos
      }

      if (isEdicao) {
        const { error } = await supabase
          .from('produtos')
          .update(dados)
          .eq('id', id)

        if (error) {
          console.error('[CadastroProduto] Erro update:', error)
          alert('Erro ao salvar produto')
          setSalvando(false)
          return
        }
      } else {
        const { error } = await supabase
          .from('produtos')
          .insert(dados)

        if (error) {
          console.error('[CadastroProduto] Erro insert:', error)
          alert('Erro ao criar produto')
          setSalvando(false)
          return
        }
      }

      navigate('/produtos')

    } catch (err) {
      console.error('[CadastroProduto] Exceção:', err)
      alert('Erro ao salvar produto')
    }

    setSalvando(false)
  }

  async function excluir() {
    if (!confirm('Tem certeza que deseja excluir este produto?')) {
      return
    }

    setSalvando(true)

    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[CadastroProduto] Erro delete:', error)
        alert('Erro ao excluir produto')
        setSalvando(false)
        return
      }

      navigate('/produtos')

    } catch (err) {
      console.error('[CadastroProduto] Exceção:', err)
      alert('Erro ao excluir produto')
    }

    setSalvando(false)
  }

  const totalFotos = fotos.length + fotosParaUpload.length

  if (loading) {
    return (
      <div className={`cadastro-produto ${isDark ? 'dark' : 'light'}`}>
        <header className="cp-header">
          <button className="cp-voltar" onClick={() => navigate('/produtos')}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="cp-header-titulo">{isEdicao ? 'Editar Produto' : 'Novo Produto'}</span>
          <div style={{ width: 60 }}></div>
        </header>
        <div className="cp-loading">Carregando...</div>
      </div>
    )
  }

  return (
    <div className={`cadastro-produto ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="cp-header">
        <button className="cp-voltar" onClick={() => navigate('/produtos')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="cp-header-titulo">{isEdicao ? 'Editar Produto' : 'Novo Produto'}</span>
        <button
          className="cp-salvar"
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? '...' : 'Salvar'}
        </button>
      </header>

      <div className="cp-content">
        {/* Fotos */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Fotos</label>
          <p className="cp-secao-hint">A primeira foto é a principal. Máximo 5 fotos.</p>

          <div className="cp-fotos-grid">
            {/* Fotos existentes */}
            {fotos.map((url, index) => (
              <div key={`existing-${index}`} className="cp-foto-item">
                <img src={url} alt={`Foto ${index + 1}`} />
                <button className="cp-foto-remover" onClick={() => removerFotoExistente(index)}>
                  ×
                </button>
                {index === 0 && <span className="cp-foto-principal">Principal</span>}
              </div>
            ))}

            {/* Fotos para upload */}
            {fotosParaUpload.map((item, index) => (
              <div key={`new-${index}`} className="cp-foto-item">
                <img src={item.preview} alt={`Nova foto ${index + 1}`} />
                <button className="cp-foto-remover" onClick={() => removerFotoNova(index)}>
                  ×
                </button>
                {fotos.length === 0 && index === 0 && (
                  <span className="cp-foto-principal">Principal</span>
                )}
              </div>
            ))}

            {/* Botão adicionar */}
            {totalFotos < 5 && (
              <button className="cp-foto-add" onClick={() => fileInputRef.current?.click()}>
                <span>+</span>
                <span className="cp-foto-add-text">Adicionar</span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            multiple
            onChange={handleFotoChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Identificação */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Identificação</label>

          <div className="cp-campo">
            <label>
              Nome do produto
              <span className="cp-obrigatorio">*</span>
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => { setNome(e.target.value); setErroNome(false); }}
              placeholder="Ex: Camiseta Polo Azul"
              className={erroNome ? 'erro' : ''}
            />
            {erroNome && <span className="cp-erro-msg">Nome é obrigatório</span>}
          </div>

          <div className="cp-campo">
            <label>Código / Referência</label>
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex: POLO-AZ-M"
            />
          </div>

          <div className="cp-row">
            <div className="cp-campo">
              <label>NCM</label>
              <input
                type="text"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                placeholder="Ex: 6109.10.00"
              />
            </div>
            <div className="cp-campo">
              <label>Código de barras</label>
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="EAN-13"
              />
            </div>
          </div>
        </div>

        {/* Preço e unidade */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Preço e unidade</label>

          <div className="cp-row">
            <div className="cp-campo flex-2">
              <label>Preço de tabela</label>
              <div className="cp-input-prefix">
                <span>R$</span>
                <input
                  type="text"
                  value={preco}
                  onChange={(e) => handlePrecoChange(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="cp-campo flex-1">
              <label>Unidade</label>
              <select value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                {UNIDADES.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="cp-row">
            <div className="cp-campo">
              <label>Múltiplo de venda</label>
              <input
                type="number"
                value={multiplo}
                onChange={(e) => setMultiplo(e.target.value)}
                placeholder="1"
                min="1"
              />
            </div>
            <div className="cp-campo">
              <label>IPI %</label>
              <input
                type="number"
                value={ipi}
                onChange={(e) => setIpi(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Descrição */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição detalhada do produto (aparece no catálogo)"
            rows={4}
          />
        </div>

        {/* Status */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Status</label>
          <button
            className={`cp-toggle-status ${ativo ? 'ativo' : 'inativo'}`}
            onClick={() => setAtivo(!ativo)}
          >
            <span className="cp-toggle-indicator"></span>
            <span className="cp-toggle-label">
              {ativo ? 'Produto ativo' : 'Produto inativo'}
            </span>
          </button>
        </div>

        {/* Botão excluir (só em edição) */}
        {isEdicao && (
          <button
            className="cp-btn-excluir"
            onClick={excluir}
            disabled={salvando}
          >
            Excluir produto
          </button>
        )}
      </div>
    </div>
  )
}

export default CadastroProduto

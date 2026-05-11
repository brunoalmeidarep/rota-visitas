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
  const isReadOnly = isEdicao && representadaSelecionada?.plano === 'enterprise'

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

  // Dados da política (read-only, vem da view)
  const [politica, setPolitica] = useState(null)

  const [erroNome, setErroNome] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Recalcula política em tempo real conforme rep edita o preço
  useEffect(() => {
    if (!politica) return
    const precoNum = parseFloat(preco.replace(',', '.')) || 0
    if (precoNum > 0 && politica.desconto_pct_aplicado > 0) {
      const novoPrecoDist = precoNum * (1 - politica.desconto_pct_aplicado / 100)
      setPolitica(prev => ({
        ...prev,
        preco_loja: precoNum,
        preco_distribuidora: novoPrecoDist
      }))
    }
  }, [preco]) // eslint-disable-line react-hooks/exhaustive-deps

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

      // Busca dados da política aplicada (read-only)
      const { data: dataPolitica } = await supabase
        .from('produtos_com_preco_distribuidora')
        .select('preco_loja, preco_distribuidora, desconto_pct_aplicado, nome_familia')
        .eq('produto_id', id)
        .single()

      if (dataPolitica) {
        setPolitica(dataPolitica)
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
    if (totalFotos > 3) {
      alert('Máximo de 3 fotos permitido')
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
        {isReadOnly ? (
          <div style={{ width: 60 }}></div>
        ) : (
          <button
            className="cp-salvar"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? '...' : 'Salvar'}
          </button>
        )}
      </header>

      <div className="cp-content">
        {isReadOnly && (
          <div className="cp-readonly-banner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Catálogo gerenciado pela empresa. Visualização apenas.</span>
          </div>
        )}

        {/* Identificação */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Identificação</label>

          <div className="cp-row">
            <div className="cp-campo">
              <label>Código / Referência</label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: POLO-AZ-M"
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
            </div>
            <div className="cp-campo">
              <label>Código de barras</label>
              <input
                type="text"
                value={codigoBarras}
                onChange={(e) => setCodigoBarras(e.target.value)}
                placeholder="EAN-13"
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
            </div>
          </div>

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
              disabled={isReadOnly}
              readOnly={isReadOnly}
            />
            {erroNome && <span className="cp-erro-msg">Nome é obrigatório</span>}
          </div>

          <div className="cp-campo">
            <label>Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição detalhada do produto (aparece no catálogo)"
              rows={3}
              disabled={isReadOnly}
              readOnly={isReadOnly}
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
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
            </div>
            <div className="cp-campo">
              <label>Unidade</label>
              <select value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={isReadOnly}>
                {UNIDADES.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="cp-campo">
              <label>Múltiplo</label>
              <input
                type="number"
                value={multiplo}
                onChange={(e) => setMultiplo(e.target.value)}
                placeholder="1"
                min="1"
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
            </div>
          </div>
        </div>

        {/* Preços e Impostos */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Preços e Impostos</label>

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
                  disabled={isReadOnly}
                  readOnly={isReadOnly}
                />
              </div>
            </div>
            <div className="cp-campo flex-1">
              <label>IPI %</label>
              <input
                type="number"
                value={ipi}
                onChange={(e) => setIpi(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
            </div>
          </div>
        </div>

        {/* Política de desconto (read-only) */}
        {isEdicao && politica && (
          <div className="cp-secao">
            <label className="cp-secao-titulo">Política de desconto</label>
            <div className="cp-politica-card">
              <div className="cp-politica-row">
                <span className="cp-politica-label">Família</span>
                <span className="cp-politica-valor">
                  {politica.nome_familia || '—'}
                </span>
              </div>
              <div className="cp-politica-row">
                <span className="cp-politica-label">Desconto aplicado</span>
                <span className="cp-politica-valor">
                  {politica.desconto_pct_aplicado > 0
                    ? `${Math.round(politica.desconto_pct_aplicado)}%`
                    : 'Sem desconto'}
                </span>
              </div>
              {politica.desconto_pct_aplicado > 0 && politica.preco_distribuidora != null && (
                <div className="cp-politica-row destaque">
                  <span className="cp-politica-label">Preço final (distribuidora)</span>
                  <span className="cp-politica-valor verde">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(politica.preco_distribuidora)}
                  </span>
                </div>
              )}
              <p className="cp-politica-hint">
                A política é definida em Tabelas → Políticas. Esta seção é apenas informativa.
              </p>
            </div>
          </div>
        )}

        {/* Foto do Produto */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Foto do Produto</label>
          <p className="cp-secao-hint">A primeira foto é a principal. Máximo 3 fotos.</p>

          <div className="cp-fotos-compact">
            {/* Fotos existentes */}
            {fotos.map((url, index) => (
              <div key={`existing-${index}`} className="cp-foto-thumb">
                <img src={url} alt={`Foto ${index + 1}`} />
                {!isReadOnly && (
                  <button className="cp-foto-remover" onClick={() => removerFotoExistente(index)}>×</button>
                )}
                {index === 0 && <span className="cp-foto-badge">1ª</span>}
              </div>
            ))}

            {/* Fotos para upload */}
            {!isReadOnly && fotosParaUpload.map((item, index) => (
              <div key={`new-${index}`} className="cp-foto-thumb">
                <img src={item.preview} alt={`Nova foto ${index + 1}`} />
                <button className="cp-foto-remover" onClick={() => removerFotoNova(index)}>×</button>
                {fotos.length === 0 && index === 0 && <span className="cp-foto-badge">1ª</span>}
              </div>
            ))}

            {/* Botão adicionar */}
            {!isReadOnly && totalFotos < 3 && (
              <button className="cp-foto-btn" onClick={() => fileInputRef.current?.click()}>
                Escolher Foto
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

        {/* Status */}
        <div className="cp-secao">
          <label className="cp-secao-titulo">Status</label>
          <button
            className={`cp-toggle-status ${ativo ? 'ativo' : 'inativo'}`}
            onClick={() => !isReadOnly && setAtivo(!ativo)}
            disabled={isReadOnly}
          >
            <span className="cp-toggle-indicator"></span>
            <span className="cp-toggle-label">
              {ativo ? 'Produto ativo' : 'Produto inativo'}
            </span>
          </button>
        </div>

        {/* Botão excluir (só em edição e não read-only) */}
        {isEdicao && !isReadOnly && (
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

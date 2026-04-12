import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './DadosCliente.css'

function DadosCliente() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [isDark, setIsDark] = useState(false)

  // Detectar modo claro/escuro
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)
    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Carregar cliente
  useEffect(() => {
    async function fetchCliente() {
      if (!id) return

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', id)
          .single()

        if (error) {
          console.error('[DadosCliente] Erro:', error)
          setErro('Cliente não encontrado')
        } else {
          setCliente(data)
        }
      } catch (err) {
        console.error('[DadosCliente] Exceção:', err)
        setErro('Erro ao carregar cliente')
      }
      setLoading(false)
    }

    fetchCliente()
  }, [id])

  // Formata CNPJ
  function formatarCnpj(cnpj) {
    if (!cnpj) return null
    const nums = cnpj.replace(/\D/g, '')
    if (nums.length !== 14) return cnpj
    return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`
  }

  // Formata CEP
  function formatarCep(cep) {
    if (!cep) return null
    const nums = cep.replace(/\D/g, '')
    if (nums.length !== 8) return cep
    return `${nums.slice(0, 5)}-${nums.slice(5)}`
  }

  // Abre telefone
  function ligarTelefone(tel) {
    if (!tel) return
    const nums = tel.replace(/\D/g, '')
    window.open(`tel:${nums}`, '_self')
  }

  if (loading) {
    return <div className="loading">Carregando...</div>
  }

  if (erro || !cliente) {
    return (
      <div className={`dados-cliente ${isDark ? 'dark' : 'light'}`}>
        <header className="dados-header">
          <button className="dados-voltar" onClick={() => navigate(`/clientes/${id}`)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <span className="dados-header-titulo">Dados</span>
        </header>
        <div className="dados-erro">
          <p>{erro || 'Cliente não encontrado'}</p>
          <button onClick={() => navigate('/clientes')}>Voltar</button>
        </div>
      </div>
    )
  }

  // Extrair componentes do endereço se existirem
  const enderecoPartes = cliente.endereco?.split(',').map(p => p.trim()) || []
  const rua = enderecoPartes[0] || null
  const numero = enderecoPartes[1] || null
  const bairro = enderecoPartes[2] || null

  // Extrair cidade e estado do campo cidade
  const cidadeEstado = cliente.cidade?.split(' - ') || []
  const cidade = cidadeEstado[0] || cliente.cidade || null
  const estado = cidadeEstado[1] || null

  return (
    <div className={`dados-cliente ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="dados-header">
        <button className="dados-voltar" onClick={() => navigate(`/clientes/${id}`)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <span className="dados-header-titulo">Dados</span>
        <button className="dados-editar" onClick={() => navigate(`/clientes/${id}/editar`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </header>

      <div className="dados-content">
        {/* Card Fiscal */}
        <div className="dados-card">
          <h2 className="dados-card-titulo">Fiscal</h2>

          <div className="dados-campo">
            <span className="dados-campo-label">Razão Social</span>
            <span className={`dados-campo-valor ${!cliente.razao_social ? 'vazio' : ''}`}>
              {cliente.razao_social || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">CNPJ</span>
            <span className={`dados-campo-valor ${!cliente.cnpj ? 'vazio' : ''}`}>
              {formatarCnpj(cliente.cnpj) || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">Inscrição Estadual</span>
            <span className={`dados-campo-valor ${!cliente.inscricao_estadual ? 'vazio' : ''}`}>
              {cliente.inscricao_estadual || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">Regime Tributário</span>
            <span className={`dados-campo-valor ${!cliente.regime ? 'vazio' : ''}`}>
              {cliente.regime || 'Não informado'}
            </span>
          </div>
        </div>

        {/* Card Contato */}
        <div className="dados-card">
          <h2 className="dados-card-titulo">Contato</h2>

          <div className="dados-campo">
            <span className="dados-campo-label">Comprador</span>
            <span className={`dados-campo-valor ${!cliente.comprador ? 'vazio' : ''}`}>
              {cliente.comprador || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">Telefone</span>
            {cliente.telefone ? (
              <button className="dados-telefone" onClick={() => ligarTelefone(cliente.telefone)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {cliente.telefone}
              </button>
            ) : (
              <span className="dados-campo-valor vazio">Não informado</span>
            )}
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">Segmento</span>
            <span className={`dados-campo-valor ${!cliente.segmento ? 'vazio' : ''}`}>
              {cliente.segmento || 'Não informado'}
            </span>
          </div>
        </div>

        {/* Card Endereço */}
        <div className="dados-card">
          <h2 className="dados-card-titulo">Endereço</h2>

          <div className="dados-campo">
            <span className="dados-campo-label">Rua</span>
            <span className={`dados-campo-valor ${!rua ? 'vazio' : ''}`}>
              {rua || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">Número</span>
            <span className={`dados-campo-valor ${!numero ? 'vazio' : ''}`}>
              {numero || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">Bairro</span>
            <span className={`dados-campo-valor ${!bairro ? 'vazio' : ''}`}>
              {bairro || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">Cidade</span>
            <span className={`dados-campo-valor ${!cidade ? 'vazio' : ''}`}>
              {cidade || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">Estado</span>
            <span className={`dados-campo-valor ${!estado ? 'vazio' : ''}`}>
              {estado || 'Não informado'}
            </span>
          </div>

          <div className="dados-campo">
            <span className="dados-campo-label">CEP</span>
            <span className={`dados-campo-valor ${!cliente.cep ? 'vazio' : ''}`}>
              {formatarCep(cliente.cep) || 'Não informado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DadosCliente

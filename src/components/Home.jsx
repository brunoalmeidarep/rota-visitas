import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRepId } from '../hooks/useRepId'
import { useRepresentada } from '../contexts/RepresentadaContext'
import './Home.css'

function Home() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { representadas, representadaSelecionada, trocarRepresentada, loading: loadingRep } = useRepresentada()

  const [nomeRep, setNomeRep] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [mostrarSheet, setMostrarSheet] = useState(false)

  // Badges
  const [badgePedidos, setBadgePedidos] = useState({ count: 0, isNew: false })
  const [badgeVisitas, setBadgeVisitas] = useState({ count: 0, isNew: false })
  const [badgePlanner, setBadgePlanner] = useState({ count: 0, isNew: false })

  // Detectar modo claro/escuro do sistema
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    setIsDark(mediaQuery.matches)

    const handler = (e) => setIsDark(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Aplicar classe no body para tema
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDark)
    document.body.classList.toggle('light-mode', !isDark)
  }, [isDark])


  // Carregar nome do representante
  useEffect(() => {
    if (!repId) return

    async function fetchRep() {
      const { data } = await supabase
        .from('representantes')
        .select('nome')
        .eq('id', repId)
        .single()

      if (data?.nome) {
        const primeiroNome = data.nome.split(' ')[0]
        setNomeRep(primeiroNome)
      }
    }

    fetchRep()
  }, [repId])

  // Carregar badges
  useEffect(() => {
    if (!repId) return

    async function fetchBadges() {
      // Badge Pedidos: orçamentos em aberto
      const { count: pedidosCount } = await supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('rep_id', repId)
        .eq('status', 'orcamento')

      // Badge Visitas: clientes inativos há 90+ dias
      const dataLimite = new Date()
      dataLimite.setDate(dataLimite.getDate() - 90)
      const dataLimiteStr = dataLimite.toISOString().split('T')[0]

      const { count: visitasCount } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('rep_id', repId)
        .or(`ultima_visita.is.null,ultima_visita.lt.${dataLimiteStr}`)

      // Badge Planner: tarefas do dia não concluídas
      const hoje = new Date().toISOString().split('T')[0]
      const { count: plannerCount } = await supabase
        .from('planner')
        .select('*', { count: 'exact', head: true })
        .eq('rep_id', repId)
        .eq('data', hoje)
        .eq('concluido', false)

      // Verificar localStorage para saber se já foram vistos
      const vistos = JSON.parse(localStorage.getItem('badges_vistos') || '{}')

      setBadgePedidos({
        count: pedidosCount || 0,
        isNew: !vistos.pedidos && (pedidosCount || 0) > 0
      })
      setBadgeVisitas({
        count: visitasCount || 0,
        isNew: !vistos.visitas && (visitasCount || 0) > 0
      })
      setBadgePlanner({
        count: plannerCount || 0,
        isNew: !vistos.planner && (plannerCount || 0) > 0
      })
    }

    fetchBadges()
  }, [repId])

  // Marcar como visto ao navegar
  function marcarVisto(tipo) {
    const vistos = JSON.parse(localStorage.getItem('badges_vistos') || '{}')
    vistos[tipo] = true
    localStorage.setItem('badges_vistos', JSON.stringify(vistos))
  }

  function navegarPara(rota, tipoBadge) {
    if (tipoBadge) marcarVisto(tipoBadge)
    navigate(rota)
  }

  // Módulos do grid
  const modulos = [
    {
      id: 'pedidos',
      icone: '📋',
      titulo: 'Pedidos',
      subtitulo: 'Orçamentos e vendas',
      rota: '/pedidos',
      badge: badgePedidos
    },
    {
      id: 'visitas',
      icone: '✅',
      titulo: 'Visitas',
      subtitulo: 'Carteira de clientes',
      rota: '/clientes',
      badge: badgeVisitas
    },
    {
      id: 'produtos',
      icone: '📦',
      titulo: 'Produtos',
      subtitulo: 'Catálogo',
      rota: '/produtos',
      badge: null
    },
    {
      id: 'planner',
      icone: '📅',
      titulo: 'Planner',
      subtitulo: 'Agenda e rotas',
      rota: '/planner',
      badge: badgePlanner
    },
    {
      id: 'relatorios',
      icone: '📈',
      titulo: 'Relatórios',
      subtitulo: 'Análises',
      rota: '/mais/relatorios',
      badge: null
    },
    {
      id: 'financas',
      icone: '💰',
      titulo: 'Finanças',
      subtitulo: 'Receitas e despesas',
      rota: '/mais/financas',
      badge: null
    }
  ]

  return (
    <div className={`home ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="home-header">
        <div className="home-header-top">
          <div className="home-header-left">
            <span className="home-saudacao">Ola, {nomeRep || 'Representante'}</span>
            <h1 className="home-titulo">Minha Rota RP</h1>
          </div>
          <button className="home-config-btn" onClick={() => navigate('/mais/perfil')}>
            <span>⚙️</span>
          </button>
        </div>

        {/* Switcher de representada */}
        {!loadingRep && representadas.length > 0 ? (
          <button className="home-rep-switcher" onClick={() => setMostrarSheet(true)}>
            <div className="home-rep-icon">
              {representadaSelecionada?.logo ? (
                <img src={representadaSelecionada.logo} alt="" />
              ) : (
                <span>🏭</span>
              )}
            </div>
            <span className="home-rep-nome">{representadaSelecionada?.nome || 'Selecionar'}</span>
            <span className="home-rep-trocar">trocar ›</span>
          </button>
        ) : !loadingRep && representadas.length === 0 ? (
          <button className="home-rep-vazio" onClick={() => navigate('/mais/representadas')}>
            <span>Nenhuma empresa cadastrada</span>
            <span className="home-rep-link">Cadastrar agora →</span>
          </button>
        ) : null}
      </header>

      {/* Conteúdo */}
      <main className="home-content">
        {/* Grid de módulos */}
        <div className="home-grid">
          {modulos.map((mod) => (
            <button
              key={mod.id}
              className={`home-card ${mod.badge?.count > 0 && !mod.badge.isNew ? 'has-pending' : ''}`}
              onClick={() => navegarPara(mod.rota, mod.badge ? mod.id : null)}
            >
              {/* Badge vermelho (novo) */}
              {mod.badge?.count > 0 && mod.badge.isNew && (
                <span className="home-badge-new">{mod.badge.count}</span>
              )}
              {/* Ponto laranja (pendência vista) */}
              {mod.badge?.count > 0 && !mod.badge.isNew && (
                <span className="home-badge-pending"></span>
              )}

              <span className="home-card-icon">{mod.icone}</span>
              <span className="home-card-titulo">{mod.titulo}</span>
              <span className="home-card-subtitulo">{mod.subtitulo}</span>
            </button>
          ))}
        </div>

        {/* Card Planejar Rota */}
        <button className="home-rota-card" onClick={() => navigate('/planner')}>
          <div className="home-rota-content">
            <span className="home-rota-icon">🗺️</span>
            <div className="home-rota-text">
              <span className="home-rota-titulo">Planejar rota do dia</span>
              <span className="home-rota-subtitulo">
                Selecione os clientes e veja a rota otimizada com km e custo estimado
              </span>
            </div>
          </div>
          <span className="home-rota-btn">Abrir</span>
        </button>

        {/* Card Mapa */}
        <button className="home-mapa-card" onClick={() => navigate('/mapa')}>
          <div className="home-mapa-preview">
            {/* SVG ilustrativo de mapa */}
            <svg viewBox="0 0 200 100" className="home-mapa-svg">
              {/* Grid de fundo */}
              <rect width="200" height="100" fill="#e8f5e9" />
              <path d="M0 25 L200 25 M0 50 L200 50 M0 75 L200 75" stroke="#c8e6c9" strokeWidth="1" />
              <path d="M40 0 L40 100 M80 0 L80 100 M120 0 L120 100 M160 0 L160 100" stroke="#c8e6c9" strokeWidth="1" />
              {/* Ruas */}
              <path d="M20 60 Q60 40, 100 55 T180 45" stroke="#a5d6a7" strokeWidth="3" fill="none" />
              <path d="M30 80 L170 30" stroke="#81c784" strokeWidth="2" fill="none" />
              {/* Pins */}
              <circle cx="50" cy="50" r="6" fill="#f44336" />
              <circle cx="100" cy="40" r="6" fill="#f44336" />
              <circle cx="150" cy="55" r="6" fill="#f44336" />
              <circle cx="80" cy="70" r="5" fill="#ff7043" />
              <circle cx="130" cy="30" r="5" fill="#ff7043" />
            </svg>
          </div>
          <div className="home-mapa-info">
            <span className="home-mapa-titulo">Mapa</span>
            <span className="home-mapa-subtitulo">Ver clientes no mapa</span>
          </div>
          <span className="home-mapa-arrow">›</span>
        </button>
      </main>

      {/* Sheet de representadas */}
      {mostrarSheet && (
        <div className="home-sheet-overlay" onClick={() => setMostrarSheet(false)}>
          <div className="home-sheet" onClick={e => e.stopPropagation()}>
            <div className="home-sheet-handle"></div>
            <h3>Selecionar empresa</h3>

            <div className="home-sheet-lista">
              {representadas.map(rep => (
                <button
                  key={rep.id}
                  className={`home-sheet-item ${representadaSelecionada?.id === rep.id ? 'active' : ''}`}
                  onClick={() => {
                    trocarRepresentada(rep)
                    setMostrarSheet(false)
                  }}
                >
                  <div className="home-sheet-item-icon">
                    {rep.logo ? (
                      <img src={rep.logo} alt="" />
                    ) : (
                      <div className="home-sheet-item-placeholder" style={{ background: rep.cor_pdf || '#1a3a6b' }}>
                        {rep.nome?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="home-sheet-item-info">
                    <span className="home-sheet-item-nome">{rep.nome}</span>
                    <span className="home-sheet-item-email">{rep.email || '-'}</span>
                  </div>
                  {representadaSelecionada?.id === rep.id && (
                    <span className="home-sheet-check">✓</span>
                  )}
                </button>
              ))}
            </div>

            <button
              className="home-sheet-cadastrar"
              onClick={() => {
                setMostrarSheet(false)
                navigate('/mais/representadas')
              }}
            >
              + Cadastrar nova empresa
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home

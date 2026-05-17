import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { dataLocal } from '../lib/data'
import { useRepId } from '../hooks/useRepId'
import { usePlano } from '../hooks/usePlano'
import { useRepresentada } from '../contexts/RepresentadaContext'
import Onboarding from './shared/Onboarding'
import DespesaRapida from './shared/DespesaRapida'
import './Home.css'

function IconePlanner() {
  const hoje = new Date()
  const dia = hoje.getDate()
  const mes = hoje
    .toLocaleDateString('pt-BR', { month: 'short' })
    .toUpperCase()
    .replace('.', '')

  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="6" y="8"
        width="36" height="34"
        rx="4"
        fill="#FFFFFF"
        stroke="#E0E0E0"
        strokeWidth="1.5"
      />
      <path
        d="M6 12 C6 9.79 7.79 8 10 8 L38 8 C40.21 8 42 9.79 42 12 L42 16 L6 16 Z"
        fill="#FF3B30"
      />
      <rect x="14" y="5" width="2.5" height="6" rx="1.25" fill="#9E9E9E"/>
      <rect x="31.5" y="5" width="2.5" height="6" rx="1.25" fill="#9E9E9E"/>
      <text
        x="24"
        y="14"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
        fontSize="5"
        fontWeight="700"
        fill="#FFFFFF"
      >
        {mes}
      </text>
      <text
        x="24"
        y="36"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
        fontSize="16"
        fontWeight="700"
        fill="#1C1C1E"
      >
        {dia}
      </text>
    </svg>
  )
}

function Home() {
  const navigate = useNavigate()
  const { repId } = useRepId()
  const { isStarter, loading: loadingPlano } = usePlano()
  const { representadas, representadaSelecionada, trocarRepresentada, loading: loadingRep, sync } = useRepresentada()

  // Cache de plano para evitar flash
  const temCachePlano = !!localStorage.getItem('plano_cache')

  const [nomeRep, setNomeRep] = useState('')
  const [isDark, setIsDark] = useState(false)
  const [mostrarSheet, setMostrarSheet] = useState(false)
  const [mostrarOnboarding, setMostrarOnboarding] = useState(false)
  const [mostrarDespesa, setMostrarDespesa] = useState(false)
  const [toast, setToast] = useState('')

  // Badges
  const [badgePedidos, setBadgePedidos] = useState({ count: 0, isNew: false })
  const [badgeVisitas, setBadgeVisitas] = useState({ count: 0, isNew: false })
  const [badgePlanner, setBadgePlanner] = useState({ count: 0, isNew: false })
  const [tarefasPendentes, setTarefasPendentes] = useState(0)

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

  // Verificar onboarding
  useEffect(() => {
    const onboardingCompleto = localStorage.getItem('onboarding_completo')
    if (!onboardingCompleto) {
      setMostrarOnboarding(true)
    }
  }, [])

  // Limpar toast após 2s
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 2000)
      return () => clearTimeout(timer)
    }
  }, [toast])

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

      // Badge Planner: eventos do dia
      const hoje = dataLocal()
      const { count: plannerCount } = await supabase
        .from('planner')
        .select('*', { count: 'exact', head: true })
        .eq('rep_id', repId)
        .eq('data', hoje)

      // Tarefas pendentes (sem filtro de data)
      const { count: tarefasCount, error: tarefasError } = await supabase
        .from('tarefas')
        .select('*', { count: 'exact', head: true })
        .eq('rep_id', repId)
        .eq('concluida', false)

      console.log('[Home] Tarefas pendentes - count:', tarefasCount, 'error:', tarefasError, 'repId:', repId)
      setTarefasPendentes(tarefasCount || 0)

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

  // Módulos do grid (2x3)
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
      icone: '💼',
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
      badge: null,
      premium: true
    },
    {
      id: 'planner',
      icone: <IconePlanner />,
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
      rota: '/relatorios',
      badge: null
    },
    {
      id: 'financas',
      icone: '💰',
      titulo: 'Finanças',
      subtitulo: 'Receitas e despesas',
      rota: '/financas',
      badge: null
    }
  ]

  // Só mostrar skeleton se loading E sem cache
  if (loadingPlano && !temCachePlano) {
    return (
      <div className={`home ${isDark ? 'dark' : 'light'}`}>
        <div style={{ padding: 20, color: '#888', textAlign: 'center', marginTop: 100 }}>
          Carregando...
        </div>
      </div>
    )
  }

  return (
    <div className={`home ${isDark ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="home-header">
        <div className="home-header-top">
          <div className="home-header-left">
            <span className="home-saudacao">Olá, {nomeRep || 'Representante'}</span>
            <h1 className="home-titulo">Minha Rota RP</h1>
          </div>
          <div className="home-header-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              title={
                sync?.sincronizando
                  ? 'Sincronizando...'
                  : sync?.online
                    ? 'Online'
                    : 'Offline — usando dados em cache'
              }
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: sync?.sincronizando
                  ? '#3b82f6'
                  : sync?.online
                    ? '#22c55e'
                    : '#f59e0b',
                boxShadow: sync?.sincronizando
                  ? '0 0 8px #3b82f6'
                  : 'none',
                animation: sync?.sincronizando ? 'sync-pulse 1.2s infinite' : 'none',
                flexShrink: 0
              }}
            />
            <button className="home-config-btn" onClick={() => navigate('/opcoes')}>
              <span>⚙️</span>
            </button>
          </div>
        </div>

        {/* Switcher de representada */}
        {!loadingRep && representadas.length > 0 ? (
          <div
            className="home-rep-switcher"
            onClick={representadas.length > 1 ? () => setMostrarSheet(true) : undefined}
            style={{ cursor: representadas.length > 1 ? 'pointer' : 'default' }}
          >
            <div className="home-rep-icon">
              {representadaSelecionada?.logo ? (
                <img src={representadaSelecionada.logo} alt="" />
              ) : (
                <span>🏭</span>
              )}
            </div>
            <span className="home-rep-nome">{representadaSelecionada?.nome || 'Selecionar'}</span>
            {representadas.length > 1 && (
              <span className="home-rep-trocar">trocar ›</span>
            )}
          </div>
        ) : !loadingRep && representadas.length === 0 ? (
          <div className="home-rep-vazio">
            <span>Nenhuma empresa cadastrada</span>
          </div>
        ) : null}
      </header>

      {/* Conteúdo */}
      <main className="home-content">
        {/* Grid de módulos */}
        <div className="home-grid">
          {modulos.map((mod) => {
            const bloqueado = mod.premium && isStarter

            return (
              <button
                key={mod.id}
                className={`home-card ${mod.badge?.count > 0 && !mod.badge.isNew ? 'has-pending' : ''} ${bloqueado ? 'bloqueado' : ''}`}
                onClick={() => !bloqueado && navegarPara(mod.rota, mod.badge ? mod.id : null)}
              >
                {/* Badge vermelho (novo) */}
                {mod.badge?.count > 0 && mod.badge.isNew && (
                  <span className="home-badge-new">{mod.badge.count}</span>
                )}
                {/* Ponto laranja (pendência vista) */}
                {mod.badge?.count > 0 && !mod.badge.isNew && (
                  <span className="home-badge-pending"></span>
                )}

                {/* Cadeado para itens premium bloqueados */}
                {bloqueado && (
                  <span className="home-card-lock" title="Disponível no plano Pro">🔒</span>
                )}

                {/* Botão + no card Finanças */}
                {mod.id === 'financas' && !bloqueado && (
                  <span
                    className="home-card-plus"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMostrarDespesa(true)
                    }}
                  >
                    +
                  </span>
                )}

                <span className="home-card-icon">{mod.icone}</span>
                <span className="home-card-titulo">{mod.titulo}</span>
                <span className="home-card-subtitulo">{bloqueado ? 'Plano Pro' : mod.subtitulo}</span>
              </button>
            )
          })}
        </div>

        {/* Linha 4: Planejar rota + Tarefas */}
        <div className="home-grid-row">
          {/* Card Planejar Rota */}
          <button className="home-card home-rota-card-small" onClick={() => navigate('/rota')}>
            <span className="home-card-icon">🗺️</span>
            <span className="home-card-titulo">Planejar rota</span>
            <span className="home-card-subtitulo">Rota otimizada</span>
          </button>

          {/* Card Tarefas */}
          <button className="home-card home-tarefas-card" onClick={() => navigate('/tarefas')}>
            {tarefasPendentes > 0 && (
              <span className="home-tarefas-badge">{tarefasPendentes}</span>
            )}
            <span className="home-card-icon">📝</span>
            <span className="home-card-titulo">Tarefas</span>
            <span className="home-card-subtitulo">
              {tarefasPendentes > 0 ? `${tarefasPendentes} pendente${tarefasPendentes > 1 ? 's' : ''}` : 'Nenhuma pendente'}
            </span>
          </button>
        </div>

        {/* Card Mapa */}
        <button className="home-mapa-card" onClick={() => navigate('/mapa')}>
          <div className="home-mapa-preview">
            {/* SVG ilustrativo de mapa */}
            <svg viewBox="0 0 200 100" className="home-mapa-svg" preserveAspectRatio="xMidYMid slice">
              <defs>
                <clipPath id="mapaClip">
                  <rect x="0" y="0" width="200" height="100" />
                </clipPath>
              </defs>

              <g clipPath="url(#mapaClip)">
                {/* Fundo do mapa */}
                <rect x="0" y="0" width="200" height="100" fill="#e8f5e9" />

                {/* Áreas verdes (parques) */}
                <path d="M0 0 L60 0 L70 15 L50 30 L0 25 Z" fill="#c8e6c9" opacity="0.6" />
                <path d="M140 75 L200 70 L200 100 L150 100 Z" fill="#c8e6c9" opacity="0.6" />

                {/* Rio/água azul */}
                <path
                  d="M0 65 Q40 60, 80 70 T160 65 L200 70 L200 80 Q160 78, 120 80 T40 78 L0 80 Z"
                  fill="#bbdefb"
                  opacity="0.7"
                />

                {/* Estrada principal horizontal */}
                <line x1="0" y1="45" x2="200" y2="45" stroke="#ffffff" strokeWidth="4" />
                <line x1="0" y1="45" x2="200" y2="45" stroke="#ffd54f" strokeWidth="1.5" strokeDasharray="3,3" />

                {/* Estrada secundária vertical */}
                <line x1="110" y1="0" x2="110" y2="100" stroke="#ffffff" strokeWidth="3" />

                {/* Estradas pequenas */}
                <line x1="40" y1="0" x2="40" y2="45" stroke="#ffffff" strokeWidth="2" />
                <line x1="170" y1="45" x2="170" y2="100" stroke="#ffffff" strokeWidth="2" />
                <line x1="0" y1="25" x2="110" y2="25" stroke="#ffffff" strokeWidth="2" />

                {/* Quarteirões sutis */}
                <rect x="10" y="50" width="25" height="12" fill="#ffffff" opacity="0.4" rx="1" />
                <rect x="115" y="50" width="50" height="12" fill="#ffffff" opacity="0.4" rx="1" />
                <rect x="115" y="10" width="20" height="12" fill="#ffffff" opacity="0.4" rx="1" />
                <rect x="60" y="10" width="40" height="10" fill="#ffffff" opacity="0.4" rx="1" />

                {/* Pin principal (vermelho, em destaque) */}
                <g transform="translate(95, 20)">
                  <ellipse cx="0" cy="22" rx="4" ry="1" fill="#000000" opacity="0.15" />
                  <path
                    d="M0 0 C-5 0, -8 4, -8 9 C-8 15, 0 22, 0 22 C0 22, 8 15, 8 9 C8 4, 5 0, 0 0 Z"
                    fill="#ff3b30"
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                  <circle cx="0" cy="9" r="3" fill="#ffffff" />
                </g>

                {/* Pins menores (azuis) */}
                <g transform="translate(45, 55)">
                  <ellipse cx="0" cy="14" rx="3" ry="0.8" fill="#000000" opacity="0.15" />
                  <path
                    d="M0 0 C-3.5 0, -5.5 2.5, -5.5 6 C-5.5 10, 0 14, 0 14 C0 14, 5.5 10, 5.5 6 C5.5 2.5, 3.5 0, 0 0 Z"
                    fill="#007aff"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <circle cx="0" cy="6" r="2" fill="#ffffff" />
                </g>

                <g transform="translate(155, 35)">
                  <ellipse cx="0" cy="14" rx="3" ry="0.8" fill="#000000" opacity="0.15" />
                  <path
                    d="M0 0 C-3.5 0, -5.5 2.5, -5.5 6 C-5.5 10, 0 14, 0 14 C0 14, 5.5 10, 5.5 6 C5.5 2.5, 3.5 0, 0 0 Z"
                    fill="#007aff"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <circle cx="0" cy="6" r="2" fill="#ffffff" />
                </g>

                <g transform="translate(75, 80)">
                  <ellipse cx="0" cy="14" rx="3" ry="0.8" fill="#000000" opacity="0.15" />
                  <path
                    d="M0 0 C-3.5 0, -5.5 2.5, -5.5 6 C-5.5 10, 0 14, 0 14 C0 14, 5.5 10, 5.5 6 C5.5 2.5, 3.5 0, 0 0 Z"
                    fill="#007aff"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                  <circle cx="0" cy="6" r="2" fill="#ffffff" />
                </g>
              </g>
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
                    {rep.logo_url ? (
                      <img src={rep.logo_url} alt="" />
                    ) : (
                      <div className="home-sheet-item-placeholder" style={{ background: rep.cor_primaria || '#1a3a6b' }}>
                        {rep.nome?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="home-sheet-item-info">
                    <span className="home-sheet-item-nome">
                      {rep.nome}
                      <span className={`home-sheet-badge home-sheet-badge-${rep.plano || 'starter'}`}>
                        {(rep.plano || 'starter').toUpperCase()}
                      </span>
                    </span>
                    <span className="home-sheet-item-email">{rep.email || '-'}</span>
                  </div>
                  {representadaSelecionada?.id === rep.id && (
                    <span className="home-sheet-check">✓</span>
                  )}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* Onboarding primeiro acesso */}
      {mostrarOnboarding && (
        <Onboarding
          onClose={() => setMostrarOnboarding(false)}
          isDark={isDark}
        />
      )}

      {/* Despesa rápida */}
      {mostrarDespesa && (
        <DespesaRapida
          onClose={() => setMostrarDespesa(false)}
          onSuccess={() => setToast('Despesa registrada!')}
          isDark={isDark}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="home-toast">{toast}</div>
      )}
    </div>
  )
}

export default Home

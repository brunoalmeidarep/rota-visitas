// ── CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://fiwpmhrjbovnazagjcjf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpd3BtaHJqYm92bmF6YWdqY2pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNDI1MzAsImV4cCI6MjA4OTcxODUzMH0.pHgiICZzqoeLq5uez8_3WwfurHuouV_Cp9kz1ThRsFs';
const MAPS_KEY     = 'AIzaSyA8MEv3kZLzuEbykwI9dfqfw3_R9udDTWo';
const ADMIN_EMAIL  = 'brunoc.almeida.sc@gmail.com';

const SEGS = [
  { valor: 'mat_construcao', label: '🏗 Mat. Construção' },
  { valor: 'construtora',    label: '🏢 Construtora' },
  { valor: 'tintas',         label: '🎨 Tintas' },
  { valor: 'distribuidora',  label: '🚛 Distribuidora' },
];

const STATUS_COLORS = {
  today:  '#34C759',
  green:  '#007AFF',
  blue:   '#FF9500',
  red:    '#FF3B30',
  purple: '#AF52DE',
};
const STATUS_LABELS = {
  today:  'Visitado hoje',
  green:  'Até 1 mês',
  blue:   '1 a 2 meses',
  red:    'Mais de 2 meses',
  purple: 'Nunca visitado',
};
const STATUS_BG = {
  today:  'var(--green-bg)',
  green:  'var(--blue-bg)',
  blue:   'var(--orange-bg)',
  red:    'var(--red-bg)',
  purple: 'var(--purple-bg)',
};

// ── ESTADO ──────────────────────────────────────────────────────────
let sb            = null;
let currentUser   = null;
let currentRep    = null;   // linha da tabela `representantes` — fonte do rep_id
let _repIdCache   = null;
let clientes      = [];
let lembretes     = {};   // { clienteId: texto }
let gmap          = null;
let markers       = {};   // { clienteId: marker }
let activeId      = null;
let filterStatus  = null;
let filterCidade  = null;
let activeTab     = 'mapa';
let relMes            = new Date().getMonth();
let relAno            = new Date().getFullYear();
let relFiltro         = 'mes'; // 'hoje' | 'semana' | 'mes'
let visatasRel        = [];
let visatasRelAnterior = [];   // mês anterior — carregado lazy para radar
let relRowsAtual      = [];    // rows filtradas no período — compartilhadas com o detalhe
let relEstAtual       = {};    // { visitados, pctConv, totalVendas, totalVisitas }
let novoSegInput  = '';

// ── PLANNER ──────────────────────────────────────────────────────────
let plannerMode    = false;
let plannerSel     = new Map();  // id → { horTipo:'nenhum'|'obrigatorio'|'preferencial', horario:'HH:MM' }
let plannerOrigin  = null;       // { type:'gps'|'endereco', lat, lng, label }
let plannerDate    = '';         // 'YYYY-MM-DD'
let plannerSearchQ = '';
let dirRenderer    = null;       // google.maps.DirectionsRenderer
let plannerMarkers = [];         // marcadores numerados da rota ativa

// ── INIT ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  document.getElementById('header-date').textContent =
    new Date().toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' });

  // Google Maps
  const s = document.createElement('script');
  s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&callback=initMap&loading=async`;
  s.async = true; s.defer = true;
  document.head.appendChild(s);

  iniciarApp();
});

window.initMap = function () {
  gmap = new google.maps.Map(document.getElementById('map'), {
    center: { lat: -26.5, lng: -49.0 },
    zoom: 8,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [
      { elementType: 'geometry',           stylers: [{ color: '#1a1a1e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1e' }] },
      { elementType: 'labels.text.fill',   stylers: [{ color: '#888888' }] },
      { featureType: 'road', elementType: 'geometry',         stylers: [{ color: '#2d2d32' }] },
      { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
      { featureType: 'water', elementType: 'geometry',        stylers: [{ color: '#111118' }] },
      { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#aaaaaa' }] }
    ]
  });
  dirRenderer = new google.maps.DirectionsRenderer({
    map: gmap,
    suppressMarkers: true,
    polylineOptions: { strokeColor: '#007AFF', strokeWeight: 4, strokeOpacity: .85 },
  });
  if (clientes.length) renderMapMarkers();
};

// ── AUTH ─────────────────────────────────────────────────────────────
async function iniciarApp() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) { currentUser = session.user; mostrarApp(); }
    else mostrarLogin();
  } catch(e) { mostrarLogin(); }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) { currentUser = session.user; mostrarApp(); }
    else if (event === 'SIGNED_OUT') { currentUser = null; mostrarLogin(); }
  });
}

function mostrarLogin() {
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('app').classList.remove('visible');
}

async function mostrarApp() {
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  document.getElementById('header-user').textContent = currentUser?.email ?? '';
  if (currentUser?.email === ADMIN_EMAIL) {
    document.getElementById('tab-admin-btn').style.display = 'inline-block';
  }
  await carregarRepresentante();
  await loadClientes();
  carregarLembretesSupabase();
}

// Carrega a linha da tabela `representantes` pelo email — igual ao mobile
async function carregarRepresentante() {
  _repIdCache = null;
  try {
    const { data } = await sb
      .from('representantes')
      .select('*')
      .eq('email', currentUser.email)
      .maybeSingle();
    if (data) {
      currentRep = data;
      if (!data.auth_id) {
        await sb.from('representantes').update({ auth_id: currentUser.id }).eq('id', data.id);
        currentRep.auth_id = currentUser.id;
      }
    } else {
      const { data: novo } = await sb.from('representantes').insert({
        email:   currentUser.email,
        nome:    currentUser.email.split('@')[0],
        auth_id: currentUser.id,
        ativo:   true,
      }).select().maybeSingle();
      currentRep = novo || null;
    }
  } catch(e) {
    currentRep = null;
  }
  _repIdCache = currentRep?.id || null;
}

// Retorna o id correto de representantes para uso como rep_id
// em tabelas com FK → representantes(id)
async function getRepId() {
  if (_repIdCache) return _repIdCache;
  if (!currentRep) await carregarRepresentante();
  _repIdCache = currentRep?.id || null;
  return _repIdCache;
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  const btn   = document.getElementById('btn-login');
  const erro  = document.getElementById('login-erro');
  if (!email || !senha) { erro.textContent = 'Preencha e-mail e senha.'; return; }
  btn.disabled = true; btn.textContent = 'Entrando...'; erro.textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    erro.textContent = 'E-mail ou senha incorretos.';
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

function fazerLogout() { _repIdCache = null; sb.auth.signOut(); }

// ── CLIENTES ─────────────────────────────────────────────────────────
async function loadClientes() {
  if (!currentUser) return;

  // clientes.rep_id → auth.users(id), usa currentUser.id diretamente
  const repId = currentUser.id;

  const listEl = document.getElementById('client-list');
  if (listEl) listEl.innerHTML = '<div class="list-empty">Carregando...</div>';

  try {
    const { data, error } = await sb
      .from('clientes')
      .select('*')
      .eq('rep_id', repId)
      .order('nome');

    if (error) throw error;

    if (!data || !data.length) {
      // Verifica quantos registros existem na tabela (sem filtro) para diagnóstico
      const { count } = await sb
        .from('clientes')
        .select('*', { count: 'exact', head: true });

      const msg = count > 0
        ? `A tabela clientes tem ${count} registro(s) mas nenhum com rep_id = ${repId}. ` +
          `Verifique se a migração foi feita com o rep_id correto.`
        : `A tabela clientes está vazia. A migração ainda não foi executada.`;

      if (listEl) listEl.innerHTML = `<div class="list-empty" style="color:var(--orange)">⚠️ ${msg}</div>`;
      clientes = [];
      renderAll();
      return;
    }

    clientes = data.map(mapCliente);
    restaurarCheckinsDoDia();
  } catch(e) {
    console.warn('loadClientes:', e);
    if (listEl) listEl.innerHTML = `<div class="list-empty" style="color:var(--red)">❌ Erro ao carregar: ${e.message}</div>`;
    clientes = [];
  }
  renderAll();
}

function mapCliente(c) {
  return {
    id:           c.id,
    nome:         c.nome || '',
    cnpj:         c.cnpj || '',
    cidade:       c.cidade || '',
    endereco:     c.endereco || '',
    cep:          c.cep || '',
    ultimaVisita: c.ultima_visita || null,
    ultimaObs:    c.ultima_obs || '',
    lat:          c.lat || null,
    lng:          c.lng || null,
    segmento:     c.segmento || '',
    tel:          c.telefone || '',
    razaoSocial:  c.razao_social || c.nome || '',
    fantasia:     c.fantasia || '',
    comprador:    c.comprador || '',
    visitadoHoje: false,
    horaHoje:     null,
  };
}

function restaurarCheckinsDoDia() {
  const hoje = new Date().toISOString().slice(0, 10);
  clientes.forEach(c => {
    const raw = localStorage.getItem(`checkin_${c.id}_${hoje}`);
    if (raw) {
      const d = JSON.parse(raw);
      c.visitadoHoje = true;
      c.horaHoje     = d.hora;
    }
  });
}

function renderAll() {
  renderCounters();
  renderCityFilter();
  renderList();
  if (gmap) renderMapMarkers();
}

// ── CONTADORES ───────────────────────────────────────────────────────
function getStatus(c) {
  if (c.visitadoHoje) return 'today';
  if (!c.ultimaVisita) return 'purple';
  const dias = Math.floor((Date.now() - new Date(c.ultimaVisita + 'T00:00:00')) / 86400000);
  if (dias <= 30) return 'green';
  if (dias <= 60) return 'blue';
  return 'red';
}

function renderCounters() {
  const counts = { all: clientes.length, today: 0, green: 0, blue: 0, red: 0, purple: 0 };
  clientes.forEach(c => { counts[getStatus(c)]++; });
  const counters = document.getElementById('header-counters');
  counters.innerHTML = [
    { key: 'all',    label: 'Carteira', cls: 'c-all' },
    { key: 'today',  label: 'Hoje',     cls: 'c-today' },
    { key: 'green',  label: '≤1m',      cls: 'c-green' },
    { key: 'blue',   label: '1–2m',     cls: 'c-blue' },
    { key: 'red',    label: '+2m',      cls: 'c-red' },
    { key: 'purple', label: 'Novos',    cls: 'c-purple' },
  ].map(({ key, label, cls }) => `
    <button class="hdr-counter${filterStatus === (key === 'all' ? null : key) ? ' active' : ''}"
      onclick="setFilter('${key}')">
      <span class="hdr-counter-num ${cls}">${counts[key]}</span>
      <span class="hdr-counter-lbl">${label}</span>
    </button>
  `).join('');
}

function setFilter(key) {
  filterStatus = key === 'all' ? null : key;
  renderCounters();
  syncFilterPills();
  renderList();
  if (gmap) renderMapMarkers();
}

function syncFilterPills() {
  document.querySelectorAll('#filter-bar .filter-pill').forEach(btn => {
    const k = btn.classList[1]?.replace('f-', '') || 'all';
    const match = filterStatus === null ? k === 'all' : k === filterStatus;
    btn.classList.toggle('active', match);
  });
}

// ── FILTRO CIDADE ────────────────────────────────────────────────────
function renderCityFilter() {
  const cidades = [...new Set(clientes.map(c => c.cidade).filter(Boolean))].sort();
  const sel = document.getElementById('city-select');
  sel.innerHTML = `<option value="">Todas as cidades</option>` +
    cidades.map(c => `<option value="${c}"${filterCidade === c ? ' selected' : ''}>${c}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('city-select').addEventListener('change', e => {
    filterCidade = e.target.value || null;
    renderList();
    if (gmap) renderMapMarkers();
  });
});

// ── LISTA ────────────────────────────────────────────────────────────
function getClientesFiltrados() {
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  return clientes.filter(c => {
    if (filterStatus && getStatus(c) !== filterStatus) return false;
    if (filterCidade && c.cidade !== filterCidade) return false;
    if (q && !c.nome.toLowerCase().includes(q) && !c.cidade.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderList() {
  const list = document.getElementById('client-list');
  const filtered = getClientesFiltrados();

  if (!filtered.length) {
    list.innerHTML = `<div class="list-empty">Nenhum cliente<br>encontrado</div>`;
    return;
  }

  // Agrupa por status
  const grupos = [
    { key: 'today',  label: 'Visitados hoje' },
    { key: 'green',  label: 'Até 1 mês' },
    { key: 'blue',   label: '1 a 2 meses' },
    { key: 'red',    label: 'Mais de 2 meses' },
    { key: 'purple', label: 'Nunca visitados' },
  ];

  let html = '';
  grupos.forEach(({ key, label }) => {
    const grupo = filtered.filter(c => getStatus(c) === key);
    if (!grupo.length) return;
    html += `<div class="list-sep">${label} (${grupo.length})</div>`;
    grupo.forEach(c => {
      const st = getStatus(c);
      const cor = STATUS_COLORS[st];
      const active = activeId === c.id ? ' active' : '';
      const sub = c.visitadoHoje
        ? `Visitado às ${c.horaHoje}`
        : c.ultimaVisita ? formatDate(c.ultimaVisita) : c.cidade;
      html += `
        <div class="client-item${active}" onclick="selectCliente(${c.id})">
          <div class="client-dot" style="background:${cor}"></div>
          <div class="client-item-info">
            <div class="client-item-nome">${c.nome}</div>
            <div class="client-item-sub">${sub}</div>
          </div>
        </div>`;
    });
  });

  list.innerHTML = html;
}

// ── MAPA ─────────────────────────────────────────────────────────────
function renderMapMarkers() {
  // Remove marcadores anteriores
  Object.values(markers).forEach(m => m.setMap(null));
  markers = {};

  const filtered = getClientesFiltrados();
  filtered.forEach(c => {
    if (!c.lat || !c.lng) return;
    const cor = STATUS_COLORS[getStatus(c)];
    const marker = new google.maps.Marker({
      position: { lat: c.lat, lng: c.lng },
      map: gmap,
      title: c.nome,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: cor,
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      }
    });
    marker.addListener('click', () => selectCliente(c.id));
    markers[c.id] = marker;
  });

  document.getElementById('map-overlay').textContent =
    `${filtered.filter(c => c.lat && c.lng).length} clientes no mapa`;
}

// ── SELECIONAR CLIENTE ───────────────────────────────────────────────
function selectCliente(id) {
  activeId = id;
  const c = clientes.find(x => x.id === id);
  if (!c) return;

  // Atualiza lista (highlight)
  renderList();

  // Centraliza mapa
  if (gmap && c.lat && c.lng) {
    gmap.panTo({ lat: c.lat, lng: c.lng });
    gmap.setZoom(14);
  }

  // Painel detalhe
  renderDetail(c);
}

// ── DETALHE ──────────────────────────────────────────────────────────
function renderDetail(c) {
  document.getElementById('detail-empty').style.display = 'none';
  const body = document.getElementById('detail-body');
  body.style.display = 'flex';

  const st  = getStatus(c);
  const cor = STATUS_COLORS[st];
  const bg  = STATUS_BG[st];
  const lbl = STATUS_LABELS[st];
  const lembrete = lembretes[String(c.id)] || '';
  const visitadoHoje = c.visitadoHoje;

  const segLabel = SEGS.find(s => s.valor === c.segmento)?.label || c.segmento || '';

  body.innerHTML = `
    <!-- HEADER DO CLIENTE -->
    <div class="det-header">
      <div class="det-badge" style="background:${bg};color:${cor}">${lbl}</div>
      <div class="det-nome">${c.nome}</div>
      ${c.comprador ? `<div class="det-sub">👤 ${c.comprador}</div>` : ''}
      ${segLabel     ? `<div class="det-sub">${segLabel}</div>` : ''}
      <div class="det-cidade">📍 ${c.cidade}${c.cnpj ? ` · ${c.cnpj}` : ''}</div>
      <div class="det-actions">
        <button class="det-btn primary" id="btn-checkin-det"
          onclick="toggleCheckinForm()"
          ${visitadoHoje ? 'disabled' : ''}>
          ${visitadoHoje ? `✓ Visitado às ${c.horaHoje}` : '✓ Check-in'}
        </button>
        <button class="det-btn secondary maps" onclick="abrirMaps(${c.id})" title="Abrir no Google Maps">↗</button>
      </div>
    </div>

    <!-- FORM CHECK-IN (oculto até clicar) -->
    <div id="checkin-form-wrap" class="det-section" style="display:none">
      <div class="det-section-title">Registrar visita</div>
      <div class="checkin-form">
        <textarea class="checkin-obs" id="checkin-obs" placeholder="Observações, pedido feito, retornar em X dias..."></textarea>
        <div class="checkin-valor-row">
          <span class="checkin-valor-pre">R$</span>
          <input type="number" class="checkin-valor-input" id="checkin-valor" placeholder="Valor do pedido (opcional)" step="0.01" min="0">
        </div>
        <button class="det-btn primary" onclick="doCheckin(${c.id})">✓ Confirmar visita</button>
      </div>
    </div>

    <!-- INFO -->
    <div class="det-section">
      <div class="det-section-title">Informações</div>
      ${c.endereco ? `
        <div class="det-info-row">
          <span class="det-info-label">Endereço</span>
          <span class="det-info-value">${c.endereco}</span>
        </div>` : ''}
      ${c.tel ? `
        <div class="det-info-row">
          <span class="det-info-label">Telefone</span>
          <span class="det-info-value">${c.tel}</span>
        </div>` : ''}
      ${c.ultimaVisita ? `
        <div class="det-info-row">
          <span class="det-info-label">Última visita</span>
          <span class="det-info-value">${formatDate(c.ultimaVisita)}</span>
        </div>` : ''}
      ${c.ultimaObs ? `
        <div class="det-info-row" style="flex-direction:column;gap:4px;align-items:flex-start">
          <span class="det-info-label">Obs anterior</span>
          <span style="font-size:13px;color:var(--text);line-height:1.4;background:var(--bg);padding:7px 10px;border-radius:7px;width:100%">${c.ultimaObs}</span>
        </div>` : ''}
    </div>

    <!-- LEMBRETE -->
    <div class="det-section">
      <div class="det-section-title">Lembrete fixo</div>
      <div class="lembrete-box">
        <span class="lembrete-icon">💡</span>
        <textarea class="lembrete-textarea" id="lembrete-ta" placeholder="Anotação fixa sobre este cliente..."
          oninput="agendarSalvarLembrete(${c.id})">${lembrete}</textarea>
      </div>
      <div class="lembrete-saved" id="lembrete-saved"></div>
    </div>

    <!-- HISTÓRICO -->
    <div class="det-section" id="historico-wrap">
      <div class="det-section-title">Histórico de visitas</div>
      <div id="historico-list"><div style="font-size:12px;color:var(--text3)">Carregando...</div></div>
    </div>
  `;

  carregarHistorico(c.id);
}

function toggleCheckinForm() {
  const wrap = document.getElementById('checkin-form-wrap');
  if (!wrap) return;
  const visible = wrap.style.display !== 'none';
  wrap.style.display = visible ? 'none' : 'block';
  if (!visible) document.getElementById('checkin-obs')?.focus();
}

// ── CHECK-IN ─────────────────────────────────────────────────────────
async function doCheckin(id) {
  const c = clientes.find(x => x.id === id);
  if (!c || c.visitadoHoje) return;

  const obs      = document.getElementById('checkin-obs')?.value.trim() || '';
  const valorRaw = document.getElementById('checkin-valor')?.value;
  const valor    = valorRaw ? parseFloat(valorRaw) : null;
  const hora     = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const data     = new Date().toISOString().slice(0, 10);

  c.visitadoHoje = true;
  c.horaHoje     = hora;
  c.ultimaVisita = data;
  if (obs) c.ultimaObs = obs;

  // Salva local para restaurar no reload
  localStorage.setItem(`checkin_${c.id}_${data}`, JSON.stringify({ hora, obs }));

  renderList();
  renderCounters();
  renderDetail(c);
  if (gmap) {
    const m = markers[c.id];
    if (m) m.setIcon({ ...m.getIcon(), fillColor: STATUS_COLORS.today });
  }

  try {
    const payload = {
      id_cliente:   String(c.id),
      nome_cliente: c.nome,
      cidade:       c.cidade,
      data, hora,
      obs:          obs || '',
      rep_id:       currentUser.id,
      tipo:         'visita',
    };
    if (valor !== null) payload.valor_pedido = valor;
    await sb.from('visitas').insert(payload);
    showToast('✓ Visita registrada!');
  } catch(e) {
    showToast('⚠️ Salvo localmente', true);
  }
}

// ── HISTÓRICO ────────────────────────────────────────────────────────
async function carregarHistorico(clienteId) {
  const el = document.getElementById('historico-list');
  if (!el) return;
  try {
    const { data, error } = await sb
      .from('visitas')
      .select('*')
      .eq('id_cliente', String(clienteId))
      .eq('rep_id', currentUser.id)
      .order('data', { ascending: false })
      .order('hora', { ascending: false })
      .limit(20);
    if (error) throw error;
    const visitas = data || [];
    if (!visitas.length) {
      el.innerHTML = `<div class="hist-obs-empty" style="padding:8px 0">Nenhuma visita registrada ainda.</div>`;
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    el.innerHTML = visitas.map(v => {
      const isHoje   = v.data === hoje;
      const diasAtras = Math.floor((Date.now() - new Date(v.data + 'T00:00:00')) / 86400000);
      const isRecent = diasAtras <= 7;
      const dotClass = isHoje ? 'hoje' : isRecent ? 'recent' : '';
      const icon = isHoje ? '🟡' : isRecent ? '🟢' : '·';
      const valorStr = v.valor_pedido ? `<div class="hist-valor">R$ ${parseFloat(v.valor_pedido).toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>` : '';
      return `
        <div class="hist-item">
          <div class="hist-dot ${dotClass}">${icon}</div>
          <div class="hist-content">
            <div class="hist-data">${formatDate(v.data)} às ${v.hora || '—'}</div>
            ${v.obs ? `<div class="hist-obs">${v.obs}</div>` : `<div class="hist-obs-empty">Sem observação</div>`}
            ${valorStr}
          </div>
        </div>`;
    }).join('');
  } catch(e) {
    if (el) el.innerHTML = `<div class="hist-obs-empty">Erro ao carregar histórico.</div>`;
  }
}

// ── LEMBRETE ─────────────────────────────────────────────────────────
let lembreteTimer = null;

function agendarSalvarLembrete(clienteId) {
  clearTimeout(lembreteTimer);
  lembreteTimer = setTimeout(() => salvarLembrete(clienteId), 1200);
}

async function salvarLembrete(clienteId) {
  const ta = document.getElementById('lembrete-ta');
  if (!ta) return;
  const texto = ta.value;
  lembretes[String(clienteId)] = texto;
  try {
    await sb.from('lembretes').upsert({
      id_cliente:    String(clienteId),
      rep_id:        currentUser.id,
      texto,
      atualizado_em: new Date().toISOString()
    }, { onConflict: 'id_cliente,rep_id' });
    const saved = document.getElementById('lembrete-saved');
    if (saved) { saved.textContent = '✓ Salvo'; setTimeout(() => { if(saved) saved.textContent = ''; }, 2000); }
  } catch(e) { console.warn('lembrete:', e); }
}

async function carregarLembretesSupabase() {
  if (!currentUser) return;
  try {
    const { data } = await sb.from('lembretes').select('*').eq('rep_id', currentUser.id);
    if (!data) return;
    data.forEach(l => { lembretes[l.id_cliente] = l.texto; });
  } catch(e) {}
}

// ── MAPS ─────────────────────────────────────────────────────────────
function abrirMaps(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  const q = encodeURIComponent((c.endereco || '') + ', ' + c.cidade);
  window.open(`https://maps.google.com/?q=${q}`, '_blank');
}

// ── TABS ─────────────────────────────────────────────────────────────
function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
  if (tab === 'relatorio') { fecharDetalheRelatorio(); carregarRelatorio(); }
}

// ── RELATÓRIO ────────────────────────────────────────────────────────
async function carregarRelatorio() {
  const ini = new Date(relAno, relMes, 1).toISOString().slice(0, 10);
  const fim = new Date(relAno, relMes + 1, 0).toISOString().slice(0, 10);
  try {
    const { data } = await sb.from('visitas').select('*')
      .eq('rep_id', currentUser.id)
      .gte('data', ini).lte('data', fim)
      .order('data', { ascending: false });
    visatasRel = data || [];
  } catch(e) { visatasRel = []; }
  renderReport();
}

function navegarMes(delta) {
  relMes += delta;
  if (relMes < 0)  { relMes = 11; relAno--; }
  if (relMes > 11) { relMes = 0;  relAno++; }
  carregarRelatorio();
}

function setRelFiltro(filtro, btn) {
  relFiltro = filtro;
  document.querySelectorAll('.rep-ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReport();
}

function renderReport() {
  const hoje      = new Date();
  const ehAtual   = relMes === hoje.getMonth() && relAno === hoje.getFullYear();
  const nomeMes   = new Date(relAno, relMes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Título e navegação
  document.getElementById('rep-mes-titulo').textContent =
    relFiltro === 'hoje' ? 'Hoje' :
    relFiltro === 'semana' ? 'Esta semana' :
    nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  document.getElementById('rep-nav-prev').style.display = relFiltro === 'mes' ? '' : 'none';
  document.getElementById('rep-nav-next').style.display = relFiltro === 'mes' ? '' : 'none';
  document.getElementById('rep-nav-next').disabled = ehAtual && relFiltro === 'mes';

  // Filtra visitas pelo período
  let rows = visatasRel;
  if (relFiltro === 'hoje') {
    const hd = hoje.toISOString().slice(0, 10);
    rows = rows.filter(v => v.data === hd);
  } else if (relFiltro === 'semana') {
    const dSem = hoje.getDay();
    const iniSem = new Date(hoje); iniSem.setDate(hoje.getDate() - dSem); iniSem.setHours(0,0,0,0);
    rows = rows.filter(v => new Date(v.data + 'T00:00:00') >= iniSem);
  }

  const totalVisitas = rows.length;
  const totalVendas  = rows.reduce((s, v) => s + (parseFloat(v.valor_pedido) || 0), 0);
  const orcAbertos   = rows.filter(v => v.tipo === 'orcamento' && (!v.status_orcamento || v.status_orcamento === 'aberto')).length;

  // Salva estado para uso nas telas de detalhe
  relRowsAtual = rows;

  // Conversão: clientes visitados no período / total carteira
  let visitados;
  if (relFiltro === 'hoje') {
    visitados = clientes.filter(c => c.visitadoHoje).length;
  } else if (relFiltro === 'semana') {
    const dSem = hoje.getDay();
    const iniSem = new Date(hoje); iniSem.setDate(hoje.getDate() - dSem); iniSem.setHours(0,0,0,0);
    visitados = clientes.filter(c => {
      if (c.visitadoHoje) return true;
      if (!c.ultimaVisita) return false;
      return new Date(c.ultimaVisita + 'T00:00:00') >= iniSem;
    }).length;
  } else {
    visitados = clientes.filter(c => {
      if (c.visitadoHoje && relFiltro === 'mes' && ehAtual) return true;
      if (!c.ultimaVisita) return false;
      const d = new Date(c.ultimaVisita + 'T00:00:00');
      return d.getMonth() === relMes && d.getFullYear() === relAno;
    }).length;
  }
  const pctConv = clientes.length ? Math.round(visitados / clientes.length * 100) : 0;

  // Salva métricas para o detalhe
  relEstAtual = { visitados, pctConv, totalVendas, totalVisitas };

  // Top cidades
  const byCidade = {};
  rows.forEach(v => { byCidade[v.cidade] = (byCidade[v.cidade] || 0) + 1; });
  const topCidades = Object.entries(byCidade).sort((a,b) => b[1] - a[1]).slice(0, 5);

  document.getElementById('rep-body').innerHTML = `
    <div class="rep-card clickable" onclick="abrirDetalheRelatorio('visitas')" title="Ver detalhes de visitas">
      <div class="rep-card-icon">🤝</div>
      <div class="rep-card-val" style="color:var(--blue)">${totalVisitas}</div>
      <div class="rep-card-label">Visitas</div>
      <div class="rep-card-sub">registradas · clique para detalhar</div>
    </div>
    <div class="rep-card clickable" onclick="abrirDetalheRelatorio('vendas')" title="Ver detalhes de vendas">
      <div class="rep-card-icon">💰</div>
      <div class="rep-card-val" style="color:var(--green);font-size:${totalVendas>=10000?'18':totalVendas>=1000?'20':'24'}px">
        R$ ${totalVendas.toLocaleString('pt-BR', {minimumFractionDigits:2})}
      </div>
      <div class="rep-card-label">Vendas</div>
      <div class="rep-card-sub">total pedidos · clique para detalhar</div>
    </div>
    <div class="rep-card clickable" onclick="abrirDetalheRelatorio('conversao')" title="Ver detalhes de conversão">
      <div class="rep-card-icon">📊</div>
      <div class="rep-card-val" style="color:var(--purple)">${pctConv}%</div>
      <div class="rep-card-label">Conversão</div>
      <div class="rep-card-sub">${visitados} / ${clientes.length} clientes · clique para detalhar</div>
    </div>
    <div class="rep-card rep-card-wide rep-progresso">
      <div class="det-section-title">Progresso da carteira no ${relFiltro === 'mes' ? nomeMes : 'período'}</div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;margin-bottom:4px">
        <span style="font-size:13px;color:var(--text2)">${visitados} visitados</span>
        <span style="font-size:13px;font-weight:700;color:var(--text)">${pctConv}%</span>
      </div>
      <div class="rep-prog-bar"><div class="rep-prog-fill" style="width:${pctConv}%"></div></div>
      <div style="margin-top:6px;font-size:11px;color:var(--text3)">${clientes.length - visitados} clientes restantes</div>
    </div>
    ${topCidades.length ? `
    <div class="rep-card rep-card-wide">
      <div class="det-section-title" style="margin-bottom:12px">Top cidades</div>
      ${topCidades.map(([cidade, n]) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px;color:var(--text)">${cidade}</span>
          <span style="font-size:13px;font-weight:700;color:var(--blue)">${n} visitas</span>
        </div>`).join('')}
    </div>` : ''}
    ${orcAbertos > 0 ? `
    <div class="rep-card rep-card-wide" style="border-color:var(--orange);background:var(--orange-bg)">
      <div class="rep-card-icon">📋</div>
      <div style="font-size:15px;font-weight:700;color:var(--orange)">${orcAbertos} orçamento${orcAbertos>1?'s':''} em aberto</div>
      <div style="font-size:12px;color:var(--text3);margin-top:4px">Acompanhe no app mobile</div>
    </div>` : ''}

    ${renderRadarSection(rows)}
  `;
}

// ── RADAR COMERCIAL — seção do dashboard ─────────────────────────────
function renderRadarSection(rows) {
  // Pré-calcula contadores para exibir nos cards antes de abrir o detalhe
  const comValor     = rows.filter(v => v.valor_pedido && parseFloat(v.valor_pedido) > 0);
  const byCliente    = {};
  comValor.forEach(v => {
    const k = v.id_cliente;
    if (!byCliente[k]) byCliente[k] = { nome: v.nome_cliente, cidade: v.cidade, total: 0, pedidos: 0 };
    byCliente[k].total   += parseFloat(v.valor_pedido);
    byCliente[k].pedidos += 1;
  });
  const rankingCount = Object.keys(byCliente).length;

  const sumindoCount = clientes.filter(c => {
    const st = getStatus(c);
    return st === 'blue' || st === 'red';
  }).length;

  const potencialCount = clientes.filter(c => {
    const st = getStatus(c);
    return (st === 'blue' || st === 'red') && comValor.some(v => v.id_cliente == c.id);
  }).length || clientes.filter(c => getStatus(c) === 'red').length;

  return `
    <div class="rep-radar-header">
      <span class="rep-radar-titulo">⚡ Radar Comercial</span>
      <span class="rep-radar-sub">Insights automáticos da carteira</span>
    </div>

    <div class="rep-card rep-radar-card clickable"
         onclick="abrirDetalheRelatorio('top-compradores')"
         title="Ver ranking de compradores">
      <div class="rep-card-icon">🏆</div>
      <div class="rep-card-val" style="color:var(--orange)">${rankingCount}</div>
      <div class="rep-card-label">Top compradores</div>
      <div class="rep-card-sub">clientes com pedido no período</div>
    </div>

    <div class="rep-card rep-radar-card clickable"
         onclick="abrirDetalheRelatorio('mais-lucrativos')"
         title="Ver clientes mais lucrativos">
      <div class="rep-card-icon">💎</div>
      <div class="rep-card-val" style="color:var(--green);font-size:20px">
        R$ ${rankingCount > 0
          ? (Object.values(byCliente).sort((a,b)=>b.total-a.total)[0].total)
              .toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})
          : '—'}
      </div>
      <div class="rep-card-label">Mais lucrativos</div>
      <div class="rep-card-sub">${rankingCount > 0 ? 'maior pedido individual' : 'sem pedidos com valor'}</div>
    </div>

    <div class="rep-card rep-radar-card clickable"
         onclick="abrirDetalheRelatorio('clientes-sumindo')"
         title="Ver clientes sem visita recente">
      <div class="rep-card-icon">⚠️</div>
      <div class="rep-card-val" style="color:var(--red)">${sumindoCount}</div>
      <div class="rep-card-label">Clientes sumindo</div>
      <div class="rep-card-sub">sem visita há mais de 30 dias</div>
    </div>

    <div class="rep-card rep-radar-card clickable"
         onclick="abrirDetalheRelatorio('quedas')"
         title="Ver ranking de queda vs mês anterior">
      <div class="rep-card-icon">📉</div>
      <div class="rep-card-val" style="color:var(--red)">—</div>
      <div class="rep-card-label">Maiores quedas</div>
      <div class="rep-card-sub">ranking vs mês anterior</div>
    </div>

    <div class="rep-card rep-radar-card clickable"
         onclick="abrirDetalheRelatorio('potencial')"
         title="Ver clientes com potencial não visitado">
      <div class="rep-card-icon">🎯</div>
      <div class="rep-card-val" style="color:var(--purple)">${potencialCount}</div>
      <div class="rep-card-label">Potencial não visitado</div>
      <div class="rep-card-sub">compradores atrasados na agenda</div>
    </div>
  `;
}

// ── RELATÓRIO DETALHE ────────────────────────────────────────────────
async function abrirDetalheRelatorio(tipo) {
  document.getElementById('rep-body').style.display = 'none';
  const det = document.getElementById('rep-detail');
  det.style.display = 'flex';

  const periodoLabel =
    relFiltro === 'hoje' ? 'Hoje' :
    relFiltro === 'semana' ? 'Esta semana' :
    new Date(relAno, relMes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const titulos = {
    visitas:          '🤝 Visitas',
    vendas:           '💰 Vendas',
    conversao:        '📊 Conversão',
    'top-compradores':'🏆 Top Compradores',
    'mais-lucrativos':'💎 Mais Lucrativos',
    'clientes-sumindo':'⚠️ Clientes Sumindo',
    quedas:           '📉 Maiores Quedas vs Mês Anterior',
    potencial:        '🎯 Potencial Não Visitado',
  };
  document.getElementById('rep-detail-titulo').textContent = titulos[tipo] || tipo;
  document.getElementById('rep-detail-meta').textContent = periodoLabel;

  const body = document.getElementById('rep-detail-body');
  body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">Carregando...</div>';

  if (tipo === 'visitas')           body.innerHTML = renderDetalheVisitas();
  else if (tipo === 'vendas')       body.innerHTML = renderDetalheVendas();
  else if (tipo === 'conversao')    body.innerHTML = renderDetalheConversao();
  else if (tipo === 'top-compradores') body.innerHTML = renderDetalheTopCompradores();
  else if (tipo === 'mais-lucrativos') body.innerHTML = renderDetalheMaisLucrativos();
  else if (tipo === 'clientes-sumindo') body.innerHTML = renderDetalheClientesSumindo();
  else if (tipo === 'quedas') {
    await carregarMesAnteriorParaRadar();
    body.innerHTML = renderDetalheQuedas();
  }
  else if (tipo === 'potencial') {
    await carregarMesAnteriorParaRadar();
    body.innerHTML = renderDetalhePotencial();
  }
}

function fecharDetalheRelatorio() {
  const det = document.getElementById('rep-detail');
  const body = document.getElementById('rep-body');
  if (det)  det.style.display = 'none';
  if (body) body.style.display = '';
}

function renderDetalheVisitas() {
  const rows = relRowsAtual;
  const total = rows.length;

  const resumo = `
    <div class="det-summary-row">
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--blue)">${total}</div>
        <div class="det-summary-label">Visitas registradas</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--green)">
          ${[...new Set(rows.map(v => v.id_cliente))].length}
        </div>
        <div class="det-summary-label">Clientes distintos</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--purple)">
          ${[...new Set(rows.map(v => v.cidade).filter(Boolean))].length}
        </div>
        <div class="det-summary-label">Cidades visitadas</div>
      </div>
    </div>`;

  if (!rows.length) {
    return resumo + `<div class="det-table-wrap"><div class="det-table-empty">Nenhuma visita registrada no período.</div></div>`;
  }

  const linhas = rows.map(v => {
    const obsHtml = v.obs ? `<div class="dt-obs">${v.obs}</div>` : '';
    const valorHtml = v.valor_pedido
      ? `<span style="font-size:11px;font-weight:600;color:var(--green);margin-left:6px">R$ ${parseFloat(v.valor_pedido).toLocaleString('pt-BR',{minimumFractionDigits:2})}</span>`
      : '';
    return `<tr>
      <td class="muted" style="white-space:nowrap">${formatDate(v.data)}</td>
      <td class="muted">${v.hora || '—'}</td>
      <td><strong>${v.nome_cliente || '—'}</strong>${valorHtml}${obsHtml}</td>
      <td class="muted">${v.cidade || '—'}</td>
    </tr>`;
  }).join('');

  return resumo + `
    <div class="det-table-wrap">
      <table class="det-table">
        <thead>
          <tr>
            <th>Data</th><th>Hora</th><th>Cliente / Obs</th><th>Cidade</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function renderDetalheVendas() {
  const rows = relRowsAtual;
  const comValor = rows.filter(v => v.valor_pedido && parseFloat(v.valor_pedido) > 0);
  const totalVendas = comValor.reduce((s, v) => s + parseFloat(v.valor_pedido), 0);
  const ticketMedio = comValor.length ? totalVendas / comValor.length : 0;

  const resumo = `
    <div class="det-summary-row">
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--green);font-size:${totalVendas>=10000?'20':'28'}px">
          R$ ${totalVendas.toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
        <div class="det-summary-label">Total vendido</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--blue)">${comValor.length}</div>
        <div class="det-summary-label">Pedidos com valor</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--orange);font-size:${ticketMedio>=10000?'20':'28'}px">
          R$ ${ticketMedio.toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
        <div class="det-summary-label">Ticket médio</div>
      </div>
    </div>`;

  if (!comValor.length) {
    const semValorMsg = rows.length > 0
      ? `Existem ${rows.length} visita(s) no período, mas nenhuma com valor de pedido registrado. O campo "Valor do pedido" deve ser preenchido no check-in para aparecer aqui.`
      : 'Nenhuma visita registrada no período.';
    return resumo + `<div class="det-table-wrap"><div class="det-table-empty">${semValorMsg}</div></div>`;
  }

  const ordenado = [...comValor].sort((a, b) => parseFloat(b.valor_pedido) - parseFloat(a.valor_pedido));

  const linhas = ordenado.map(v => `
    <tr>
      <td class="muted" style="white-space:nowrap">${formatDate(v.data)}</td>
      <td><strong>${v.nome_cliente || '—'}</strong></td>
      <td class="muted">${v.cidade || '—'}</td>
      <td class="val-green" style="text-align:right;white-space:nowrap">
        R$ ${parseFloat(v.valor_pedido).toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </td>
    </tr>`).join('');

  return resumo + `
    <div class="det-table-wrap">
      <table class="det-table">
        <thead>
          <tr><th>Data</th><th>Cliente</th><th>Cidade</th><th style="text-align:right">Valor</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function renderDetalheConversao() {
  const { visitados, pctConv } = relEstAtual;
  const total = clientes.length;
  const hoje  = new Date();

  // Determina quais clientes foram convertidos no período atual
  const convertidos = clientes.filter(c => {
    if (relFiltro === 'hoje') return c.visitadoHoje;
    if (relFiltro === 'semana') {
      if (c.visitadoHoje) return true;
      if (!c.ultimaVisita) return false;
      const dSem = hoje.getDay();
      const iniSem = new Date(hoje); iniSem.setDate(hoje.getDate() - dSem); iniSem.setHours(0,0,0,0);
      return new Date(c.ultimaVisita + 'T00:00:00') >= iniSem;
    }
    if (c.visitadoHoje && relMes === hoje.getMonth() && relAno === hoje.getFullYear()) return true;
    if (!c.ultimaVisita) return false;
    const d = new Date(c.ultimaVisita + 'T00:00:00');
    return d.getMonth() === relMes && d.getFullYear() === relAno;
  });

  const naoVisitados = clientes.filter(c => !convertidos.includes(c));
  const naoVisitadosPorStatus = naoVisitados
    .map(c => ({ ...c, st: getStatus(c) }))
    .sort((a, b) => {
      const ord = { red: 0, blue: 1, green: 2, purple: 3, today: 4 };
      return (ord[a.st] ?? 9) - (ord[b.st] ?? 9);
    });

  const periodoLabel = relFiltro === 'hoje' ? 'hoje' : relFiltro === 'semana' ? 'esta semana' :
    new Date(relAno, relMes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const formula = `
    <div class="conv-formula-box">
      <strong>Como a conversão é calculada:</strong><br>
      Conversão = clientes visitados no período ÷ total da carteira × 100<br>
      <strong>${visitados} visitados</strong> ÷ <strong>${total} na carteira</strong> = <strong style="color:var(--purple)">${pctConv}%</strong><br>
      Período considerado: <strong>${periodoLabel}</strong>
    </div>`;

  const resumo = `
    <div class="det-summary-row">
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--purple)">${pctConv}%</div>
        <div class="det-summary-label">Taxa de conversão</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--green)">${visitados}</div>
        <div class="det-summary-label">Visitados</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--red)">${total - visitados}</div>
        <div class="det-summary-label">Não visitados</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--text)">${total}</div>
        <div class="det-summary-label">Total carteira</div>
      </div>
    </div>`;

  // Tabela dos convertidos
  const linhasConv = convertidos.length
    ? convertidos.map(c => `
        <tr>
          <td><strong>${c.nome}</strong></td>
          <td class="muted">${c.cidade}</td>
          <td class="val-green">${c.visitadoHoje ? 'Hoje às ' + c.horaHoje : formatDate(c.ultimaVisita)}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" class="det-table-empty">Nenhum cliente visitado no período.</td></tr>`;

  // Tabela dos não visitados (prioridade: mais atrasados primeiro)
  const linhasNaoConv = naoVisitadosPorStatus.slice(0, 30).map(c => {
    const cor = STATUS_COLORS[c.st];
    const lbl = STATUS_LABELS[c.st];
    return `<tr>
      <td><strong>${c.nome}</strong></td>
      <td class="muted">${c.cidade}</td>
      <td><span style="font-size:11px;font-weight:700;color:${cor}">${lbl}</span></td>
      <td class="muted">${c.ultimaVisita ? formatDate(c.ultimaVisita) : '—'}</td>
    </tr>`;
  }).join('');

  const maisMsg = naoVisitadosPorStatus.length > 30
    ? `<tr><td colspan="4" class="det-table-empty">+ ${naoVisitadosPorStatus.length - 30} clientes não exibidos</td></tr>`
    : '';

  return formula + resumo + `
    <div class="det-section-block">
      <div class="det-section-block-title">✅ Visitados no período (${convertidos.length})</div>
      <div class="det-table-wrap">
        <table class="det-table">
          <thead><tr><th>Cliente</th><th>Cidade</th><th>Visita</th></tr></thead>
          <tbody>${linhasConv}</tbody>
        </table>
      </div>
    </div>
    <div class="det-section-block">
      <div class="det-section-block-title">⏳ Não visitados no período (${naoVisitadosPorStatus.length}) — por prioridade</div>
      <div class="det-table-wrap">
        <table class="det-table">
          <thead><tr><th>Cliente</th><th>Cidade</th><th>Status</th><th>Última visita</th></tr></thead>
          <tbody>${linhasNaoConv}${maisMsg}</tbody>
        </table>
      </div>
    </div>`;
}

// ── RADAR COMERCIAL — funções de detalhe ─────────────────────────────

async function carregarMesAnteriorParaRadar() {
  // Só busca se ainda não tiver os dados ou se o mês mudou
  const mesAnt = relMes === 0 ? 11 : relMes - 1;
  const anoAnt = relMes === 0 ? relAno - 1 : relAno;
  const ini = new Date(anoAnt, mesAnt, 1).toISOString().slice(0, 10);
  const fim = new Date(anoAnt, mesAnt + 1, 0).toISOString().slice(0, 10);
  try {
    const { data } = await sb.from('visitas').select('*')
      .eq('rep_id', currentUser.id)
      .gte('data', ini).lte('data', fim);
    visatasRelAnterior = data || [];
  } catch(e) { visatasRelAnterior = []; }
}

function renderDetalheTopCompradores() {
  const rows = relRowsAtual.filter(v => v.valor_pedido && parseFloat(v.valor_pedido) > 0);

  // Agrupa por cliente
  const byCliente = {};
  rows.forEach(v => {
    const k = String(v.id_cliente);
    if (!byCliente[k]) byCliente[k] = { nome: v.nome_cliente, cidade: v.cidade, total: 0, pedidos: 0 };
    byCliente[k].total   += parseFloat(v.valor_pedido);
    byCliente[k].pedidos += 1;
  });

  const ranking = Object.values(byCliente).sort((a, b) => b.total - a.total);
  const totalGeral = ranking.reduce((s, r) => s + r.total, 0);

  const resumo = `
    <div class="det-summary-row">
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--orange)">${ranking.length}</div>
        <div class="det-summary-label">Clientes com pedido</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--green);font-size:${totalGeral>=10000?'18':'28'}px">
          R$ ${totalGeral.toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
        <div class="det-summary-label">Total do período</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--blue);font-size:20px">
          ${ranking[0]?.nome?.split(' ').slice(0,2).join(' ') || '—'}
        </div>
        <div class="det-summary-label">Maior comprador</div>
      </div>
    </div>`;

  if (!ranking.length) {
    return resumo + `<div class="det-table-wrap"><div class="det-table-empty">
      Nenhuma visita com valor de pedido registrado no período.<br>
      Preencha o campo "Valor do pedido" no check-in para ver o ranking aqui.
    </div></div>`;
  }

  const totalRef = totalGeral || 1;
  const linhas = ranking.map((r, i) => {
    const pct = Math.round(r.total / totalRef * 100);
    const barWidth = Math.max(pct, 2);
    return `<tr>
      <td style="font-weight:700;color:var(--text3);width:36px">#${i + 1}</td>
      <td><strong>${r.nome}</strong></td>
      <td class="muted">${r.cidade || '—'}</td>
      <td style="text-align:center" class="muted">${r.pedidos}</td>
      <td style="min-width:140px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:6px;background:var(--border);border-radius:3px">
            <div style="width:${barWidth}%;height:100%;background:var(--orange);border-radius:3px"></div>
          </div>
          <span style="font-size:11px;color:var(--text3);white-space:nowrap">${pct}%</span>
        </div>
      </td>
      <td class="val-green" style="text-align:right;white-space:nowrap">
        R$ ${r.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </td>
    </tr>`;
  }).join('');

  return resumo + `
    <div class="det-table-wrap">
      <table class="det-table">
        <thead>
          <tr><th>#</th><th>Cliente</th><th>Cidade</th><th style="text-align:center">Pedidos</th><th>Participação</th><th style="text-align:right">Total</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function renderDetalheMaisLucrativos() {
  const rows = relRowsAtual.filter(v => v.valor_pedido && parseFloat(v.valor_pedido) > 0);

  const byCliente = {};
  rows.forEach(v => {
    const k = String(v.id_cliente);
    if (!byCliente[k]) byCliente[k] = { nome: v.nome_cliente, cidade: v.cidade, total: 0, pedidos: 0, maior: 0 };
    const val = parseFloat(v.valor_pedido);
    byCliente[k].total   += val;
    byCliente[k].pedidos += 1;
    if (val > byCliente[k].maior) byCliente[k].maior = val;
  });

  const ranking = Object.values(byCliente).sort((a, b) => b.total - a.total);

  // Aviso sobre limitação de dados (lucro real não está disponível)
  const aviso = `
    <div class="conv-formula-box" style="background:var(--orange-bg);border-color:rgba(255,149,0,.25)">
      <strong style="color:var(--orange)">ℹ️ Nota sobre "lucratividade":</strong><br>
      Este ranking usa o <strong>valor total de pedidos</strong> como proxy de lucratividade.
      O cálculo de lucro real (receita − custo da visita − comissão − impostos) requer
      dados adicionais ainda não disponíveis no sistema. A estrutura está pronta para evoluir
      quando esses dados forem incluídos.
    </div>`;

  if (!ranking.length) {
    return aviso + `<div class="det-table-wrap"><div class="det-table-empty">
      Nenhum pedido com valor no período. Preencha o valor no check-in para ver este ranking.
    </div></div>`;
  }

  const linhas = ranking.map((r, i) => `
    <tr>
      <td style="font-weight:700;color:var(--text3);width:36px">#${i + 1}</td>
      <td><strong>${r.nome}</strong></td>
      <td class="muted">${r.cidade || '—'}</td>
      <td style="text-align:center" class="muted">${r.pedidos}</td>
      <td class="muted" style="text-align:right;white-space:nowrap">
        R$ ${r.maior.toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </td>
      <td class="val-green" style="text-align:right;white-space:nowrap">
        R$ ${r.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </td>
    </tr>`).join('');

  return aviso + `
    <div class="det-table-wrap">
      <table class="det-table">
        <thead>
          <tr><th>#</th><th>Cliente</th><th>Cidade</th><th style="text-align:center">Pedidos</th><th style="text-align:right">Maior pedido</th><th style="text-align:right">Total período</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function renderDetalheClientesSumindo() {
  const hoje = new Date();

  // Clientes sem visita há mais de 30 dias (status blue ou red) — ordenados por mais dias
  const sumindo = clientes
    .filter(c => { const st = getStatus(c); return st === 'blue' || st === 'red'; })
    .map(c => {
      const dias = c.ultimaVisita
        ? Math.floor((Date.now() - new Date(c.ultimaVisita + 'T00:00:00')) / 86400000)
        : null;
      return { ...c, dias };
    })
    .sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999));

  const semVisitaNunca = clientes.filter(c => getStatus(c) === 'purple').length;

  const resumo = `
    <div class="conv-formula-box" style="background:var(--red-bg);border-color:rgba(255,59,48,.2)">
      <strong style="color:var(--red)">Regra de detecção:</strong><br>
      São considerados "sumindo" os clientes com <strong>última visita há mais de 30 dias</strong>
      (status laranja ou vermelho). Clientes nunca visitados aparecem separados abaixo.
    </div>
    <div class="det-summary-row">
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--red)">${sumindo.length}</div>
        <div class="det-summary-label">Atrasados (>30 dias)</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--purple)">${semVisitaNunca}</div>
        <div class="det-summary-label">Nunca visitados</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--orange)">
          ${sumindo[0]?.dias ?? '—'} dias
        </div>
        <div class="det-summary-label">Maior atraso</div>
      </div>
    </div>`;

  if (!sumindo.length) {
    return resumo + `<div class="det-table-wrap"><div class="det-table-empty">
      Nenhum cliente com visita atrasada acima de 30 dias. Ótimo! 🎉
    </div></div>`;
  }

  const linhas = sumindo.map(c => {
    const st  = getStatus(c);
    const cor = STATUS_COLORS[st];
    const diasLabel = c.dias !== null ? `${c.dias} dias` : '—';
    const urgencia  = c.dias > 60
      ? `<span style="font-size:10px;font-weight:700;color:var(--red);background:var(--red-bg);padding:2px 7px;border-radius:10px">URGENTE</span>`
      : '';
    return `<tr>
      <td><strong>${c.nome}</strong> ${urgencia}</td>
      <td class="muted">${c.cidade}</td>
      <td><span style="font-size:11px;font-weight:700;color:${cor}">${STATUS_LABELS[st]}</span></td>
      <td class="muted" style="text-align:right">${c.ultimaVisita ? formatDate(c.ultimaVisita) : '—'}</td>
      <td style="text-align:right;font-weight:700;color:${c.dias > 60 ? 'var(--red)' : 'var(--orange)'}">
        ${diasLabel}
      </td>
    </tr>`;
  }).join('');

  return resumo + `
    <div class="det-table-wrap">
      <table class="det-table">
        <thead>
          <tr><th>Cliente</th><th>Cidade</th><th>Status</th><th style="text-align:right">Última visita</th><th style="text-align:right">Dias sem visita</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function renderDetalheQuedas() {
  const rowsAtual = relRowsAtual;
  const rowsAnt   = visatasRelAnterior;

  const mesAnt    = relMes === 0 ? 11 : relMes - 1;
  const anoAnt    = relMes === 0 ? relAno - 1 : relAno;
  const nomeMesAnt   = new Date(anoAnt, mesAnt, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const nomeMesAtual = new Date(relAno, relMes, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const aviso = `
    <div class="conv-formula-box">
      <strong>Regra do ranking:</strong><br>
      Compara o <strong>valor total de pedidos por cliente</strong> entre
      <strong>${nomeMesAtual}</strong> (mês atual) e <strong>${nomeMesAnt}</strong> (mês anterior).
      São listados todos os clientes com queda em qualquer magnitude, do maior para o menor recuo.
      Clientes que aparecem apenas no mês anterior (sem pedido no mês atual) são tratados como queda de 100%.
      ${rowsAnt.length === 0
        ? '<br><strong style="color:var(--orange)">⚠️ Dados do mês anterior não encontrados — sem visitas registradas para o período.</strong>'
        : ''}
    </div>`;

  if (!rowsAnt.length) return aviso;

  // Agrega valor total por cliente em cada período
  const agregar = (rows) => {
    const m = {};
    rows.filter(v => v.valor_pedido && parseFloat(v.valor_pedido) > 0).forEach(v => {
      const k = String(v.id_cliente);
      if (!m[k]) m[k] = { nome: v.nome_cliente, cidade: v.cidade, total: 0 };
      m[k].total += parseFloat(v.valor_pedido);
    });
    return m;
  };

  const atual = agregar(rowsAtual);
  const ant   = agregar(rowsAnt);

  // Todos os clientes que tinham pedido no mês anterior e caíram
  const ranking = Object.entries(ant)
    .map(([id, a]) => {
      const valorAtual = atual[id]?.total ?? 0;
      const diff       = valorAtual - a.total;           // negativo = queda
      const pct        = ((a.total - valorAtual) / a.total) * 100; // positivo = queda
      return { id, nome: a.nome, cidade: a.cidade, ant: a.total, atual: valorAtual, diff, pct };
    })
    .filter(r => r.pct > 0)                              // só quedas
    .sort((a, b) => b.pct - a.pct);                      // maiores quedas primeiro

  // Clientes que cresceram (informação complementar)
  const cresceram = Object.entries(ant)
    .filter(([id, a]) => atual[id] && atual[id].total > a.total)
    .length;

  // Novos clientes no mês atual (não estavam no anterior)
  const novosNoPeriodo = Object.keys(atual).filter(id => !ant[id]).length;

  if (!Object.keys(ant).length) {
    return aviso + `<div class="det-table-wrap"><div class="det-table-empty">
      Nenhum cliente com valor de pedido registrado no mês anterior.<br>
      Preencha o campo "Valor do pedido" no check-in para ativar este ranking.
    </div></div>`;
  }

  const volPerdido = ranking.reduce((s, r) => s + (r.ant - r.atual), 0);

  const resumo = `
    <div class="det-summary-row">
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--red)">${ranking.length}</div>
        <div class="det-summary-label">Com queda</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--green)">${cresceram}</div>
        <div class="det-summary-label">Cresceram</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--blue)">${novosNoPeriodo}</div>
        <div class="det-summary-label">Novos no período</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--red);font-size:${volPerdido>=10000?'18':'28'}px">
          R$ ${volPerdido.toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
        <div class="det-summary-label">Volume em queda</div>
      </div>
    </div>`;

  if (!ranking.length) {
    return aviso + resumo + `<div class="det-table-wrap"><div class="det-table-empty">
      Nenhum cliente com queda em relação ao mês anterior. 🎉
    </div></div>`;
  }

  // Função de gravidade: cor + label baseados na % de queda
  const gravidade = (pct) => {
    if (pct >= 80) return { cor: 'var(--red)',    label: 'Crítico' };
    if (pct >= 50) return { cor: 'var(--red)',    label: 'Alto' };
    if (pct >= 25) return { cor: 'var(--orange)', label: 'Médio' };
    return            { cor: 'var(--blue)',   label: 'Baixo' };
  };

  const linhas = ranking.map((r, i) => {
    const g = gravidade(r.pct);
    const diffStr = 'R$ ' + Math.abs(r.diff).toLocaleString('pt-BR', {minimumFractionDigits:2});
    return `<tr>
      <td style="font-weight:700;color:var(--text3);width:36px">#${i + 1}</td>
      <td><strong>${r.nome}</strong></td>
      <td class="muted">${r.cidade || '—'}</td>
      <td class="muted" style="text-align:right;white-space:nowrap">
        R$ ${r.ant.toLocaleString('pt-BR',{minimumFractionDigits:2})}
      </td>
      <td style="text-align:right;white-space:nowrap;font-weight:700;color:${r.atual > 0 ? 'var(--text)' : 'var(--text3)'}">
        ${r.atual > 0 ? 'R$ ' + r.atual.toLocaleString('pt-BR',{minimumFractionDigits:2}) : 'Sem pedido'}
      </td>
      <td style="text-align:right;white-space:nowrap;font-weight:700;color:var(--red)">
        −${diffStr}
      </td>
      <td style="text-align:right">
        <span style="font-size:11px;font-weight:800;color:${g.cor};background:${g.cor}22;padding:3px 8px;border-radius:10px;white-space:nowrap">
          −${Math.round(r.pct)}% · ${g.label}
        </span>
      </td>
    </tr>`;
  }).join('');

  return aviso + resumo + `
    <div class="det-table-wrap">
      <table class="det-table">
        <thead>
          <tr>
            <th>#</th><th>Cliente</th><th>Cidade</th>
            <th style="text-align:right">${nomeMesAnt.split(' ')[0]}</th>
            <th style="text-align:right">${nomeMesAtual.split(' ')[0]}</th>
            <th style="text-align:right">Diferença</th>
            <th style="text-align:right">Variação</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

function renderDetalhePotencial() {
  const rows = [...relRowsAtual, ...visatasRelAnterior];

  // Clientes com pelo menos um pedido com valor em qualquer período carregado
  const comHistoricoDeValor = new Set(
    rows.filter(v => v.valor_pedido && parseFloat(v.valor_pedido) > 0)
        .map(v => String(v.id_cliente))
  );

  // Filtro: tem histórico de valor E não visitado recentemente (>30 dias)
  let potencial = clientes.filter(c => {
    const st = getStatus(c);
    return (st === 'blue' || st === 'red') && comHistoricoDeValor.has(String(c.id));
  });

  // Se não tiver dados de valor, amplia para todos os atrasados
  const semDadosValor = comHistoricoDeValor.size === 0;
  if (semDadosValor) {
    potencial = clientes.filter(c => getStatus(c) === 'red');
  }

  potencial = potencial
    .map(c => {
      const pedidosC = rows.filter(v => String(v.id_cliente) === String(c.id) && v.valor_pedido);
      const totalHist = pedidosC.reduce((s, v) => s + parseFloat(v.valor_pedido || 0), 0);
      const dias = c.ultimaVisita
        ? Math.floor((Date.now() - new Date(c.ultimaVisita + 'T00:00:00')) / 86400000)
        : null;
      return { ...c, totalHist, dias };
    })
    .sort((a, b) => b.totalHist - a.totalHist || (b.dias ?? 9999) - (a.dias ?? 9999));

  const aviso = `
    <div class="conv-formula-box">
      <strong>Regra de identificação:</strong><br>
      ${semDadosValor
        ? 'Sem histórico de valor nos pedidos, o critério usado é: <strong>clientes com visita atrasada há mais de 60 dias</strong>. Para análise mais precisa, preencha o valor dos pedidos no check-in.'
        : 'Clientes com <strong>pedido com valor registrado</strong> em qualquer visita dos períodos carregados, mas <strong>sem visita há mais de 30 dias</strong>. Ordenados pelo maior valor histórico.'
      }
    </div>`;

  const resumo = `
    <div class="det-summary-row">
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--purple)">${potencial.length}</div>
        <div class="det-summary-label">Clientes identificados</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--green);font-size:${potencial.reduce((s,c)=>s+c.totalHist,0)>=10000?'18':'28'}px">
          R$ ${potencial.reduce((s,c)=>s+c.totalHist,0).toLocaleString('pt-BR',{minimumFractionDigits:2})}
        </div>
        <div class="det-summary-label">Volume em risco</div>
      </div>
      <div class="det-summary-card">
        <div class="det-summary-num" style="color:var(--orange)">
          ${potencial[0]?.dias ?? '—'} dias
        </div>
        <div class="det-summary-label">Mais tempo sem visita</div>
      </div>
    </div>`;

  if (!potencial.length) {
    return aviso + resumo + `<div class="det-table-wrap"><div class="det-table-empty">
      Nenhum cliente com potencial detectado sem visita recente. 🎉
    </div></div>`;
  }

  const linhas = potencial.map(c => {
    const st  = getStatus(c);
    const cor = STATUS_COLORS[st];
    return `<tr>
      <td><strong>${c.nome}</strong></td>
      <td class="muted">${c.cidade}</td>
      <td><span style="font-size:11px;font-weight:700;color:${cor}">${STATUS_LABELS[st]}</span></td>
      <td class="muted" style="text-align:right">${c.ultimaVisita ? formatDate(c.ultimaVisita) : '—'}</td>
      <td style="text-align:right;font-weight:700;color:var(--orange)">${c.dias ?? '—'} dias</td>
      <td class="val-green" style="text-align:right;white-space:nowrap">
        ${c.totalHist > 0 ? 'R$ ' + c.totalHist.toLocaleString('pt-BR',{minimumFractionDigits:2}) : '—'}
      </td>
    </tr>`;
  }).join('');

  return aviso + resumo + `
    <div class="det-table-wrap">
      <table class="det-table">
        <thead>
          <tr><th>Cliente</th><th>Cidade</th><th>Status</th><th style="text-align:right">Última visita</th><th style="text-align:right">Dias</th><th style="text-align:right">Histórico valor</th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </div>`;
}

// ── TAREFAS ──────────────────────────────────────────────────────────
function getTarefas() {
  const hoje = new Date().toISOString().slice(0, 10);
  return JSON.parse(localStorage.getItem(`tarefas_${hoje}`) || '[]');
}

function setTarefas(list) {
  const hoje = new Date().toISOString().slice(0, 10);
  localStorage.setItem(`tarefas_${hoje}`, JSON.stringify(list));
}

function renderTarefas() {
  const list = getTarefas();
  const el   = document.getElementById('tarefas-list');
  const data = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  document.getElementById('tarefas-date').textContent = data;

  if (!list.length) {
    el.innerHTML = `<div class="list-empty">Nenhuma tarefa para hoje.<br>Adicione acima.</div>`;
    return;
  }
  el.innerHTML = list.map((t, i) => `
    <div class="tarefa-item">
      <button class="tarefa-check${t.done ? ' done' : ''}" onclick="toggleTarefa(${i})">${t.done ? '✓' : ''}</button>
      <span class="tarefa-texto${t.done ? ' done' : ''}">${t.texto}</span>
      <button class="tarefa-del" onclick="deletarTarefa(${i})">×</button>
    </div>
  `).join('');
}

function adicionarTarefa() {
  const input = document.getElementById('tarefas-input');
  const texto = input.value.trim();
  if (!texto) return;
  const list = getTarefas();
  list.push({ texto, done: false, criada: Date.now() });
  setTarefas(list);
  input.value = '';
  renderTarefas();
}

function toggleTarefa(i) {
  const list = getTarefas();
  list[i].done = !list[i].done;
  setTarefas(list);
  renderTarefas();
}

function deletarTarefa(i) {
  const list = getTarefas();
  list.splice(i, 1);
  setTarefas(list);
  renderTarefas();
}

// ── ADMIN ────────────────────────────────────────────────────────────
async function carregarReps() {
  try {
    const { data } = await sb.from('representantes').select('*').order('nome');
    const el = document.getElementById('reps-list');
    if (!data?.length) { el.innerHTML = `<div class="list-empty">Nenhum representante.</div>`; return; }
    el.innerHTML = data.map(r => `
      <div class="rep-item">
        <div>
          <div class="rep-nome">${r.nome || r.email}</div>
          <div class="rep-email">${r.email}</div>
        </div>
        <span class="rep-badge ${r.ativo !== false ? 'ativo' : 'inativo'}">${r.ativo !== false ? 'Ativo' : 'Inativo'}</span>
      </div>
    `).join('');
  } catch(e) {}
}

async function criarRep() {
  const nome  = document.getElementById('admin-nome').value.trim();
  const email = document.getElementById('admin-email').value.trim();
  const senha = document.getElementById('admin-senha').value;
  const msg   = document.getElementById('admin-msg');
  const btn   = document.getElementById('admin-submit');
  if (!nome || !email || !senha) { msg.textContent = 'Preencha todos os campos.'; msg.className = 'admin-msg erro'; return; }
  btn.disabled = true;
  try {
    const { data, error } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error) throw error;
    await sb.from('representantes').insert({ id: data.user.id, nome, email, ativo: true });
    msg.textContent = '✓ Representante criado!'; msg.className = 'admin-msg ok';
    document.getElementById('admin-nome').value = '';
    document.getElementById('admin-email').value = '';
    document.getElementById('admin-senha').value = '';
    carregarReps();
  } catch(e) {
    msg.textContent = 'Erro: ' + (e.message || 'verifique os dados.'); msg.className = 'admin-msg erro';
  }
  btn.disabled = false;
}

// ── CADASTRO CLIENTE ─────────────────────────────────────────────────
let novoClienteCoords = null;
let segNovoCliente    = '';

function openCadastro() {
  novoClienteCoords = null;
  segNovoCliente    = '';
  document.getElementById('modal-overlay').classList.add('open');
  document.getElementById('cad-form').reset();
  document.getElementById('cad-cep-status').textContent = '';
  document.getElementById('cad-gps-status').textContent = '';
  document.getElementById('btn-cad-gps').className = 'btn-gps';
  document.getElementById('btn-cad-gps').textContent = '📍 Usar localização atual';
  renderSegPills();
}

function closeCadastro() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function renderSegPills() {
  const wrap = document.getElementById('seg-pills-wrap');
  wrap.innerHTML = SEGS.map(s => `
    <button type="button" class="seg-pill${segNovoCliente === s.valor ? ' active' : ''}"
      onclick="toggleSeg('${s.valor}')">${s.label}</button>
  `).join('');
}

function toggleSeg(valor) {
  segNovoCliente = segNovoCliente === valor ? '' : valor;
  renderSegPills();
}

function usarGPS() {
  const btn = document.getElementById('btn-cad-gps');
  const status = document.getElementById('cad-gps-status');
  btn.disabled = true; status.textContent = 'Localizando...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      novoClienteCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      btn.className = 'btn-gps ok'; btn.textContent = '✓ Localização capturada';
      status.textContent = `${novoClienteCoords.lat.toFixed(5)}, ${novoClienteCoords.lng.toFixed(5)}`;
      btn.disabled = false;
    },
    () => { status.textContent = 'Erro ao capturar localização.'; btn.disabled = false; }
  );
}

async function buscarCEP() {
  const cep = document.getElementById('cad-cep').value.replace(/\D/g, '');
  const btn = document.getElementById('btn-buscar-cep');
  const status = document.getElementById('cad-cep-status');
  if (cep.length !== 8) return;
  btn.disabled = true; status.textContent = 'Buscando...';
  try {
    const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) { status.textContent = 'CEP não encontrado.'; btn.disabled = false; return; }
    document.getElementById('cad-endereco').value = `${data.logradouro}, ${data.bairro}`;
    document.getElementById('cad-cidade').value   = `${data.localidade} - ${data.uf}`;
    status.textContent = '✓ Endereço preenchido';
  } catch(e) { status.textContent = 'Erro na busca.'; }
  btn.disabled = false;
}

async function salvarCliente() {
  const nome    = document.getElementById('cad-nome').value.trim();
  const cidade  = document.getElementById('cad-cidade').value.trim();
  const btn     = document.getElementById('btn-salvar-cad');
  if (!nome) { showToast('Nome é obrigatório.', true); return; }
  btn.disabled = true; btn.textContent = 'Salvando...';
  try {
    const payload = {
      rep_id:      currentUser.id,
      nome,
      razao_social: document.getElementById('cad-razao').value.trim() || nome,
      fantasia:     document.getElementById('cad-fantasia').value.trim(),
      comprador:    document.getElementById('cad-comprador').value.trim(),
      cnpj:         document.getElementById('cad-cnpj').value.trim(),
      telefone:     document.getElementById('cad-tel').value.trim(),
      cep:          document.getElementById('cad-cep').value.trim(),
      endereco:     document.getElementById('cad-endereco').value.trim(),
      cidade,
      segmento:     segNovoCliente || null,
      lat:          novoClienteCoords?.lat || null,
      lng:          novoClienteCoords?.lng || null,
    };
    const { data, error } = await sb.from('clientes').insert(payload).select().single();
    if (error) throw error;
    clientes.push(mapCliente(data));
    closeCadastro();
    renderAll();
    showToast('✓ Cliente cadastrado!');
  } catch(e) {
    showToast('Erro ao salvar: ' + (e.message || ''), true);
  }
  btn.disabled = false; btn.textContent = 'Salvar cliente';
}

// ── UTILITÁRIOS ──────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

let toastTimer = null;
function showToast(msg, isErr = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = isErr ? '#FF3B30' : '';
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── BUSCA GLOBAL (header) ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('search-input').addEventListener('input', () => {
    renderList();
    if (gmap) renderMapMarkers();
  });

  document.getElementById('tarefas-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') adicionarTarefa();
  });

  // ESC fecha modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeCadastro();
  });

  // Carrega tarefas se tab ativa
  document.querySelector('[data-tab="tarefas"]')?.addEventListener('click', renderTarefas);
  document.querySelector('[data-tab="admin"]')?.addEventListener('click', carregarReps);
});

// ── PLANNER ROTA ──────────────────────────────────────────────────────

function setSidebarMode(mode) {
  plannerMode = (mode === 'planner');
  document.getElementById('sb-btn-lista')?.classList.toggle('active', !plannerMode);
  document.getElementById('sb-btn-planner')?.classList.toggle('active', plannerMode);
  document.getElementById('sidebar-lista').style.display = plannerMode ? 'none' : 'flex';

  const pp = document.getElementById('planner-panel');
  if (plannerMode) {
    pp.style.display = 'flex';
    renderPlannerPanel();
  } else {
    pp.style.display = 'none';
    // Volta ao modo normal: restaura mapa de clientes, oculta resultado de rota
    limparRota();
    renderList();
    if (gmap) renderMapMarkers();
  }
}

function renderPlannerPanel() {
  const pp = document.getElementById('planner-panel');
  if (!plannerDate) plannerDate = new Date().toISOString().slice(0, 10);
  const dateFmt = plannerDate
    ? new Date(plannerDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' })
    : '';

  const originStatus = plannerOrigin
    ? `✅ ${plannerOrigin.label}`
    : 'Nenhum ponto de partida definido';
  const originInputVal = plannerOrigin?.type === 'endereco' ? plannerOrigin.label : '';

  pp.innerHTML = `
    <div class="planner-scroll" style="display:flex;flex-direction:column;flex:1;min-height:0;">

      <!-- DATA -->
      <div class="planner-section">
        <div class="planner-section-title">Data da rota</div>
        <input class="planner-input" type="date" id="planner-date-input"
          value="${plannerDate}"
          onchange="plannerDate=this.value">
      </div>

      <!-- PARTIDA -->
      <div class="planner-section">
        <div class="planner-section-title">Ponto de partida</div>
        <div class="planner-origin-btns">
          <button class="planner-origin-btn${plannerOrigin?.type==='gps' ? ' active' : ''}"
            onclick="plannerUsarGPS()">📍 GPS atual</button>
          <button class="planner-origin-btn${plannerOrigin?.type==='endereco' ? ' active' : ''}"
            onclick="document.getElementById('planner-origin-input').focus()">✍ Endereço</button>
        </div>
        <input class="planner-input" type="text" id="planner-origin-input"
          placeholder="Ex: Rua Bahia, 123, Pomerode"
          value="${originInputVal}"
          oninput="plannerOriginDigitando(this.value)"
          onkeydown="if(event.key==='Enter') plannerGeocodificarEndereco()">
        <div class="planner-origin-status" id="planner-origin-status">${originStatus}</div>
      </div>

      <!-- CLIENTES -->
      <div class="planner-section" style="padding-bottom:6px;border-bottom:none;">
        <div class="planner-section-title" style="margin-bottom:6px;">
          Clientes da rota
          <span id="planner-sel-count" style="font-weight:500;margin-left:4px;">
            (${plannerSel.size} selecionado${plannerSel.size!==1?'s':''})
          </span>
        </div>
        <input class="planner-input" type="search" id="planner-search"
          placeholder="Buscar cliente ou cidade..."
          value="${plannerSearchQ}"
          oninput="plannerSearchQ=this.value; renderPlannerClientList()">
      </div>
      <div id="planner-client-list" style="flex:1;overflow-y:auto;min-height:0;"></div>
    </div>

    <!-- FOOTER -->
    <div id="planner-footer">
      <button id="btn-gerar-rota" onclick="gerarRota()" disabled>Selecione clientes</button>
      <button class="btn-limpar-planner" onclick="resetarPlanner()"
        title="Limpar toda a seleção e recomeçar">Limpar seleção</button>
    </div>`;

  renderPlannerClientList();
  updatePlannerBtn();
}

function renderPlannerClientList() {
  const container = document.getElementById('planner-client-list');
  if (!container) return;
  const q = plannerSearchQ.toLowerCase();
  let lista = clientes.filter(c =>
    !q || c.nome.toLowerCase().includes(q) || c.cidade.toLowerCase().includes(q)
  );
  // Selecionados primeiro, depois nome
  lista.sort((a, b) => {
    const diff = (plannerSel.has(b.id) ? 1 : 0) - (plannerSel.has(a.id) ? 1 : 0);
    return diff || a.nome.localeCompare(b.nome, 'pt-BR');
  });

  if (!lista.length) {
    container.innerHTML = `<div class="list-empty">Nenhum cliente encontrado</div>`;
    return;
  }

  container.innerHTML = lista.map(c => {
    const sel  = plannerSel.get(c.id);
    const checked = !!sel;
    const cor  = STATUS_COLORS[getStatus(c)];
    const horTipo = sel?.horTipo || 'nenhum';
    const horario = sel?.horario || '';
    const noGPS   = !c.lat || !c.lng;
    return `
      <div class="planner-client-row" id="pcr-${c.id}">
        <label class="planner-client-check">
          <input type="checkbox" ${checked ? 'checked' : ''}
            onchange="togglePlannerCliente(${c.id}, this.checked)">
          <div class="pcc-dot" style="background:${cor}"></div>
          <div class="pcc-info">
            <div class="pcc-nome">${c.nome}</div>
            <div class="pcc-cidade">${c.cidade}</div>
          </div>
          ${noGPS ? '<span class="pcc-nogps">sem GPS</span>' : ''}
        </label>
        <div class="planner-time-row ${checked ? 'visible' : ''}" id="ptr-${c.id}">
          <button class="planner-type-btn ${horTipo==='nenhum'      ? 't-none'  : ''}"
            onclick="setPlannerHorTipo(${c.id},'nenhum')">Sem hora</button>
          <button class="planner-type-btn ${horTipo==='preferencial' ? 't-pref'  : ''}"
            onclick="setPlannerHorTipo(${c.id},'preferencial')">Preferido</button>
          <button class="planner-type-btn ${horTipo==='obrigatorio'  ? 't-obrig' : ''}"
            onclick="setPlannerHorTipo(${c.id},'obrigatorio')">Fixo</button>
          ${horTipo !== 'nenhum' ? `
            <input type="time" class="planner-time-input" value="${horario}"
              onchange="setPlannerHorario(${c.id}, this.value)">` : ''}
        </div>
      </div>`;
  }).join('');
}

function togglePlannerCliente(id, checked) {
  if (checked) {
    plannerSel.set(id, { horTipo: 'nenhum', horario: '' });
  } else {
    plannerSel.delete(id);
  }
  const row = document.getElementById(`ptr-${id}`);
  if (row) row.classList.toggle('visible', checked);
  const countEl = document.getElementById('planner-sel-count');
  if (countEl) countEl.textContent = `(${plannerSel.size} selecionado${plannerSel.size!==1?'s':''})`;
  updatePlannerBtn();
}

function setPlannerHorTipo(id, tipo) {
  if (!plannerSel.has(id)) return;
  plannerSel.get(id).horTipo = tipo;
  // Re-renderiza apenas a time-row do cliente
  const row = document.getElementById(`ptr-${id}`);
  if (!row) return;
  const c = clientes.find(x => x.id === id);
  const horario = plannerSel.get(id).horario || '';
  row.innerHTML = `
    <button class="planner-type-btn ${tipo==='nenhum'      ? 't-none'  : ''}"
      onclick="setPlannerHorTipo(${id},'nenhum')">Sem hora</button>
    <button class="planner-type-btn ${tipo==='preferencial' ? 't-pref'  : ''}"
      onclick="setPlannerHorTipo(${id},'preferencial')">Preferido</button>
    <button class="planner-type-btn ${tipo==='obrigatorio'  ? 't-obrig' : ''}"
      onclick="setPlannerHorTipo(${id},'obrigatorio')">Fixo</button>
    ${tipo !== 'nenhum' ? `
      <input type="time" class="planner-time-input" value="${horario}"
        onchange="setPlannerHorario(${id}, this.value)">` : ''}`;
}

function setPlannerHorario(id, val) {
  if (plannerSel.has(id)) plannerSel.get(id).horario = val;
}

function updatePlannerBtn() {
  const btn = document.getElementById('btn-gerar-rota');
  if (!btn) return;
  const disabled = !plannerOrigin || plannerSel.size === 0;
  btn.disabled = disabled;
  if (plannerSel.size === 0) {
    btn.textContent = 'Selecione clientes para gerar';
  } else if (!plannerOrigin) {
    btn.textContent = 'Defina o ponto de partida';
  } else {
    btn.textContent = `🗺 Gerar rota · ${plannerSel.size} parada${plannerSel.size!==1?'s':''}`;
  }
}

function plannerUsarGPS() {
  const statusEl = document.getElementById('planner-origin-status');
  if (statusEl) statusEl.textContent = '⏳ Obtendo localização...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      plannerOrigin = {
        type: 'gps',
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        label: `GPS (${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)})`,
      };
      const input = document.getElementById('planner-origin-input');
      if (input) input.value = '';
      if (statusEl) statusEl.textContent = `✅ ${plannerOrigin.label}`;
      document.querySelectorAll('.planner-origin-btn').forEach((b, i) =>
        b.classList.toggle('active', i === 0)
      );
      updatePlannerBtn();
    },
    () => {
      if (statusEl) statusEl.textContent = '❌ Não foi possível obter localização';
    }
  );
}

function plannerOriginDigitando(val) {
  // Limpa origem GPS se usuário digita no campo de endereço
  if (plannerOrigin?.type === 'gps') {
    plannerOrigin = null;
    document.querySelectorAll('.planner-origin-btn').forEach(b => b.classList.remove('active'));
  }
  const statusEl = document.getElementById('planner-origin-status');
  if (!statusEl) return;
  if (val.trim().length > 4) {
    statusEl.innerHTML =
      `<span style="color:var(--blue);cursor:pointer" onclick="plannerGeocodificarEndereco()">
        🔍 Pressione Enter ou clique para confirmar endereço
      </span>`;
  } else {
    statusEl.textContent = 'Digite e pressione Enter para confirmar';
  }
  updatePlannerBtn();
}

function plannerGeocodificarEndereco() {
  const input = document.getElementById('planner-origin-input');
  const val = input?.value?.trim();
  if (!val) return;
  const statusEl = document.getElementById('planner-origin-status');
  if (statusEl) statusEl.textContent = '⏳ Buscando endereço...';
  if (!window.google?.maps) {
    if (statusEl) statusEl.textContent = '❌ API de mapas não carregada';
    return;
  }
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: val + ', Santa Catarina, Brasil', region: 'br' }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const loc = results[0].geometry.location;
      plannerOrigin = {
        type: 'endereco',
        lat: loc.lat(), lng: loc.lng(),
        label: results[0].formatted_address,
      };
      if (input) input.value = plannerOrigin.label;
      if (statusEl) statusEl.textContent = `✅ ${plannerOrigin.label}`;
      document.querySelectorAll('.planner-origin-btn').forEach((b, i) =>
        b.classList.toggle('active', i === 1)
      );
      updatePlannerBtn();
    } else {
      if (statusEl) statusEl.textContent = '❌ Endereço não encontrado. Tente mais específico.';
    }
  });
}

// ── Lógica de ordenação da rota ──────────────────────────────────────

function prepararOrdemRota(selecionados) {
  const fixed    = selecionados
    .filter(c => c.horTipo === 'obrigatorio' && c.horario)
    .sort((a, b) => a.horario.localeCompare(b.horario));
  const flexible = selecionados.filter(c => !(c.horTipo === 'obrigatorio' && c.horario));

  if (!fixed.length) {
    return { ordered: selecionados, optimize: true, conflicts: [] };
  }

  // Âncoras: origem + cada cliente fixo (em ordem de horário)
  const anchors = [
    { lat: plannerOrigin.lat, lng: plannerOrigin.lng },
    ...fixed.map(c => ({ lat: c.lat, lng: c.lng })),
  ];

  // Buckets: um por lacuna entre âncoras (incluindo após a última)
  const buckets = anchors.map(() => []);

  flexible.forEach(c => {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const next = anchors[i + 1] || anchors[i]; // após última âncora
      const midLat = (anchors[i].lat + next.lat) / 2;
      const midLng = (anchors[i].lng + next.lng) / 2;
      const d = Math.hypot(c.lat - midLat, c.lng - midLng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    buckets[best].push(c);
  });

  // Monta ordem final: [bucket[0]], fixed[0], [bucket[1]], fixed[1], ..., [bucket[n]]
  const ordered = [];
  fixed.forEach((fc, i) => {
    ordered.push(...buckets[i]);
    ordered.push(fc);
  });
  ordered.push(...buckets[fixed.length]);

  return { ordered, optimize: false, conflicts: [] };
}

// ── Geração de rota ──────────────────────────────────────────────────

async function gerarRota() {
  if (!plannerOrigin || plannerSel.size === 0) return;
  const btn = document.getElementById('btn-gerar-rota');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Calculando...'; }

  // Coleta clientes selecionados, mergeando config de horário
  const todos = [];
  for (const [id, conf] of plannerSel) {
    const c = clientes.find(x => x.id === id);
    if (c) todos.push({ ...c, horTipo: conf.horTipo, horario: conf.horario });
  }

  const comGPS    = todos.filter(c => c.lat && c.lng);
  const semGPS    = todos.filter(c => !c.lat || !c.lng);

  if (!comGPS.length) {
    showToast('Nenhum cliente selecionado tem coordenadas GPS.');
    updatePlannerBtn();
    return;
  }

  const { ordered, optimize, conflicts } = prepararOrdemRota(comGPS);

  if (!window.google?.maps) {
    showToast('API de mapas não carregada ainda. Aguarde.');
    updatePlannerBtn();
    return;
  }

  const svc = new google.maps.DirectionsService();

  // Usa round-trip (origem = destino) para que o Google possa otimizar livremente
  const waypoints = ordered.map(c => ({
    location: new google.maps.LatLng(c.lat, c.lng),
    stopover: true,
  }));

  svc.route({
    origin:             new google.maps.LatLng(plannerOrigin.lat, plannerOrigin.lng),
    destination:        new google.maps.LatLng(plannerOrigin.lat, plannerOrigin.lng),
    waypoints,
    travelMode:         google.maps.TravelMode.DRIVING,
    optimizeWaypoints:  optimize,
    region:             'br',
  }, (result, status) => {
    if (status !== 'OK') {
      showToast(`Erro ao calcular rota: ${status}`);
      updatePlannerBtn();
      return;
    }

    // Se Google otimizou, reordena nosso array de clientes
    let finalOrder = [...ordered];
    if (optimize) {
      const wo = result.routes[0].waypoint_order;
      if (wo?.length) finalOrder = wo.map(i => ordered[i]);
    }

    // Exibe polilinha no mapa
    dirRenderer.setDirections(result);

    // Marcadores numerados
    addPlannerMarkers(finalOrder);

    // Painel de resultado
    mostrarRotaResult(finalOrder, result.routes[0].legs, conflicts, semGPS);

    // Restaura botão
    updatePlannerBtn();
  });
}

// ── Marcadores numerados ─────────────────────────────────────────────

function plannerMarkerSVG(label, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.27 21.73 0 14 0z" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1"/>
    <text x="14" y="18" text-anchor="middle" font-size="11" font-weight="bold" fill="white"
      font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${label}</text>
  </svg>`;
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(28, 36),
    anchor:     new google.maps.Point(14, 36),
  };
}

function clearPlannerMarkers() {
  plannerMarkers.forEach(m => m.setMap(null));
  plannerMarkers = [];
}

function addPlannerMarkers(orderedClients) {
  clearPlannerMarkers();
  if (!gmap) return;

  // Marcador de partida/chegada
  plannerMarkers.push(new google.maps.Marker({
    position: { lat: plannerOrigin.lat, lng: plannerOrigin.lng },
    map: gmap,
    icon:  plannerMarkerSVG('P', '#34C759'),
    title: 'Ponto de partida / chegada',
    zIndex: 10,
  }));

  // Marcadores numerados para cada stop
  orderedClients.forEach((c, i) => {
    plannerMarkers.push(new google.maps.Marker({
      position: { lat: c.lat, lng: c.lng },
      map: gmap,
      icon:  plannerMarkerSVG(String(i + 1), '#007AFF'),
      title: c.nome,
      zIndex: 5,
    }));
  });
}

// ── Painel de resultado ──────────────────────────────────────────────

function calcularETAs(legs, firstFixedHorario) {
  // Hora base: primeiro horário fixo do primeiro leg, ou 08:00
  let base = 8 * 60; // 08:00 em minutos
  if (firstFixedHorario) {
    const [h, m] = firstFixedHorario.split(':').map(Number);
    // Volta no tempo: subtrai duração do 1º leg para estimar partida
    const firstLegMin = Math.round((legs[0]?.duration?.value || 0) / 60);
    base = h * 60 + m - firstLegMin;
  }

  const result = [];
  let t = base;
  for (let i = 0; i < legs.length; i++) {
    const legMin = Math.round((legs[i].duration?.value || 0) / 60);
    t += legMin;
    const h = Math.floor(t / 60) % 24;
    const m = t % 60;
    const eta = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const distKm = ((legs[i].distance?.value || 0) / 1000).toFixed(1);
    result.push({
      eta,
      legDur: legs[i].duration?.text || '',
      legDist: `${distKm} km`,
    });
    t += 15; // 15 min por parada
  }
  return result;
}

function mostrarRotaResult(ordered, legs, conflicts, semGPS) {
  // Oculta painel normal
  document.getElementById('detail-empty').style.display = 'none';
  const db = document.getElementById('detail-body');
  db.style.display = 'none';

  const rr = document.getElementById('rota-result');
  rr.style.display = 'flex';

  // ETAs
  const firstFixed = ordered.find(c => c.horTipo === 'obrigatorio' && c.horario);
  const etas = calcularETAs(legs, firstFixed?.horario);

  // Totais (todos os legs exceto o último = volta para origem)
  const legsParadas = legs.slice(0, -1); // legs de origem→stop[0], stop[0]→stop[1], ...
  const legsVolta   = legs[legs.length - 1]; // último leg = stop[n-1]→origem
  const totalDist   = legs.reduce((s, l) => s + (l.distance?.value || 0), 0);
  const totalDur    = legs.reduce((s, l) => s + (l.duration?.value || 0), 0);
  const totalDistKm = (totalDist / 1000).toFixed(0);
  const totalDurMin = Math.round(totalDur / 60);
  const totalDurStr = totalDurMin >= 60
    ? `${Math.floor(totalDurMin/60)}h${String(totalDurMin%60).padStart(2,'0')}`
    : `${totalDurMin} min`;

  const dateFmt = plannerDate
    ? new Date(plannerDate + 'T12:00:00').toLocaleDateString('pt-BR',
        { weekday:'short', day:'2-digit', month:'2-digit' })
    : '';

  let conflictHTML = '';
  if (semGPS.length) {
    const nomes = semGPS.slice(0, 3).map(c => c.nome.split(' ')[0]).join(', ');
    conflictHTML += `<div class="rota-conflict">
      ⚠️ ${semGPS.length} cliente${semGPS.length>1?'s':''} sem GPS foram ignorados: ${nomes}${semGPS.length>3?' e outros':''}
    </div>`;
  }
  if (conflicts.length) {
    conflictHTML += `<div class="rota-conflict">⚠️ ${conflicts.join(' · ')}</div>`;
  }

  // Linha de parada de origem
  const origemLabel = plannerOrigin.type === 'gps' ? 'Localização atual' : plannerOrigin.label.split(',')[0];

  // Lista de stops
  const stopsHTML = [
    // Origem
    `<div class="rota-stop">
       <div class="rota-stop-num s-origem">P</div>
       <div class="rota-stop-info">
         <div class="rota-stop-nome">${origemLabel}</div>
         <div class="rota-stop-cidade">Ponto de partida</div>
       </div>
       <div class="rota-stop-meta">
         <div class="rota-stop-eta">${etas[0] ? subtrairMin(etas[0].eta, Math.round((legs[0]?.duration?.value||0)/60)) : '–'}</div>
         <div class="rota-stop-leg">saída</div>
       </div>
     </div>`,
    // Paradas
    ...ordered.map((c, i) => {
      const eta = etas[i] || {};
      let horHTML = '';
      if (c.horTipo === 'obrigatorio' && c.horario)
        horHTML = `<div class="rota-stop-hor h-obrig">🔒 Fixo: ${c.horario}</div>`;
      else if (c.horTipo === 'preferencial' && c.horario)
        horHTML = `<div class="rota-stop-hor h-pref">🕐 Pref: ${c.horario}</div>`;
      return `
        <div class="rota-stop">
          <div class="rota-stop-num">${i + 1}</div>
          <div class="rota-stop-info">
            <div class="rota-stop-nome">${c.nome}</div>
            <div class="rota-stop-cidade">${c.cidade}</div>
            ${horHTML}
          </div>
          <div class="rota-stop-meta">
            <div class="rota-stop-eta">${eta.eta || '–'}</div>
            <div class="rota-stop-leg">${eta.legDur || ''} · ${eta.legDist || ''}</div>
          </div>
        </div>`;
    }),
    // Chegada
    `<div class="rota-stop" style="opacity:.6">
       <div class="rota-stop-num s-chegada">🏠</div>
       <div class="rota-stop-info">
         <div class="rota-stop-nome">${origemLabel}</div>
         <div class="rota-stop-cidade">Chegada</div>
       </div>
       <div class="rota-stop-meta">
         <div class="rota-stop-eta">${etas[etas.length-1]?.eta || '–'}</div>
         <div class="rota-stop-leg">${legsVolta?.duration?.text || ''}</div>
       </div>
     </div>`,
  ].join('');

  // JSON compacto para passar pelo onclick sem problemas de closure
  const exportPayload = JSON.stringify(
    ordered.map(c => ({ lat: c.lat, lng: c.lng, nome: c.nome }))
  ).replace(/'/g, '&#39;');

  rr.innerHTML = `
    <div class="rota-result-header">
      <button class="rota-back-btn" onclick="voltarParaPlanner()">← Editar</button>
      <div class="rota-result-title">Rota · ${dateFmt}</div>
    </div>
    <div class="rota-summary">
      <div class="rota-summary-card">
        <div class="rota-summary-val">${ordered.length}</div>
        <div class="rota-summary-label">Paradas</div>
      </div>
      <div class="rota-summary-card">
        <div class="rota-summary-val">${totalDistKm} km</div>
        <div class="rota-summary-label">Distância</div>
      </div>
      <div class="rota-summary-card">
        <div class="rota-summary-val">${totalDurStr}</div>
        <div class="rota-summary-label">Tempo</div>
      </div>
    </div>
    ${conflictHTML}
    <div id="rota-stops">${stopsHTML}</div>
    <div class="rota-export-bar">
      <button class="btn-export-maps"
        onclick="exportarRotaGoogleMaps('${exportPayload}')">
        🗺 Abrir no Google Maps
      </button>
      <button class="btn-nova-rota-clear" onclick="resetarPlanner()">
        🔄 Nova rota
      </button>
    </div>`;
}

function subtrairMin(horaStr, minutos) {
  if (!horaStr) return '–';
  const [h, m] = horaStr.split(':').map(Number);
  const total = h * 60 + m - minutos;
  const hh = Math.floor(Math.max(total, 0) / 60) % 24;
  const mm = Math.max(total, 0) % 60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
}

function limparRota() {
  if (dirRenderer) {
    try { dirRenderer.setMap(null); dirRenderer.setMap(gmap); } catch(e) {}
  }
  clearPlannerMarkers();
  const rr = document.getElementById('rota-result');
  if (rr) rr.style.display = 'none';
  const de = document.getElementById('detail-empty');
  if (de) de.style.display = '';
}

function voltarParaPlanner() {
  limparRota();
  // Re-exibe o painel planner com seleção preservada
  renderPlannerPanel();
}

function resetarPlanner() {
  plannerSel.clear();
  plannerSearchQ = '';
  limparRota();
  renderPlannerPanel();
}

// ── Exportação para Google Maps ───────────────────────────────────────

function exportarRotaGoogleMaps(orderedJSON) {
  // orderedJSON é um JSON-string com array de {lat, lng, nome}
  // (passado via onclick para evitar closure sobre variável mutable)
  const ordered = JSON.parse(orderedJSON);
  if (!ordered.length || !plannerOrigin) return;

  // Formato: maps.google.com/maps/dir/[orig]/[s1]/[s2]/.../[orig]
  // Suporta até ~25 paradas sem problemas de URL.
  const MAX = 23; // deixa margem para orig + chegada
  const stops = ordered.slice(0, MAX);
  const truncado = ordered.length > MAX;

  const encode = (lat, lng) => `${lat},${lng}`;
  const orig   = encode(plannerOrigin.lat, plannerOrigin.lng);
  const partes  = [
    orig,
    ...stops.map(s => encode(s.lat, s.lng)),
    orig,  // retorno à origem
  ];

  const url = 'https://www.google.com/maps/dir/' + partes.join('/');

  window.open(url, '_blank', 'noopener');

  if (truncado) {
    showToast(`Abrindo com ${MAX} de ${ordered.length} paradas (limite do Google Maps).`);
  }
}

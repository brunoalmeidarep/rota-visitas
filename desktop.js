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
  red:    '61+ dias',
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

// ── FINANÇAS ─────────────────────────────────────────────────────────
let lancamentosCache  = [];
let impostosCache     = [];
let finTab            = 'lancamentos';
let finPeriodo        = 'mes';
let finPeriodoResumo  = 'mes';
let lancTipoAtual     = 'gasto';
let hotelEstrelas     = 0;
const CATEGORIAS_RECEITA = ['Comissão', 'Bônus', 'Outros'];
const CATEGORIAS_GASTO   = ['Combustível', 'Alimentação', 'Hospedagem', 'Clientes', 'Impostos', 'Outros'];

// ── GASTOS / BONIFICAÇÕES ────────────────────────────────────────────
let gastosClienteAtual = [];
let gastosFiltro       = 'todos';
let gastosExpandido    = null;
let bonifAtual         = [];
let bonifDetalheId     = null;
let representadasList  = [];
let representadasCache = [];  // para gestão de empresas (todos os campos)
let segmentosCache     = [];  // para gestão de segmentos

// ── CALENDÁRIO ───────────────────────────────────────────────────────
let calMesDesk          = new Date().getMonth();
let calAnoDesk          = new Date().getFullYear();
let calDiaSelecionadoDesk = null;
let calVisitasCacheDesk = {};

// ── IMPORTAR ─────────────────────────────────────────────────────────
let _importarFileDesk   = null;

// ── CHECK-IN PEDIDOS ─────────────────────────────────────────────────
let ciPedidos = [];   // pedidos sendo criados no check-in atual

// ── PEDIDO SEM VISITA ────────────────────────────────────────────────
let waCanal   = null; // 'whatsapp' | 'telefone'
let waPedidos = [];   // pedidos do modal WA/Tel

// ── DETALHE VISITA ───────────────────────────────────────────────────
let visitasHistoricoCache = {};  // { visitaId: visita }
let visitaDetAtual        = null;
let visitaModoEdicao      = false;
let pedidosVisitaAtual    = [];

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
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      mostrarApp();
    } else if (event === 'PASSWORD_RECOVERY') {
      // Usuário clicou no link de recuperação — mostra form nova senha
      _mostrarViewLogin('view-nova-senha');
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      mostrarLogin();
    }
  });
}

function _mostrarViewLogin(viewId) {
  document.getElementById('screen-onboarding').style.display = 'none';
  document.getElementById('app').classList.remove('visible');
  document.getElementById('screen-login').style.display = 'flex';
  ['view-login', 'view-recuperar', 'view-nova-senha'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === viewId ? 'flex' : 'none';
  });
}

function mostrarLogin() {
  _mostrarViewLogin('view-login');
}

function mostrarRecuperarSenha() {
  const email = document.getElementById('login-email')?.value.trim() || '';
  if (email) document.getElementById('rec-email').value = email;
  document.getElementById('rec-erro').textContent = '';
  document.getElementById('rec-ok').style.display = 'none';
  _mostrarViewLogin('view-recuperar');
}

async function enviarRecuperacao() {
  const email = document.getElementById('rec-email').value.trim();
  const erro  = document.getElementById('rec-erro');
  const ok    = document.getElementById('rec-ok');
  const btn   = document.getElementById('btn-rec');
  if (!email) { erro.textContent = 'Informe o e-mail.'; return; }
  btn.disabled = true; btn.textContent = 'Enviando...';
  erro.textContent = ''; ok.style.display = 'none';
  try {
    const redirectTo = window.location.href.split('?')[0].split('#')[0];
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    ok.textContent = '✓ Link enviado! Verifique sua caixa de entrada.';
    ok.style.display = 'block';
    btn.textContent = 'Reenviar';
  } catch(e) {
    erro.textContent = 'Erro: ' + (e.message || 'tente novamente.');
    btn.textContent = 'Enviar link';
  }
  btn.disabled = false;
}

async function salvarNovaSenha() {
  const senha = document.getElementById('nova-senha').value;
  const conf  = document.getElementById('nova-senha-conf').value;
  const erro  = document.getElementById('nova-senha-erro');
  const btn   = document.getElementById('btn-nova-senha');
  if (!senha || senha.length < 6) { erro.textContent = 'Senha deve ter ao menos 6 caracteres.'; return; }
  if (senha !== conf)              { erro.textContent = 'As senhas não conferem.'; return; }
  btn.disabled = true; btn.textContent = 'Salvando...';
  erro.textContent = '';
  try {
    const { error } = await sb.auth.updateUser({ password: senha });
    if (error) throw error;
    showToast('✓ Senha atualizada! Entrando...');
    // onAuthStateChange com SIGNED_IN vai chamar mostrarApp automaticamente
  } catch(e) {
    erro.textContent = 'Erro: ' + (e.message || 'tente novamente.');
    btn.disabled = false; btn.textContent = 'Salvar nova senha';
  }
}

async function mostrarApp() {
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-onboarding').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  document.getElementById('header-user').textContent = currentUser?.email ?? '';
  if (currentUser?.email === ADMIN_EMAIL) {
    document.getElementById('tab-admin-btn').style.display = 'inline-block';
  }
  await carregarRepresentante();
  // Onboarding: primeira abertura sem endereço configurado
  if (currentRep && !currentRep.onboarding_ok) {
    _mostrarOnboarding();
    return;
  }
  await loadClientes();
  carregarLembretesSupabase();
  carregarRepresentadasDesktop();
  carregarImpostos().then(verificarLembretesDesk);
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

// ── ONBOARDING ───────────────────────────────────────────────────────
function _mostrarOnboarding() {
  document.getElementById('app').classList.remove('visible');
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-onboarding').style.display = 'flex';
  // Preenche endereço base se já existir (edição do onboarding)
  if (currentRep?.endereco_base)
    document.getElementById('ob-endereco').value = currentRep.endereco_base;
  if (currentRep?.media_carro)
    document.getElementById('ob-media').value = currentRep.media_carro;
  if (currentRep?.preco_gasolina)
    document.getElementById('ob-gasolina').value = currentRep.preco_gasolina;
}

function obMaskCep(el) {
  let v = el.value.replace(/\D/g, '').slice(0, 8);
  if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5);
  el.value = v;
}

async function obBuscarCep() {
  const cep = document.getElementById('ob-cep').value.replace(/\D/g, '');
  const status = document.getElementById('ob-cep-status');
  if (cep.length !== 8) return;
  status.textContent = 'Buscando endereço...'; status.style.color = 'rgba(255,255,255,.4)';
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) { status.textContent = 'CEP não encontrado.'; return; }
    document.getElementById('ob-endereco').value =
      `${d.logradouro}, ${d.bairro}, ${d.localidade} - ${d.uf}`;
    status.textContent = '✓ Endereço encontrado'; status.style.color = '#34C759';
  } catch(e) { status.textContent = 'Erro ao buscar CEP.'; }
}

async function obSalvar() {
  const endereco = document.getElementById('ob-endereco').value.trim();
  const media    = parseFloat(document.getElementById('ob-media').value)    || 10;
  const gasolina = parseFloat(document.getElementById('ob-gasolina').value) || 6.0;
  const erro     = document.getElementById('ob-erro');
  const btn      = document.getElementById('btn-ob');

  if (!endereco) { erro.textContent = 'Informe o endereço base.'; return; }
  btn.disabled = true; btn.textContent = 'Salvando...'; erro.textContent = '';

  try {
    // Geocodifica endereço base para lat/lng
    let lat_base = currentRep?.lat_base || null;
    let lng_base = currentRep?.lng_base || null;
    const coords = await geocodeEndereco(endereco, '');
    if (coords) { lat_base = coords.lat; lng_base = coords.lng; }

    await sb.from('representantes').update({
      endereco_base: endereco,
      media_carro:   media,
      preco_gasolina: gasolina,
      onboarding_ok: true,
      lat_base, lng_base,
    }).eq('id', currentRep.id);

    currentRep.endereco_base  = endereco;
    currentRep.media_carro    = media;
    currentRep.preco_gasolina = gasolina;
    currentRep.onboarding_ok  = true;
    if (lat_base) { currentRep.lat_base = lat_base; currentRep.lng_base = lng_base; }

    document.getElementById('screen-onboarding').style.display = 'none';
    document.getElementById('app').classList.add('visible');
    await loadClientes();
    carregarLembretesSupabase();
    carregarRepresentadasDesktop();
    showToast('✓ Perfil configurado!');
  } catch(e) {
    erro.textContent = 'Erro ao salvar: ' + (e.message || '');
    btn.disabled = false; btn.textContent = 'Salvar e começar';
  }
}

function obPular() {
  // Marca onboarding como ok mesmo sem preencher (não vai pedir de novo)
  if (currentRep) {
    sb.from('representantes').update({ onboarding_ok: true }).eq('id', currentRep.id).then(() => {});
    currentRep.onboarding_ok = true;
  }
  document.getElementById('screen-onboarding').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  loadClientes();
  carregarLembretesSupabase();
  carregarRepresentadasDesktop();
}

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
      ${!visitadoHoje ? `
      <div class="det-pedido-canais">
        <button class="det-btn-canal wa" onclick="abrirPedidoSemVisita('whatsapp')">💬 WhatsApp</button>
        <button class="det-btn-canal tel" onclick="abrirPedidoSemVisita('telefone')">📞 Telefone</button>
      </div>` : ''}
    </div>

    <!-- FORM CHECK-IN (oculto até clicar) -->
    <div id="checkin-form-wrap" class="det-section" style="display:none">
      <div class="det-section-title">Registrar visita presencial</div>
      <div class="checkin-form">
        <textarea class="checkin-obs" id="checkin-obs" placeholder="Observações, próximo contato, decisões..."></textarea>
        <div class="ci-pedidos-header">
          <span class="ci-pedidos-label">Pedidos desta visita</span>
          <button type="button" class="ci-add-btn" onclick="ciAdicionarPedido()">+ Adicionar</button>
        </div>
        <div id="ci-pedidos-list"><div class="ci-empty">Nenhum pedido — clique em "+ Adicionar" para incluir.</div></div>
        <button class="det-btn primary" style="margin-top:4px" onclick="doCheckin(${c.id})">✓ Confirmar visita</button>
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

    <!-- LINKS GASTOS / BONIFICAÇÕES -->
    <div class="det-section">
      <div class="det-section-title">Financeiro do cliente</div>
      <div class="det-row-link" onclick="openGastosCliente()">
        <span class="row-icon">💸</span>
        <div class="row-body">
          <div class="row-title">Gastos com cliente</div>
          <div class="row-sub" id="p-gastos-sub">—</div>
        </div>
        <span class="row-chevron">›</span>
      </div>
      <div class="det-row-link" onclick="openBonificacoes()">
        <span class="row-icon">🎁</span>
        <div class="row-body">
          <div class="row-title">Bonificações</div>
          <div class="row-sub" id="p-bonif-sub">—</div>
        </div>
        <span id="p-bonif-badge" class="row-badge" style="display:none">R$ 0</span>
        <span class="row-chevron">›</span>
      </div>
    </div>
  `;

  carregarHistorico(c.id);
  carregarGastosResumoPerfil();
  carregarBonifResumoPerfil();
}

function toggleCheckinForm() {
  const wrap = document.getElementById('checkin-form-wrap');
  if (!wrap) return;
  const visible = wrap.style.display !== 'none';
  if (!visible) {
    ciPedidos = [];
    ciRenderPedidos();
  }
  wrap.style.display = visible ? 'none' : 'block';
  if (!visible) document.getElementById('checkin-obs')?.focus();
}

// ── CHECK-IN ─────────────────────────────────────────────────────────
async function doCheckin(id) {
  const c = clientes.find(x => x.id === id);
  if (!c || c.visitadoHoje) return;

  const obs  = document.getElementById('checkin-obs')?.value.trim() || '';
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const data = new Date().toISOString().slice(0, 10);

  // Snapshot dos pedidos antes de re-renderizar
  const pedidosSnap = [...ciPedidos];

  c.visitadoHoje = true;
  c.horaHoje     = hora;
  c.ultimaVisita = data;
  if (obs) c.ultimaObs = obs;

  localStorage.setItem(`checkin_${c.id}_${data}`, JSON.stringify({ hora, obs }));

  ciPedidos = [];
  renderList();
  renderCounters();
  renderDetail(c);
  if (gmap) {
    const m = markers[c.id];
    if (m) m.setIcon({ ...m.getIcon(), fillColor: STATUS_COLORS.today });
  }

  try {
    const repId = await getRepId();
    const totalPedidos = pedidosSnap.reduce((s, p) => s + (p.valor || 0), 0);

    const payload = {
      id_cliente:   String(c.id),
      nome_cliente: c.nome,
      cidade:       c.cidade,
      data, hora,
      obs:          obs || '',
      rep_id:       currentUser.id,
      tipo:         'visita',
    };
    if (totalPedidos > 0) payload.valor_pedido = totalPedidos;

    const { data: visitaData, error: errV } = await sb.from('visitas').insert(payload).select().single();
    if (errV) throw errV;

    // Salva pedidos se existirem
    if (pedidosSnap.length > 0 && visitaData?.id) {
      const pedidosPayload = pedidosSnap.map(p => ({
        visita_id:         visitaData.id,
        rep_id:            repId,
        cliente_id:        String(c.id),
        cliente_nome:      c.nome,
        representada_id:   p.representada_id   || null,
        representada_nome: p.representada_nome || null,
        tipo:              p.tipo   || 'pedido',
        valor:             p.valor  || 0,
        status:            p.status || null,
        tipo_contato:      null,   // presencial
      }));
      await sb.from('pedidos').insert(pedidosPayload);
    }

    await sb.from('clientes').update({ ultima_visita: data }).eq('id', String(c.id));
    showToast('✓ Visita registrada!');
  } catch(e) {
    console.warn('doCheckin:', e);
    showToast('⚠️ Salvo localmente', true);
  }
}

// ── CHECK-IN — gerenciamento de pedidos ──────────────────────────────
function ciRenderPedidos() {
  const el = document.getElementById('ci-pedidos-list');
  if (!el) return;
  if (!ciPedidos.length) {
    el.innerHTML = '<div class="ci-empty">Nenhum pedido — clique em "+ Adicionar" para incluir.</div>';
    return;
  }
  el.innerHTML = ciPedidos.map((p, idx) => {
    const repOpts = representadasList.map(r =>
      `<option value="${r.id}" data-nome="${r.nome}"${p.representada_id == r.id ? ' selected' : ''}>${r.nome}</option>`
    ).join('');
    return `
      <div class="ci-pedido-card">
        <div class="ci-pedido-row">
          <select class="ci-select" onchange="ciSetRep(${idx},this)">
            <option value="">Representada (opcional)...</option>${repOpts}
          </select>
          <button class="ci-remove-btn" onclick="ciRemoverPedido(${idx})">×</button>
        </div>
        <div class="ci-pedido-row">
          <div class="ci-tipo-btns">
            <button class="ci-tipo-btn${p.tipo==='pedido'?' active':''}" onclick="ciSetTipo(${idx},'pedido')">Pedido</button>
            <button class="ci-tipo-btn${p.tipo==='orcamento'?' active':''}" onclick="ciSetTipo(${idx},'orcamento')">Orçamento</button>
          </div>
          <input class="ci-valor-input" type="text" inputmode="decimal" placeholder="R$ 0,00"
            value="${p.valor ? p.valor.toFixed(2).replace('.',',') : ''}"
            oninput="ciSetValor(${idx},this)" onblur="maskMoeda(this)">
        </div>
        ${p.tipo==='orcamento' ? `
        <div class="ci-status-row">
          <span class="ci-status-label">Status:</span>
          <button class="ci-status-btn${p.status==='aberto'?' active':''}" onclick="ciSetStatus(${idx},'aberto')">Aberto</button>
          <button class="ci-status-btn${p.status==='ganho'?' active':''}" onclick="ciSetStatus(${idx},'ganho')">Ganho</button>
          <button class="ci-status-btn${p.status==='perdido'?' active':''}" onclick="ciSetStatus(${idx},'perdido')">Perdido</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

function ciAdicionarPedido() {
  ciPedidos.push({ representada_id: null, representada_nome: null, tipo: 'pedido', valor: 0, status: null });
  ciRenderPedidos();
}

function ciRemoverPedido(idx) {
  ciPedidos.splice(idx, 1);
  ciRenderPedidos();
}

function ciSetRep(idx, sel) {
  const opt = sel.options[sel.selectedIndex];
  ciPedidos[idx].representada_id   = sel.value || null;
  ciPedidos[idx].representada_nome = opt.dataset.nome || null;
}

function ciSetTipo(idx, tipo) {
  ciPedidos[idx].tipo   = tipo;
  ciPedidos[idx].status = tipo === 'orcamento' ? 'aberto' : null;
  ciRenderPedidos();
}

function ciSetValor(idx, el) {
  const v = el.value.replace(/\./g, '').replace(',', '.');
  ciPedidos[idx].valor = parseFloat(v) || 0;
}

function ciSetStatus(idx, status) {
  ciPedidos[idx].status = status;
  ciRenderPedidos();
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
      .limit(30);
    if (error) throw error;
    const visitas = data || [];
    if (!visitas.length) {
      el.innerHTML = `<div class="hist-obs-empty" style="padding:8px 0">Nenhuma visita registrada ainda.</div>`;
      return;
    }
    // Cacheia para o detalhe
    visitas.forEach(v => { visitasHistoricoCache[v.id] = v; });

    const hoje = new Date().toISOString().slice(0, 10);
    el.innerHTML = visitas.map(v => {
      const isHoje    = v.data === hoje;
      const diasAtras = Math.floor((Date.now() - new Date(v.data + 'T00:00:00')) / 86400000);
      const isRecent  = diasAtras <= 7;
      const dotClass  = isHoje ? 'hoje' : isRecent ? 'recent' : '';
      const icon      = isHoje ? '🟡' : isRecent ? '🟢' : '·';
      const valorStr  = v.valor_pedido
        ? `<div class="hist-valor">R$ ${parseFloat(v.valor_pedido).toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>`
        : '';
      const canalBadge = v.via_whatsapp
        ? `<span class="hist-canal-badge wa">💬 WhatsApp</span>`
        : '';
      return `
        <div class="hist-item clickable" onclick="abrirDetalheVisita('${v.id}')">
          <div class="hist-dot ${dotClass}">${icon}</div>
          <div class="hist-content">
            <div class="hist-data">${formatDate(v.data)} às ${v.hora || '—'} ${canalBadge}</div>
            ${v.obs ? `<div class="hist-obs">${v.obs}</div>` : `<div class="hist-obs-empty">Sem observação</div>`}
            ${valorStr}
          </div>
          <div class="hist-arrow">›</div>
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
  relDetalheAtivo = tipo;
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

  // Mostra botão PDF apenas para tipos exportáveis
  const exportaveis = ['visitas','vendas','top-compradores','mais-lucrativos','clientes-sumindo'];
  const btnPdf = document.getElementById('btn-pdf-relatorio');
  if (btnPdf) btnPdf.style.display = exportaveis.includes(tipo) ? '' : 'none';

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
  relDetalheAtivo = null;
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
    // Geocoding automático se não tiver GPS mas tiver endereço/cidade
    if (!novoClienteCoords && (payload.endereco || payload.cep) && cidade) {
      btn.textContent = 'Geocodificando...';
      const coords = await geocodeEndereco(payload.endereco || payload.cep, cidade);
      if (coords) { payload.lat = coords.lat; payload.lng = coords.lng; }
    }
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

// ── PDF EXPORT ────────────────────────────────────────────────────────

function _novoPDF(titulo, subtitulo) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica');

  // Cabeçalho
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(titulo, 14, 18);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(subtitulo, 14, 25);
  doc.setTextColor(0);
  return doc;
}

function _nomePeriodo() {
  if (relFiltro === 'hoje')   return 'Hoje — ' + new Date().toLocaleDateString('pt-BR');
  if (relFiltro === 'semana') return 'Esta semana';
  const n = new Date(relAno, relMes, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return n.charAt(0).toUpperCase() + n.slice(1);
}

let relDetalheAtivo = null; // tipo aberto no detalhe do relatório

function exportarPDFRelatorio() {
  if (!relDetalheAtivo) return;
  if (relDetalheAtivo === 'visitas')          exportarPDFVisitas();
  else if (relDetalheAtivo === 'vendas')      exportarPDFVendas();
  else if (relDetalheAtivo === 'top-compradores') exportarPDFTopCompradores();
  else if (relDetalheAtivo === 'clientes-sumindo') exportarPDFClientesSumindo();
  else if (relDetalheAtivo === 'mais-lucrativos')  exportarPDFMaisLucrativos();
  else showToast('Exportação não disponível para este tipo', true);
}

function exportarPDFVisitas() {
  if (!relRowsAtual.length) { showToast('Nenhuma visita para exportar', true); return; }
  const periodo = _nomePeriodo();
  const doc = _novoPDF('Relatório de Visitas', periodo);

  const rows = [...relRowsAtual].sort((a, b) => b.data.localeCompare(a.data));
  const body = rows.map(v => [
    formatDate(v.data),
    v.hora || '—',
    v.nome_cliente || '—',
    v.cidade || '—',
    v.obs ? (v.obs.length > 60 ? v.obs.slice(0, 60) + '…' : v.obs) : '',
    v.valor_pedido ? 'R$ ' + parseFloat(v.valor_pedido).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '',
  ]);

  doc.autoTable({
    startY: 30,
    head: [['Data', 'Hora', 'Cliente', 'Cidade', 'Observação', 'Valor']],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 122, 255], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 14 }, 5: { cellWidth: 26, halign: 'right' } },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });

  const total = rows.reduce((s, v) => s + (parseFloat(v.valor_pedido) || 0), 0);
  if (total > 0) {
    const y = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(`Total: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, 14, y);
  }

  doc.save(`visitas_${periodo.replace(/\s/g,'_')}.pdf`);
  showToast('✓ PDF gerado!');
}

function exportarPDFVendas() {
  const rows = relRowsAtual.filter(v => v.valor_pedido && parseFloat(v.valor_pedido) > 0);
  if (!rows.length) { showToast('Nenhuma venda com valor para exportar', true); return; }
  const periodo = _nomePeriodo();
  const doc = _novoPDF('Relatório de Vendas', periodo);

  const ordenado = [...rows].sort((a, b) => parseFloat(b.valor_pedido) - parseFloat(a.valor_pedido));
  const body = ordenado.map(v => [
    formatDate(v.data),
    v.nome_cliente || '—',
    v.cidade || '—',
    v.representada_nome || v.pedido_representada || '—',
    'R$ ' + parseFloat(v.valor_pedido).toLocaleString('pt-BR', {minimumFractionDigits:2}),
  ]);

  doc.autoTable({
    startY: 30,
    head: [['Data', 'Cliente', 'Cidade', 'Representada', 'Valor']],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [52, 199, 89], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right', cellWidth: 30 } },
    alternateRowStyles: { fillColor: [245, 250, 245] },
  });

  const total = rows.reduce((s, v) => s + parseFloat(v.valor_pedido), 0);
  const y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(`Total vendido: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`, 14, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`${rows.length} pedidos com valor`, 14, y + 6);

  doc.save(`vendas_${periodo.replace(/\s/g,'_')}.pdf`);
  showToast('✓ PDF gerado!');
}

function exportarPDFTopCompradores() {
  const comValor = relRowsAtual.filter(v => v.valor_pedido && parseFloat(v.valor_pedido) > 0);
  if (!comValor.length) { showToast('Sem dados de valor para exportar', true); return; }
  const periodo = _nomePeriodo();
  const doc = _novoPDF('Top Compradores', periodo);

  const byCliente = {};
  comValor.forEach(v => {
    const k = v.id_cliente;
    if (!byCliente[k]) byCliente[k] = { nome: v.nome_cliente, cidade: v.cidade, total: 0, pedidos: 0 };
    byCliente[k].total   += parseFloat(v.valor_pedido);
    byCliente[k].pedidos += 1;
  });
  const ranking = Object.values(byCliente).sort((a, b) => b.total - a.total);
  const body = ranking.map((r, i) => [
    `#${i+1}`,
    r.nome,
    r.cidade || '—',
    String(r.pedidos),
    'R$ ' + r.total.toLocaleString('pt-BR', {minimumFractionDigits:2}),
  ]);

  doc.autoTable({
    startY: 30,
    head: [['#', 'Cliente', 'Cidade', 'Pedidos', 'Total']],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [255, 149, 0], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10 }, 3: { halign: 'center' }, 4: { halign: 'right', cellWidth: 32 } },
    alternateRowStyles: { fillColor: [255, 249, 240] },
  });

  doc.save(`top_compradores_${periodo.replace(/\s/g,'_')}.pdf`);
  showToast('✓ PDF gerado!');
}

function exportarPDFClientesSumindo() {
  const sumindo = clientes
    .filter(c => { const st = getStatus(c); return st === 'blue' || st === 'red'; })
    .map(c => {
      const dias = c.ultimaVisita
        ? Math.floor((Date.now() - new Date(c.ultimaVisita + 'T00:00:00')) / 86400000)
        : null;
      return { ...c, dias };
    })
    .sort((a, b) => (b.dias ?? 9999) - (a.dias ?? 9999));

  if (!sumindo.length) { showToast('Nenhum cliente sumindo', true); return; }
  const doc = _novoPDF('Clientes Sumindo', new Date().toLocaleDateString('pt-BR'));

  const body = sumindo.map(c => [
    c.nome,
    c.cidade || '—',
    STATUS_LABELS[getStatus(c)],
    c.ultimaVisita ? formatDate(c.ultimaVisita) : 'Nunca',
    c.dias !== null ? `${c.dias} dias` : '—',
  ]);

  doc.autoTable({
    startY: 30,
    head: [['Cliente', 'Cidade', 'Status', 'Última visita', 'Dias sem visita']],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [255, 59, 48], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right' } },
    alternateRowStyles: { fillColor: [255, 245, 245] },
  });

  doc.save('clientes_sumindo.pdf');
  showToast('✓ PDF gerado!');
}

function exportarPDFMaisLucrativos() {
  exportarPDFTopCompradores(); // mesma lógica com nome diferente
}

async function exportarPDFGastos() {
  const c = clientes.find(x => x.id === activeId);
  if (!c) return;
  if (!gastosClienteAtual.length) { showToast('Nenhum gasto para exportar', true); return; }

  const doc = _novoPDF('Gastos com Cliente', c.nome);
  const sorted = [...gastosClienteAtual].sort((a, b) => b.data.localeCompare(a.data));
  const body = sorted.map(g => [
    new Date(g.data + 'T12:00:00').toLocaleDateString('pt-BR'),
    g.descricao || '—',
    g.url_comprovante ? 'Sim' : '—',
    'R$ ' + (g.valor || 0).toFixed(2).replace('.', ','),
  ]);

  doc.autoTable({
    startY: 30,
    head: [['Data', 'Descrição', 'NF', 'Valor']],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 122, 255], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 3: { halign: 'right', cellWidth: 28 } },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });

  const total = gastosClienteAtual.reduce((s, g) => s + (g.valor || 0), 0);
  const y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text(`Total: R$ ${total.toFixed(2).replace('.', ',')}`, 14, y);

  doc.save(`gastos_${c.nome.replace(/\s+/g,'_')}.pdf`);
  showToast('✓ PDF gerado!');
}

async function exportarPDFFinancas() {
  if (!lancamentosCache.length) { showToast('Nenhum lançamento no período', true); return; }

  const periodo = (() => {
    const p = finTab === 'resumo' ? finPeriodoResumo : finPeriodo;
    if (p === 'hoje')   return 'Hoje — ' + new Date().toLocaleDateString('pt-BR');
    if (p === 'semana') return 'Esta semana';
    return 'Este mês';
  })();
  const doc = _novoPDF('Finanças — Lançamentos', periodo);

  const sorted = [...lancamentosCache].sort((a, b) => b.data.localeCompare(a.data));
  const body = sorted.map(l => {
    const isHosp = l.categoria === 'Hospedagem';
    const desc = isHosp ? (l.hotel_nome || l.descricao || 'Hospedagem') : (l.descricao || l.categoria);
    return [
      new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR'),
      l.tipo === 'receita' ? 'Receita' : 'Gasto',
      l.categoria || '—',
      desc,
      (l.tipo === 'receita' ? '+' : '-') + 'R$ ' + Number(l.valor).toFixed(2).replace('.', ','),
    ];
  });

  doc.autoTable({
    startY: 30,
    head: [['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor']],
    body,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [52, 199, 89], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right', cellWidth: 30 } },
    alternateRowStyles: { fillColor: [245, 250, 245] },
    bodyStyles: {
      didParseCell: (data) => {
        if (data.column.index === 4 && data.cell.text[0]?.startsWith('-'))
          data.cell.styles.textColor = [255, 59, 48];
        if (data.column.index === 4 && data.cell.text[0]?.startsWith('+'))
          data.cell.styles.textColor = [52, 199, 89];
      }
    },
  });

  const receitas = lancamentosCache.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor), 0);
  const gastos   = lancamentosCache.filter(l => l.tipo === 'gasto').reduce((s, l) => s + Number(l.valor), 0);
  const saldo    = receitas - gastos;
  const y = doc.lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  doc.text(`Receitas: R$ ${receitas.toFixed(2).replace('.',',')}   Gastos: R$ ${gastos.toFixed(2).replace('.',',')}   Saldo: R$ ${saldo.toFixed(2).replace('.',',')}`, 14, y);

  doc.save(`financas_${periodo.replace(/[\s\/—]/g,'_')}.pdf`);
  showToast('✓ PDF gerado!');
}

// ── GEOCODING ─────────────────────────────────────────────────────────
function geocodeEndereco(endereco, cidade) {
  return new Promise(resolve => {
    if (!window.google?.maps?.Geocoder) { resolve(null); return; }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: `${endereco}, ${cidade}, Brasil` }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        resolve({ lat: loc.lat(), lng: loc.lng() });
      } else {
        resolve(null);
      }
    });
  });
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

// ── FINANÇAS — funções ───────────────────────────────────────────────

function dataHojeLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function formatarMoeda(v) {
  return 'R$ ' + (v||0).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}

function maskMoeda(el) {
  let v = el.value.replace(/\D/g, '');
  if (!v) { el.value = ''; return; }
  el.value = (parseInt(v,10)/100).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}

function parseMoeda(el) {
  if (!el) return 0;
  const v = (el.value||'').replace(/\./g,'').replace(',','.');
  return parseFloat(v) || 0;
}

function initFinancas() {
  setFinTab(finTab);
}

function setFinTab(tab) {
  finTab = tab;
  ['lancamentos','impostos','resumo','compromissos'].forEach(t => {
    document.getElementById(`fin-subtab-${t}`)?.classList.toggle('active', t === tab);
    const wrap = document.getElementById(`fin-wrap-${t}`);
    if (wrap) wrap.style.display = t === tab ? (t === 'lancamentos' ? 'flex' : 'block') : 'none';
  });
  const novoBtn = document.getElementById('fin-novo-btn');
  if (novoBtn) novoBtn.style.display = tab === 'lancamentos' ? 'block' : 'none';
  const pdfBtn = document.getElementById('fin-pdf-btn');
  if (pdfBtn) pdfBtn.style.display = tab === 'lancamentos' ? 'block' : 'none';
  if (tab === 'lancamentos')  carregarLancamentos().then(renderLancamentos);
  if (tab === 'impostos')     carregarImpostos().then(renderImpostos);
  if (tab === 'resumo')       carregarLancamentos().then(renderResumoFin);
  if (tab === 'compromissos') carregarCompromissos().then(renderCompromissos);
}

function setFinPeriodo(p) {
  finPeriodo = p;
  document.querySelectorAll('#fin-periodo-bar .fin-periodo-tab').forEach((b, i) => {
    b.classList.toggle('active', ['hoje','semana','mes'][i] === p);
  });
  carregarLancamentos().then(renderLancamentos);
}

function setFinPeriodoResumo(p) {
  finPeriodoResumo = p;
  document.querySelectorAll('#fin-resumo-periodo-bar .fin-periodo-tab').forEach((b, i) => {
    b.classList.toggle('active', ['hoje','semana','mes'][i] === p);
  });
  carregarLancamentos().then(renderResumoFin);
}

function getDateRange(periodo) {
  const hoje = new Date();
  const ini  = new Date(hoje);
  if (periodo === 'hoje')   { ini.setHours(0,0,0,0); }
  else if (periodo === 'semana') { ini.setDate(hoje.getDate() - hoje.getDay()); ini.setHours(0,0,0,0); }
  else { ini.setDate(1); ini.setHours(0,0,0,0); }
  return { ini: ini.toISOString().split('T')[0], fim: hoje.toISOString().split('T')[0] };
}

async function carregarLancamentos() {
  if (!currentRep) return;
  const { ini, fim } = getDateRange(finTab === 'resumo' ? finPeriodoResumo : finPeriodo);
  try {
    const { data } = await sb.from('financeiro').select('*')
      .eq('rep_id', currentRep.id).gte('data', ini).lte('data', fim)
      .order('data', { ascending: false });
    lancamentosCache = data || [];
  } catch(e) { lancamentosCache = []; }
}

function renderLancamentos() {
  const el = document.getElementById('fin-lista-lancamentos');
  if (!el) return;
  if (!lancamentosCache.length) {
    el.innerHTML = '<div style="text-align:center;padding:48px 0;color:var(--text3);font-size:14px;">Nenhum lançamento no período.</div>';
    return;
  }
  const grupos = {};
  lancamentosCache.forEach(l => { if (!grupos[l.data]) grupos[l.data] = []; grupos[l.data].push(l); });
  el.innerHTML = Object.entries(grupos).map(([data, items]) => {
    const [y,m,d] = data.split('-');
    const dataBR = `${d}/${m}/${y}`;
    return `
      <div class="fin-group-date">${dataBR}</div>
      <div class="fin-card">
        ${items.map(l => {
          const isHosp = l.categoria === 'Hospedagem';
          const desc = isHosp ? (l.hotel_nome || l.descricao || 'Hospedagem') : (l.descricao || l.categoria);
          const sub  = isHosp
            ? [l.hotel_cidade, l.hotel_estrelas ? '⭐'.repeat(l.hotel_estrelas) : ''].filter(Boolean).join(' · ')
            : (l.categoria + (l.mes_referencia ? ' · '+l.mes_referencia : ''));
          return `
          <div class="fin-item">
            <div class="fin-item-info">
              <div class="fin-item-desc">${isHosp ? '🏨 ' : ''}${desc}</div>
              <div class="fin-item-sub">${sub}</div>
            </div>
            <div style="display:flex;align-items:center">
              <div class="fin-item-val ${l.tipo}">${l.tipo==='receita'?'+':'-'}R$ ${Number(l.valor).toFixed(2).replace('.',',')}</div>
              <button class="fin-item-del" onclick="excluirLancamento('${l.id}')">×</button>
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

function renderResumoFin() {
  const { ini, fim } = getDateRange(finPeriodoResumo);
  const filtrados = lancamentosCache.filter(l => l.data >= ini && l.data <= fim);
  const receitas  = filtrados.filter(l=>l.tipo==='receita').reduce((s,l)=>s+Number(l.valor),0);
  const gastos    = filtrados.filter(l=>l.tipo==='gasto').reduce((s,l)=>s+Number(l.valor),0);
  const resultado = receitas - gastos;
  const catGastos = {};
  filtrados.filter(l=>l.tipo==='gasto').forEach(l => { catGastos[l.categoria] = (catGastos[l.categoria]||0)+Number(l.valor); });
  const el = document.getElementById('fin-resumo-conteudo');
  if (!el) return;
  el.innerHTML = `
    <div class="fin-resumo-grid">
      <div class="fin-resumo-card">
        <div class="fin-resumo-val" style="color:var(--green)">R$ ${receitas.toFixed(2).replace('.',',')}</div>
        <div class="fin-resumo-lbl">Receitas</div>
      </div>
      <div class="fin-resumo-card">
        <div class="fin-resumo-val" style="color:var(--red)">R$ ${gastos.toFixed(2).replace('.',',')}</div>
        <div class="fin-resumo-lbl">Gastos</div>
      </div>
      <div class="fin-resumo-card">
        <div class="fin-resumo-val" style="color:${resultado>=0?'var(--green)':'var(--red)'}">R$ ${Math.abs(resultado).toFixed(2).replace('.',',')}</div>
        <div class="fin-resumo-lbl">${resultado>=0?'Lucro líquido':'Prejuízo'}</div>
      </div>
    </div>
    ${Object.keys(catGastos).length ? `
      <div class="fin-group-date" style="margin-top:8px">Gastos por categoria</div>
      <div class="fin-card">
        ${Object.entries(catGastos).sort((a,b)=>b[1]-a[1]).map(([cat,val]) => `
          <div class="fin-item">
            <div class="fin-item-info">
              <div class="fin-item-desc">${cat}</div>
              <div style="height:4px;background:var(--border);border-radius:2px;margin-top:5px;overflow:hidden;">
                <div style="height:100%;background:var(--red);width:${gastos>0?Math.min(100,val/gastos*100).toFixed(0):0}%;border-radius:2px;"></div>
              </div>
            </div>
            <div class="fin-item-val gasto" style="margin-left:16px">R$ ${val.toFixed(2).replace('.',',')}</div>
          </div>`).join('')}
      </div>` : ''}`;
}

async function excluirLancamento(id) {
  if (!confirm('Excluir este lançamento?')) return;
  await sb.from('financeiro').delete().eq('id', id);
  lancamentosCache = lancamentosCache.filter(l => l.id !== id);
  renderLancamentos();
  showToast('Lançamento excluído');
}

// Modal lançamento
function abrirModalLancamento() {
  lancTipoAtual = 'gasto';
  document.getElementById('ln-btn-receita').className = 'lancamento-tipo-btn';
  document.getElementById('ln-btn-gasto').className   = 'lancamento-tipo-btn ativo-gasto';
  document.getElementById('ln-data').value      = new Date().toISOString().split('T')[0];
  document.getElementById('ln-descricao').value = '';
  document.getElementById('ln-valor').value     = '';
  document.getElementById('ln-hotel-nome').value   = '';
  document.getElementById('ln-hotel-cidade').value = '';
  hotelEstrelas = 0;
  document.querySelectorAll('#ln-estrelas-display span').forEach(s => s.textContent = '☆');
  atualizarCategoriasLancamento();
  document.getElementById('lancamento-modal').classList.add('open');
}

function fecharModalLancamento() {
  document.getElementById('lancamento-modal').classList.remove('open');
}

function setLancTipo(tipo) {
  lancTipoAtual = tipo;
  document.getElementById('ln-btn-receita').className = `lancamento-tipo-btn ${tipo==='receita'?'ativo-receita':''}`;
  document.getElementById('ln-btn-gasto').className   = `lancamento-tipo-btn ${tipo==='gasto'?'ativo-gasto':''}`;
  atualizarCategoriasLancamento();
}

function atualizarCategoriasLancamento() {
  const cats = lancTipoAtual === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_GASTO;
  const sel  = document.getElementById('ln-categoria');
  sel.innerHTML = '<option value="">Selecione...</option>' + cats.map(c => `<option>${c}</option>`).join('');
  atualizarCamposLancamento();
}

function atualizarCamposLancamento() {
  const cat    = document.getElementById('ln-categoria').value;
  const isHosp = cat === 'Hospedagem';
  document.getElementById('ln-representada-row').style.display   = cat==='Comissão' ? 'block' : 'none';
  document.getElementById('ln-mes-row').style.display            = cat==='Comissão' ? 'block' : 'none';
  document.getElementById('ln-cliente-row').style.display        = cat==='Clientes' ? 'block' : 'none';
  document.getElementById('ln-hotel-nome-row').style.display     = isHosp ? 'block' : 'none';
  document.getElementById('ln-hotel-cidade-row').style.display   = isHosp ? 'block' : 'none';
  document.getElementById('ln-hotel-estrelas-row').style.display = isHosp ? 'block' : 'none';
  const descLabel = document.getElementById('ln-descricao-label');
  if (descLabel) descLabel.textContent = isHosp ? 'Observações (opcional)' : 'Descrição';
  document.getElementById('ln-descricao').placeholder = isHosp ? 'Ex: Café da manhã ruim, quarto bom...' : 'Descreva o lançamento...';
  if (cat === 'Comissão') {
    document.getElementById('ln-representada').innerHTML =
      '<option value="">Selecione...</option>' + representadasList.map(r => `<option value="${r.id}">${r.nome}</option>`).join('');
  }
  if (cat === 'Clientes') {
    document.getElementById('ln-cliente').innerHTML =
      '<option value="">Nenhum</option>' + clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
  }
}

function setHotelEstrelas(n) {
  hotelEstrelas = n;
  document.querySelectorAll('#ln-estrelas-display span').forEach((s, i) => { s.textContent = i < n ? '⭐' : '☆'; });
}

async function salvarLancamento() {
  const cat   = document.getElementById('ln-categoria').value;
  const desc  = document.getElementById('ln-descricao').value.trim();
  const valor = parseFloat(document.getElementById('ln-valor').value);
  const data  = document.getElementById('ln-data').value;
  if (!cat)           { showToast('Selecione uma categoria', true); return; }
  if (!valor || valor <= 0) { showToast('Informe o valor', true); return; }
  if (!data)          { showToast('Informe a data', true); return; }
  if (!currentRep)    return;
  const payload = { tipo: lancTipoAtual, categoria: cat, descricao: desc||cat, valor, data, rep_id: currentRep.id };
  if (cat === 'Comissão') {
    payload.representada_id = document.getElementById('ln-representada').value || null;
    payload.mes_referencia  = document.getElementById('ln-mes').value || null;
  }
  if (cat === 'Clientes') {
    payload.cliente_id = document.getElementById('ln-cliente').value || null;
  }
  if (cat === 'Hospedagem') {
    payload.hotel_nome    = document.getElementById('ln-hotel-nome').value.trim()   || null;
    payload.hotel_cidade  = document.getElementById('ln-hotel-cidade').value.trim() || null;
    payload.hotel_estrelas = hotelEstrelas || null;
  }
  const { error } = await sb.from('financeiro').insert(payload);
  if (error) { showToast('Erro ao salvar', true); return; }
  fecharModalLancamento();
  showToast('✓ Lançamento salvo!');
  await carregarLancamentos();
  renderLancamentos();
}

// Impostos
async function carregarImpostos() {
  if (!currentRep) return;
  try {
    const { data } = await sb.from('impostos').select('*').eq('rep_id', currentRep.id).order('dia_vencimento');
    impostosCache = data || [];
  } catch(e) { impostosCache = []; }
}

function renderImpostos() {
  const el = document.getElementById('fin-impostos-lista');
  if (!el) return;
  if (!impostosCache.length) {
    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px;">Nenhum imposto cadastrado</div>';
    return;
  }
  el.innerHTML = impostosCache.map(imp => `
    <div class="fin-imposto-item">
      <div>
        <div class="fin-imposto-nome">${imp.nome}</div>
        <div class="fin-imposto-dia">Vence todo dia ${imp.dia_vencimento}</div>
      </div>
      <button class="fin-imposto-del" onclick="excluirImposto('${imp.id}')">×</button>
    </div>`).join('');
}

async function salvarImposto() {
  const nome = document.getElementById('fin-imp-nome').value.trim();
  const dia  = parseInt(document.getElementById('fin-imp-dia').value);
  if (!nome)                   { showToast('Informe o nome', true); return; }
  if (!dia || dia < 1 || dia > 31) { showToast('Dia inválido (1–31)', true); return; }
  if (!currentRep) return;
  const { error } = await sb.from('impostos').insert({ nome, dia_vencimento: dia, rep_id: currentRep.id });
  if (error) { showToast('Erro ao salvar', true); return; }
  document.getElementById('fin-imp-nome').value = '';
  document.getElementById('fin-imp-dia').value  = '';
  showToast('✓ Imposto salvo!');
  await carregarImpostos();
  renderImpostos();
}

async function excluirImposto(id) {
  if (!confirm('Excluir este imposto?')) return;
  await sb.from('impostos').delete().eq('id', id);
  impostosCache = impostosCache.filter(i => i.id !== id);
  renderImpostos();
  showToast('Imposto removido');
}

// ── CONFIGURAÇÕES ────────────────────────────────────────────────────

function toggleConfig() {
  const panel = document.getElementById('config-panel');
  if (panel.classList.contains('open')) closeConfig();
  else openConfig();
}

function openConfig() {
  // Preenche dados do usuário
  document.getElementById('cfg-user-name').textContent  = currentRep?.nome  || '—';
  document.getElementById('cfg-user-email').textContent = currentUser?.email || '—';
  // Preenche campos do perfil
  document.getElementById('cfg-endereco').value = currentRep?.endereco_base  || '';
  document.getElementById('cfg-media').value    = currentRep?.media_carro    || 10;
  document.getElementById('cfg-gasolina').value = currentRep?.preco_gasolina || 6.0;
  document.getElementById('cfg-cep-status').textContent = '';
  document.getElementById('config-panel').classList.add('open');
  document.getElementById('config-backdrop').classList.add('open');
}

function closeConfig() {
  document.getElementById('config-panel').classList.remove('open');
  document.getElementById('config-backdrop').classList.remove('open');
}

async function cfgBuscarEndereco() {
  const val = document.getElementById('cfg-endereco').value.trim();
  const st  = document.getElementById('cfg-cep-status');
  const cep = val.replace(/\D/g,'');
  if (cep.length !== 8) { st.textContent = 'Digite um CEP válido (8 dígitos)'; st.style.color = 'var(--red)'; return; }
  st.textContent = 'Buscando...'; st.style.color = 'var(--text3)';
  try {
    const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d = await r.json();
    if (d.erro) { st.textContent = 'CEP não encontrado'; st.style.color = 'var(--red)'; return; }
    document.getElementById('cfg-endereco').value = `${d.logradouro}, ${d.bairro}, ${d.localidade} - ${d.uf}`;
    st.textContent = '✓ Endereço encontrado'; st.style.color = 'var(--green)';
  } catch(e) { st.textContent = 'Erro ao buscar CEP'; st.style.color = 'var(--red)'; }
}

function exportCoords() {
  const rows = clientes
    .filter(c => c.lat && c.lng)
    .map(c => `${c.id}\t${c.nome}\t${c.lat}\t${c.lng}`);
  if (!rows.length) { showToast('Nenhuma coordenada para exportar', true); return; }
  const blob = new Blob(['id\tnome\tlat\tlng\n' + rows.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'coordenadas.tsv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`✓ ${rows.length} coordenadas exportadas`);
}

async function salvarConfigPerfil() {
  if (!currentRep) return;
  const endereco = document.getElementById('cfg-endereco').value.trim();
  const media    = parseFloat(document.getElementById('cfg-media').value)    || 10;
  const gasolina = parseFloat(document.getElementById('cfg-gasolina').value) || 6.0;
  const { error } = await sb.from('representantes')
    .update({ endereco_base: endereco, media_carro: media, preco_gasolina: gasolina })
    .eq('id', currentRep.id);
  if (error) { showToast('Erro ao salvar', true); return; }
  currentRep.endereco_base  = endereco;
  currentRep.media_carro    = media;
  currentRep.preco_gasolina = gasolina;
  showToast('✓ Perfil salvo!');
}

// ── GASTOS COM CLIENTE ────────────────────────────────────────────────

// ── PEDIDO SEM VISITA (WhatsApp / Telefone) ───────────────────────────
function abrirPedidoSemVisita(canal) {
  const c = clientes.find(x => x.id === activeId);
  if (!c) return;
  waCanal   = canal;
  waPedidos = [{ representada_id: null, representada_nome: null, tipo: 'pedido', valor: 0, status: null }];

  document.getElementById('wa-modal-titulo').textContent =
    canal === 'whatsapp' ? '💬 Pedido via WhatsApp' : '📞 Pedido via Telefone';
  document.getElementById('wa-cliente-nome').textContent = c.nome + ' · ' + c.cidade;
  document.getElementById('wa-obs').value = '';

  waRenderPedidos();
  document.getElementById('wa-modal').classList.add('open');
}

function fecharPedidoSemVisita() {
  document.getElementById('wa-modal').classList.remove('open');
  waCanal   = null;
  waPedidos = [];
}

async function salvarPedidoSemVisita() {
  const c = clientes.find(x => x.id === activeId);
  if (!c || !waCanal) return;
  if (!waPedidos.length) { showToast('Adicione ao menos um pedido', true); return; }

  const obs = document.getElementById('wa-obs')?.value.trim() || '';
  const btn = document.getElementById('wa-btn-salvar');
  btn.disabled = true; btn.textContent = 'Salvando...';

  try {
    const repId = await getRepId();
    const pedidosPayload = waPedidos.map(p => ({
      visita_id:         null,         // sem visita
      rep_id:            repId,
      cliente_id:        String(c.id),
      cliente_nome:      c.nome,
      representada_id:   p.representada_id   || null,
      representada_nome: p.representada_nome || null,
      tipo:              p.tipo   || 'pedido',
      valor:             p.valor  || 0,
      status:            p.status || null,
      tipo_contato:      waCanal,      // 'whatsapp' | 'telefone'
      obs:               obs || null,
    }));
    const { error } = await sb.from('pedidos').insert(pedidosPayload);
    if (error) throw error;
    // Regra: NÃO atualiza ultima_visita
    showToast(`✓ Pedido via ${waCanal === 'whatsapp' ? 'WhatsApp' : 'Telefone'} registrado!`);
    fecharPedidoSemVisita();
  } catch(e) {
    showToast('Erro ao salvar: ' + (e.message || ''), true);
  }
  btn.disabled = false; btn.textContent = 'Salvar pedido';
}

function waRenderPedidos() {
  const el = document.getElementById('wa-pedidos-list');
  if (!el) return;
  if (!waPedidos.length) {
    el.innerHTML = '<div class="ci-empty">Nenhum pedido adicionado.</div>';
    return;
  }
  el.innerHTML = waPedidos.map((p, idx) => {
    const repOpts = representadasList.map(r =>
      `<option value="${r.id}" data-nome="${r.nome}"${p.representada_id == r.id ? ' selected' : ''}>${r.nome}</option>`
    ).join('');
    return `
      <div class="ci-pedido-card">
        <div class="ci-pedido-row">
          <select class="ci-select" onchange="waSetRep(${idx},this)">
            <option value="">Representada (opcional)...</option>${repOpts}
          </select>
          <button class="ci-remove-btn" onclick="waRemoverPedido(${idx})">×</button>
        </div>
        <div class="ci-pedido-row">
          <div class="ci-tipo-btns">
            <button class="ci-tipo-btn${p.tipo==='pedido'?' active':''}" onclick="waSetTipo(${idx},'pedido')">Pedido</button>
            <button class="ci-tipo-btn${p.tipo==='orcamento'?' active':''}" onclick="waSetTipo(${idx},'orcamento')">Orçamento</button>
          </div>
          <input class="ci-valor-input" type="text" inputmode="decimal" placeholder="R$ 0,00"
            value="${p.valor ? p.valor.toFixed(2).replace('.',',') : ''}"
            oninput="waSetValor(${idx},this)" onblur="maskMoeda(this)">
        </div>
        ${p.tipo==='orcamento' ? `
        <div class="ci-status-row">
          <span class="ci-status-label">Status:</span>
          <button class="ci-status-btn${p.status==='aberto'?' active':''}" onclick="waSetStatus(${idx},'aberto')">Aberto</button>
          <button class="ci-status-btn${p.status==='ganho'?' active':''}" onclick="waSetStatus(${idx},'ganho')">Ganho</button>
          <button class="ci-status-btn${p.status==='perdido'?' active':''}" onclick="waSetStatus(${idx},'perdido')">Perdido</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

function waAdicionarPedido() {
  waPedidos.push({ representada_id: null, representada_nome: null, tipo: 'pedido', valor: 0, status: null });
  waRenderPedidos();
}

function waRemoverPedido(idx) {
  waPedidos.splice(idx, 1);
  waRenderPedidos();
}

function waSetRep(idx, sel) {
  const opt = sel.options[sel.selectedIndex];
  waPedidos[idx].representada_id   = sel.value || null;
  waPedidos[idx].representada_nome = opt.dataset.nome || null;
}

function waSetTipo(idx, tipo) {
  waPedidos[idx].tipo   = tipo;
  waPedidos[idx].status = tipo === 'orcamento' ? 'aberto' : null;
  waRenderPedidos();
}

function waSetValor(idx, el) {
  const v = el.value.replace(/\./g, '').replace(',', '.');
  waPedidos[idx].valor = parseFloat(v) || 0;
}

function waSetStatus(idx, status) {
  waPedidos[idx].status = status;
  waRenderPedidos();
}

async function carregarRepresentadasDesktop() {
  if (!currentRep) return;
  const { data } = await sb.from('representadas').select('id,nome').eq('rep_id', currentRep.id).order('nome');
  representadasList = data || [];
}

function showDetailOverlay(panelId) {
  document.getElementById('detail-empty').style.display = 'none';
  document.getElementById('detail-body').style.display = 'none';
  ['panel-gastos', 'panel-bonif', 'panel-visita-detalhe'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === panelId ? 'flex' : 'none';
  });
}

function fecharPainelDetalhe() {
  ['panel-gastos', 'panel-bonif', 'panel-visita-detalhe'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const c = clientes.find(x => x.id === activeId);
  if (c) renderDetail(c);
}

// ── DETALHE VISITA ───────────────────────────────────────────────────
function abrirDetalheVisita(visitaId) {
  const v = visitasHistoricoCache[visitaId];
  if (!v) return;
  visitaDetAtual    = v;
  visitaModoEdicao  = false;
  pedidosVisitaAtual = [];

  document.getElementById('vd-titulo').textContent =
    formatDate(v.data) + ' às ' + (v.hora || '—');
  document.getElementById('vd-btn-edit').style.display = '';

  showDetailOverlay('panel-visita-detalhe');
  renderDetalheVisitaView();
  carregarPedidosVisita(visitaId);
}

function fecharDetalheVisita() {
  fecharPainelDetalhe();
}

function ativarEdicaoVisita() {
  visitaModoEdicao = true;
  renderDetalheVisitaView();
  document.getElementById('vd-btn-edit').style.display = 'none';
}

function cancelarEdicaoVisita() {
  visitaModoEdicao = false;
  renderDetalheVisitaView();
  document.getElementById('vd-btn-edit').style.display = '';
}

function renderDetalheVisitaView() {
  const v    = visitaDetAtual;
  const body = document.getElementById('vd-body');
  if (!v || !body) return;

  const diasAtras = Math.floor((Date.now() - new Date(v.data + 'T00:00:00')) / 86400000);
  const diasLabel = diasAtras === 0 ? 'Hoje' : diasAtras === 1 ? 'Ontem' : `${diasAtras} dias atrás`;

  const obsHtml = visitaModoEdicao
    ? `<textarea class="checkin-obs" id="vd-obs-edit" style="min-height:70px">${v.obs || ''}</textarea>`
    : (v.obs
        ? `<div class="vd-obs-text">${v.obs}</div>`
        : `<div class="hist-obs-empty">Sem observação</div>`);

  body.innerHTML = `
    <div class="vd-meta-block">
      <div class="vd-meta"><span class="vd-meta-label">Data</span><span class="vd-meta-val">${formatDate(v.data)}</span></div>
      <div class="vd-meta"><span class="vd-meta-label">Hora</span><span class="vd-meta-val">${v.hora || '—'}</span></div>
      <div class="vd-meta"><span class="vd-meta-label">Período</span><span class="vd-meta-val" style="color:var(--text3)">${diasLabel}</span></div>
      ${v.cidade ? `<div class="vd-meta"><span class="vd-meta-label">Cidade</span><span class="vd-meta-val">${v.cidade}</span></div>` : ''}
    </div>

    <div class="det-section-title" style="margin:14px 0 6px">Observação</div>
    ${obsHtml}

    <div class="det-section-title" style="margin:14px 0 6px">Pedidos</div>
    <div id="vd-pedidos-list"><div style="font-size:12px;color:var(--text3);padding:4px 0">Carregando...</div></div>

    ${visitaModoEdicao ? `
    <div style="display:flex;gap:8px;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
      <button class="det-btn danger" style="flex:0 0 auto;background:var(--red-bg);color:var(--red)" onclick="excluirVisitaDetalhe()">🗑 Excluir</button>
      <button class="det-btn secondary" onclick="cancelarEdicaoVisita()">Cancelar</button>
      <button class="det-btn primary" onclick="salvarEdicaoVisita()">Salvar</button>
    </div>` : ''}
  `;

  if (pedidosVisitaAtual.length) renderPedidosVisita();
}

async function carregarPedidosVisita(visitaId) {
  try {
    const { data } = await sb.from('pedidos').select('*').eq('visita_id', visitaId);
    pedidosVisitaAtual = data || [];
    renderPedidosVisita();
  } catch(e) {
    const el = document.getElementById('vd-pedidos-list');
    if (el) el.innerHTML = '<div style="font-size:12px;color:var(--text3)">Erro ao carregar pedidos.</div>';
  }
}

function renderPedidosVisita() {
  const el = document.getElementById('vd-pedidos-list');
  if (!el) return;
  if (!pedidosVisitaAtual.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 0">Nenhum pedido registrado nesta visita.</div>';
    return;
  }
  el.innerHTML = pedidosVisitaAtual.map(p => {
    const valor      = p.valor ? `R$ ${parseFloat(p.valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '—';
    const tipoLabel  = p.tipo === 'orcamento' ? 'Orçamento' : 'Pedido';
    const tipoCor    = p.tipo === 'orcamento' ? 'var(--orange)' : 'var(--green)';
    const statusMap  = { aberto:'Aberto', ganho:'Ganho', perdido:'Perdido', fechado:'Fechado' };
    const statusLabel = p.status ? statusMap[p.status] || p.status : null;
    const podeConverter = p.tipo === 'orcamento' && p.status !== 'fechado';
    return `
      <div class="vd-pedido-card">
        <div class="vd-pedido-top">
          <span class="vd-pedido-tipo" style="color:${tipoCor}">${tipoLabel}</span>
          <span class="vd-pedido-valor">${valor}</span>
        </div>
        ${p.representada_nome ? `<div class="vd-pedido-rep">${p.representada_nome}</div>` : ''}
        ${statusLabel ? `<div class="vd-pedido-status">${statusLabel}</div>` : ''}
        ${visitaModoEdicao ? `
        <div class="vd-pedido-actions">
          ${podeConverter ? `<button class="gc-item-action-btn" onclick="converterOrcamento('${p.id}')">→ Converter em pedido</button>` : ''}
          <button class="gc-item-action-btn danger" onclick="excluirPedidoVisita('${p.id}')">Excluir</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

async function salvarEdicaoVisita() {
  if (!visitaDetAtual) return;
  const obs = document.getElementById('vd-obs-edit')?.value.trim() || '';
  const btns = document.querySelectorAll('#vd-body .det-btn');
  btns.forEach(b => b.disabled = true);
  try {
    await sb.from('visitas').update({ obs }).eq('id', visitaDetAtual.id);
    visitaDetAtual.obs = obs;
    visitasHistoricoCache[visitaDetAtual.id] = { ...visitaDetAtual };
    visitaModoEdicao = false;
    renderDetalheVisitaView();
    document.getElementById('vd-btn-edit').style.display = '';
    renderPedidosVisita();
    showToast('✓ Visita atualizada!');
  } catch(e) {
    showToast('Erro ao salvar', true);
    btns.forEach(b => b.disabled = false);
  }
}

async function excluirVisitaDetalhe() {
  if (!visitaDetAtual) return;
  if (!confirm('Excluir esta visita? A ação não pode ser desfeita.')) return;
  try {
    await sb.from('pedidos').delete().eq('visita_id', visitaDetAtual.id);
    await sb.from('visitas').delete().eq('id', visitaDetAtual.id);
    delete visitasHistoricoCache[visitaDetAtual.id];
    // Atualiza ultima_visita do cliente local
    const c = clientes.find(x => x.id === activeId);
    if (c) {
      const { data: last } = await sb.from('visitas')
        .select('data').eq('id_cliente', String(activeId))
        .order('data', { ascending: false }).limit(1).maybeSingle();
      c.ultimaVisita = last?.data || null;
      c.visitadoHoje = false;
    }
    showToast('✓ Visita excluída');
    renderList();
    renderCounters();
    fecharDetalheVisita();
  } catch(e) {
    showToast('Erro ao excluir', true);
  }
}

async function excluirPedidoVisita(pedidoId) {
  if (!confirm('Excluir este pedido?')) return;
  try {
    await sb.from('pedidos').delete().eq('id', pedidoId);
    pedidosVisitaAtual = pedidosVisitaAtual.filter(p => p.id !== pedidoId);
    renderPedidosVisita();
    showToast('✓ Pedido excluído');
  } catch(e) {
    showToast('Erro ao excluir pedido', true);
  }
}

async function converterOrcamento(pedidoId) {
  try {
    await sb.from('pedidos').update({ tipo: 'pedido', status: 'fechado' }).eq('id', pedidoId);
    const idx = pedidosVisitaAtual.findIndex(p => p.id === pedidoId);
    if (idx !== -1) { pedidosVisitaAtual[idx].tipo = 'pedido'; pedidosVisitaAtual[idx].status = 'fechado'; }
    renderPedidosVisita();
    showToast('✓ Convertido para pedido!');
  } catch(e) {
    showToast('Erro ao converter', true);
  }
}

function openGastosCliente() {
  if (!activeId) return;
  const c = clientes.find(x => x.id === activeId);
  if (!c) return;
  const nomeBase = c.nome.replace(/\s*\(.*?\)/, '').trim();
  document.getElementById('gc-titulo').textContent = 'Gastos — ' + nomeBase;
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('gc-data').value = hoje;
  document.getElementById('gc-form').style.display = 'none';
  document.getElementById('gc-nf-label').textContent = 'Anexar NF (opcional)';
  document.getElementById('gc-desc').value = '';
  document.getElementById('gc-valor').value = '';
  document.getElementById('gc-nf-input').value = '';
  gastosFiltro = 'todos';
  ['todos','mes','ano'].forEach(f => document.getElementById('gc-filter-'+f)?.classList.toggle('active', f==='todos'));
  showDetailOverlay('panel-gastos');
  carregarGastos();
}

function toggleGastoForm() {
  const f = document.getElementById('gc-form');
  if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
}

function gcNfSelecionada(input) {
  const lbl = document.getElementById('gc-nf-label');
  if (input.files[0]) lbl.textContent = '✓ ' + input.files[0].name;
}

function setGastoFilter(f) {
  gastosFiltro = f;
  ['todos','mes','ano'].forEach(id => document.getElementById('gc-filter-'+id)?.classList.toggle('active', id===f));
  renderGastos();
}

async function carregarGastos() {
  if (!currentRep || !activeId) return;
  const gcList = document.getElementById('gc-list');
  if (gcList) gcList.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Carregando...</div>';
  const { data } = await sb.from('financeiro')
    .select('*')
    .eq('rep_id', currentRep.id)
    .eq('categoria', 'clientes')
    .eq('cliente_id', String(activeId))
    .order('data', { ascending: false });
  gastosClienteAtual = data || [];
  renderGastos();
}

function renderGastos() {
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  const mesAtual = hoje.getMonth();
  let lista = gastosClienteAtual;
  if (gastosFiltro === 'mes') {
    lista = lista.filter(g => { const d = new Date(g.data); return d.getFullYear()===anoAtual && d.getMonth()===mesAtual; });
  } else if (gastosFiltro === 'ano') {
    lista = lista.filter(g => new Date(g.data).getFullYear()===anoAtual);
  }
  const total = gastosClienteAtual.reduce((s,g) => s+(g.valor||0), 0);
  const totalMes = gastosClienteAtual.filter(g => { const d=new Date(g.data); return d.getFullYear()===anoAtual && d.getMonth()===mesAtual; }).reduce((s,g)=>s+(g.valor||0),0);
  document.getElementById('gc-total').textContent = 'R$ '+total.toFixed(2).replace('.',',');
  document.getElementById('gc-mes').textContent   = 'R$ '+totalMes.toFixed(2).replace('.',',');
  document.getElementById('gc-qtd').textContent   = gastosClienteAtual.length;
  const el = document.getElementById('gc-list');
  if (!el) return;
  if (!lista.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0">Nenhum gasto registrado</div>'; return; }
  const grupos = {};
  lista.forEach(g => {
    const d = new Date(g.data+'T12:00:00');
    const key = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const label = d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    if (!grupos[key]) grupos[key] = {label, items:[]};
    grupos[key].items.push(g);
  });
  let html = '';
  Object.keys(grupos).sort((a,b)=>b.localeCompare(a)).forEach(key => {
    const g = grupos[key];
    html += `<div class="gc-month-title">${g.label}</div>`;
    g.items.forEach(item => {
      const exp = gastosExpandido === item.id;
      const dataPt = new Date(item.data+'T12:00:00').toLocaleDateString('pt-BR');
      html += `<div class="gc-item">
        <div class="gc-item-row" onclick="toggleGastoItem('${item.id}')">
          <div class="gc-item-main">
            <div class="gc-item-desc">${item.descricao||'Sem descrição'}</div>
            <div class="gc-item-meta"><span>${dataPt}</span>${item.url_comprovante?'<span>📎 NF</span>':''}</div>
          </div>
          <div class="gc-item-val">R$ ${(item.valor||0).toFixed(2).replace('.',',')}</div>
        </div>
        ${exp?`<div class="gc-item-actions">
          ${item.url_comprovante?`<button class="gc-item-action-btn" onclick="window.open('${item.url_comprovante}','_blank')">📎 Ver NF</button>`:''}
          <button class="gc-item-action-btn danger" onclick="excluirGasto('${item.id}')">Excluir</button>
        </div>
        <div class="gc-item-footer">📊 Alimentou Finanças → Gastos com Clientes</div>`:''}
      </div>`;
    });
  });
  el.innerHTML = html;
}

function toggleGastoItem(id) {
  gastosExpandido = gastosExpandido === id ? null : id;
  renderGastos();
}

async function salvarGasto() {
  if (!activeId || !currentRep) return;
  const c = clientes.find(x => x.id === activeId);
  if (!c) return;
  const descricao = document.getElementById('gc-desc').value.trim();
  const valor     = parseFloat(document.getElementById('gc-valor').value);
  const data      = document.getElementById('gc-data').value;
  const nfFile    = document.getElementById('gc-nf-input').files[0];
  if (!descricao) { showToast('Informe a descrição', true); return; }
  if (!valor || isNaN(valor)) { showToast('Informe o valor', true); return; }
  let url_comprovante = null;
  if (nfFile) {
    const path = `${currentRep.id}/gastos/${Date.now()}_${nfFile.name}`;
    const { error: upErr } = await sb.storage.from('pedidos').upload(path, nfFile);
    if (!upErr) {
      const { data: urlData } = sb.storage.from('pedidos').getPublicUrl(path);
      url_comprovante = urlData.publicUrl;
    }
  }
  const { error } = await sb.from('financeiro').insert({
    tipo: 'despesa', categoria: 'clientes',
    descricao, valor, data: data || new Date().toISOString().split('T')[0],
    cliente_id: String(activeId), cliente_nome: c.nome,
    rep_id: currentRep.id,
    url_comprovante
  });
  if (error) { showToast('Erro ao salvar', true); return; }
  showToast('Gasto registrado');
  document.getElementById('gc-form').style.display = 'none';
  document.getElementById('gc-desc').value = '';
  document.getElementById('gc-valor').value = '';
  document.getElementById('gc-nf-input').value = '';
  document.getElementById('gc-nf-label').textContent = 'Anexar NF (opcional)';
  carregarGastos();
}

async function excluirGasto(id) {
  if (!confirm('Excluir este gasto?')) return;
  await sb.from('financeiro').delete().eq('id', id);
  gastosClienteAtual = gastosClienteAtual.filter(g => g.id !== id);
  gastosExpandido = null;
  renderGastos();
}

async function carregarGastosResumoPerfil() {
  if (!currentRep || !activeId) return;
  const sub = document.getElementById('p-gastos-sub');
  if (!sub) return;
  const { data } = await sb.from('financeiro').select('valor').eq('rep_id', currentRep.id).eq('categoria', 'clientes').eq('cliente_id', String(activeId));
  if (!data || !data.length) { sub.textContent = 'Nenhum gasto'; return; }
  const total = data.reduce((s,g)=>s+(g.valor||0),0);
  sub.textContent = data.length+' registro'+(data.length===1?'':'s')+' · R$ '+total.toFixed(2).replace('.',',');
}

// ── BONIFICAÇÕES ──────────────────────────────────────────────────────

function openBonificacoes() {
  if (!activeId) return;
  const c = clientes.find(x => x.id === activeId);
  if (!c) return;
  const nomeBase = c.nome.replace(/\s*\(.*?\)/, '').trim();
  document.getElementById('bonif-titulo').textContent = 'Bonificações — ' + nomeBase;
  document.getElementById('bonif-form').style.display = 'none';
  document.getElementById('bonif-motivo').value = '';
  document.getElementById('bonif-valor').value = '';
  document.getElementById('bonif-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('bonif-edit-id').value = '';
  // garante que lista está visível e detalhe oculto
  document.getElementById('bonif-lista-view').style.display = 'flex';
  document.getElementById('bonif-detalhe-view').style.display = 'none';
  bonifDetalheId = null;
  // preenche select de representadas
  const sel = document.getElementById('bonif-representada');
  sel.innerHTML = '<option value="">Selecionar empresa...</option>' +
    representadasList.map(r => `<option value="${r.id}">${r.nome}</option>`).join('');
  showDetailOverlay('panel-bonif');
  carregarBonificacoes();
}

function toggleBonifForm() {
  const f = document.getElementById('bonif-form');
  if (!f) return;
  const show = f.style.display === 'none';
  f.style.display = show ? 'block' : 'none';
  if (show) {
    document.getElementById('bonif-motivo').value = '';
    document.getElementById('bonif-valor').value = '';
    document.getElementById('bonif-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('bonif-edit-id').value = '';
  }
}

async function carregarBonificacoes() {
  if (!currentRep || !activeId) return;
  const { data } = await sb.from('bonificacoes')
    .select('*').eq('rep_id', currentRep.id).eq('cliente_id', String(activeId))
    .order('created_at', { ascending: false });
  bonifAtual = data || [];
  renderBonificacoes();
}

function renderBonificacoes() {
  const andamentoEl  = document.getElementById('bonif-andamento');
  const concluidasEl = document.getElementById('bonif-concluidas');
  if (!andamentoEl || !concluidasEl) return;
  const andamento  = bonifAtual.filter(b => b.status === 'em_andamento');
  const concluidas = bonifAtual.filter(b => b.status === 'concluida');
  const renderLista = (lista, elId) => {
    const el = document.getElementById(elId);
    if (!lista.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 0 12px">Nenhuma</div>'; return; }
    el.innerHTML = lista.map(b => {
      const pagamentos = (b.parcelas || []).filter(p => p.recebido);
      const recebido   = pagamentos.reduce((s,p) => s+(p.valor||0), 0);
      const pendente   = Math.max(0, (b.valor_total||0) - recebido);
      const pct        = b.valor_total ? Math.min(100, Math.round(recebido/b.valor_total*100)) : 0;
      return `<div class="gc-item" style="margin-bottom:8px">
        <div class="gc-item-row" onclick="abrirBonifDetalhe('${b.id}')">
          <div class="gc-item-main">
            <div class="gc-item-desc">${b.motivo}</div>
            <div class="gc-item-meta">
              ${b.representada_nome?`<span>${b.representada_nome}</span>`:''}
              <span>${pagamentos.length} pagamento${pagamentos.length!==1?'s':''}</span>
            </div>
            <div class="bonif-progress-bar"><div class="bonif-progress-fill" style="width:${pct}%"></div></div>
            <div style="font-size:11px;display:flex;gap:10px;margin-top:2px">
              <span style="color:var(--green)">✓ ${formatarMoeda(recebido)}</span>
              ${pendente>0?`<span style="color:var(--orange)">pendente ${formatarMoeda(pendente)}</span>`:''}
            </div>
          </div>
          <div style="text-align:right;margin-left:10px;min-width:0">
            <div style="font-size:13px;font-weight:800;white-space:nowrap">${formatarMoeda(b.valor_total||0)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">${pct}%</div>
          </div>
        </div>
      </div>`;
    }).join('');
  };
  renderLista(andamento, 'bonif-andamento');
  renderLista(concluidas, 'bonif-concluidas');
}

function abrirBonifDetalhe(id) {
  bonifDetalheId = id;
  renderBonifDetalhe();
  document.getElementById('bonif-lista-view').style.display = 'none';
  document.getElementById('bonif-detalhe-view').style.display = 'flex';
}

function fecharBonifDetalhe() {
  document.getElementById('bonif-detalhe-view').style.display = 'none';
  document.getElementById('bonif-lista-view').style.display = 'flex';
  bonifDetalheId = null;
}

function renderBonifDetalhe() {
  const b = bonifAtual.find(x => x.id === bonifDetalheId);
  if (!b) return;
  const pagamentos     = (b.parcelas || []).filter(p => p.recebido);
  const totalRecebido  = pagamentos.reduce((s,p) => s+(p.valor||0), 0);
  const totalAcordado  = b.valor_total || 0;
  const saldoPendente  = totalAcordado - totalRecebido;
  const pct = totalAcordado ? Math.min(100, Math.round(totalRecebido/totalAcordado*100)) : 0;
  document.getElementById('bonif-detalhe-titulo').textContent = b.motivo;
  let html = `
    <div style="margin-bottom:14px">
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <div class="gc-summary-card" style="flex:1"><div class="gc-summary-val" style="color:var(--blue)">${formatarMoeda(totalAcordado)}</div><div class="gc-summary-lbl">Acordado</div></div>
        <div class="gc-summary-card" style="flex:1"><div class="gc-summary-val" style="color:var(--green)">${formatarMoeda(totalRecebido)}</div><div class="gc-summary-lbl">Recebido</div></div>
        <div class="gc-summary-card" style="flex:1"><div class="gc-summary-val" style="color:var(--orange)">${formatarMoeda(Math.max(0,saldoPendente))}</div><div class="gc-summary-lbl">Pendente</div></div>
      </div>
      <div class="bonif-progress-bar"><div class="bonif-progress-fill" style="width:${pct}%"></div></div>
      <div style="font-size:11px;color:var(--text3);text-align:right;margin-top:3px">${pct}% recebido</div>
      ${totalRecebido > totalAcordado && totalAcordado > 0
        ? `<div style="color:var(--green);font-size:12px;font-weight:700;margin-top:8px;padding:8px;background:var(--green-bg);border-radius:8px;text-align:center">Quitada ✓ — ${formatarMoeda(totalRecebido-totalAcordado)} a mais</div>`
        : ''}
    </div>
    <div class="det-section-title">Pagamentos</div>`;
  if (!pagamentos.length) {
    html += '<div style="font-size:12px;color:var(--text3);padding:4px 0 12px">Nenhum pagamento registrado</div>';
  } else {
    html += pagamentos.map((p, i) => {
      const dataFmt = p.data_recebimento ? new Date(p.data_recebimento+'T12:00:00').toLocaleDateString('pt-BR') : '—';
      return `<div style="display:flex;align-items:center;padding:8px 0;border-top:1px solid var(--border);gap:8px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${formatarMoeda(p.valor||0)}</div>
          <div style="font-size:11px;color:var(--text3)">${dataFmt}</div>
        </div>
        <button class="gestao-btn-sm" style="color:var(--red);border-color:var(--red-bg);font-size:11px;padding:3px 8px" onclick="removerPagamentoBonif(${i})">×</button>
      </div>`;
    }).join('');
  }
  html += `<button class="cfg-save-btn" style="margin-top:16px" onclick="abrirModalPagamentoBonif()">+ Registrar pagamento</button>`;
  document.getElementById('bonif-detalhe-body').innerHTML = html;
}

function abrirModalPagamentoBonif() {
  document.getElementById('bonif-pag-data').value = new Date().toISOString().split('T')[0];
  document.getElementById('bonif-pag-valor').value = '';
  const modal = document.getElementById('bonif-modal-pagamento');
  modal.style.display = 'flex';
}

function fecharModalPagamentoBonif() {
  document.getElementById('bonif-modal-pagamento').style.display = 'none';
}

async function confirmarPagamentoBonif() {
  const valorEl = document.getElementById('bonif-pag-valor');
  const valor   = parseFloat(valorEl?.value) || 0;
  const data    = document.getElementById('bonif-pag-data').value;
  if (!valor || valor <= 0) { showToast('⚠️ Informe o valor', true); return; }
  if (!data)                { showToast('⚠️ Informe a data', true); return; }
  const b = bonifAtual.find(x => x.id === bonifDetalheId);
  if (!b) return;
  const novasParcelas = [...(b.parcelas||[]), {valor, data_recebimento: data, recebido: true}];
  const totalRec  = novasParcelas.filter(p=>p.recebido).reduce((s,p)=>s+(p.valor||0),0);
  const novoStatus = totalRec >= (b.valor_total||0) ? 'concluida' : 'em_andamento';
  const { error } = await sb.from('bonificacoes').update({parcelas: novasParcelas, status: novoStatus}).eq('id', bonifDetalheId);
  if (error) { showToast('❌ Erro ao registrar', true); return; }
  if (currentRep) {
    const c = clientes.find(x => x.id === activeId);
    await sb.from('financeiro').insert({
      tipo: 'receita', categoria: 'bonificacao',
      descricao: `Bonif: ${b.motivo}${b.representada_nome?' ('+b.representada_nome+')':''}`,
      valor, data,
      cliente_id: String(activeId), cliente_nome: c?.nome||'',
      representada_id: b.representada_id||null,
      rep_id: currentRep.id
    });
  }
  fecharModalPagamentoBonif();
  showToast('✓ Pagamento registrado!');
  await carregarBonificacoes();
  renderBonifDetalhe();
}

async function removerPagamentoBonif(idx) {
  if (!confirm('Remover este pagamento?')) return;
  const b = bonifAtual.find(x => x.id === bonifDetalheId);
  if (!b) return;
  const recebidas    = (b.parcelas||[]).filter(p => p.recebido);
  recebidas.splice(idx, 1);
  const naoRecebidas = (b.parcelas||[]).filter(p => !p.recebido);
  const novasParcelas = [...naoRecebidas, ...recebidas];
  const totalRec  = recebidas.reduce((s,p) => s+(p.valor||0), 0);
  const novoStatus = totalRec >= (b.valor_total||0) && recebidas.length > 0 ? 'concluida' : 'em_andamento';
  const { error } = await sb.from('bonificacoes').update({parcelas: novasParcelas, status: novoStatus}).eq('id', bonifDetalheId);
  if (error) { showToast('❌ Erro ao remover', true); return; }
  showToast('Pagamento removido');
  await carregarBonificacoes();
  renderBonifDetalhe();
}

async function salvarBonificacao() {
  if (!activeId || !currentUser) return;
  const c = clientes.find(x => x.id === activeId);
  if (!c) return;
  const motivo        = document.getElementById('bonif-motivo').value.trim();
  const valorTotal    = parseFloat(document.getElementById('bonif-valor').value);
  const dataCombinada = document.getElementById('bonif-data').value;
  const repSel        = document.getElementById('bonif-representada');
  const representadaId   = repSel?.value || null;
  const representadaNome = representadaId ? repSel?.options[repSel.selectedIndex]?.text : null;
  const editId = document.getElementById('bonif-edit-id').value;
  if (!motivo)                        { showToast('⚠️ Informe o motivo', true); return; }
  if (!valorTotal || isNaN(valorTotal)) { showToast('⚠️ Informe o valor', true); return; }
  let error;
  if (editId) {
    const existente = bonifAtual.find(b => b.id === editId);
    const parcelas  = existente?.parcelas || [];
    const totalRec  = parcelas.filter(p=>p.recebido).reduce((s,p)=>s+(p.valor||0),0);
    const novoStatus = totalRec >= valorTotal && parcelas.filter(p=>p.recebido).length > 0 ? 'concluida' : 'em_andamento';
    ({ error } = await sb.from('bonificacoes').update({
      representada_id: representadaId||null, representada_nome: representadaNome||null,
      motivo, valor_total: valorTotal, data_combinada: dataCombinada||null,
      status: novoStatus
    }).eq('id', editId));
    if (!error) showToast('✓ Bonificação atualizada');
  } else {
    ({ error } = await sb.from('bonificacoes').insert({
      rep_id: currentRep.id,
      cliente_id: String(activeId), cliente_nome: c.nome,
      representada_id: representadaId||null, representada_nome: representadaNome||null,
      motivo, valor_total: valorTotal,
      data_combinada: dataCombinada||null,
      parcelas: [], status: 'em_andamento'
    }));
    if (!error) showToast('✓ Bonificação registrada');
  }
  if (error) { showToast('❌ Erro ao salvar', true); console.error(error); return; }
  document.getElementById('bonif-form').style.display = 'none';
  carregarBonificacoes();
}

async function carregarBonifResumoPerfil() {
  if (!currentUser || !activeId) return;
  const sub   = document.getElementById('p-bonif-sub');
  const badge = document.getElementById('p-bonif-badge');
  if (!sub) return;
  const { data } = await sb.from('bonificacoes').select('parcelas,valor_total,status').eq('rep_id', currentRep.id).eq('cliente_id', String(activeId));
  if (!data || !data.length) { sub.textContent = 'Nenhuma bonificação'; if(badge) badge.style.display='none'; return; }
  let pendente = 0;
  data.forEach(b => {
    const recebido = (b.parcelas||[]).filter(p=>p.recebido).reduce((s,p)=>s+(p.valor||0),0);
    pendente += Math.max(0, (b.valor_total||0) - recebido);
  });
  sub.textContent = data.length+' bonificaç'+(data.length===1?'ão':'ões');
  if (badge) {
    if (pendente > 0) { badge.textContent = formatarMoeda(pendente); badge.style.display = 'inline-flex'; }
    else badge.style.display = 'none';
  }
}

// ── COMPROMISSOS (Parcelas / Empréstimos) ─────────────────────────────

let compromissosCache = [];
let compSubTab = 'parcelas';

async function carregarCompromissos() {
  if (!currentRep) return;
  try {
    const { data } = await sb.from('compromissos').select('*')
      .eq('rep_id', currentRep.id).order('created_at', { ascending: true });
    compromissosCache = data || [];
  } catch(e) { compromissosCache = []; }
}

function calcProximoVencimento(dataInicio, parcelaAtual) {
  const [y, m, d] = dataInicio.split('-').map(Number);
  const date = new Date(y, m - 1 + (parcelaAtual - 1), d);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function setCompSubTab(tab) {
  compSubTab = tab;
  ['parcelas','emprestimos'].forEach(t => {
    document.getElementById(`comp-tab-${t}`)?.classList.toggle('active', t === tab);
  });
  if (document.getElementById('comp-form')?.style.display === 'block') _atualizarFormCompCampos();
  renderCompromissos();
}

function _atualizarFormCompCampos() {
  const tipoParcela = compSubTab === 'parcelas';
  document.getElementById('comp-campo-categoria').style.display     = tipoParcela ? 'block' : 'none';
  document.getElementById('comp-campo-banco').style.display         = tipoParcela ? 'none'  : 'block';
  document.getElementById('comp-campo-valor-parcela').style.display = tipoParcela ? 'none'  : 'block';
  document.getElementById('comp-campo-taxa').style.display          = tipoParcela ? 'none'  : 'block';
  document.getElementById('comp-form-titulo').textContent = tipoParcela ? 'Nova Parcela' : 'Novo Empréstimo';
}

function renderCompromissos() {
  const tipo = compSubTab === 'parcelas' ? 'parcela' : 'emprestimo';
  const items = compromissosCache.filter(c => c.tipo === tipo);
  const hoje = new Date();
  const anoAtual = hoje.getFullYear(), mesAtual = hoje.getMonth() + 1;

  const resumoEl = document.getElementById('comp-resumo');
  if (resumoEl) {
    const ativos = items.filter(c => (c.parcela_atual||1) <= (c.total_parcelas||0));
    const estesMes = ativos.filter(c => {
      if (!c.data_inicio) return false;
      const v = calcProximoVencimento(c.data_inicio, c.parcela_atual||1);
      const [vy,vm] = v.split('-').map(Number);
      return vy === anoAtual && vm === mesAtual;
    });
    const valEstesMes = estesMes.reduce((s,c) => s+(c.valor_parcela||0), 0);
    const totalRestante = ativos.reduce((s,c) => s + Math.max(0,(c.total_parcelas||0)-(c.parcela_atual||1)+1)*(c.valor_parcela||0), 0);
    if (tipo === 'parcela') {
      resumoEl.innerHTML = `
        <div class="fin-resumo-card" style="flex:1"><div class="fin-resumo-val" style="color:var(--red)">R$ ${totalRestante.toFixed(2).replace('.',',')}</div><div class="fin-resumo-lbl">Total restante</div></div>
        <div class="fin-resumo-card" style="flex:1"><div class="fin-resumo-val" style="color:var(--orange)">R$ ${valEstesMes.toFixed(2).replace('.',',')}</div><div class="fin-resumo-lbl">Este mês</div></div>`;
    } else {
      resumoEl.innerHTML = `
        <div class="fin-resumo-card" style="flex:1"><div class="fin-resumo-val" style="color:var(--red)">R$ ${totalRestante.toFixed(2).replace('.',',')}</div><div class="fin-resumo-lbl">Saldo devedor</div></div>
        <div class="fin-resumo-card" style="flex:1"><div class="fin-resumo-val" style="color:var(--orange)">R$ ${valEstesMes.toFixed(2).replace('.',',')}</div><div class="fin-resumo-lbl">Este mês</div></div>`;
    }
  }

  const lista = document.getElementById('comp-lista');
  if (!lista) return;
  if (!items.length) {
    lista.innerHTML = `<div style="text-align:center;padding:40px 0;color:var(--text3);font-size:13px;">${tipo==='parcela'?'Nenhuma parcela cadastrada.':'Nenhum empréstimo cadastrado.'}</div>`;
    return;
  }
  lista.innerHTML = items.map(c => {
    const totalP = c.total_parcelas || 1;
    const atual  = c.parcela_atual || 1;
    const pagas  = atual - 1;
    const pct    = Math.min(100, Math.round(pagas / totalP * 100));
    const restantes = Math.max(0, totalP - atual + 1);
    const saldoRest = restantes * (c.valor_parcela||0);
    const concluido = atual > totalP;
    const venc   = (!concluido && c.data_inicio) ? calcProximoVencimento(c.data_inicio, atual) : null;
    const [vy,vm] = venc ? venc.split('-').map(Number) : [0,0];
    const venceEsteMes = vy===anoAtual && vm===mesAtual;
    const [vy2,vm2,vd2] = venc ? venc.split('-') : ['','',''];
    const vencBR = venc ? `${vd2}/${vm2}/${vy2}` : '—';
    return `<div class="fin-card" style="margin-bottom:10px;${concluido?'opacity:.55':''}">
      <div class="fin-item" style="align-items:flex-start;padding:12px 14px;">
        <div class="fin-item-info" style="flex:1">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px;">
            <span class="fin-item-desc">${c.descricao}</span>
            ${venceEsteMes?'<span style="background:var(--orange);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;">Este mês</span>':''}
            ${concluido?'<span style="background:var(--green);color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;">✓ Quitado</span>':''}
          </div>
          <div class="fin-item-sub">${tipo==='parcela'?(c.categoria||''):(c.banco||'')}${(tipo==='emprestimo'&&c.taxa_juros)?` · ${c.taxa_juros}% a.m.`:''}</div>
          <div class="bonif-progress-bar" style="margin-top:5px"><div class="bonif-progress-fill" style="width:${pct}%"></div></div>
          <div style="font-size:11px;color:var(--text3);margin-top:3px;">${pagas}/${totalP} parcelas${!concluido?` · Próx.: ${vencBR}`:''}</div>
        </div>
        <div style="text-align:right;margin-left:16px;flex-shrink:0;">
          <div style="font-size:14px;font-weight:800;">R$ ${(c.valor_parcela||0).toFixed(2).replace('.',',')}<span style="font-size:10px;font-weight:400;color:var(--text3)">/mês</span></div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px;">Restante: R$ ${saldoRest.toFixed(2).replace('.',',')}</div>
          <div style="display:flex;gap:6px;margin-top:8px;justify-content:flex-end;">
            ${!concluido?`<button onclick="avancarParcelaComp('${c.id}')" style="background:var(--green);color:#fff;border:none;border-radius:6px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;">✓ Pago</button>`:''}
            <button onclick="deletarCompromisso('${c.id}')" style="background:none;border:1.5px solid var(--border);border-radius:6px;padding:5px 8px;font-size:13px;color:var(--text3);cursor:pointer;">🗑</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function abrirFormCompromisso() {
  document.getElementById('comp-form').style.display = 'block';
  document.getElementById('comp-add-btn').style.display = 'none';
  const di = document.getElementById('comp-data-inicio');
  if (di && !di.value) di.value = dataHojeLocal();
  const pa = document.getElementById('comp-parcela-atual');
  if (pa && !pa.value) pa.value = '1';
  _atualizarFormCompCampos();
}

function fecharFormCompromisso() {
  document.getElementById('comp-form').style.display = 'none';
  document.getElementById('comp-add-btn').style.display = 'block';
}

async function salvarCompromisso() {
  const tipo          = compSubTab === 'parcelas' ? 'parcela' : 'emprestimo';
  const desc          = document.getElementById('comp-desc')?.value.trim();
  const totalParcelas = parseInt(document.getElementById('comp-total-parcelas')?.value) || 0;
  const parcelaAtual  = parseInt(document.getElementById('comp-parcela-atual')?.value) || 1;
  const dataInicio    = document.getElementById('comp-data-inicio')?.value;
  const valorTotal    = parseMoeda(document.getElementById('comp-valor-total'));
  if (!desc || !totalParcelas || !dataInicio) { showToast('Preencha os campos obrigatórios', true); return; }
  let valorParcela;
  if (tipo === 'parcela') {
    valorParcela = valorTotal ? valorTotal / totalParcelas : 0;
    if (!valorParcela) { showToast('Informe o valor total', true); return; }
  } else {
    valorParcela = parseMoeda(document.getElementById('comp-valor-parcela'));
    if (!valorParcela) { showToast('Informe o valor da parcela', true); return; }
  }
  const payload = {
    rep_id: currentRep.id, tipo, descricao: desc,
    total_parcelas: totalParcelas, parcela_atual: parcelaAtual,
    valor_parcela: valorParcela, valor_total: valorTotal || (valorParcela * totalParcelas),
    data_inicio: dataInicio,
  };
  if (tipo === 'parcela') {
    payload.categoria = document.getElementById('comp-categoria')?.value || null;
  } else {
    payload.banco = document.getElementById('comp-banco')?.value.trim() || null;
    const taxaStr = (document.getElementById('comp-taxa')?.value || '').replace(',','.');
    payload.taxa_juros = taxaStr ? parseFloat(taxaStr) : null;
  }
  const { error } = await sb.from('compromissos').insert(payload);
  if (error) { showToast('Erro ao salvar', true); console.error(error); return; }
  showToast('✓ Compromisso salvo');
  fecharFormCompromisso();
  await carregarCompromissos();
  renderCompromissos();
}

async function deletarCompromisso(id) {
  if (!confirm('Excluir este compromisso?')) return;
  await sb.from('compromissos').delete().eq('id', id);
  compromissosCache = compromissosCache.filter(c => c.id !== id);
  renderCompromissos();
  showToast('Compromisso excluído');
}

async function avancarParcelaComp(id) {
  const c = compromissosCache.find(x => x.id === id);
  if (!c) return;
  const nova = (c.parcela_atual||1) + 1;
  await sb.from('compromissos').update({ parcela_atual: nova }).eq('id', id);
  c.parcela_atual = nova;
  renderCompromissos();
  showToast('✓ Parcela marcada como paga');
}

// ── EMPRESAS ─────────────────────────────────────────────────────────

async function carregarEmpresasDesk() {
  if (!currentRep) return;
  const { data } = await sb.from('representadas').select('*').eq('rep_id', currentRep.id).order('nome');
  representadasCache = data || [];
}

async function openEmpresas() {
  document.getElementById('modal-empresas').style.display = 'flex';
  await carregarEmpresasDesk();
  renderEmpresasDesk();
}

function closeEmpresas() {
  document.getElementById('modal-empresas').style.display = 'none';
}

function renderEmpresasDesk() {
  const lista = document.getElementById('empresas-lista');
  if (!lista) return;
  if (!representadasCache.length) {
    lista.innerHTML = '<div style="text-align:center;padding:32px 0;color:var(--text3);font-size:13px">Nenhuma empresa cadastrada.</div>';
    return;
  }
  lista.innerHTML = representadasCache.map(r => `
    <div class="gestao-card-desk">
      <div>
        <div class="gestao-card-nome-desk">${sanitize(r.nome)}</div>
        ${r.cnpj ? `<div class="gestao-card-sub-desk">CNPJ: ${sanitize(r.cnpj)}</div>` : ''}
        ${r.cidade ? `<div class="gestao-card-sub-desk">\u{1F4CD} ${sanitize(r.cidade)}</div>` : ''}
        ${r.banco ? `<div class="gestao-card-sub-desk">\u{1F3E6} ${sanitize(r.banco)}${r.agencia ? ' Ag. '+sanitize(r.agencia) : ''}${r.conta ? ' C/C '+sanitize(r.conta) : ''}</div>` : ''}
        ${r.pix ? `<div class="gestao-card-sub-desk">PIX: ${sanitize(r.pix)}</div>` : ''}
      </div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="gestao-btn-sm-desk" onclick="abrirFormEmpresaDesk('${r.id}')">Editar</button>
        <button class="gestao-btn-sm-desk danger" onclick="deletarEmpresaDesk('${r.id}')">Excluir</button>
      </div>
    </div>`).join('');
}

function abrirFormEmpresaDesk(id) {
  const form = document.getElementById('empresa-form');
  const fab  = document.getElementById('empresas-fab');
  if (!form) return;
  form.style.display = 'block';
  if (fab) fab.style.display = 'none';
  if (id) {
    const r = representadasCache.find(x => x.id === id);
    if (!r) return;
    document.getElementById('empresa-form-titulo').textContent = 'Editar Empresa';
    document.getElementById('emp-id').value       = r.id;
    document.getElementById('emp-nome').value     = r.nome || '';
    document.getElementById('emp-cnpj').value     = r.cnpj || '';
    document.getElementById('emp-cep').value      = r.cep  || '';
    document.getElementById('emp-endereco').value = r.endereco || '';
    const cidEl = document.getElementById('emp-cidade');
    cidEl.value = r.cidade || ''; cidEl.disabled = !!r.cidade;
    document.getElementById('emp-banco').value    = r.banco    || '';
    document.getElementById('emp-agencia').value  = r.agencia  || '';
    document.getElementById('emp-conta').value    = r.conta    || '';
    document.getElementById('emp-pix').value      = r.pix      || '';
    document.getElementById('emp-fin-nome').value = r.fin_nome || '';
    document.getElementById('emp-fin-tel').value  = r.fin_tel  || '';
    document.getElementById('emp-com-nome').value = r.com_nome || '';
    document.getElementById('emp-com-tel').value  = r.com_tel  || '';
    document.getElementById('emp-fis-nome').value = r.fis_nome || '';
    document.getElementById('emp-fis-tel').value  = r.fis_tel  || '';
    document.getElementById('emp-fat-nome').value = r.fat_nome || '';
    document.getElementById('emp-fat-tel').value  = r.fat_tel  || '';
    document.getElementById('emp-cep-status').textContent = '';
  } else {
    document.getElementById('empresa-form-titulo').textContent = 'Nova Empresa';
    ['emp-id','emp-nome','emp-cnpj','emp-cep','emp-endereco','emp-banco','emp-agencia','emp-conta','emp-pix',
     'emp-fin-nome','emp-fin-tel','emp-com-nome','emp-com-tel','emp-fis-nome','emp-fis-tel','emp-fat-nome','emp-fat-tel']
      .forEach(fid => { const el = document.getElementById(fid); if (el) el.value = ''; });
    const cidEl = document.getElementById('emp-cidade');
    if (cidEl) { cidEl.value = ''; cidEl.disabled = true; }
    document.getElementById('emp-cep-status').textContent = '';
  }
}

function fecharFormEmpresaDesk() {
  const form = document.getElementById('empresa-form');
  const fab  = document.getElementById('empresas-fab');
  if (form) form.style.display = 'none';
  if (fab)  fab.style.display  = '';
}

function mascaraCEPDesk(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 5) v = v.slice(0,5) + '-' + v.slice(5,8);
  el.value = v;
}

async function buscarCEPEmpresaDesk() {
  const cepEl    = document.getElementById('emp-cep');
  const statusEl = document.getElementById('emp-cep-status');
  const cidEl    = document.getElementById('emp-cidade');
  const endEl    = document.getElementById('emp-endereco');
  if (!cepEl) return;
  const cep = cepEl.value.replace(/\D/g,'');
  if (cep.length < 8) return;
  statusEl.textContent = 'Buscando...'; statusEl.style.color = 'var(--text3)';
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const d   = await res.json();
    if (d.erro) { statusEl.textContent = 'CEP não encontrado'; statusEl.style.color = 'var(--red)'; cidEl.disabled = false; return; }
    const cidade = (d.localidade || '') + (d.uf ? ' - ' + d.uf.toUpperCase() : '');
    cidEl.value = cidade; cidEl.disabled = true;
    if (!endEl.value) endEl.value = [d.logradouro, d.bairro].filter(Boolean).join(', ');
    statusEl.textContent = '✓ CEP encontrado'; statusEl.style.color = 'var(--green)';
  } catch(e) {
    statusEl.textContent = 'Erro ao buscar CEP'; statusEl.style.color = 'var(--red)';
    cidEl.disabled = false;
  }
}

async function salvarEmpresaDesk() {
  if (!currentUser) return;
  const nome = document.getElementById('emp-nome').value.trim();
  if (!nome) { showToast('Nome obrigatório', true); return; }
  const id = document.getElementById('emp-id').value;
  const repId = await getRepId();
  const payload = {
    rep_id:   repId, nome,
    cnpj:     document.getElementById('emp-cnpj').value.trim(),
    cep:      document.getElementById('emp-cep').value.replace(/\D/g,''),
    endereco: document.getElementById('emp-endereco').value.trim(),
    cidade:   document.getElementById('emp-cidade').value.trim(),
    banco:    document.getElementById('emp-banco').value.trim(),
    agencia:  document.getElementById('emp-agencia').value.trim(),
    conta:    document.getElementById('emp-conta').value.trim(),
    pix:      document.getElementById('emp-pix').value.trim(),
    fin_nome: document.getElementById('emp-fin-nome').value.trim(),
    fin_tel:  document.getElementById('emp-fin-tel').value.trim(),
    com_nome: document.getElementById('emp-com-nome').value.trim(),
    com_tel:  document.getElementById('emp-com-tel').value.trim(),
    fis_nome: document.getElementById('emp-fis-nome').value.trim(),
    fis_tel:  document.getElementById('emp-fis-tel').value.trim(),
    fat_nome: document.getElementById('emp-fat-nome').value.trim(),
    fat_tel:  document.getElementById('emp-fat-tel').value.trim(),
  };
  let err;
  if (id) {
    ({ error: err } = await sb.from('representadas').update(payload).eq('id', id).eq('rep_id', repId));
  } else {
    ({ error: err } = await sb.from('representadas').insert(payload));
  }
  if (err) { showToast('Erro ao salvar', true); console.error(err); return; }
  await carregarEmpresasDesk();
  await carregarRepresentadasDesktop();
  fecharFormEmpresaDesk();
  renderEmpresasDesk();
  showToast('Empresa salva!');
}

async function deletarEmpresaDesk(id) {
  const r = representadasCache.find(x => x.id === id);
  if (!r || !confirm('Excluir "' + r.nome + '"?')) return;
  const repId = await getRepId();
  const { error } = await sb.from('representadas').delete().eq('id', id).eq('rep_id', repId);
  if (error) { showToast('Erro ao excluir', true); return; }
  await carregarEmpresasDesk();
  await carregarRepresentadasDesktop();
  renderEmpresasDesk();
  showToast('Empresa excluída');
}

// ── SEGMENTAÇÃO ──────────────────────────────────────────────────────

const _SEGS_DEFAULT_DESK = ['Mat. Construção', 'Construtora', 'Tintas', 'Distribuidora'];

async function carregarSegmentosDesk() {
  if (!currentRep) return;
  try {
    const repId = await getRepId();
    if (!repId) { if (!segmentosCache.length) segmentosCache = _SEGS_DEFAULT_DESK.map((nome, i) => ({ id: 'def_'+i, nome })); return; }
    const { data, error } = await sb.from('segmentos').select('*').eq('rep_id', repId).order('nome');
    if (error) throw error;
    const seen = new Set();
    const fromDb = (data || []).filter(s => seen.has(s.nome) ? false : seen.add(s.nome));
    if (fromDb.length) {
      segmentosCache = fromDb;
    } else {
      const { error: insErr } = await sb.from('segmentos').insert(_SEGS_DEFAULT_DESK.map(nome => ({ nome, rep_id: repId })));
      if (!insErr) {
        const { data: d2 } = await sb.from('segmentos').select('*').eq('rep_id', repId).order('nome');
        segmentosCache = d2 && d2.length ? d2 : _SEGS_DEFAULT_DESK.map((nome, i) => ({ id: 'def_'+i, nome }));
      } else {
        if (!segmentosCache.length) segmentosCache = _SEGS_DEFAULT_DESK.map((nome, i) => ({ id: 'def_'+i, nome }));
      }
    }
  } catch(e) {
    if (!segmentosCache.length) segmentosCache = _SEGS_DEFAULT_DESK.map((nome, i) => ({ id: 'def_'+i, nome }));
  }
}

async function openSegmentos() {
  document.getElementById('modal-segmentos').style.display = 'flex';
  await carregarSegmentosDesk();
  renderSegmentosDesk();
}

function closeSegmentos() {
  document.getElementById('modal-segmentos').style.display = 'none';
}

function renderSegmentosDesk() {
  const lista = document.getElementById('segmentos-lista');
  if (!lista) return;
  if (!segmentosCache.length) {
    lista.innerHTML = '<div style="text-align:center;padding:32px 0;color:var(--text3);font-size:13px">Nenhum segmento cadastrado.</div>';
    return;
  }
  lista.innerHTML = segmentosCache.map(s => `
    <div class="gestao-card-desk">
      <div class="gestao-card-nome-desk">${sanitize(s.nome)}</div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="gestao-btn-sm-desk" onclick="abrirFormSegmentoDesk('${s.id}')">Editar</button>
        <button class="gestao-btn-sm-desk danger" onclick="deletarSegmentoDesk('${s.id}')">Excluir</button>
      </div>
    </div>`).join('');
}

function abrirFormSegmentoDesk(id) {
  const form = document.getElementById('segmento-form');
  if (!form) return;
  form.style.display = 'block';
  if (id) {
    const s = segmentosCache.find(x => String(x.id) === String(id));
    document.getElementById('segmento-form-titulo').textContent = 'Editar Segmento';
    document.getElementById('seg-mgmt-id').value   = id;
    document.getElementById('seg-mgmt-nome').value = s ? s.nome : '';
  } else {
    document.getElementById('segmento-form-titulo').textContent = 'Novo Segmento';
    document.getElementById('seg-mgmt-id').value   = '';
    document.getElementById('seg-mgmt-nome').value = '';
  }
  setTimeout(() => document.getElementById('seg-mgmt-nome').focus(), 100);
}

function fecharFormSegmentoDesk() {
  const form = document.getElementById('segmento-form');
  if (form) form.style.display = 'none';
}

async function salvarSegmentoDesk() {
  if (!currentUser) return;
  const raw = document.getElementById('seg-mgmt-nome').value.trim();
  if (!raw) { showToast('Nome obrigatório', true); return; }
  const nome = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  const id   = document.getElementById('seg-mgmt-id').value;
  if (id) {
    const s = segmentosCache.find(x => String(x.id) === String(id));
    if (s) s.nome = nome;
  } else if (!segmentosCache.find(s => s.nome === nome)) {
    segmentosCache.push({ id: 'local_' + Date.now(), nome });
    segmentosCache.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  fecharFormSegmentoDesk();
  renderSegmentosDesk();
  showToast(id ? 'Segmento atualizado' : 'Segmento criado');
  const repId = await getRepId();
  try {
    if (id) {
      await sb.from('segmentos').update({ nome }).eq('id', id).eq('rep_id', repId);
    } else {
      const { data, error } = await sb.from('segmentos').insert({ nome, rep_id: repId }).select().single();
      if (!error && data) {
        const idx = segmentosCache.findIndex(s => s.nome === nome && String(s.id).startsWith('local_'));
        if (idx >= 0) segmentosCache[idx] = data;
        renderSegmentosDesk();
      }
    }
  } catch(e) { console.error('salvarSegmento:', e); }
}

async function deletarSegmentoDesk(id) {
  const s = segmentosCache.find(x => String(x.id) === String(id));
  if (!s || !confirm('Excluir "' + s.nome + '"?')) return;
  const repId = await getRepId();
  try {
    await sb.from('segmentos').delete().eq('id', id).eq('rep_id', repId);
    await carregarSegmentosDesk();
    renderSegmentosDesk();
    showToast('Segmento excluído');
  } catch(e) { showToast('Erro ao excluir', true); }
}

// ── IMPORTAR CLIENTES ────────────────────────────────────────────────

function openImportar() {
  _importarFileDesk = null;
  document.getElementById('importar-file-label-desk').textContent = 'Selecionar arquivo .xlsx';
  document.getElementById('importar-preview-desk').style.display = 'none';
  document.getElementById('importar-progress-desk').style.display = 'none';
  document.getElementById('importar-footer-desk').style.display = 'none';
  document.getElementById('modal-importar').style.display = 'flex';
}

function closeImportar() {
  document.getElementById('modal-importar').style.display = 'none';
}

function baixarModeloXlsxDesk() {
  if (!window.XLSX) { showToast('Aguarde o carregamento', true); return; }
  const ws = XLSX.utils.aoa_to_sheet([
    ['nome','comprador','cnpj','cep','endereco','telefone','segmento','ultima_visita','ultima_obs'],
    ['Exemplo Materiais','João Silva','12.345.678/0001-90','89251-000','Rua das Flores, 100','(47) 99999-9999','Mat. Construção','2024-01-15','Interessado em novidades'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'clientes_modelo_importacao.xlsx');
}

function importarLerArquivoDesk(input) {
  const file = input.files[0];
  if (!file) return;
  _importarFileDesk = file;
  document.getElementById('importar-file-label-desk').textContent = file.name;
  document.getElementById('importar-preview-desk').style.display = 'none';
  document.getElementById('importar-progress-desk').style.display = 'none';
  const btn = document.getElementById('importar-btn-confirmar-desk');
  btn.textContent = 'Enviar para processamento';
  btn.disabled = false;
  document.getElementById('importar-footer-desk').style.display = 'block';
}

async function importarConfirmarDesk() {
  if (!_importarFileDesk || !currentUser) return;
  const btn  = document.getElementById('importar-btn-confirmar-desk');
  const prog = document.getElementById('importar-progress-desk');
  const BUCKET = 'client-import-originals';
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  prog.style.display = 'block';
  prog.textContent = 'Fazendo upload do arquivo...';
  const userId = currentUser.id;
  const ts = Date.now();
  const safeName = _importarFileDesk.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}/${ts}-${safeName}`;
  try {
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, _importarFileDesk, { upsert: false });
    if (uploadError) throw uploadError;
    prog.textContent = 'Registrando importacao...';
    const { error: dbError } = await sb.from('client_import_files').insert({
      user_id: userId, original_filename: _importarFileDesk.name,
      storage_bucket: BUCKET, storage_path: storagePath, status: 'uploaded',
    });
    if (dbError) throw dbError;
    _importarFileDesk = null;
    prog.style.display = 'none';
    document.getElementById('importar-footer-desk').style.display = 'none';
    document.getElementById('importar-preview-texto-desk').innerHTML =
      '<div style="color:var(--green);font-size:15px;font-weight:700;margin-bottom:8px">Arquivo enviado!</div>' +
      '<div style="color:var(--text2);font-size:13px;line-height:1.6">Seus clientes serao importados em breve.</div>' +
      '<button onclick="closeImportar()" style="margin-top:14px;width:100%;padding:11px;background:var(--blue);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer">Fechar</button>';
    document.getElementById('importar-preview-desk').style.display = 'block';
  } catch (err) {
    prog.style.display = 'none';
    btn.disabled = false;
    btn.textContent = 'Tentar novamente';
    let msg = 'Erro ao enviar o arquivo.';
    if (err && err.message) {
      if (err.message.includes('Bucket not found')) msg = 'Bucket nao encontrado no Supabase.';
      else msg = err.message;
    }
    document.getElementById('importar-preview-texto-desk').innerHTML =
      '<div style="color:var(--red);font-size:14px;font-weight:600;margin-bottom:6px">Falha no envio</div>' +
      '<div style="color:var(--text2);font-size:13px">' + msg + '</div>';
    document.getElementById('importar-preview-desk').style.display = 'block';
  }
}

// ── CALENDÁRIO DE VISITAS ────────────────────────────────────────────

async function openCalendario() {
  calMesDesk = new Date().getMonth();
  calAnoDesk = new Date().getFullYear();
  calDiaSelecionadoDesk = new Date().getDate();
  document.getElementById('modal-calendario').style.display = 'flex';
  await carregarCalendarioDesk();
}

function closeCalendario() {
  document.getElementById('modal-calendario').style.display = 'none';
}

async function navegarCalMesDesk(delta) {
  calMesDesk += delta;
  if (calMesDesk > 11) { calMesDesk = 0; calAnoDesk++; }
  if (calMesDesk < 0)  { calMesDesk = 11; calAnoDesk--; }
  calDiaSelecionadoDesk = null;
  await carregarCalendarioDesk();
}

async function carregarCalendarioDesk() {
  const nomesMes = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  document.getElementById('cal-mes-titulo-desk').textContent = nomesMes[calMesDesk] + ' ' + calAnoDesk;

  const chaveCache = calAnoDesk + '-' + calMesDesk;
  let visitas = [];
  if (calVisitasCacheDesk[chaveCache]) {
    visitas = calVisitasCacheDesk[chaveCache];
  } else {
    const inicio = new Date(calAnoDesk, calMesDesk, 1).toISOString().slice(0, 10);
    const fim    = new Date(calAnoDesk, calMesDesk + 1, 0).toISOString().slice(0, 10);
    try {
      const { data } = await sb.from('visitas').select('id,id_cliente,nome_cliente,cidade,data,hora,obs')
        .eq('rep_id', currentUser.id).gte('data', inicio).lte('data', fim).order('data');
      visitas = data || [];
    } catch(e) { visitas = []; }
    calVisitasCacheDesk[chaveCache] = visitas;
  }

  const porDia = {};
  visitas.forEach(v => {
    const dia = parseInt(v.data.split('-')[2]);
    if (!porDia[dia]) porDia[dia] = [];
    porDia[dia].push(v);
  });

  const primeiroDia = new Date(calAnoDesk, calMesDesk, 1).getDay();
  const ultimoDia   = new Date(calAnoDesk, calMesDesk + 1, 0).getDate();
  const hoje        = new Date();
  const ehMesAtual  = calMesDesk === hoje.getMonth() && calAnoDesk === hoje.getFullYear();

  let gridHTML = '';
  const diasMesAnt = new Date(calAnoDesk, calMesDesk, 0).getDate();
  for (let i = primeiroDia - 1; i >= 0; i--) {
    gridHTML += '<div class="cal-d-desk outro">' + (diasMesAnt - i) + '</div>';
  }
  for (let d = 1; d <= ultimoDia; d++) {
    const classes = ['cal-d-desk'];
    if (ehMesAtual && d === hoje.getDate()) classes.push('hoje');
    if (porDia[d]) classes.push(porDia[d].length >= 4 ? 'com-visita muitas' : 'com-visita');
    if (d === calDiaSelecionadoDesk) classes.push('selecionado');
    if (new Date(calAnoDesk, calMesDesk, d).getDay() === 0) classes.push('dom');
    gridHTML += '<div class="' + classes.join(' ') + '" onclick="selecionarDiaDesk(' + d + ')">' + d + '</div>';
  }
  const total = primeiroDia + ultimoDia;
  const resto = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= resto; d++) {
    gridHTML += '<div class="cal-d-desk outro">' + d + '</div>';
  }
  document.getElementById('cal-grid-desk').innerHTML = gridHTML;

  if (calDiaSelecionadoDesk) {
    renderDiaCalDesk(calDiaSelecionadoDesk, porDia[calDiaSelecionadoDesk] || []);
  } else {
    document.getElementById('cal-body-desk').innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px">Clique em um dia para ver as visitas</div>';
  }
}

async function selecionarDiaDesk(dia) {
  calDiaSelecionadoDesk = dia;
  document.querySelectorAll('.cal-d-desk').forEach(el => el.classList.remove('selecionado'));
  const els = document.querySelectorAll('.cal-d-desk:not(.outro)');
  if (els[dia - 1]) els[dia - 1].classList.add('selecionado');
  const chaveCache = calAnoDesk + '-' + calMesDesk;
  const visitas = calVisitasCacheDesk[chaveCache] || [];
  const doDia = visitas.filter(v => parseInt(v.data.split('-')[2]) === dia);
  renderDiaCalDesk(dia, doDia);
}

function renderDiaCalDesk(dia, visitas) {
  const nomesDia = ['Domingo','Segunda','Terca','Quarta','Quinta','Sexta','Sabado'];
  const nomesMes = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const diaSemana = new Date(calAnoDesk, calMesDesk, dia).getDay();
  const titulo = nomesDia[diaSemana] + ', ' + dia + ' de ' + nomesMes[calMesDesk];
  let html = '<div class="cal-dia-titulo-desk">' + titulo;
  if (visitas.length) html += ' &middot; ' + visitas.length + ' visita' + (visitas.length > 1 ? 's' : '');
  html += '</div>';
  if (!visitas.length) {
    html += '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px">Nenhuma visita neste dia</div>';
  } else {
    visitas.sort((a, b) => (a.hora||'').localeCompare(b.hora||''));
    html += visitas.map(v => {
      const c = clientes.find(x => String(x.id) === String(v.id_cliente));
      const nome = c ? c.nome : (v.nome_cliente || '');
      const cidade = (c ? c.cidade : (v.cidade || '')).replace(' - SC','').replace(' - PR','');
      const obsText = v.obs ? sanitize(v.obs) : '';
      return '<div class="cal-visita-card-desk">' +
        '<div class="cal-visita-dot-desk"></div>' +
        '<div style="flex:1">' +
          '<div style="font-size:13px;font-weight:700">' + sanitize(nome) + '</div>' +
          '<div style="font-size:11px;color:var(--text3)">' + sanitize(cidade) + '</div>' +
          (obsText ? '<div style="font-size:11px;color:var(--text2);margin-top:2px">' + obsText + '</div>' : '') +
        '</div>' +
        (v.hora ? '<div style="font-size:12px;color:var(--text3);flex-shrink:0">' + v.hora + '</div>' : '') +
      '</div>';
    }).join('');
  }
  document.getElementById('cal-body-desk').innerHTML = html;
}

// ── LEMBRETES DE IMPOSTOS ────────────────────────────────────────────

async function verificarLembretesDesk() {
  const hoje = new Date();
  const chaveHoje = hoje.toISOString().split('T')[0];
  const chaveImpostos = 'lembrete_imp_desk_' + chaveHoje;
  if (localStorage.getItem(chaveImpostos)) return;
  const vencendo = (impostosCache || []).filter(imp => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), imp.dia_vencimento);
    const diff = (d - hoje) / 86400000;
    return diff >= 0 && diff <= 7;
  });
  if (!vencendo.length) return;
  localStorage.setItem(chaveImpostos, '1');
  const nomes = vencendo.map(i => i.nome + ' (dia ' + i.dia_vencimento + ')').join(', ');
  setTimeout(() => showToast('Imposto vencendo: ' + nomes, false), 3000);
}

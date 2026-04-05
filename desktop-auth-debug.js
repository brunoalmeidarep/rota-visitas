// ── DESKTOP AUTH DEBUG MODULE ─────────────────────────────────────────
// Logs com prefixos claros + painel visual temporário de debug.
// Este arquivo é carregado APENAS pelo desktop.html e não interfere no mobile.
(function () {
  'use strict';

  const PANEL_ID  = 'desk-dbg-panel';
  const MAX_EVT   = 12;

  const s = {
    env:        '',
    action:     '',
    status:     '',
    error:      '',
    errorCode:  '',
    errorHTTP:  '',
    redirectTo: '',
    time:       '',
    events:     [],
  };

  function ts() {
    return new Date().toLocaleTimeString('pt-BR', { hour12: false });
  }

  function render() {
    const el = document.getElementById(PANEL_ID);
    if (!el) return;
    const statusClass = s.status === 'OK' ? 'ok'
                      : s.status && s.status !== 'iniciando...' ? 'err' : 'neu';
    el.innerHTML = `
      <div class="dp-hd">[DESKTOP DEBUG]
        <span class="dp-close" onclick="document.getElementById('${PANEL_ID}').style.display='none'" title="fechar">×</span>
      </div>
      <div class="dp-r"><span class="dp-k">Domínio</span><span class="dp-v dp-small">${s.env || '—'}</span></div>
      <div class="dp-r"><span class="dp-k">Última ação</span><span class="dp-v">${s.action || '—'}</span></div>
      <div class="dp-r"><span class="dp-k">Status</span><span class="dp-v dp-${statusClass}">${s.status || '—'}</span></div>
      <div class="dp-r"><span class="dp-k">Erro</span><span class="dp-v dp-warn">${s.error || '—'}</span></div>
      <div class="dp-r"><span class="dp-k">Código</span><span class="dp-v">${s.errorCode || '—'}</span></div>
      <div class="dp-r"><span class="dp-k">HTTP</span><span class="dp-v">${s.errorHTTP || '—'}</span></div>
      <div class="dp-r"><span class="dp-k">redirectTo</span><span class="dp-v dp-small">${s.redirectTo || '—'}</span></div>
      <div class="dp-r"><span class="dp-k">Tentativa</span><span class="dp-v">${s.time || '—'}</span></div>
      <div class="dp-evts">
        <div class="dp-evts-hd">Eventos</div>
        ${s.events.slice().reverse().map(e => `<div class="dp-evt">${e}</div>`).join('')}
      </div>`;
  }

  function addEvt(msg) {
    s.events.push(`[${ts()}] ${msg}`);
    if (s.events.length > MAX_EVT) s.events.shift();
  }

  // ── API pública ──────────────────────────────────────────────────────
  const D = window.DESK_DEBUG = {

    log(prefix, ...args) {
      const str = args.map(a => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      console.log('%c' + prefix, 'color:#60a5fa;font-weight:700', ...args);
      addEvt(prefix + ' ' + str);
      render();
    },

    err(prefix, ...args) {
      const str = args.map(a => {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        return typeof a === 'object' ? JSON.stringify(a) : String(a);
      }).join(' ');
      console.error(prefix, ...args);
      addEvt(prefix + ' ' + str);
      render();
    },

    action(label) {
      s.action   = label;
      s.status   = 'iniciando...';
      s.error    = '';
      s.errorCode = '';
      s.errorHTTP = '';
      s.time     = ts();
      addEvt('► ' + label);
      render();
    },

    ok(msg) {
      s.status = 'OK';
      s.error  = '';
      addEvt('✓ ' + msg);
      render();
    },

    fail(err) {
      s.status    = 'ERRO';
      s.error     = (err && err.message) ? err.message : String(err || 'erro desconhecido');
      s.errorCode = (err && (err.code || err.error_code || err.__isAuthError)) ? (err.code || err.error_code || 'auth_error') : '';
      s.errorHTTP = (err && err.status)  ? String(err.status) : '';
      addEvt('✗ ' + s.error + (s.errorCode ? ' [' + s.errorCode + ']' : '') + (s.errorHTTP ? ' HTTP' + s.errorHTTP : ''));
      render();
    },

    redirect(url) {
      s.redirectTo = url;
      render();
    },

    init() {
      s.env = window.location.origin + window.location.pathname;
      render();
      D.log('[AUTH][CONFIG]', 'Desktop Auth Debug iniciado');
      D.log('[AUTH][CONFIG]', 'origin :', window.location.origin);
      D.log('[AUTH][CONFIG]', 'href   :', window.location.href);
      D.log('[AUTH][CONFIG]', 'pathname:', window.location.pathname);
      D.log('[AUTH][CONFIG]', 'hash   :', window.location.hash || '(vazio)');
      D.log('[AUTH][CONFIG]', 'search :', window.location.search || '(vazio)');
    },
  };

  // ── Estilos ──────────────────────────────────────────────────────────
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'desk-dbg-styles';
    style.textContent = `
      #${PANEL_ID} {
        position: fixed; bottom: 14px; right: 14px;
        background: rgba(8,8,18,0.97);
        border: 1px solid rgba(96,165,250,0.35);
        border-radius: 12px; padding: 10px 13px;
        font-family: 'IBM Plex Mono','Courier New',monospace;
        font-size: 11px; color: rgba(255,255,255,0.72);
        min-width: 290px; max-width: 360px;
        z-index: 999999;
        box-shadow: 0 6px 32px rgba(0,0,0,0.75);
        line-height: 1.4;
      }
      #${PANEL_ID} .dp-hd {
        color: #60a5fa; font-weight: 700; font-size: 12px;
        margin-bottom: 7px; letter-spacing: .04em;
        display: flex; justify-content: space-between; align-items: center;
      }
      #${PANEL_ID} .dp-close {
        cursor: pointer; color: rgba(255,255,255,.35);
        font-size: 16px; line-height: 1; padding: 0 2px;
      }
      #${PANEL_ID} .dp-close:hover { color: #fff; }
      #${PANEL_ID} .dp-r {
        display: flex; gap: 6px; margin-bottom: 3px;
        align-items: flex-start; flex-wrap: wrap;
      }
      #${PANEL_ID} .dp-k {
        color: rgba(255,255,255,.38); flex-shrink: 0; min-width: 90px;
      }
      #${PANEL_ID} .dp-v    { color: rgba(255,255,255,.82); word-break: break-all; }
      #${PANEL_ID} .dp-small{ font-size: 10px; }
      #${PANEL_ID} .dp-ok   { color: #34C759; font-weight: 700; }
      #${PANEL_ID} .dp-err  { color: #FF3B30; font-weight: 700; }
      #${PANEL_ID} .dp-neu  { color: rgba(255,255,255,.5); }
      #${PANEL_ID} .dp-warn { color: #FF9500; word-break: break-word; }
      #${PANEL_ID} .dp-evts {
        margin-top: 7px; border-top: 1px solid rgba(255,255,255,.1);
        padding-top: 5px;
      }
      #${PANEL_ID} .dp-evts-hd {
        color: rgba(255,255,255,.3); font-size: 10px;
        text-transform: uppercase; letter-spacing: .05em; margin-bottom: 3px;
      }
      #${PANEL_ID} .dp-evt {
        color: rgba(255,255,255,.48); font-size: 10px;
        margin-bottom: 2px; word-break: break-word;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Injeção do painel ────────────────────────────────────────────────
  function injectPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = '<div class="dp-hd">[DESKTOP DEBUG] aguardando...</div>';
    document.body.appendChild(panel);
  }

  function setup() {
    injectStyles();
    injectPanel();
    D.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

})();

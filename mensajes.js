'use strict';

/* ═══════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════ */
const GATEWAY      = 'http://127.0.0.1:8000';
const POLL_CONV_MS = 15_000;   // lista de conversaciones
const POLL_MSG_MS  =  5_000;   // mensajes del hilo activo

/* ═══════════════════════════════════════════
   ESTADO
═══════════════════════════════════════════ */
let _conversations   = [];
let _activeConvId    = null;
let _messages        = [];
let _currentUserId   = null;
let _currentRole     = null;
let _pollConvTimer   = null;
let _pollMsgTimer    = null;
let _lastMsgCount    = 0;
let _searchQuery     = '';
let _isMobile        = window.innerWidth <= 700;

/* ═══════════════════════════════════════════
   AUTH HELPERS
═══════════════════════════════════════════ */
function authHeaders() {
  const token = localStorage.getItem('inmo_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

function getUserId() {
  try {
    const raw  = localStorage.getItem('inmo_user');
    const user = raw ? JSON.parse(raw) : null;
    return user?.id || user?.sub || null;
  } catch { return null; }
}

function getUserRole() {
  try {
    const raw  = localStorage.getItem('inmo_user');
    const user = raw ? JSON.parse(raw) : null;
    return user?.role || 'buscador';
  } catch { return 'buscador'; }
}

function getUserInitials() {
  try {
    const raw  = localStorage.getItem('inmo_user');
    const user = raw ? JSON.parse(raw) : null;
    const name = user?.name || user?.email || '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  } catch { return '?'; }
}

function roleLabel(role) {
  const labels = {
    agente: 'Agente', propietario: 'Propietario',
    buscador: 'Buscador', inquilino: 'Inquilino',
    admin: 'Admin',
  };
  return labels[role] || role;
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  _currentUserId = getUserId();
  _currentRole   = getUserRole();

  // Mostrar rol en topbar
  const roleEl = document.getElementById('topbar-role');
  if (roleEl) roleEl.textContent = roleLabel(_currentRole);

  // Iniciales del usuario en topbar (si existe el elemento)
  const initialsEl = document.getElementById('topbar-initials');
  if (initialsEl) initialsEl.textContent = getUserInitials();

  // Redirección si no hay token
  const token = localStorage.getItem('inmo_token');
  if (!token) {
    window.location.href = 'loginregister.html?return=' + encodeURIComponent(window.location.href);
    return;
  }

  // Busqueda
  document.getElementById('conv-search-input').addEventListener('input', e => {
    _searchQuery = e.target.value.toLowerCase();
    renderConvList();
  });

  // Enter en textarea → enviar
  document.getElementById('chat-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  document.getElementById('chat-input').addEventListener('input', autoResizeTextarea);

  // Polling de conversaciones
  loadConversations();
  _pollConvTimer = setInterval(loadConversations, POLL_CONV_MS);

  // Mobile resize
  window.addEventListener('resize', () => { _isMobile = window.innerWidth <= 700; });

  // Abrir conversación desde URL param ?conv=id
  const params  = new URLSearchParams(window.location.search);
  const convId  = params.get('conv');
  if (convId) {
    // Esperar a que cargue la lista antes de seleccionar
    setTimeout(() => selectConversation(convId), 800);
  }
});

/* ═══════════════════════════════════════════
   CONVERSACIONES
═══════════════════════════════════════════ */
async function loadConversations() {
  try {
    const res  = await fetch(`${GATEWAY}/api/v1/chats`, { headers: authHeaders() });
    if (!res.ok) { handleAuthError(res.status); return; }
    const data = await res.json();
    _conversations = Array.isArray(data) ? data : (data.conversations || data.items || []);
    renderConvList();
  } catch (err) {
    console.error('[chats list]', err);
    showConvError();
  }
}

function renderConvList() {
  const container = document.getElementById('conv-list');

  const filtered = _conversations.filter(c => {
    if (!_searchQuery) return true;
    const prop    = (c.property_title || c.property_id || '').toLowerCase();
    const partner = (c.partner_name   || '').toLowerCase();
    return prop.includes(_searchQuery) || partner.includes(_searchQuery);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="conv-empty">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>${_searchQuery ? 'Sin resultados' : 'Sin conversaciones'}</p>
        <span>${_searchQuery ? 'Probá con otra búsqueda' : 'Cuando consultes por una propiedad, aparecerá acá'}</span>
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(c => convItem(c)).join('');
}

function convItem(c) {
  const isActive  = c.id === _activeConvId;
  const isUnread  = c.unread_count > 0 && !isActive;
  const partner   = c.partner_name || 'Usuario';
  const initials  = partner.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const preview   = c.last_message || 'Sin mensajes aún';
  const propTitle = c.property_title || c.property_id?.slice(0, 12) || '—';
  const timeStr   = c.updated_at ? fmtTime(c.updated_at) : '';

  return `
    <div class="conv-item ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}"
         onclick="selectConversation('${esc(c.id)}')">
      <div class="conv-avatar">${esc(initials)}</div>
      <div class="conv-item-body">
        <div class="conv-item-top">
          <span class="conv-item-name">${esc(partner)}</span>
          <span class="conv-item-time">${esc(timeStr)}</span>
        </div>
        <div class="conv-item-prop">${esc(propTitle)}</div>
        <div class="conv-item-preview">${esc(preview)}</div>
      </div>
      <div class="conv-unread-dot"></div>
    </div>`;
}

function showConvError() {
  const container = document.getElementById('conv-list');
  container.innerHTML = `
    <div class="conv-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".4">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>Error de conexión</p>
      <span>Verificá que el servidor de chat esté corriendo en :8086</span>
    </div>`;
}

/* ═══════════════════════════════════════════
   SELECCIONAR CONVERSACIÓN
═══════════════════════════════════════════ */
async function selectConversation(convId) {
  if (_activeConvId === convId) return;

  _activeConvId = convId;
  _lastMsgCount = 0;

  // Detener polling anterior de mensajes
  clearInterval(_pollMsgTimer);

  // Marcar activo en lista
  document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
  const activeEl = document.querySelector(`.conv-item[onclick*="${convId}"]`);
  if (activeEl) activeEl.classList.add('active');

  // Actualizar header del chat
  const conv = _conversations.find(c => c.id === convId);
  if (conv) updateChatHeader(conv);

  // Mobile: esconder lista, mostrar hilo
  if (_isMobile) showChatPanel();

  // Mostrar skeleton mientras carga
  showMessagesSkeleton();

  // Cargar mensajes
  await loadMessages();

  // Iniciar polling del hilo
  _pollMsgTimer = setInterval(pollMessages, POLL_MSG_MS);

  // Actualizar dot status
  setChatStatusPolling(true);
}

function updateChatHeader(conv) {
  const partner  = conv.partner_name || 'Usuario';
  const initials = partner.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const propTitle = conv.property_title || conv.property_id?.slice(0, 12) || '—';

  document.getElementById('chat-header-avatar').textContent = initials;
  document.getElementById('chat-header-name').textContent   = partner;
  document.getElementById('chat-header-prop').textContent   = propTitle;

  // Mostrar header y input
  document.getElementById('chat-header').style.display     = 'flex';
  document.getElementById('chat-input-bar').style.display  = 'flex';
  document.getElementById('chat-placeholder').style.display = 'none';
}

/* ═══════════════════════════════════════════
   MENSAJES
═══════════════════════════════════════════ */
async function loadMessages() {
  try {
    const res  = await fetch(
      `${GATEWAY}/api/v1/chats/${_activeConvId}?limit=60&offset=0`,
      { headers: authHeaders() }
    );
    if (!res.ok) { handleAuthError(res.status); return; }
    const data = await res.json();
    _messages   = normalizeMessages(data);
    _lastMsgCount = _messages.length;
    renderMessages(true); // scroll to bottom
  } catch (err) {
    console.error('[messages]', err);
  }
}

async function pollMessages() {
  if (!_activeConvId) return;
  try {
    const res  = await fetch(
      `${GATEWAY}/api/v1/chats/${_activeConvId}?limit=60&offset=0`,
      { headers: authHeaders() }
    );
    if (!res.ok) return;
    const data = await res.json();
    const msgs = normalizeMessages(data);

    if (msgs.length !== _lastMsgCount) {
      _messages     = msgs;
      _lastMsgCount = msgs.length;
      renderMessages(true);
    }
  } catch (_) { /* silencioso */ }
}

function normalizeMessages(data) {
  // El backend puede devolver { messages: [...] } o un array directo
  const msgs = Array.isArray(data) ? data : (data.messages || data.items || []);
  // Ordenar por created_at ascendente
  return msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function renderMessages(scrollToBottom = false) {
  const container = document.getElementById('chat-messages');

  if (_messages.length === 0) {
    container.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p>Sin mensajes aún</p>
        <span>Escribí el primer mensaje</span>
      </div>`;
    return;
  }

  let html = '';
  let lastDate  = null;
  let lastSender = null;

  _messages.forEach(msg => {
    const msgDate = msg.created_at ? fmtDate(msg.created_at) : null;

    // Separador de fecha
    if (msgDate && msgDate !== lastDate) {
      html += `<div class="msg-date-sep">${esc(msgDate)}</div>`;
      lastDate   = msgDate;
      lastSender = null;
    }

    if (msg.type === 'visit_proposal') {
      html += renderVisitCard(msg);
      lastSender = 'card';
    } else {
      const isMine = msg.sender_id === _currentUserId;
      const side   = isMine ? 'mine' : 'theirs';
      const showTime = lastSender !== side;

      html += `
        <div class="msg-bubble-wrap ${side}">
          <div class="msg-bubble">${esc(msg.content || msg.body || '')}</div>
          ${showTime || lastSender === 'card'
            ? `<span class="msg-meta">${esc(fmtTime(msg.created_at))}</span>`
            : ''}
        </div>`;
      lastSender = side;
    }
  });

  container.innerHTML = html;

  if (scrollToBottom) {
    container.scrollTop = container.scrollHeight;
  }
}

function showMessagesSkeleton() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = `
    <div class="conv-skeleton" style="flex-direction:column;gap:12px;padding:20px 24px;align-items:flex-start">
      <div style="display:flex;gap:10px;align-self:flex-start;max-width:55%">
        <div class="skel-circle" style="width:28px;height:28px;flex-shrink:0"></div>
        <div class="skel-lines"><div class="skel-line"></div><div class="skel-line short"></div></div>
      </div>
      <div style="align-self:flex-end;max-width:60%;width:100%">
        <div class="skel-lines"><div class="skel-line"></div></div>
      </div>
      <div style="display:flex;gap:10px;align-self:flex-start;max-width:50%">
        <div class="skel-circle" style="width:28px;height:28px;flex-shrink:0"></div>
        <div class="skel-lines"><div class="skel-line"></div><div class="skel-line short"></div></div>
      </div>
    </div>`;
}

/* ── Card de propuesta de visita ── */
function renderVisitCard(msg) {
  const proposal = msg.visit_proposal || msg;
  const status   = proposal.status || 'pending';   // pending | confirmed | rejected
  const dt       = proposal.proposed_datetime || proposal.datetime;
  const note     = proposal.message || msg.content || '';

  const statusConfig = {
    pending:   { icon: calendarIcon(), label: 'Visita propuesta' },
    confirmed: { icon: checkIcon(),    label: 'Visita confirmada' },
    rejected:  { icon: xIcon(),        label: 'Visita rechazada' },
  };

  const cfg = statusConfig[status] || statusConfig.pending;

  // Solo el agente/propietario puede confirmar/rechazar propuestas pendientes
  const canAct = status === 'pending' &&
                 (_currentRole === 'agente' || _currentRole === 'propietario' || _currentRole === 'admin');

  const actionsHtml = canAct ? `
    <div class="visit-card-actions">
      <button class="btn-visit-confirm" onclick="respondVisit('${esc(proposal.id || msg.id)}', 'confirm')">
        Confirmar
      </button>
      <button class="btn-visit-reject" onclick="respondVisit('${esc(proposal.id || msg.id)}', 'reject')">
        Rechazar
      </button>
    </div>` : '';

  return `
    <div class="visit-proposal-card" data-proposal-id="${esc(proposal.id || msg.id)}">
      <div class="visit-card-header">
        <div class="visit-card-icon ${status}">${cfg.icon}</div>
        <span class="visit-card-label ${status}">${cfg.label}</span>
      </div>
      <div class="visit-card-body">
        <div class="visit-card-datetime">${dt ? fmtDatetimeFull(dt) : '—'}</div>
        ${note ? `<div class="visit-card-msg">${esc(note)}</div>` : ''}
      </div>
      ${actionsHtml}
    </div>`;
}

/* ── Responder propuesta de visita ── */
async function respondVisit(proposalId, action) {
  // Encontrar la conversación activa para armar la URL
  const endpoint = action === 'confirm'
    ? `${GATEWAY}/api/v1/chats/${_activeConvId}/visit-proposals/${proposalId}/confirm`
    : `${GATEWAY}/api/v1/chats/${_activeConvId}/visit-proposals/${proposalId}/reject`;

  try {
    const res = await fetch(endpoint, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Recargar mensajes inmediatamente
    await loadMessages();
  } catch (err) {
    console.error('[visit respond]', err);
    alert(`Error al ${action === 'confirm' ? 'confirmar' : 'rechazar'} la visita.`);
  }
}

/* ═══════════════════════════════════════════
   ENVIAR MENSAJE
═══════════════════════════════════════════ */
async function sendMessage() {
  if (!_activeConvId) return;

  const input   = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;

  const btn = document.getElementById('btn-send');
  btn.disabled = true;
  input.value  = '';
  autoResizeTextarea.call(input);

  // Optimistic UI: agregar el mensaje localmente ya
  const optimistic = {
    id:         'opt-' + Date.now(),
    sender_id:  _currentUserId,
    content,
    created_at: new Date().toISOString(),
    type:       'text',
  };
  _messages.push(optimistic);
  renderMessages(true);

  try {
    const res = await fetch(`${GATEWAY}/api/v1/chats/${_activeConvId}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      // Remover mensaje optimista si falló
      _messages = _messages.filter(m => m.id !== optimistic.id);
      renderMessages(false);
      console.error('[send msg] HTTP', res.status);
    } else {
      // El polling actualizará con el mensaje real del server
    }
  } catch (err) {
    _messages = _messages.filter(m => m.id !== optimistic.id);
    renderMessages(false);
    console.error('[send msg]', err);
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

/* ═══════════════════════════════════════════
   MOBILE NAV
═══════════════════════════════════════════ */
function showChatPanel() {
  document.getElementById('conv-list-panel').classList.add('hidden');
  document.getElementById('chat-panel').classList.add('visible');
  document.getElementById('btn-back').style.display = 'flex';
}

function goBackToList() {
  document.getElementById('conv-list-panel').classList.remove('hidden');
  document.getElementById('chat-panel').classList.remove('visible');
  document.getElementById('btn-back').style.display = 'none';
  _activeConvId = null;
  clearInterval(_pollMsgTimer);
  setChatStatusPolling(false);
}

/* ═══════════════════════════════════════════
   UI HELPERS
═══════════════════════════════════════════ */
function setChatStatusPolling(active) {
  const dot  = document.getElementById('chat-status-dot');
  const text = document.getElementById('chat-status-text');
  if (!dot || !text) return;
  if (active) {
    dot.classList.add('polling');
    text.textContent = 'En vivo';
  } else {
    dot.classList.remove('polling');
    text.textContent = '';
  }
}

function autoResizeTextarea() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';
}

function handleAuthError(status) {
  if (status === 401 || status === 403) {
    localStorage.removeItem('inmo_token');
    window.location.href = 'loginregister.html?return=' + encodeURIComponent(window.location.href);
  }
}

/* ─── Íconos inline ─── */
function calendarIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
}
function checkIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
}
function xIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
}

/* ─── Formateo de fechas ─── */
function fmtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d   = new Date(iso);
    const hoy = new Date();
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
    if (d.toDateString() === hoy.toDateString())  return 'Hoy';
    if (d.toDateString() === ayer.toDateString()) return 'Ayer';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
  } catch { return ''; }
}

function fmtDatetimeFull(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

/* ─── Escape HTML ─── */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

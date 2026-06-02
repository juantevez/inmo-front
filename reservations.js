'use strict';

/* ─────────────────────────────────────────
   CONFIG
───────────────────────────────────────── */
const GATEWAY       = 'http://127.0.0.1:8000';
const POLL_INTERVAL = 30_000; // 30 segundos

let _pollTimer       = null;
let _activeRes       = null;   // reserva que está abierta en el modal de acción
let _bannerDismissed = false;

/* ─────────────────────────────────────────
   AUTH
───────────────────────────────────────── */
function authHeaders() {
  const token = localStorage.getItem('inmo_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function logout() {
  ['inmo_token','inmo_user','inmo_pending_role','inmo_pending_email'].forEach(k => localStorage.removeItem(k));
  window.location.href = 'landing.html';
}

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Redirigir si no hay token
  if (!localStorage.getItem('inmo_token')) {
    window.location.href = 'loginregister.html';
    return;
  }

  // Rellenar info de usuario en sidebar
  try {
    const user = JSON.parse(localStorage.getItem('inmo_user') || '{}');
    if (user.firstName) {
      const initials = (user.firstName[0] + (user.lastName?.[0] || '')).toUpperCase();
      document.getElementById('user-avatar-initials').textContent = initials;
      document.getElementById('user-display-name').textContent =
        `${user.firstName} ${user.lastName || ''}`.trim();
    }
    if (user.email) {
      document.getElementById('user-display-email').textContent = user.email;
    }
  } catch (_) {}

  // Primer fetch
  loadAll();

  // Polling
  _pollTimer = setInterval(loadAll, POLL_INTERVAL);
});

/* ─────────────────────────────────────────
   FETCH PRINCIPAL
───────────────────────────────────────── */
async function loadAll() {
  try {
    const res  = await fetch(`${GATEWAY}/api/v1/reservations/owner`, {
      headers: authHeaders(),
    });

    if (res.status === 401) {
      logout();
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data         = await res.json();
    const reservations = Array.isArray(data) ? data : (data.reservations || data.items || data.data || []);

    setConnectionStatus(true);
    updateLastRefresh();
    processReservations(reservations);
  } catch (err) {
    console.error('[reservations]', err);
    setConnectionStatus(false);
  }
}

function processReservations(list) {
  const pending   = list.filter(r => r.status === 'PENDING_APPROVAL');
  const confirmed = list.filter(r => r.status === 'CONFIRMED');
  const history   = list.filter(r => ['CANCELLED','REJECTED','COMPLETED'].includes(r.status));

  // Stats
  document.getElementById('stat-pending').textContent   = pending.length;
  document.getElementById('stat-confirmed').textContent = confirmed.length;
  document.getElementById('stat-completed').textContent = list.filter(r => r.status === 'COMPLETED').length;
  document.getElementById('stat-cancelled').textContent =
    list.filter(r => ['CANCELLED','REJECTED'].includes(r.status)).length;

  // Tab counters
  setTabCount('count-pending',   pending.length,   pending.length   > 0);
  setTabCount('count-confirmed', confirmed.length, false);
  setTabCount('count-history',   history.length,   false);

  // Nav badge (sidebar)
  const navBadge = document.getElementById('nav-pending-count');
  if (navBadge) {
    if (pending.length > 0) {
      navBadge.textContent = pending.length;
      navBadge.style.display = 'flex';
    } else {
      navBadge.style.display = 'none';
    }
  }

  // Alert banner
  if (pending.length > 0 && !_bannerDismissed) {
    showBanner(pending.length);
  } else if (pending.length === 0) {
    hideBanner();
  }

  // Panels
  renderPanel('panel-pending',   'skel-pending',   pending,   true);
  renderPanel('panel-confirmed', 'skel-confirmed', confirmed, false);
  renderPanel('panel-history',   'skel-history',   history,   false);
}

/* ─────────────────────────────────────────
   RENDER
───────────────────────────────────────── */
function renderPanel(panelId, skelId, list, showActions) {
  const panel    = document.getElementById(panelId);
  const skeleton = document.getElementById(skelId);

  // Quitar skeleton
  if (skeleton) skeleton.remove();

  // Limpiar cards anteriores (excepto skeleton si aún existe)
  panel.querySelectorAll('.res-card').forEach(c => c.remove());
  panel.querySelectorAll('.empty-state').forEach(e => e.remove());

  if (!list.length) {
    panel.appendChild(emptyState(showActions));
    return;
  }

  list.forEach(r => panel.appendChild(buildCard(r, showActions)));
}

function buildCard(r, showActions) {
  const card     = document.createElement('div');
  const status   = r.status || 'PENDING_APPROVAL';
  const cssClass = {
    PENDING_APPROVAL: 'pending',
    CONFIRMED:        'confirmed',
    CANCELLED:        'cancelled',
    REJECTED:         'rejected',
    COMPLETED:        '',
  }[status] || '';

  card.className = `res-card ${cssClass}`;

  const guestName  = r.guest_name || r.guestName || 'Inquilino';
  const initials   = guestName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const propTitle  = r.property_title || r.propertyTitle || `Propiedad ${(r.property_id || '').slice(0, 8)}`;
  const checkIn    = formatDate(r.check_in_date  || r.checkInDate);
  const checkOut   = formatDate(r.check_out_date || r.checkOutDate);
  const nights     = calcNights(r.check_in_date  || r.checkInDate, r.check_out_date || r.checkOutDate);
  const totalAmt   = r.total_amount || r.totalAmount || r.total || 0;
  const currency   = r.currency || 'USD';
  const message    = r.guest_message || r.guestMessage || '';

  const statusLabel = {
    PENDING_APPROVAL: 'Pendiente',
    CONFIRMED:        'Confirmada',
    CANCELLED:        'Cancelada',
    REJECTED:         'Rechazada',
    COMPLETED:        'Completada',
  }[status] || status;

  card.innerHTML = `
    <div class="res-card-header">
      <div class="res-card-avatar">${escHtml(initials)}</div>
      <div class="res-card-info">
        <div class="res-card-guest">${escHtml(guestName)}</div>
        <div class="res-card-prop">${escHtml(propTitle)}</div>
      </div>
      <span class="res-status-badge badge-${status}">${statusLabel}</span>
    </div>
    <div class="res-card-body">
      <div class="res-field">
        <span class="res-field-lbl">Check-in</span>
        <span class="res-field-val">${checkIn}</span>
      </div>
      <div class="res-field">
        <span class="res-field-lbl">Check-out</span>
        <span class="res-field-val">${checkOut}</span>
      </div>
      <div class="res-field">
        <span class="res-field-lbl">Noches / Total</span>
        <span class="res-field-val">${nights}n · ${fmtCurrency(totalAmt, currency)}</span>
      </div>
      ${showActions ? `
        <div class="res-card-actions">
          <button class="btn-reject" onclick="openRejectModal('${r.id}')">
            <span class="btn-text">Rechazar</span>
            <span class="btn-loader" aria-hidden="true"></span>
          </button>
          <button class="btn-accept" onclick="openActionModal(${JSON.stringify(r).replace(/"/g, '&quot;')})">
            <span class="btn-text">Ver detalle</span>
          </button>
        </div>` : `
        <div class="res-card-actions">
          <button class="btn-ghost" onclick="openActionModal(${JSON.stringify(r).replace(/"/g, '&quot;')})">
            Ver detalle
          </button>
        </div>`
      }
    </div>
    ${message ? `
      <div class="res-card-message">
        <div class="res-message-text">"${escHtml(message)}"</div>
      </div>` : ''}
  `;

  return card;
}

function emptyState(isPending) {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = isPending
    ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
       <p>No hay solicitudes pendientes</p>
       <span>Cuando un inquilino solicite una reserva, aparecerá acá.</span>`
    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
       <p>Sin registros</p>
       <span>No hay reservas en esta categoría aún.</span>`;
  return div;
}

/* ─────────────────────────────────────────
   MODAL DE ACCIÓN (detalle + Aceptar)
───────────────────────────────────────── */
function openActionModal(r) {
  _activeRes = r;

  const guestName = r.guest_name || r.guestName || 'Inquilino';
  const propTitle = r.property_title || r.propertyTitle || 'Propiedad';
  const checkIn   = formatDate(r.check_in_date  || r.checkInDate);
  const checkOut  = formatDate(r.check_out_date || r.checkOutDate);
  const nights    = calcNights(r.check_in_date  || r.checkInDate, r.check_out_date || r.checkOutDate);
  const currency  = r.currency || 'USD';
  const nightPrice   = r.night_price      || r.nightPrice      || 0;
  const cleaningFee  = r.cleaning_fee     || r.cleaningFee     || 0;
  const deposit      = r.security_deposit || r.securityDeposit || 0;
  const subtotal     = r.subtotal         || (nightPrice * nights) || 0;
  const total        = r.total_amount     || r.totalAmount      || r.total || subtotal + cleaningFee;
  const message      = r.guest_message    || r.guestMessage     || '';
  const guestEmail   = r.guest_email      || r.guestEmail       || '';
  const guestPhone   = r.guest_phone      || r.guestPhone       || '';
  const initials     = guestName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const status       = r.status || 'PENDING_APPROVAL';
  const isPending    = status === 'PENDING_APPROVAL';

  document.getElementById('modal-prop-title').textContent = `Solicitud — ${propTitle}`;

  document.getElementById('modal-action-body').innerHTML = `
    <!-- Guest info -->
    <div class="guest-row">
      <div class="guest-avatar-lg">${escHtml(initials)}</div>
      <div class="guest-details">
        <div class="guest-name">${escHtml(guestName)}</div>
        <div class="guest-meta">
          ${guestEmail ? `<span>${escHtml(guestEmail)}</span>` : ''}
          ${guestPhone ? `<span>${escHtml(guestPhone)}</span>` : ''}
          <span>ID: <code style="font-size:11px">${escHtml(r.id || '')}</code></span>
        </div>
      </div>
    </div>

    <!-- Fechas -->
    <div class="dates-block">
      <div class="date-field">
        <span class="date-lbl">Check-in</span>
        <span class="date-val">${checkIn}</span>
      </div>
      <div class="date-field">
        <span class="date-lbl">Check-out</span>
        <span class="date-val">${checkOut}</span>
      </div>
      <div class="date-field">
        <span class="date-lbl">Estadía</span>
        <span class="date-val">${nights} noche${nights !== 1 ? 's' : ''}</span>
      </div>
    </div>

    <!-- Desglose financiero -->
    <div class="finance-block">
      <div class="finance-title">Desglose financiero</div>
      <div class="finance-rows">
        ${nightPrice > 0 ? `
          <div class="finance-row">
            <span>${nights} noches × ${fmtCurrency(nightPrice, currency)}</span>
            <span>${fmtCurrency(subtotal || nightPrice * nights, currency)}</span>
          </div>` : ''}
        ${cleaningFee > 0 ? `
          <div class="finance-row">
            <span>Limpieza</span>
            <span>${fmtCurrency(cleaningFee, currency)}</span>
          </div>` : ''}
        ${deposit > 0 ? `
          <div class="finance-row" style="color:var(--ink-40)">
            <span>Depósito en garantía <small>(reintegrable)</small></span>
            <span>${fmtCurrency(deposit, currency)}</span>
          </div>` : ''}
        <div class="finance-row total">
          <span>Total bruto a recibir</span>
          <span class="finance-amount">${fmtCurrency(total, currency)}</span>
        </div>
      </div>
    </div>

    <!-- Mensaje del inquilino -->
    ${message ? `
      <div class="message-block">
        <div class="message-lbl">Mensaje del inquilino</div>
        <div class="message-text">${escHtml(message)}</div>
      </div>` : ''}

    <div class="form-msg" id="action-msg"></div>
  `;

  // Footer según estado
  const footer = document.getElementById('modal-action-footer');
  if (isPending) {
    footer.innerHTML = `
      <button class="btn-ghost" onclick="closeModal('modal-action')">Cancelar</button>
      <button class="btn-reject" id="btn-modal-reject" onclick="openRejectFromModal()">
        <span class="btn-text">Rechazar</span>
        <span class="btn-loader" aria-hidden="true"></span>
      </button>
      <button class="btn-accept" id="btn-modal-accept" onclick="acceptReservation('${r.id}')">
        <span class="btn-text">Aceptar reserva</span>
        <span class="btn-loader" aria-hidden="true"></span>
      </button>
    `;
  } else {
    footer.innerHTML = `<button class="btn-ghost" onclick="closeModal('modal-action')">Cerrar</button>`;
  }

  openModal('modal-action');
}

/* ─────────────────────────────────────────
   ACEPTAR
───────────────────────────────────────── */
async function acceptReservation(id) {
  const btn = document.getElementById('btn-modal-accept');
  if (btn) { btn.classList.add('loading'); btn.disabled = true; }
  hideFormMsg('action-msg');

  try {
    const res = await fetch(`${GATEWAY}/api/v1/reservations/${id}/confirm`, {
      method: 'POST',
      headers: authHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showFormMsg('action-msg', err.message || `Error ${res.status}`, 'error');
      return;
    }

    closeModal('modal-action');
    showToast('¡Reserva confirmada con éxito!', 'success');
    await loadAll();
  } catch (err) {
    console.error('[accept]', err);
    showFormMsg('action-msg', 'No se pudo conectar al servidor de contratos.', 'error');
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
}

/* ─────────────────────────────────────────
   RECHAZAR
───────────────────────────────────────── */
function openRejectModal(id) {
  // Buscar la reserva por ID en el DOM para tenerla disponible
  // (puede que se llame desde tarjeta o desde modal)
  _activeRes = _activeRes?.id === id ? _activeRes : { id };
  hideFormMsg('reject-msg');
  // Reset radio selection
  const firstRadio = document.querySelector('input[name="reject-reason"]');
  if (firstRadio) firstRadio.checked = true;
  openModal('modal-reject');
}

function openRejectFromModal() {
  // Llamado desde dentro del modal de acción
  openModal('modal-reject');
}

async function confirmReject() {
  const btn    = document.getElementById('btn-reject-confirm');
  const reason = document.querySelector('input[name="reject-reason"]:checked')?.value || 'OTHER';

  btn.classList.add('loading');
  btn.disabled = true;
  hideFormMsg('reject-msg');

  try {
    const res = await fetch(`${GATEWAY}/api/v1/reservations/${_activeRes.id}/cancel`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reason }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showFormMsg('reject-msg', err.message || `Error ${res.status}`, 'error');
      return;
    }

    closeModal('modal-reject');
    closeModal('modal-action');
    showToast('Solicitud rechazada.', 'error');
    await loadAll();
  } catch (err) {
    console.error('[reject]', err);
    showFormMsg('reject-msg', 'No se pudo conectar al servidor.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ─────────────────────────────────────────
   TABS
───────────────────────────────────────── */
function switchTab(tab) {
  const panels = { pending: 'panel-pending', confirmed: 'panel-confirmed', history: 'panel-history' };
  const btns   = { pending: 'tab-pending',   confirmed: 'tab-confirmed',   history: 'tab-history' };

  Object.entries(panels).forEach(([key, panelId]) => {
    const panel = document.getElementById(panelId);
    const btn   = document.getElementById(btns[key]);
    const isActive = key === tab;
    panel.classList.toggle('active', isActive);
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  // Si el usuario fue al tab de pendientes desde el banner, lo dismiss
  if (tab === 'pending') _bannerDismissed = false;
}

function setTabCount(id, count, highlight) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('has-items', highlight && count > 0);
}

/* ─────────────────────────────────────────
   ALERT BANNER
───────────────────────────────────────── */
function showBanner(count) {
  const banner = document.getElementById('alert-banner');
  document.getElementById('alert-banner-text').textContent =
    count === 1
      ? 'Tenés 1 solicitud de reserva pendiente de aprobación.'
      : `Tenés ${count} solicitudes de reserva pendientes de aprobación.`;
  document.getElementById('alert-banner-sub').textContent =
    'Revisalas para que los inquilinos reciban una respuesta a tiempo.';
  banner.classList.remove('hidden');
}

function hideBanner() {
  document.getElementById('alert-banner').classList.add('hidden');
}

function closeBanner() {
  _bannerDismissed = true;
  hideBanner();
}

/* ─────────────────────────────────────────
   MODAL HELPERS
───────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // Sólo restaurar overflow si no queda otro modal abierto
  if (!document.querySelector('.modal-overlay.open')) {
    document.body.style.overflow = '';
  }
}

/* ─────────────────────────────────────────
   FORM MESSAGES
───────────────────────────────────────── */
function showFormMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `form-msg ${type} visible`;
}

function hideFormMsg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'form-msg';
  el.textContent = '';
}

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
function showToast(text, type = '') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
    : type === 'error'
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>`;

  toast.innerHTML = `${icon}<span>${escHtml(text)}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 4200);
}

/* ─────────────────────────────────────────
   STATUS / REFRESH
───────────────────────────────────────── */
function setConnectionStatus(ok) {
  const dot  = document.getElementById('status-dot');
  const text = document.getElementById('status-text');
  if (dot)  dot.classList.toggle('error', !ok);
  if (text) text.textContent = ok ? 'Conectado' : 'Sin conexión';
}

function updateLastRefresh() {
  const el = document.getElementById('last-refresh-text');
  if (!el) return;
  const now = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  el.textContent = `Actualizado ${now}`;
}

/* ─────────────────────────────────────────
   UTILS
───────────────────────────────────────── */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function calcNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function fmtCurrency(amount, currency = 'USD') {
  const n = Number(amount || 0);
  if (currency === 'ARS') {
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  }
  return `U$S ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
'use strict';

/* ── API config ── */
const GATEWAY = 'http://localhost:8000';

const API = {
  catalog:     GATEWAY,
  crm:         GATEWAY,
  contracts:   GATEWAY,
  finances:    GATEWAY,
  maintenance: GATEWAY,
};

/* ── State ── */
let currentRole   = 'agente';
let currentView   = 'catalog';
let catalogPage   = 0;
const PAGE_SIZE   = 12;
let debounceTimer = null;

/* ── Reservas: polling de pendientes para badge en sidebar ── */
let _resBadgeTimer = null;

/* ── Role definitions ── */
const ROLES = {
  agente: {
    nav: [
      { id: 'catalog',      label: 'Catálogo',        icon: iconHome },
      { id: 'crm',          label: 'CRM / Leads',     icon: iconUsers },
      { id: 'contracts',    label: 'Contratos',        icon: iconFile },
      { id: 'maintenance',  label: 'Mantenimiento',    icon: iconTool },
      /* ── NUEVO: enlace externo al panel de reservas ── */
      { id: 'reservations', label: 'Mis reservas',     icon: iconCalendar, href: 'reservations.html', badge: 'res' },
    ]
  },
  propietario: {
    nav: [
      { id: 'catalog',      label: 'Mis propiedades', icon: iconHome },
      { id: 'contracts',    label: 'Contratos',        icon: iconFile },
      { id: 'finances',     label: 'Liquidaciones',    icon: iconMoney },
      /* ── NUEVO: enlace externo al panel de reservas ── */
      { id: 'reservations', label: 'Mis reservas',     icon: iconCalendar, href: 'reservations.html', badge: 'res' },
    ]
  },
  buscador: {
    nav: [
      { id: 'catalog', label: 'Buscar propiedades', icon: iconHome },
      { id: 'crm',     label: 'Mis consultas',      icon: iconUsers },
    ]
  },
  inquilino: {
    nav: [
      { id: 'contracts',   label: 'Mi contrato',    icon: iconFile },
      { id: 'finances',    label: 'Pagos',           icon: iconMoney },
      { id: 'maintenance', label: 'Mantenimiento',   icon: iconTool },
    ]
  },
  proveedor: {
    nav: [
      { id: 'maintenance', label: 'Órdenes de trabajo', icon: iconTool },
    ]
  },
  admin: {
    nav: [
      { id: 'catalog',      label: 'Catálogo',        icon: iconHome },
      { id: 'crm',          label: 'CRM',             icon: iconUsers },
      { id: 'contracts',    label: 'Contratos',        icon: iconFile },
      { id: 'finances',     label: 'Finanzas',         icon: iconMoney },
      { id: 'maintenance',  label: 'Mantenimiento',    icon: iconTool },
      { id: 'reservations', label: 'Reservas',         icon: iconCalendar, href: 'reservations.html', badge: 'res' },
      { id: 'admin',        label: 'Administración',   icon: iconShield, badge: 'admin' },
    ]
  },
};

/* ── Icons ── */
function iconHome()     { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`; }
function iconUsers()    { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`; }
function iconFile()     { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`; }
function iconMoney()    { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`; }
function iconTool()     { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`; }
function iconShield()   { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; }
/* ── NUEVO ── */
function iconCalendar() { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`; }

/* ── VIEW titles ── */
const VIEW_TITLES = {
  catalog:     'Catálogo de propiedades',
  crm:         'CRM / Gestión de leads',
  contracts:   'Contratos',
  finances:    'Finanzas',
  maintenance: 'Mantenimiento',
  admin:       'Administración',
};

/* ── Role switching ── */
function switchRole(role, btn) {
  currentRole = role;
  document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  buildNav();
  const firstView = ROLES[role].nav[0].id;

  // Si el primer item es externo (href), no hacer showView
  const firstItem = ROLES[role].nav[0];
  if (firstItem.href) {
    window.location.href = firstItem.href;
    return;
  }

  showView(firstView);

  // Activar/desactivar polling de reservas según rol
  manageBadgePolling(role);
}

function buildNav() {
  const nav   = document.getElementById('sidebar-nav');
  const items = ROLES[currentRole].nav;

  nav.innerHTML = items.map(item => {
    // Item con href → <a> link externo
    if (item.href) {
      const badgeHtml = item.badge === 'res'
        ? `<span class="nav-badge nav-badge-res" id="nav-badge-res" style="display:none;
            margin-left:auto;background:#C0392B;color:#fff;font-size:10px;font-weight:600;
            min-width:17px;height:17px;align-items:center;justify-content:center;
            border-radius:99px;padding:0 4px;"></span>`
        : '';
      return `
        <a class="nav-item" href="${item.href}" style="text-decoration:none">
          ${item.icon()}
          ${item.label}
          ${badgeHtml}
        </a>`;
    }

    // Item interno → <button>
    const badgeHtml = item.badge === 'admin'
      ? `<span class="nav-badge">${item.badge}</span>`
      : '';
    return `
      <button
        class="nav-item ${item.id === currentView ? 'active' : ''}"
        onclick="showView('${item.id}')"
      >
        ${item.icon()}
        ${item.label}
        ${badgeHtml}
      </button>`;
  }).join('');
}

function showView(viewId) {
  currentView = viewId;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add('active');

  document.getElementById('page-title').textContent = VIEW_TITLES[viewId] || viewId;

  buildNav();

  if (viewId === 'catalog') { catalogPage = 0; loadProperties(); }
  if (viewId === 'crm')     { loadLeads(); }
}

/* ── Sidebar toggle (mobile) ── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ═══════════════════════════════════════
   BADGE DE RESERVAS PENDIENTES (polling)
═══════════════════════════════════════ */
const BADGE_POLL_MS = 30_000;

function manageBadgePolling(role) {
  clearInterval(_resBadgeTimer);
  const rolesConReservas = ['propietario', 'agente', 'admin'];
  if (rolesConReservas.includes(role)) {
    fetchPendingCount();
    _resBadgeTimer = setInterval(fetchPendingCount, BADGE_POLL_MS);
  }
}

async function fetchPendingCount() {
  try {
    const res = await fetch(`${GATEWAY}/api/v1/reservations/owner`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.reservations || data.items || data.data || []);
    const pending = list.filter(r => r.status === 'PENDING_APPROVAL').length;
    updateResBadge(pending);
  } catch (_) {
    /* silencioso — el badge no es crítico */
  }
}

function updateResBadge(count) {
  // El badge puede estar en el nav recién construido
  const badge = document.getElementById('nav-badge-res');
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ═══════════════════════════════════════
   CATÁLOGO — :8081
═══════════════════════════════════════ */

function debounceLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadProperties(), 500);
}

async function loadProperties() {
  const grid  = document.getElementById('properties-grid');
  const pager = document.getElementById('catalog-pagination');
  grid.innerHTML = `<div class="skeleton-grid">${'<div class="skeleton-card"></div>'.repeat(6)}</div>`;
  pager.innerHTML = '';

  const operation = document.getElementById('filter-operation').value;
  const status     = document.getElementById('filter-status').value;
  const minPrice   = document.getElementById('filter-min').value;
  const maxPrice   = document.getElementById('filter-max').value;
  const offset     = catalogPage * PAGE_SIZE;

  const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
  if (operation) params.set('operation', operation);
  if (status)    params.set('status', status);
  if (minPrice)  params.set('min_price', minPrice);
  if (maxPrice)  params.set('max_price', maxPrice);

  try {
    const res  = await fetch(`${API.catalog}/api/v1/properties?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const props = Array.isArray(data) ? data : (data.properties || data.items || data.data || []);
    const total = data.total ?? data.Total ?? props.length;

    updateCatalogStats(props);
    renderProperties(props);
    renderPagination(total, pager);
    setStatus(true);
  } catch (err) {
    console.error('[catalog]', err);
    setStatus(false);
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p>No se pudo conectar al servicio de catálogo</p>
        <span>Verificá que el servidor esté corriendo en <code>:8081</code></span>
      </div>`;
  }
}

function updateCatalogStats(props) {
  document.getElementById('stat-total').textContent     = props.length;
  document.getElementById('stat-available').textContent = props.filter(p => p.state === 'AVAILABLE').length;
  document.getElementById('stat-reserved').textContent  = props.filter(p => p.state === 'RESERVED').length;
  document.getElementById('stat-repair').textContent    = props.filter(p => p.state === 'UNDER_REPAIR').length;
}

function renderProperties(props) {
  const grid = document.getElementById('properties-grid');

  if (!props.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <p>No hay propiedades con los filtros seleccionados</p>
        <span>Publicá la primera o ajustá los filtros</span>
      </div>`;
    return;
  }

  grid.innerHTML = `<div class="prop-grid">${props.map(propCard).join('')}</div>`;
}

function propCard(p) {
  const stateLabel = { AVAILABLE: 'Disponible', RESERVED: 'Reservada', CLOSED: 'Alquilada', UNDER_REPAIR: 'En reparación', RENTED: 'Alquilada' };
  const opLabel   = { SALE: 'Venta', RENT: 'Alquiler', TEMP: 'Temporario' };
  const rawPrice  = typeof p.price === 'object' ? p.price?.amount : p.price;
  const price     = Number(rawPrice || p.amount || 0).toLocaleString('es-AR');
  const currency  = (typeof p.price === 'object' ? p.price?.currency : p.currency) || 'ARS';
  const shortId   = (p.id || '').slice(0, 8);
  const opType    = p.operation_type || 'SALE';

  return `
    <div class="prop-card" onclick="openDetail(${JSON.stringify(p).replace(/"/g, '&quot;')})">
      <div class="prop-card-img">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span class="prop-state-badge state-${p.state || 'AVAILABLE'}">${stateLabel[p.state] || p.state || 'Disponible'}</span>
        <span class="prop-op-badge op-${opType}">${opLabel[opType] || opType}</span>
      </div>
      <div class="prop-card-body">
        <p class="prop-card-title">${escHtml(p.title || 'Sin título')}</p>
        <p class="prop-card-addr">${escHtml(p.address || p.location?.address || '—')}</p>
        <div class="prop-card-footer">
          <span class="prop-price">${price}<span class="prop-currency">${currency}</span></span>
          <span class="prop-id">#${shortId}</span>
        </div>
      </div>
    </div>`;
}

function renderPagination(total, container) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return;

  let html = '';
  if (catalogPage > 0) html += `<button class="page-btn" onclick="goPage(${catalogPage - 1})">&#8249;</button>`;
  for (let i = 0; i < pages; i++) {
    html += `<button class="page-btn ${i === catalogPage ? 'active' : ''}" onclick="goPage(${i})">${i + 1}</button>`;
  }
  if (catalogPage < pages - 1) html += `<button class="page-btn" onclick="goPage(${catalogPage + 1})">&#8250;</button>`;
  container.innerHTML = html;
}

function goPage(n) {
  catalogPage = n;
  loadProperties();
}

/* ── Detalle de propiedad ── */
let _detailProperty = null;

async function openDetail(p) {
  _detailProperty = p;
  document.getElementById('detail-title').textContent = p.title || 'Propiedad';
  const stateLabel = { AVAILABLE: 'Disponible', RESERVED: 'Reservada', CLOSED: 'Alquilada/Vendida', UNDER_REPAIR: 'En reparación' };
  const rawPrice = typeof p.price === 'object' ? p.price?.amount : p.price;
  const price    = Number(rawPrice || p.amount || 0).toLocaleString('es-AR');
  const currency = (typeof p.price === 'object' ? p.price?.currency : p.currency) || 'ARS';
  const isTemp   = (p.operation_type || p.operationType) === 'TEMP';

  let amenitiesHtml = '';
  const amenities = p.temp_config?.amenities || p.amenities || [];
  if (amenities.length > 0) {
    const byCategory = { infrastructure: [], comfort: [], premium: [] };
    amenities.forEach(a => { (byCategory[a.category] || byCategory.comfort).push(a.label); });
    const catLabel = { infrastructure: '🏗️ Infraestructura', comfort: '🛋️ Confort', premium: '⭐ Premium' };
    amenitiesHtml = `<div class="detail-field full"><span>Comodidades</span><div class="amenities-display">` +
      Object.entries(byCategory).filter(([,v]) => v.length).map(([k,v]) =>
        `<div class="amenity-group"><strong>${catLabel[k]}</strong> ${v.map(a => `<span class="amenity-tag">${escHtml(a)}</span>`).join('')}</div>`
      ).join('') + `</div></div>`;
  }

  let tempPriceHtml = '';
  const tc = p.temp_config || p;
  if (isTemp && (tc.night_price || tc.nightPrice)) {
    const np  = tc.night_price  || tc.nightPrice  || 0;
    const cf  = tc.cleaning_fee || tc.cleaningFee  || 0;
    const dep = tc.security_deposit || tc.securityDeposit || 0;
    const minN = tc.min_nights || tc.minNights || 1;
    const maxN = tc.max_nights || tc.maxNights || 90;
    tempPriceHtml = `
      <div class="detail-field"><span>Precio/noche</span><span>${Number(np).toLocaleString('es-AR')} ${currency}</span></div>
      <div class="detail-field"><span>Limpieza</span><span>${Number(cf).toLocaleString('es-AR')} ${currency}</span></div>
      <div class="detail-field"><span>Depósito</span><span>${Number(dep).toLocaleString('es-AR')} ${currency}</span></div>
      <div class="detail-field"><span>Estadía</span><span>${minN}–${maxN} noches</span></div>
      <div class="detail-field"><span>Check-in</span><span>${tc.check_in_time || tc.checkInTime || '14:00'} hs</span></div>
      <div class="detail-field"><span>Check-out</span><span>${tc.check_out_time || tc.checkOutTime || '10:00'} hs</span></div>`;
  }

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-field full"><span>ID</span><span style="font-family:monospace;font-size:12px">${escHtml(p.id || '—')}</span></div>
      <div class="detail-field"><span>Estado</span><span class="prop-state-badge state-${p.state}">${stateLabel[p.state] || p.state}</span></div>
      <div class="detail-field"><span>Precio base</span><span>${price} ${currency}</span></div>
      ${tempPriceHtml}
      <div class="detail-field full"><span>Dirección</span><span>${escHtml(p.address || p.location?.address || '—')}</span></div>
      <div class="detail-field full"><span>Descripción</span><span>${escHtml(p.description || '—')}</span></div>
      ${amenitiesHtml}
    </div>`;

  const footer = document.getElementById('detail-footer');
  if (p.state === 'AVAILABLE') {
    if (isTemp) {
      footer.innerHTML = `
        <button class="btn-ghost" onclick="closeModal('modal-detail')">Cerrar</button>
        <button class="btn-primary-sm" onclick="openReservationModal()">
          <span class="btn-text">Solicitar reserva</span>
          <span class="btn-loader"></span>
        </button>`;
    } else {
      footer.innerHTML = `
        <button class="btn-ghost" onclick="closeModal('modal-detail')">Cerrar</button>
        <button class="btn-primary-sm" onclick="reserveProperty('${p.id}')">
          <span class="btn-text">Reservar</span>
          <span class="btn-loader"></span>
        </button>`;
    }
  } else {
    footer.innerHTML = `<button class="btn-ghost" onclick="closeModal('modal-detail')">Cerrar</button>`;
  }

  openModal('modal-detail');
  loadPropertyMedia(p.id);
}

async function loadPropertyMedia(propertyID) {
  try {
    const res = await fetch(`${API.catalog}/api/v1/properties/${propertyID}/media`);
    if (!res.ok) return;
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return;

    const images  = items.filter(m => m.type === 'IMAGE' || m.type === 'VIDEO');
    const socials = items.filter(m => m.type === 'SOCIAL_LINK');

    let html = '';

    if (images.length > 0) {
      html += `<div class="media-gallery">` +
        images.map(m => {
          if (m.type === 'VIDEO') {
            return `<video class="media-thumb" src="${escHtml(m.url)}" controls preload="none"></video>`;
          }
          return `<a href="${escHtml(m.url)}" target="_blank" rel="noopener">
                    <img class="media-thumb" src="${escHtml(m.url)}" alt="foto de la propiedad" loading="lazy" />
                  </a>`;
        }).join('') +
        `</div>`;
    }

    if (socials.length > 0 && socials[0].social_links) {
      const links = socials[0].social_links;
      html += `<div class="social-links-display">` +
        Object.entries(links).map(([platform, url]) =>
          `<a class="social-link-pill" href="${escHtml(url)}" target="_blank" rel="noopener">
             ${escHtml(platform)}
           </a>`
        ).join('') +
        `</div>`;
    }

    if (html) {
      const mediaSection = document.createElement('div');
      mediaSection.className = 'detail-media-section';
      mediaSection.innerHTML = html;
      document.getElementById('detail-body').prepend(mediaSection);
    }
  } catch (err) {
    console.error('[media load]', err);
  }
}

/* ── Reserva temporaria ── */
function openReservationModal() {
  if (!_detailProperty) return;
  document.getElementById('modal-res-title').textContent = 'Reservar: ' + (_detailProperty.title || 'Propiedad');
  document.getElementById('quote-breakdown').style.display = 'none';
  document.getElementById('quote-breakdown').innerHTML = '';
  document.getElementById('res-message').value = '';
  hideFormMsg('reservation-msg');

  const today    = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  document.getElementById('res-checkin').min   = today.toISOString().split('T')[0];
  document.getElementById('res-checkout').min  = tomorrow.toISOString().split('T')[0];
  document.getElementById('res-checkin').value  = '';
  document.getElementById('res-checkout').value = '';

  closeModal('modal-detail');
  openModal('modal-reservation');
}

async function fetchQuote() {
  const propID   = _detailProperty?.id;
  const checkIn  = document.getElementById('res-checkin').value;
  const checkOut = document.getElementById('res-checkout').value;
  if (!propID || !checkIn || !checkOut) return;

  const breakdown = document.getElementById('quote-breakdown');
  breakdown.style.display = 'block';
  breakdown.innerHTML = '<div style="color:var(--ink-40);font-size:13px">Calculando...</div>';

  try {
    const res = await fetch(`${API.catalog}/api/v1/properties/${propID}/quote`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ check_in_date: checkIn, check_out_date: checkOut }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      breakdown.innerHTML = `<div style="color:var(--danger);font-size:13px">${escHtml(data.message || 'Fechas no disponibles')}</div>`;
      return;
    }
    breakdown.innerHTML = `
      <div class="quote-line"><span>${escHtml(data.nights + ' noches × ' + fmtARS(data.night_price))}</span><span>${fmtARS(data.subtotal)}</span></div>
      ${data.discount_amount > 0 ? `<div class="quote-line discount"><span>Descuento (${data.discount_pct}%)</span><span>−${fmtARS(data.discount_amount)}</span></div>` : ''}
      ${data.cleaning_fee > 0   ? `<div class="quote-line"><span>Limpieza</span><span>${fmtARS(data.cleaning_fee)}</span></div>` : ''}
      ${data.security_deposit > 0 ? `<div class="quote-line muted"><span>Depósito (reintegrable)</span><span>${fmtARS(data.security_deposit)}</span></div>` : ''}
      <div class="quote-line total"><span>Total</span><span>${fmtARS(data.total)}</span></div>
      <div class="quote-times">Check-in ${data.check_in_time} hs · Check-out ${data.check_out_time} hs</div>`;
  } catch (err) {
    breakdown.innerHTML = `<div style="color:var(--danger);font-size:13px">Error al calcular precio</div>`;
    console.error('[quote]', err);
  }
}

function fmtARS(n) { return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 }); }

async function submitReservation() {
  const btn = document.getElementById('btn-res-submit');
  btn.classList.add('loading'); btn.disabled = true;
  hideFormMsg('reservation-msg');

  const checkIn  = document.getElementById('res-checkin').value;
  const checkOut = document.getElementById('res-checkout').value;
  if (!checkIn || !checkOut) {
    showFormMsg('reservation-msg', 'Seleccioná las fechas de check-in y check-out.', 'error');
    btn.classList.remove('loading'); btn.disabled = false;
    return;
  }

  try {
    const res = await fetch(`${API.contracts}/api/v1/reservations`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        property_id:    _detailProperty.id,
        check_in_date:  checkIn,
        check_out_date: checkOut,
        guest_message:  document.getElementById('res-message').value.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFormMsg('reservation-msg', data.message || `Error ${res.status} — verificá que el servidor de contratos esté corriendo`, 'error');
      return;
    }
    showFormMsg('reservation-msg', `¡Reserva enviada! El propietario tiene 24hs para confirmarla. ID: ${data.id}`, 'success');
    setTimeout(() => { closeModal('modal-reservation'); loadProperties(); }, 2000);
  } catch (err) {
    showFormMsg('reservation-msg', 'No se pudo conectar al servidor de contratos.', 'error');
    console.error('[reservation]', err);
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

async function reserveProperty(id) {
  const btn = document.querySelector('#detail-footer .btn-primary-sm');
  if (btn) { btn.classList.add('loading'); btn.disabled = true; }

  try {
    const res = await fetch(`${API.catalog}/api/v1/properties/${id}/reserve`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    closeModal('modal-detail');
    loadProperties();
  } catch (err) {
    console.error('[reserve]', err);
    alert('Error al reservar la propiedad. Verificá el servidor.');
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
}

/* ══════════════════════════════════════
   PUBLICAR PROPIEDAD
══════════════════════════════════════ */
let _pendingMediaFiles = [];

function openPublishModal() {
  _pendingMediaFiles = [];
  document.getElementById('media-file-list').innerHTML = '';
  document.getElementById('social-links-list').innerHTML = `
    <div class="social-link-row">
      <input type="text" class="social-platform" placeholder="Red (ej: instagram)" />
      <input type="url"  class="social-url"      placeholder="https://..." />
    </div>`;
  document.getElementById('pub-operation').value = 'SALE';
  toggleTempSection('SALE');
  openModal('modal-publish');

  const zone = document.getElementById('media-drop-zone');
  zone.ondragover  = e => { e.preventDefault(); zone.classList.add('drag-over'); };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop      = e => { e.preventDefault(); zone.classList.remove('drag-over'); addFilesToQueue([...e.dataTransfer.files]); };
}

function toggleTempSection(opType) {
  document.getElementById('temp-config-section').style.display = opType === 'TEMP' ? 'block' : 'none';
}

function handleFileSelect(e) {
  addFilesToQueue([...e.target.files]);
  e.target.value = '';
}

function addFilesToQueue(files) {
  const MAX  = 50 * 1024 * 1024;
  const list = document.getElementById('media-file-list');
  files.forEach(f => {
    if (f.size > MAX) {
      list.appendChild(fileListItem(f.name, 'Excede 50 MB', 'err'));
      return;
    }
    _pendingMediaFiles.push(f);
    const item = fileListItem(f.name, 'Pendiente', '');
    item.dataset.filename = f.name;
    list.appendChild(item);
  });
}

function fileListItem(name, status, cls) {
  const div  = document.createElement('div');
  div.className = 'media-file-item';
  const icon = name.match(/\.(mp4|mov|avi|webm)$/i)
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  div.innerHTML = `${icon}<span class="file-name">${escHtml(name)}</span><span class="file-status ${cls}">${escHtml(status)}</span>`;
  return div;
}

function updateFileStatus(filename, text, cls) {
  document.querySelectorAll('#media-file-list .media-file-item').forEach(item => {
    if (item.dataset.filename === filename) {
      const span = item.querySelector('.file-status');
      span.textContent = text;
      span.className   = `file-status ${cls}`;
    }
  });
}

function addSocialLinkRow() {
  const row = document.createElement('div');
  row.className = 'social-link-row';
  row.innerHTML = `
    <input type="text" class="social-platform" placeholder="Red (ej: facebook)" />
    <input type="url"  class="social-url"      placeholder="https://..." />`;
  document.getElementById('social-links-list').appendChild(row);
}

async function submitProperty(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-publish-submit');
  btn.classList.add('loading'); btn.disabled = true;
  hideFormMsg('publish-msg');

  const propID = 'prop-' + Date.now();
  const opType = document.getElementById('pub-operation').value;

  const amenities = [];
  if (opType === 'TEMP') {
    document.querySelectorAll('#amenities-grid input[type=checkbox]:checked').forEach(cb => {
      amenities.push({ key: cb.value, label: cb.dataset.label, category: cb.dataset.cat });
    });
  }

  const pricingRules = [];
  if (opType === 'TEMP') {
    const weekly  = parseFloat(document.getElementById('pub-discount-weekly').value);
    const monthly = parseFloat(document.getElementById('pub-discount-monthly').value);
    if (weekly  > 0) pricingRules.push({ type: 'weekly',  min_nights: 7,  discount_pct: weekly });
    if (monthly > 0) pricingRules.push({ type: 'monthly', min_nights: 28, discount_pct: monthly });
  }

  const body = {
    id:             propID,
    title:          document.getElementById('pub-title').value.trim(),
    description:    document.getElementById('pub-desc').value.trim(),
    operation_type: opType,
    pet_policy:     document.getElementById('pub-pet-policy').value,
    price:          parseFloat(document.getElementById('pub-price').value),
    currency:       document.getElementById('pub-currency').value,
    address:        document.getElementById('pub-address').value.trim(),
    latitude:       parseFloat(document.getElementById('pub-lat').value) || -34.6037,
    longitude:      parseFloat(document.getElementById('pub-lng').value) || -58.3816,
    ...(opType === 'TEMP' && {
      night_price:       parseFloat(document.getElementById('pub-night-price').value) || 0,
      cleaning_fee:      parseFloat(document.getElementById('pub-cleaning-fee').value) || 0,
      security_deposit:  parseFloat(document.getElementById('pub-deposit').value) || 0,
      min_nights:        parseInt(document.getElementById('pub-min-nights').value) || 1,
      max_nights:        parseInt(document.getElementById('pub-max-nights').value) || 90,
      check_in_time:     document.getElementById('pub-checkin-time').value || '14:00',
      check_out_time:    document.getElementById('pub-checkout-time').value || '10:00',
      amenities,
      pricing_rules: pricingRules,
    }),
  };

  try {
    const res = await fetch(`${API.catalog}/api/v1/properties`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showFormMsg('publish-msg', err.message || err.error || `Error ${res.status}`, 'error');
      return;
    }
  } catch (err) {
    showFormMsg('publish-msg', 'No se pudo conectar al servidor de catálogo.', 'error');
    console.error('[publish]', err);
    return;
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }

  const mediaErrors = [];
  for (const [i, file] of _pendingMediaFiles.entries()) {
    try {
      updateFileStatus(file.name, 'Subiendo...', '');
      const urlRes = await fetch(`${API.catalog}/api/v1/properties/${propID}/media/upload-url`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ filename: file.name, content_type: file.type || 'application/octet-stream' }),
      });
      if (!urlRes.ok) {
        const e = await urlRes.json().catch(() => ({}));
        updateFileStatus(file.name, e.message || `Error ${urlRes.status}`, 'err');
        mediaErrors.push(file.name);
        continue;
      }
      const { presigned_url, final_url } = await urlRes.json();

      const putRes = await fetch(presigned_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!putRes.ok) {
        updateFileStatus(file.name, `Error S3 ${putRes.status}`, 'err');
        mediaErrors.push(file.name);
        continue;
      }

      const mediaType = file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
      await fetch(`${API.catalog}/api/v1/properties/${propID}/media`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ url: final_url, type: mediaType, sort_order: i }),
      });
      updateFileStatus(file.name, 'Subido', 'ok');
    } catch (err) {
      console.error('[media upload]', file.name, err);
      updateFileStatus(file.name, 'Error de red', 'err');
      mediaErrors.push(file.name);
    }
  }

  const socialLinks = {};
  document.querySelectorAll('#social-links-list .social-link-row').forEach(row => {
    const platform = row.querySelector('.social-platform').value.trim().toLowerCase();
    const url      = row.querySelector('.social-url').value.trim();
    if (platform && url) socialLinks[platform] = url;
  });
  if (Object.keys(socialLinks).length > 0) {
    try {
      await fetch(`${API.catalog}/api/v1/properties/${propID}/media`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ type: 'SOCIAL_LINK', sort_order: 99, social_links: socialLinks }),
      });
    } catch (err) {
      console.error('[social links]', err);
    }
  }

  const mediaNote = mediaErrors.length > 0
    ? ` (${mediaErrors.length} archivo(s) fallaron)`
    : (_pendingMediaFiles.length > 0 ? ' con multimedia guardada' : '');
  showFormMsg('publish-msg', `¡Propiedad publicada${mediaNote}!`, mediaErrors.length > 0 ? 'error' : 'success');

  document.getElementById('form-publish').reset();
  _pendingMediaFiles = [];
  setTimeout(() => { closeModal('modal-publish'); loadProperties(); }, 1400);
}

/* ═══════════════════════════════════════
   CRM — :8084
═══════════════════════════════════════ */
async function loadLeads() {
  const tbody = document.getElementById('leads-tbody');
  tbody.innerHTML = `
    <tr class="table-skeleton"><td colspan="6"><div class="skel-row"></div></td></tr>
    <tr class="table-skeleton"><td colspan="6"><div class="skel-row"></div></td></tr>
    <tr class="table-skeleton"><td colspan="6"><div class="skel-row"></div></td></tr>`;

  const stateFilter = document.getElementById('filter-lead-state').value;
  const params = new URLSearchParams({ limit: 50 });
  if (stateFilter) params.set('state', stateFilter);

  try {
    const res  = await fetch(`${API.crm}/api/v1/leads?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const leads = Array.isArray(data) ? data : (data.leads || data.items || data.data || []);

    updateLeadStats(leads);
    renderLeads(leads);
    setStatus(true);
  } catch (err) {
    console.error('[crm]', err);
    setStatus(false);
    tbody.innerHTML = `
      <tr><td colspan="6" style="text-align:center;padding:40px;color:var(--ink-40)">
        No se pudo conectar al servicio CRM <code style="margin-left:6px">:8084</code>
      </td></tr>`;
  }
}

function updateLeadStats(leads) {
  document.getElementById('stat-leads-total').textContent   = leads.length;
  document.getElementById('stat-leads-new').textContent     = leads.filter(l => l.state === 'NEW').length;
  document.getElementById('stat-leads-visit').textContent   = leads.filter(l => l.state === 'VISIT_SCHEDULED').length;
  document.getElementById('stat-leads-closed').textContent  = leads.filter(l => l.state === 'CLOSED').length;
}

function renderLeads(leads) {
  const tbody = document.getElementById('leads-tbody');

  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--ink-40)">
      No hay leads registrados. Cuando se publique una propiedad, NATS creará uno automáticamente.
    </td></tr>`;
    return;
  }

  const stateLabel = { NEW: 'Nuevo', CONTACTED: 'Contactado', VISIT_SCHEDULED: 'Visita agendada', CLOSED: 'Cerrado' };

  tbody.innerHTML = leads.map(l => `
    <tr>
      <td><strong>${escHtml(l.client_name || l.clientName || '—')}</strong></td>
      <td><span style="font-family:monospace;font-size:11px;color:var(--ink-40)">${(l.property_id || l.propertyId || '—').slice(0, 12)}…</span></td>
      <td>${escHtml(l.email || '—')}</td>
      <td>${escHtml(l.phone || '—')}</td>
      <td><span class="lead-state-badge lead-${l.state || 'NEW'}">${stateLabel[l.state] || l.state || 'Nuevo'}</span></td>
      <td>
        ${l.state === 'CONTACTED' || l.state === 'NEW'
          ? `<button class="btn-table visit" onclick="scheduleVisit('${l.id}')">Agendar visita</button>`
          : `<button class="btn-table" onclick="viewLead('${l.id}')">Ver detalle</button>`
        }
      </td>
    </tr>`).join('');
}

async function scheduleVisit(leadId) {
  try {
    const res = await fetch(`${API.crm}/api/v1/leads/${leadId}/visit`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    loadLeads();
  } catch (err) {
    console.error('[visit]', err);
    alert('Error al agendar la visita.');
  }
}

async function viewLead(leadId) {
  try {
    const res  = await fetch(`${API.crm}/api/v1/leads/${leadId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const l    = await res.json();
    alert(`Lead: ${l.client_name || l.id}\nEstado: ${l.state}\nPropiedad: ${l.property_id}`);
  } catch (err) {
    console.error('[lead detail]', err);
  }
}

function openLeadModal() { openModal('modal-lead'); }

async function submitLead(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-lead-submit');
  btn.classList.add('loading'); btn.disabled = true;
  hideFormMsg('lead-msg');

  const body = {
    id:          'lead-' + Date.now(),
    property_id: document.getElementById('lead-prop').value.trim(),
    client_name: document.getElementById('lead-name').value.trim(),
    email:       document.getElementById('lead-email').value.trim(),
    phone:       document.getElementById('lead-phone').value.trim(),
  };

  try {
    const res = await fetch(`${API.crm}/api/v1/leads`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showFormMsg('lead-msg', err.error || `Error ${res.status}`, 'error');
      return;
    }

    showFormMsg('lead-msg', 'Lead creado con éxito.', 'success');
    document.getElementById('form-lead').reset();
    setTimeout(() => { closeModal('modal-lead'); loadLeads(); }, 900);
  } catch (err) {
    showFormMsg('lead-msg', 'No se pudo conectar al servicio CRM.', 'error');
    console.error('[lead]', err);
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

/* ── Modal helpers ── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Form message helpers ── */
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

/* ── Status indicator ── */
function setStatus(ok) {
  const dot  = document.querySelector('.status-dot');
  const text = document.getElementById('status-text');
  if (ok) {
    dot.classList.remove('error');
    text.textContent = 'Conectado';
  } else {
    dot.classList.add('error');
    text.textContent = 'Sin conexión';
  }
}

/* ── Auth headers ── */
function authHeaders(extra) {
  const token = localStorage.getItem('inmo_token') || '';
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...extra };
}

/* ── Utility ── */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Logout ── */
function logout() {
  localStorage.removeItem('inmo_token');
  localStorage.removeItem('inmo_user');
  localStorage.removeItem('inmo_pending_role');
  localStorage.removeItem('inmo_pending_email');
  window.location.href = 'index.html';
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {

  /* ── 1. Guard de autenticación ─────────────────────────
     Si no hay token válido → redirigir a landing.
     Cortamos la ejecución antes de inicializar cualquier
     cosa del dashboard para evitar flashes de contenido
     y llamadas a APIs protegidas sin token.
  ───────────────────────────────────────────────────────── */
  const token = localStorage.getItem('inmo_token');
  if (!token) {
    // Guardar la URL actual para redirigir de vuelta post-login (opcional)
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace('loginregister.html?return=' + returnUrl);
    return; // detener toda ejecución del dashboard
  }

  /* ── 2. Verificación liviana del token ─────────────────
     Decodificamos el payload del JWT (sin verificar firma,
     eso lo hace el backend) solo para chequear expiración.
     Si expiró → limpiar y redirigir a landing.
  ───────────────────────────────────────────────────────── */
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const nowSec  = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      // Token expirado — limpiar storage y redirigir
      localStorage.removeItem('inmo_token');
      localStorage.removeItem('inmo_user');
      window.location.replace('index.html?expired=1');
      return;
    }
  } catch (_) {
    // Token malformado — tratar como no autenticado
    localStorage.removeItem('inmo_token');
    localStorage.removeItem('inmo_user');
    window.location.replace('index.html');
    return;
  }

  /* ── 3. Init normal del dashboard ──────────────────────
     Solo llegamos acá si el token existe y no expiró.
  ───────────────────────────────────────────────────────── */
  buildNav();
  showView('catalog');
  manageBadgePolling(currentRole);

  if (new URLSearchParams(window.location.search).get('publish') === '1') {
    openPublishModal();
  }
});

/* ══════════════════════════════════════════════════════════
   PATCH app.js — Centro de Mensajes embebido (Fase 3)
   ══════════════════════════════════════════════════════════

   CAMBIO 1: Agregar ícono iconChat() junto al resto de íconos.
   CAMBIO 2: Agregar item 'messages' al nav de cada rol relevante.
   CAMBIO 3: Agregar 'Mensajes' al VIEW_TITLES.
   CAMBIO 4: Agregar carga de la vista en showView().
   CAMBIO 5: Agregar función loadMessages() para el iframe.

   ──────────────────────────────────────────────────────── */

/* ─── CAMBIO 1: nuevo ícono ───
   Agregar junto a iconCalendar() */
function iconChat() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
}


/* ─── CAMBIO 2: agregar 'messages' al nav de cada rol ───

   En el objeto ROLES, agregar este item en los roles que corresponde:

   Para 'agente':
     { id: 'messages', label: 'Mensajes', icon: iconChat }

   Para 'propietario':
     { id: 'messages', label: 'Mensajes', icon: iconChat }

   Para 'buscador':
     { id: 'messages', label: 'Mis mensajes', icon: iconChat }

   Para 'inquilino':
     { id: 'messages', label: 'Mensajes', icon: iconChat }

   Para 'admin':
     { id: 'messages', label: 'Mensajes', icon: iconChat }

   ─────────────────────────────────────────────────────── */


/* ─── CAMBIO 3: agregar al VIEW_TITLES ───

   Agregar esta entrada al objeto VIEW_TITLES:
     messages: 'Centro de mensajes',

   ─────────────────────────────────────────────────────── */


/* ─── CAMBIO 4: agregar en showView() ───

   Al final del bloque if de vistas existentes, agregar:
     if (viewId === 'messages') { loadMessagesView(); }

   ─────────────────────────────────────────────────────── */


/* ─── CAMBIO 5: función para cargar la vista de mensajes ───
   Agregar como función global en app.js */

/**
 * Carga mensajes.html dentro de un iframe embebido en la vista.
 * El iframe comparte el localStorage del mismo origen, por lo que
 * el token y el usuario ya están disponibles sin pasar nada.
 */
function loadMessagesView() {
  const view = document.getElementById('view-messages');
  if (!view) return;

  // Evitar recargar si ya tiene el iframe
  if (view.querySelector('iframe')) return;

  view.innerHTML = `
    <iframe
      src="mensajes.html"
      title="Centro de mensajes"
      style="
        width: 100%;
        flex: 1;
        border: none;
        border-radius: 0;
        min-height: 0;
      "
      allowfullscreen
    ></iframe>`;
}

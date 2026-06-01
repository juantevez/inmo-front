'use strict';

/* ── API config ── */
const GATEWAY = 'http://127.0.0.1:8000';

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

/* ── Role definitions ── */
const ROLES = {
  agente: {
    nav: [
      { id: 'catalog',     label: 'Catálogo',      icon: iconHome },
      { id: 'crm',         label: 'CRM / Leads',   icon: iconUsers },
      { id: 'contracts',   label: 'Contratos',      icon: iconFile },
      { id: 'maintenance', label: 'Mantenimiento',  icon: iconTool },
    ]
  },
  propietario: {
    nav: [
      { id: 'catalog',   label: 'Mis propiedades', icon: iconHome },
      { id: 'contracts', label: 'Contratos',        icon: iconFile },
      { id: 'finances',  label: 'Liquidaciones',    icon: iconMoney },
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
      { id: 'catalog',     label: 'Catálogo',        icon: iconHome },
      { id: 'crm',         label: 'CRM',             icon: iconUsers },
      { id: 'contracts',   label: 'Contratos',        icon: iconFile },
      { id: 'finances',    label: 'Finanzas',         icon: iconMoney },
      { id: 'maintenance', label: 'Mantenimiento',    icon: iconTool },
      { id: 'admin',       label: 'Administración',   icon: iconShield, badge: 'admin' },
    ]
  },
};

/* ── Icons ── */
function iconHome()    { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`; }
function iconUsers()   { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`; }
function iconFile()    { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`; }
function iconMoney()   { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`; }
function iconTool()    { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`; }
function iconShield()  { return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`; }

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
  showView(firstView);
}

function buildNav() {
  const nav = document.getElementById('sidebar-nav');
  const items = ROLES[currentRole].nav;
  nav.innerHTML = items.map(item => `
    <button
      class="nav-item ${item.id === currentView ? 'active' : ''}"
      onclick="showView('${item.id}')"
    >
      ${item.icon()}
      ${item.label}
      ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
    </button>
  `).join('');
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

/* Detalle de propiedad */
function openDetail(p) {
  document.getElementById('detail-title').textContent = p.title || 'Propiedad';
  const stateLabel = { AVAILABLE: 'Disponible', RESERVED: 'Reservada', CLOSED: 'Alquilada/Vendida', UNDER_REPAIR: 'En reparación' };
  const rawPrice = typeof p.price === 'object' ? p.price?.amount : p.price;
  const price    = Number(rawPrice || p.amount || 0).toLocaleString('es-AR');
  const currency = (typeof p.price === 'object' ? p.price?.currency : p.currency) || 'ARS';

  document.getElementById('detail-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-field full"><span>ID</span><span style="font-family:monospace;font-size:12px">${escHtml(p.id || '—')}</span></div>
      <div class="detail-field"><span>Estado</span><span class="prop-state-badge state-${p.state}">${stateLabel[p.state] || p.state}</span></div>
      <div class="detail-field"><span>Precio</span><span>${price} ${currency}</span></div>
      <div class="detail-field full"><span>Dirección</span><span>${escHtml(p.address || p.location?.address || '—')}</span></div>
      <div class="detail-field"><span>Latitud</span><span>${p.latitude ?? p.location?.latitude ?? '—'}</span></div>
      <div class="detail-field"><span>Longitud</span><span>${p.longitude ?? p.location?.longitude ?? '—'}</span></div>
      <div class="detail-field full"><span>Descripción</span><span>${escHtml(p.description || '—')}</span></div>
      <div class="detail-field"><span>Owner ID</span><span style="font-family:monospace;font-size:12px">${escHtml(p.owner_id || '—')}</span></div>
    </div>`;

  const footer = document.getElementById('detail-footer');
  footer.innerHTML = '';

  if (p.state === 'AVAILABLE') {
    footer.innerHTML = `
      <button class="btn-ghost" onclick="closeModal('modal-detail')">Cerrar</button>
      <button class="btn-primary-sm" onclick="reserveProperty('${p.id}')">
        <span class="btn-text">Reservar</span>
        <span class="btn-loader"></span>
      </button>`;
  } else {
    footer.innerHTML = `<button class="btn-ghost" onclick="closeModal('modal-detail')">Cerrar</button>`;
  }

  openModal('modal-detail');
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

/* Publicar propiedad */
function openPublishModal() { openModal('modal-publish'); }

async function submitProperty(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-publish-submit');
  btn.classList.add('loading'); btn.disabled = true;
  hideFormMsg('publish-msg');

  const id = 'prop-' + Date.now();
  const body = {
    id,
    title:          document.getElementById('pub-title').value.trim(),
    description:    document.getElementById('pub-desc').value.trim(),
    operation_type: document.getElementById('pub-operation').value,
    pet_policy:     document.getElementById('pub-pet-policy').value,
    price:          parseFloat(document.getElementById('pub-price').value),
    currency:       document.getElementById('pub-currency').value,
    address:        document.getElementById('pub-address').value.trim(),
    latitude:       parseFloat(document.getElementById('pub-lat').value) || -34.6037,
    longitude:      parseFloat(document.getElementById('pub-lng').value) || -58.3816,
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

    showFormMsg('publish-msg', '¡Propiedad publicada! El evento viajará a NATS → CRM.', 'success');
    document.getElementById('form-publish').reset();
    setTimeout(() => { closeModal('modal-publish'); loadProperties(); }, 1200);
  } catch (err) {
    showFormMsg('publish-msg', 'No se pudo conectar al servidor de catálogo.', 'error');
    console.error('[publish]', err);
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
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
  document.getElementById('stat-leads-total').textContent = leads.length;
  document.getElementById('stat-leads-new').textContent   = leads.filter(l => l.state === 'NEW').length;
  document.getElementById('stat-leads-visit').textContent = leads.filter(l => l.state === 'VISIT_SCHEDULED').length;
  document.getElementById('stat-leads-closed').textContent = leads.filter(l => l.state === 'CLOSED').length;
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

/* Nuevo lead manual */
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
  return String(str)
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
  window.location.href = 'landing.html';
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  buildNav();
  showView('catalog');
});

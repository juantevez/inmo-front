'use strict';

const API_CATALOG = 'http://127.0.0.1:8000';
const PAGE_SIZE   = 12;

let currentPage  = 0;
let currentOp    = '';
let selectedProp = null;



/* ── Search ── */

function setSearchTab(btn, op) {
  document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  currentOp = op;
}

function doSearch() {
  currentPage = 0;
  loadProperties();
  window.scrollTo({ top: document.querySelector('.results-section').offsetTop - 80, behavior: 'smooth' });
}

/* ── Load properties ── */

async function loadProperties() {
  const grid    = document.getElementById('properties-grid');
  const countEl = document.getElementById('results-count');

  grid.innerHTML = Array(6).fill('<div class="prop-skeleton"></div>').join('');
  countEl.textContent = '';

  const zone     = document.getElementById('search-zone').value.trim();
  const type     = document.getElementById('filter-type').value;
  const minPrice = document.getElementById('search-min').value;
  const maxPrice = document.getElementById('search-max').value;
  const petsOnly = document.getElementById('filter-pets').checked;

  const params = new URLSearchParams({ limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE });
  if (currentOp)  params.set('operation', currentOp);
  if (type)       params.set('property_type', type);
  if (minPrice)   params.set('min_price', minPrice);
  if (maxPrice)   params.set('max_price', maxPrice);
  if (zone)       params.set('zone', zone);
  if (petsOnly)   params.set('pets', 'ALLOWED');

  try {
    const res  = await fetch(`${API_CATALOG}/api/v1/properties?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const props = Array.isArray(data) ? data : (data.properties || data.items || data.data || []);
    const total = data.total ?? data.Total ?? props.length;

    countEl.textContent = total > 0 ? `${total} propiedad${total !== 1 ? 'es' : ''} encontrada${total !== 1 ? 's' : ''}` : '';
    renderProperties(props);
    renderPagination(total);
  } catch (err) {
    console.error('[catalog]', err);
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".3" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <p>No se pudo cargar las propiedades</p>
        <span>Verificá tu conexión o intentá más tarde</span>
      </div>`;
  }
}

/* ── Render ── */

function renderProperties(props) {
  const grid = document.getElementById('properties-grid');

  if (!props.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".3" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <p>No encontramos propiedades con esos filtros</p>
        <span>Probá ajustando la búsqueda</span>
      </div>`;
    return;
  }

  grid.innerHTML = props.map(propCard).join('');
}

function propCard(p) {
  const rawPrice  = typeof p.price === 'object' ? p.price?.amount : p.price;
  const price     = Number(rawPrice || p.amount || 0).toLocaleString('es-AR');
  const currency  = (typeof p.price === 'object' ? p.price?.currency : p.currency) || 'ARS';
  const opLabel   = { SALE: 'Venta', RENT: 'Alquiler', TEMP: 'Temporario' };
  const op        = opLabel[p.operation_type] || '';
  const address   = escHtml(p.address || p.location?.address || 'Dirección no disponible');
  const petPolicy = p.pet_policy || 'NOT_ALLOWED';
  const petBadge  = petPolicy !== 'NOT_ALLOWED'
    ? `<span class="pet-badge" title="${petPolicy === 'SMALL_ONLY' ? 'Solo mascotas chicas/medianas' : 'Acepta mascotas'}">🐾</span>`
    : '';

  return `
    <article class="prop-card" onclick='openDetail(${JSON.stringify(p).replace(/'/g, "&#39;")})'>
      <div class="prop-img">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".2" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        ${op ? `<span class="op-badge">${op}</span>` : ''}
        ${petBadge}
      </div>
      <div class="prop-body">
        <p class="prop-title">${escHtml(p.title || 'Sin título')}</p>
        <p class="prop-address">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${address}
        </p>
        <div class="prop-footer">
          <div class="prop-price">
            <span class="price-amount">${price}</span>
            <span class="price-currency">${currency}</span>
          </div>
          <span class="btn-ver-mas">Ver más</span>
        </div>
      </div>
    </article>`;
}

/* ── Detail modal ── */

async function openDetail(p) {
  selectedProp = p;

  const rawPrice  = typeof p.price === 'object' ? p.price?.amount : p.price;
  const price     = Number(rawPrice || p.amount || 0).toLocaleString('es-AR');
  const currency  = (typeof p.price === 'object' ? p.price?.currency : p.currency) || 'ARS';
  const opLabel   = { SALE: 'En venta', RENT: 'En alquiler', TEMP: 'Temporario' };
  const petLabel  = { ALLOWED: 'Acepta mascotas 🐾', SMALL_ONLY: 'Solo mascotas chicas/medianas 🐾', NOT_ALLOWED: 'No acepta mascotas' };
  const address   = escHtml(p.address || p.location?.address || '—');
  const opType    = p.operation_type || '';
  const petPolicy = p.pet_policy || 'NOT_ALLOWED';

  const petNote = (opType === 'TEMP' && petPolicy !== 'NOT_ALLOWED')
    ? `<div class="detail-pet-note">🐾 Esta propiedad acepta mascotas. Puede aplicarse cargo adicional de limpieza o depósito.</div>`
    : (petPolicy !== 'NOT_ALLOWED'
        ? `<div class="detail-pet-chip">${petLabel[petPolicy]}</div>`
        : '');

  document.getElementById('detail-info').innerHTML = `
    ${opType ? `<div class="detail-op-badge">${opLabel[opType] || opType}</div>` : ''}
    <h2 class="detail-title">${escHtml(p.title || 'Sin título')}</h2>
    <p class="detail-address">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      ${address}
    </p>
    <div class="detail-price">
      <span class="detail-price-amount">${price}</span>
      <span class="detail-price-currency">${currency}</span>
    </div>
    ${p.description ? `<p class="detail-desc">${escHtml(p.description)}</p>` : ''}
    ${petNote}
  `;

  // Resetear zona de imagen al placeholder mientras carga
  const imgZone = document.getElementById('modal-detail-img');
  imgZone.innerHTML = `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".15" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

  document.getElementById('modal-detail').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Cargar media sin bloquear la apertura del modal
  loadDetailMedia(p.id, imgZone);
}

async function loadDetailMedia(propertyID, imgZone) {
  try {
    const res = await fetch(`${API_CATALOG}/api/v1/properties/${propertyID}/media`);
    if (!res.ok) return;
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return;

    const images  = items.filter(m => m.type === 'IMAGE' || m.type === 'VIDEO');
    const socials = items.filter(m => m.type === 'SOCIAL_LINK');

    if (images.length === 0 && socials.length === 0) return;

    let html = '';

    if (images.length > 0) {
      // Imagen principal (primera)
      const first = images[0];
      if (first.type === 'VIDEO') {
        html += `<video class="detail-main-img" src="${escHtml(first.url)}" controls preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>`;
      } else {
        html += `<img class="detail-main-img" src="${escHtml(first.url)}" alt="Foto principal de la propiedad" style="width:100%;height:100%;object-fit:cover" />`;
      }
      // Miniaturas si hay más de una
      if (images.length > 1) {
        html += `<div class="detail-thumbs">` +
          images.slice(1).map(m =>
            m.type === 'VIDEO'
              ? `<video class="detail-thumb-sm" src="${escHtml(m.url)}" preload="none" onclick="this.parentElement.previousElementSibling.src='${escHtml(m.url)}'"></video>`
              : `<img class="detail-thumb-sm" src="${escHtml(m.url)}" alt="" loading="lazy" onclick="document.querySelector('.detail-main-img').src='${escHtml(m.url)}'" />`
          ).join('') +
          `</div>`;
      }
    }

    if (socials.length > 0 && socials[0].social_links) {
      html += `<div class="detail-social-pills">` +
        Object.entries(socials[0].social_links).map(([platform, url]) =>
          `<a class="detail-social-pill" href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(platform)}</a>`
        ).join('') +
        `</div>`;
    }

    imgZone.innerHTML = html;
  } catch (err) {
    console.error('[landing media]', err);
  }
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Auth gate ── */

function requireAuth(action) {
  const titles = {
    contact: 'Contactá al propietario',
    visit:   'Agendá una visita',
  };
  const subs = {
    contact: 'Registrate gratis para enviar un mensaje directo al propietario.',
    visit:   'Registrate para reservar un horario de visita con el agente.',
  };

  document.getElementById('auth-prompt-title').textContent = titles[action] || 'Para continuar necesitás una cuenta';
  document.getElementById('auth-prompt-sub').textContent   = subs[action] || '';

  const propId     = selectedProp?.id || '';
  const returnUrl  = encodeURIComponent(`index.html?prop=${propId}&action=${action}`);
  document.getElementById('btn-auth-register').href = `loginregister.html?tab=register&return=${returnUrl}`;

  document.getElementById('modal-auth').classList.add('open');
}

function closeAuthModal() {
  document.getElementById('modal-auth').classList.remove('open');
}

/* ── Pagination ── */

function renderPagination(total) {
  const container = document.getElementById('pagination');
  const pages     = Math.ceil(total / PAGE_SIZE);

  if (pages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  if (currentPage > 0)
    html += `<button class="page-btn" onclick="goPage(${currentPage - 1})">&#8249;</button>`;

  const maxButtons = 8;
  let start = Math.max(0, currentPage - Math.floor(maxButtons / 2));
  let end   = Math.min(pages, start + maxButtons);
  if (end - start < maxButtons) start = Math.max(0, end - maxButtons);

  for (let i = start; i < end; i++)
    html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i + 1}</button>`;

  if (currentPage < pages - 1)
    html += `<button class="page-btn" onclick="goPage(${currentPage + 1})">&#8250;</button>`;

  container.innerHTML = html;
}

function goPage(n) {
  currentPage = n;
  loadProperties();
  window.scrollTo({ top: document.querySelector('.results-section').offsetTop - 80, behavior: 'smooth' });
}

/* ── Utils ── */

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Init ── */

document.addEventListener('DOMContentLoaded', () => {
  loadProperties();

  document.getElementById('search-zone').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
});

/* ══════════════════════════════════════════════════════════
   AGENDAR VISITA — Fase 3 Pantalla A
   Agregar en landing.js (reemplaza el bloque requireAuth
   para la acción 'visit' y agrega las funciones nuevas)
══════════════════════════════════════════════════════════ */

/* ─── Constantes ─── */
const API_CHAT = 'http://127.0.0.1:8000'; // pasa por el gateway igual que el resto

/* ─── Estado del modal ─── */
let _visitPropId     = null;  // property_id de la propiedad seleccionada
let _visitPropTitle  = null;  // título para mostrar en el header del modal
let _selectedTime    = null;  // chip de horario seleccionado

/* ═══════════════════════════════════════════════════════
   1. REEMPLAZAR requireAuth — ahora distingue 'visit'
   ═══════════════════════════════════════════════════════
   INSTRUCCIÓN: reemplazar la función requireAuth existente
   en landing.js por esta versión ampliada:
*/
function requireAuth(action) {
  const token = localStorage.getItem('inmo_token');

  // Si el usuario está logueado Y la acción es 'visit' → flujo propio
  if (token && action === 'visit') {
    openVisitModal(selectedProp);
    return;
  }

  // Para cualquier otra acción (contact, etc.) o sin token → auth gate existente
  const titles = {
    contact: 'Contactá al propietario',
    visit:   'Agendá una visita',
  };
  const subs = {
    contact: 'Registrate gratis para enviar un mensaje directo al propietario.',
    visit:   'Registrate para reservar un horario de visita con el agente.',
  };

  document.getElementById('auth-prompt-title').textContent = titles[action] || 'Para continuar necesitás una cuenta';
  document.getElementById('auth-prompt-sub').textContent   = subs[action]  || '';

  const propId    = selectedProp?.id || '';
  const returnUrl = encodeURIComponent(`index.html?prop=${propId}&action=${action}`);
  document.getElementById('btn-auth-register').href = `loginregister.html?tab=register&return=${returnUrl}`;

  document.getElementById('modal-auth').classList.add('open');
}

/* ═══════════════════════════════════════════════════════
   2. ABRIR MODAL DE VISITA
   ═══════════════════════════════════════════════════════ */
function openVisitModal(prop) {
  if (!prop) return;

  _visitPropId    = prop.id;
  _visitPropTitle = prop.title || 'Propiedad';
  _selectedTime   = null;

  // Resetear UI
  document.getElementById('visit-prop-name').textContent = _visitPropTitle;
  document.getElementById('visit-date').value    = '';
  document.getElementById('visit-message').value = '';
  hideVisitMsg();

  // Fecha mínima = mañana
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('visit-date').min = tomorrow.toISOString().split('T')[0];

  // Deseleccionar chips
  document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));

  // Habilitar botón submit
  const btn = document.getElementById('btn-visit-submit');
  btn.classList.remove('loading');
  btn.disabled = false;

  document.getElementById('modal-visit').classList.add('open');
  document.body.style.overflow = 'hidden';

  // Focus en la fecha
  setTimeout(() => document.getElementById('visit-date').focus(), 120);
}

function closeVisitModal() {
  document.getElementById('modal-visit').classList.remove('open');
  document.body.style.overflow = '';
}

/* ─── Chips de horario ─── */
function selectTimeChip(chip, value) {
  document.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  _selectedTime = value;
}

/* ═══════════════════════════════════════════════════════
   3. SUBMIT — crea chat y envía propuesta de visita
   ═══════════════════════════════════════════════════════ */
async function submitVisitProposal() {
  const date    = document.getElementById('visit-date').value;
  const message = document.getElementById('visit-message').value.trim();

  if (!date) {
    showVisitMsg('Seleccioná una fecha para la visita.', 'error');
    document.getElementById('visit-date').focus();
    return;
  }

  const token = localStorage.getItem('inmo_token');
  if (!token) {
    // Sesión expiró mientras tenía el modal abierto
    closeVisitModal();
    requireAuth('visit');
    return;
  }

  const btn = document.getElementById('btn-visit-submit');
  btn.classList.add('loading');
  btn.disabled = true;
  hideVisitMsg();

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    /* ── Paso 1: Iniciar o recuperar conversación (idempotente) ── */
    const chatRes = await fetch(`${API_CHAT}/api/v1/chats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ property_id: _visitPropId }),
    });

    if (!chatRes.ok) {
      const err = await chatRes.json().catch(() => ({}));
      showVisitMsg(err.message || `No se pudo iniciar la conversación (${chatRes.status}).`, 'error');
      return;
    }

    const chatData  = await chatRes.json();
    const chatId    = chatData.id || chatData.conversation_id;

    if (!chatId) {
      showVisitMsg('Respuesta inesperada del servidor de chat.', 'error');
      return;
    }

    /* ── Paso 2: Enviar propuesta de visita ── */
    // Construir datetime combinando fecha + horario seleccionado (o mediodía por defecto)
    const time           = _selectedTime || '12:00';
    const proposedDatetime = `${date}T${time}:00`;

    const proposalRes = await fetch(`${API_CHAT}/api/v1/chats/${chatId}/visit-proposals`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        proposed_datetime: proposedDatetime,
        message: message || null,
      }),
    });

    if (!proposalRes.ok) {
      const err = await proposalRes.json().catch(() => ({}));
      showVisitMsg(err.message || `Error al enviar la propuesta (${proposalRes.status}).`, 'error');
      return;
    }

    /* ── Éxito ── */
    showVisitMsg('¡Propuesta enviada! El agente confirmará el horario a la brevedad.', 'success');

    // Marcar el botón de visita en el modal de detalle como "enviado"
    const btnVisit = document.querySelector('#modal-detail .btn-visit');
    if (btnVisit) {
      btnVisit.classList.add('sent');
      btnVisit.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        Propuesta enviada`;
    }

    // Cerrar automáticamente después de 2.2s
    setTimeout(() => {
      closeVisitModal();
    }, 2200);

  } catch (err) {
    console.error('[visit-proposal]', err);
    showVisitMsg('No se pudo conectar. Verificá tu conexión e intentá de nuevo.', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ─── Helpers de mensaje ─── */
function showVisitMsg(text, type) {
  const el = document.getElementById('visit-msg');
  if (!el) return;
  el.textContent = text;
  el.className   = `visit-msg ${type} visible`;
}

function hideVisitMsg() {
  const el = document.getElementById('visit-msg');
  if (!el) return;
  el.className   = 'visit-msg';
  el.textContent = '';
}

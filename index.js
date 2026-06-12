'use strict';

const API_CATALOG = 'http://127.0.0.1:8000';
const PAGE_SIZE   = 12;

let currentPage  = 0;
let currentOp    = '';
let selectedProp = null;

function getLoggedUserId() {
  const token = localStorage.getItem('inmo_token');
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1])).sub || null;
  } catch (_) {
    return null;
  }
}



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
  
  // Cargar imágenes para cada propiedad después de renderizar
  props.forEach(p => loadPropertyCarousel(p.id));
}

/* ── Carrusel de imágenes en cards ── */

async function loadPropertyCarousel(propertyID) {
  try {
    const res = await fetch(`${API_CATALOG}/api/v1/properties/${propertyID}/media`);
    if (!res.ok) return;
    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) return;

    const images = items.filter(m => m.type === 'IMAGE' || m.type === 'VIDEO');
    if (images.length === 0) return;

    const carouselEl = document.querySelector(`.prop-img-carousel[data-prop-id="${propertyID}"]`);
    if (!carouselEl) return;

    carouselEl.dataset.images = JSON.stringify(images.map(img => ({ url: img.url, type: img.type })));
    
    const track = carouselEl.querySelector('.prop-carousel-track');
    const dotsContainer = carouselEl.querySelector('.prop-carousel-dots');
    const prevBtn = carouselEl.querySelector('.prop-carousel-prev');
    const nextBtn = carouselEl.querySelector('.prop-carousel-next');

    // Estado del carrusel
    let currentIndex = 0;
    let prevHandler = null;
    let nextHandler = null;

    function updateCarousel() {
      const currentImg = images[currentIndex];
      if (!currentImg) return;

      if (currentImg.type === 'VIDEO') {
        track.innerHTML = `<video class="prop-carousel-img" src="${escHtml(currentImg.url)}" preload="metadata" style="width:100%;height:100%;object-fit:cover"></video>`;
      } else {
        track.innerHTML = `<img class="prop-carousel-img" src="${escHtml(currentImg.url)}" alt="" style="width:100%;height:100%;object-fit:cover" loading="lazy" />`;
      }

      // Actualizar dots
      dotsContainer.innerHTML = images.map((_, i) => 
        `<span class="prop-carousel-dot ${i === currentIndex ? 'active' : ''}" data-index="${i}"></span>`
      ).join('');

      // Mostrar/ocultar flechas según corresponda
      const showNav = images.length > 1;
      prevBtn.style.opacity = showNav ? '1' : '0';
      nextBtn.style.opacity = showNav ? '1' : '0';
      prevBtn.style.pointerEvents = showNav ? 'auto' : 'none';
      nextBtn.style.pointerEvents = showNav ? 'auto' : 'none';

      // Agregar eventos a los dots
      dotsContainer.querySelectorAll('.prop-carousel-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          currentIndex = parseInt(dot.dataset.index, 10);
          updateCarousel();
        });
      });
    }

    // Remover listeners previos si existen
    if (prevHandler) {
      prevBtn.removeEventListener('click', prevHandler);
    }
    if (nextHandler) {
      nextBtn.removeEventListener('click', nextHandler);
    }

    // Navegación
    prevHandler = (e) => {
      e.stopPropagation();
      currentIndex = (currentIndex - 1 + images.length) % images.length;
      updateCarousel();
    };

    nextHandler = (e) => {
      e.stopPropagation();
      currentIndex = (currentIndex + 1) % images.length;
      updateCarousel();
    };

    prevBtn.addEventListener('click', prevHandler);
    nextBtn.addEventListener('click', nextHandler);

    // Inicializar
    updateCarousel();

  } catch (err) {
    console.error('[carousel]', err);
  }
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
      <div class="prop-img-carousel" data-prop-id="${p.id}" data-images="">
        <div class="prop-carousel-track">
          <svg class="prop-img-placeholder" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".2" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div class="prop-carousel-nav prop-carousel-prev">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </div>
        <div class="prop-carousel-nav prop-carousel-next">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div class="prop-carousel-dots"></div>
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

function renderDetailInfo(p) {
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
}

async function openDetail(p) {
  selectedProp = p;

  renderDetailInfo(p);

  // Resetear zona de imagen al placeholder mientras carga
  const imgZone = document.getElementById('modal-detail-img');
  imgZone.innerHTML = `<svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity=".15" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

  hideDetailActionMsg();
  closeEditForm();

  const userId  = getLoggedUserId();
  const isOwner = userId && String(userId) === String(p.owner_id);
  document.querySelector('#modal-detail .modal-detail-actions').style.display = isOwner ? 'none' : '';
  document.getElementById('btn-edit-property').style.display = isOwner ? 'flex' : 'none';

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

/* ── Navbar auth ── */

function updateNavAuth() {
  const token = localStorage.getItem('inmo_token');
  const nav   = document.getElementById('nav-actions');
  if (!nav) return;

  if (!token) {
    nav.innerHTML = `
      <a href="loginregister.html" class="btn-nav-login">Ingresá</a>
      <a href="loginregister.html?tab=register&return=app.html%3Fpublish%3D1" class="btn-nav-register">Publicar propiedad</a>`;
    return;
  }

  const user      = JSON.parse(localStorage.getItem('inmo_user') || '{}');
  const firstName = user.firstName || user.email?.split('@')[0] || 'Vos';

  nav.innerHTML = `
    <span class="nav-greeting">Hola, ${escHtml(firstName)}</span>
    <a href="app.html?publish=1" class="btn-nav-register">Publicar propiedad</a>
    <button class="btn-nav-logout" onclick="logoutFromLanding()">Salir</button>`;
}

function logoutFromLanding() {
  localStorage.removeItem('inmo_token');
  localStorage.removeItem('inmo_user');
  updateNavAuth();
}

/* ── Init ── */

document.addEventListener('DOMContentLoaded', () => {
  updateNavAuth();
  loadProperties();

  document.getElementById('search-zone').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });

  // Retorno desde login: ?prop=<id>&action=<contact|visit>
  const params = new URLSearchParams(window.location.search);
  const returnAction = params.get('action');
  const returnPropId = params.get('prop');
  if (returnAction && returnPropId && localStorage.getItem('inmo_token')) {
    // Limpiar params de la URL sin recargar
    history.replaceState({}, '', 'index.html');
    // Esperar a que se carguen las propiedades antes de abrir el detalle
    const waitAndAct = setInterval(async () => {
      try {
        const res = await fetch(`${API_CATALOG}/api/v1/properties/${returnPropId}`);
        if (!res.ok) return;
        const prop = await res.json();
        clearInterval(waitAndAct);
        selectedProp = prop;
        requireAuth(returnAction);
      } catch (_) { /* reintentar en próximo tick */ }
    }, 600);
    setTimeout(() => clearInterval(waitAndAct), 8000); // timeout de seguridad
  }
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

  if (token && action === 'visit') {
    openVisitModal(selectedProp);
    return;
  }

  if (token && action === 'contact') {
    startContactChat(selectedProp);
    return;
  }

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

async function startContactChat(prop) {
  if (!prop) return;

  const token = localStorage.getItem('inmo_token');
  const btn   = document.querySelector('#modal-detail .btn-contact');
  if (btn) { btn.disabled = true; btn.textContent = 'Iniciando chat…'; }

  try {
    const res = await fetch(`${API_CHAT}/api/v1/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ property_id: prop.id, advertiser_id: prop.owner_id }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const friendly = friendlyContactError(errBody.message || '');
      showDetailActionMsg(friendly); 
      return; 
    }

    const data   = await res.json();
    const chatId = data.id || data.conversation_id;
    if (!chatId) throw new Error('sin id de chat');

    window.location.href = `mensajes.html?conv=${chatId}`;
  } catch (err) {
    console.error('[contact-chat]', err);
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar mensaje al propietario'; }
    alert('No se pudo iniciar la conversación. Intentá de nuevo.');
  }
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

function friendlyContactError(serverMsg) {
  if (serverMsg.includes('mismo usuario')) {
    return 'Esta es tu propia propiedad — no podés enviarte un mensaje a vos mismo.';
  }
  if (serverMsg.includes('advertiser_id') || serverMsg.includes('obligatorio')) {
    return 'Faltan datos de la propiedad. Cerrá este modal y volvé a intentarlo.';
  }
  return serverMsg || 'No se pudo iniciar la conversación. Intentá de nuevo.';
}

function showDetailActionMsg(text) {
  const el = document.getElementById('detail-action-msg');
  if (!el) return;
  el.textContent = text;
  el.style.display = 'flex';
}

function hideDetailActionMsg() {
  const el = document.getElementById('detail-action-msg');
  if (el) el.style.display = 'none';
}

/* ── Edición de publicación propia ── */

function openEditForm() {
  const p = selectedProp;
  if (!p) return;

  const opType   = p.operation_type || '';
  const rawPrice = typeof p.price === 'object' ? p.price?.amount : p.price;
  const currency = (typeof p.price === 'object' ? p.price?.currency : p.currency) || 'ARS';

  document.getElementById('edit-title').value       = p.title || '';
  document.getElementById('edit-description').value = p.description || '';
  document.getElementById('edit-address').value     = p.address || p.location?.address || '';
  document.getElementById('edit-price').value       = rawPrice || '';
  document.getElementById('edit-currency').value    = currency;
  document.getElementById('edit-pet-policy').value  = p.pet_policy || 'NOT_ALLOWED';

  const tempSection = document.getElementById('edit-temp-fields');
  if (opType === 'TEMP') {
    tempSection.style.display = '';
    document.getElementById('edit-night-price').value      = p.night_price      || '';
    document.getElementById('edit-cleaning-fee').value     = p.cleaning_fee     || '';
    document.getElementById('edit-security-deposit').value = p.security_deposit || '';
    document.getElementById('edit-min-nights').value       = p.min_nights       || '';
    document.getElementById('edit-max-nights').value       = p.max_nights       || '';
    document.getElementById('edit-check-in').value         = p.check_in_time    || '';
    document.getElementById('edit-check-out').value        = p.check_out_time   || '';
  } else {
    tempSection.style.display = 'none';
  }

  const msgEl = document.getElementById('edit-form-msg');
  msgEl.style.display = 'none';
  msgEl.textContent   = '';
  msgEl.className     = 'edit-form-msg';

  document.getElementById('btn-save-edit').disabled    = false;
  document.getElementById('btn-save-edit').textContent = 'Guardar cambios';
  document.getElementById('detail-edit-section').style.display = '';

  loadEditPhotos(p.id);
}

function closeEditForm() {
  const sec = document.getElementById('detail-edit-section');
  if (sec) sec.style.display = 'none';
}

async function submitEditForm(e) {
  e.preventDefault();
  const p     = selectedProp;
  const token = localStorage.getItem('inmo_token');
  if (!p || !token) return;

  const btn   = document.getElementById('btn-save-edit');
  const msgEl = document.getElementById('edit-form-msg');

  btn.disabled    = true;
  btn.textContent = 'Guardando…';
  msgEl.style.display = 'none';

  const body = {};

  const title     = document.getElementById('edit-title').value.trim();
  const desc      = document.getElementById('edit-description').value.trim();
  const addr      = document.getElementById('edit-address').value.trim();
  const price     = parseFloat(document.getElementById('edit-price').value);
  const currency  = document.getElementById('edit-currency').value;
  const petPolicy = document.getElementById('edit-pet-policy').value;

  if (title)                      body.title       = title;
  if (desc)                       body.description = desc;
  if (addr)                       body.address     = addr;
  if (!isNaN(price) && price > 0) body.price       = price;
  if (currency)                   body.currency    = currency;
  if (petPolicy)                  body.pet_policy  = petPolicy;

  if ((p.operation_type || '') === 'TEMP') {
    const nightPrice  = parseFloat(document.getElementById('edit-night-price').value);
    const cleaningFee = parseFloat(document.getElementById('edit-cleaning-fee').value);
    const secDeposit  = parseFloat(document.getElementById('edit-security-deposit').value);
    const minNights   = parseInt(document.getElementById('edit-min-nights').value, 10);
    const maxNights   = parseInt(document.getElementById('edit-max-nights').value, 10);
    const checkIn     = document.getElementById('edit-check-in').value;
    const checkOut    = document.getElementById('edit-check-out').value;

    if (!isNaN(nightPrice)  && nightPrice  > 0)  body.night_price       = nightPrice;
    if (!isNaN(cleaningFee) && cleaningFee >= 0)  body.cleaning_fee     = cleaningFee;
    if (!isNaN(secDeposit)  && secDeposit  >= 0)  body.security_deposit = secDeposit;
    if (!isNaN(minNights)   && minNights   > 0)   body.min_nights       = minNights;
    if (!isNaN(maxNights)   && maxNights   > 0)   body.max_nights       = maxNights;
    if (checkIn)  body.check_in_time  = checkIn;
    if (checkOut) body.check_out_time = checkOut;
  }

  if (Object.keys(body).length === 0) {
    btn.disabled    = false;
    btn.textContent = 'Guardar cambios';
    msgEl.textContent   = 'No hiciste ningún cambio.';
    msgEl.className     = 'edit-form-msg warning';
    msgEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_CATALOG}/api/v1/properties/${p.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    Object.assign(selectedProp, body);
    closeEditForm();
    renderDetailInfo(selectedProp);

  } catch (err) {
    btn.disabled    = false;
    btn.textContent = 'Guardar cambios';
    msgEl.textContent   = err.message || 'No se pudo guardar. Intentá de nuevo.';
    msgEl.className     = 'edit-form-msg error';
    msgEl.style.display = 'block';
  }
}

/* ── Gestión de fotos en formulario de edición ── */

async function loadEditPhotos(propertyID) {
  const grid  = document.getElementById('edit-photos-grid');
  const msgEl = document.getElementById('edit-photos-msg');
  grid.innerHTML = '<span class="edit-photos-loading">Cargando…</span>';
  msgEl.style.display = 'none';

  try {
    const res   = await fetch(`${API_CATALOG}/api/v1/properties/${propertyID}/media`);
    const items = res.ok ? await res.json() : [];
    const photos = Array.isArray(items) ? items.filter(m => m.type === 'IMAGE' || m.type === 'VIDEO') : [];

    if (photos.length === 0) {
      grid.innerHTML = '<span class="edit-photos-empty">Sin fotos aún</span>';
      return;
    }

    grid.innerHTML = photos.map(m => `
      <div class="edit-photo-item" id="ephoto-${escHtml(m.id)}">
        ${m.type === 'VIDEO'
          ? `<video class="edit-photo-thumb" src="${escHtml(m.url)}" preload="none"></video>`
          : `<img class="edit-photo-thumb" src="${escHtml(m.url)}" alt="" loading="lazy">`}
        <button class="edit-photo-del" type="button" aria-label="Eliminar foto"
          onclick="deleteEditPhoto('${escHtml(m.id)}', '${escHtml(propertyID)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
  } catch (_) {
    grid.innerHTML = '<span class="edit-photos-empty">No se pudieron cargar las fotos</span>';
  }
}

async function deleteEditPhoto(mediaID, propertyID) {
  const token = localStorage.getItem('inmo_token');
  if (!token) return;

  const item  = document.getElementById(`ephoto-${mediaID}`);
  const msgEl = document.getElementById('edit-photos-msg');
  if (item) item.style.opacity = '0.4';

  try {
    const res = await fetch(`${API_CATALOG}/api/v1/properties/${propertyID}/media/${mediaID}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    if (item) item.remove();

    const grid = document.getElementById('edit-photos-grid');
    if (grid && !grid.querySelector('.edit-photo-item')) {
      grid.innerHTML = '<span class="edit-photos-empty">Sin fotos aún</span>';
    }

    // Recargar la zona de imágenes del modal con las fotos actualizadas
    loadDetailMedia(propertyID, document.getElementById('modal-detail-img'));

  } catch (err) {
    if (item) item.style.opacity = '';
    msgEl.textContent   = err.message || 'No se pudo eliminar la foto.';
    msgEl.className     = 'edit-photos-msg error';
    msgEl.style.display = 'block';
  }
}

async function handlePhotoSelect(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  input.value = '';

  const p     = selectedProp;
  const token = localStorage.getItem('inmo_token');
  if (!p || !token) return;

  const msgEl = document.getElementById('edit-photos-msg');
  msgEl.style.display = 'none';

  for (const file of files) {
    await uploadOnePhoto(file, p.id, token, msgEl);
  }

  // Recargar grid y zona de imagen del modal
  await loadEditPhotos(p.id);
  loadDetailMedia(p.id, document.getElementById('modal-detail-img'));
}

async function uploadOnePhoto(file, propertyID, token, msgEl) {
  const grid = document.getElementById('edit-photos-grid');

  // Placeholder con progreso
  const placeholderId = `up-${Date.now()}`;
  const placeholder   = document.createElement('div');
  placeholder.className = 'edit-photo-item uploading';
  placeholder.id        = placeholderId;
  placeholder.innerHTML = `
    <div class="edit-photo-progress">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span class="edit-photo-progress-name">${escHtml(file.name)}</span>
    </div>`;

  // Quitar el "Sin fotos" si existía
  const empty = grid.querySelector('.edit-photos-empty');
  if (empty) empty.remove();
  grid.appendChild(placeholder);

  try {
    // 1. Obtener presigned URL
    const urlRes = await fetch(`${API_CATALOG}/api/v1/properties/${propertyID}/media/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ filename: file.name, content_type: file.type }),
    });

    if (!urlRes.ok) {
      const err = await urlRes.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${urlRes.status}`);
    }

    const { presigned_url: presignedURL, final_url: finalURL } = await urlRes.json();

    // 2. Subir directamente a S3
    const uploadRes = await fetch(presignedURL, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });

    if (!uploadRes.ok) throw new Error('Error al subir el archivo a S3');

    // 3. Confirmar al backend
    const confirmRes = await fetch(`${API_CATALOG}/api/v1/properties/${propertyID}/media`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        url:        finalURL,
        type:       file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        sort_order: 0,
      }),
    });

    if (!confirmRes.ok) {
      const err = await confirmRes.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${confirmRes.status}`);
    }

  } catch (err) {
    msgEl.textContent   = `${file.name}: ${err.message || 'Error al subir'}`;
    msgEl.className     = 'edit-photos-msg error';
    msgEl.style.display = 'block';
  } finally {
    placeholder.remove();
  }
}

/* ══════════════════════════════════════════════════
   INMO MAP MODULE — map.js
   Agregar <script src="map.js"></script> en index.html
   DESPUÉS de index.js
   ══════════════════════════════════════════════════ */

'use strict';

/* ── Estado del mapa ── */
const MapState = {
  map:          null,
  markers:      [],       // { marker, propId, divIcon }
  radiusCircle: null,
  userMarker:   null,
  activePopup:  null,
  geoLat:       null,
  geoLon:       null,
  radiusKm:     5,
  initialized:  false,
};

/* ── Inicializar Leaflet ── */
function initMap() {
  if (MapState.initialized) return;
  MapState.initialized = true;

  // Centro default: Buenos Aires
  MapState.map = L.map('map', {
    center: [-34.6037, -58.3816],
    zoom: 12,
    zoomControl: true,
    scrollWheelZoom: true,
  });

  // Tile OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(MapState.map);

  // Mover el control de zoom a la derecha
  MapState.map.zoomControl.setPosition('bottomright');

  // Click en el mapa → limpiar búsqueda geo
  MapState.map.on('click', () => {
    // Solo si no hay geo activo (evitar conflicto con popup)
  });
}

/* ── Crear marcador con precio como label ── */
function createMarkerIcon(price, currency, isActive) {
  const symbol = currency === 'USD' ? 'U$S' : '$';
  const formatted = Number(price).toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const label = `${symbol} ${formatted}`;

  return L.divIcon({
    className: '',
    html: `<div class="map-marker ${isActive ? 'active' : ''}">${label}</div>`,
    iconSize:   null,
    iconAnchor: [0, 0],
    popupAnchor: [0, -10],
  });
}

/* ── Construir HTML del popup ── */
function buildPopupHTML(p) {
  const rawPrice = typeof p.price === 'object' ? p.price?.amount : p.price;
  const price    = Number(rawPrice || 0).toLocaleString('es-AR');
  const currency = (typeof p.price === 'object' ? p.price?.currency : p.currency) || 'ARS';
  const opLabel  = { SALE: 'Venta', RENT: 'Alquiler', TEMP: 'Temporario' };
  const op       = p.operation_type || 'SALE';
  const address  = escHtml(p.address || p.location?.address || '');
  const symbol   = currency === 'USD' ? 'U$S' : '$';

  // Serializar la propiedad para el onclick — escapado para HTML attribute
  const pJson = JSON.stringify(p).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  return `
    <div class="map-popup">
      <div class="map-popup-img" id="popup-img-${escHtml(p.id)}">
        <svg class="map-popup-img-placeholder" width="36" height="36" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <div class="map-popup-body">
        <span class="map-popup-op ${op}">${opLabel[op] || op}</span>
        <div class="map-popup-title">${escHtml(p.title || 'Sin título')}</div>
        <div class="map-popup-addr">${address}</div>
        <div class="map-popup-footer">
          <span class="map-popup-price">
            ${symbol} ${price}<span class="map-popup-currency">${currency}</span>
          </span>
          <button class="map-popup-btn" onclick="openDetail(${pJson})">Ver más</button>
        </div>
      </div>
    </div>`;
}

/* ── Cargar imagen del popup después de abrirlo ── */
async function loadPopupImage(propertyId) {
  try {
    const res   = await fetch(`${API_CATALOG}/api/v1/properties/${propertyId}/media`);
    if (!res.ok) return;
    const items = await res.json();
    const first  = Array.isArray(items) ? items.find(m => m.type === 'IMAGE') : null;
    if (!first?.url) return;

    const container = document.getElementById(`popup-img-${propertyId}`);
    if (!container) return;
    container.innerHTML = `<img src="${escHtml(first.url)}" alt="" loading="lazy"
      style="width:100%;height:100%;object-fit:cover;display:block" />`;
  } catch (_) { /* silencioso */ }
}

/* ── Renderizar markers a partir de la lista de propiedades ── */
function renderMarkers(props) {
  if (!MapState.map) return;

  // Limpiar markers anteriores
  MapState.markers.forEach(({ marker }) => MapState.map.removeLayer(marker));
  MapState.markers = [];

  if (!props.length) return;

  const bounds = [];

  props.forEach(p => {
    const lat = p.location?.latitude  ?? p.latitude;
    const lng = p.location?.longitude ?? p.longitude;
    if (!lat || !lng) return;

    const rawPrice = typeof p.price === 'object' ? p.price?.amount : p.price;
    const currency = (typeof p.price === 'object' ? p.price?.currency : p.currency) || 'ARS';

    const icon   = createMarkerIcon(rawPrice, currency, false);
    const marker = L.marker([lat, lng], { icon, riseOnHover: true });

    const popupContent = buildPopupHTML(p);
    const popup = L.popup({ closeButton: true, maxWidth: 220, minWidth: 220 })
      .setContent(popupContent);

    marker.bindPopup(popup);

    // Al abrir el popup → marcar como activo y cargar imagen
    marker.on('popupopen', () => {
      setMarkerActive(p.id, true);
      loadPopupImage(p.id);
      highlightCard(p.id);
    });

    marker.on('popupclose', () => {
      setMarkerActive(p.id, false);
      unhighlightCard(p.id);
    });

    marker.addTo(MapState.map);
    MapState.markers.push({ marker, propId: p.id, lat, lng });
    bounds.push([lat, lng]);
  });

  // Ajustar vista al conjunto de markers (si no hay búsqueda geo activa)
  if (bounds.length > 0 && !MapState.geoLat) {
    try {
      MapState.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch (_) {}
  }
}

/* ── Activar/desactivar marker visualmente ── */
function setMarkerActive(propId, active) {
  MapState.markers.forEach(m => {
    if (m.propId === propId) {
      const rawPrice = m.marker.options.icon.options.html;
      // Re-crear el icon con la clase activa
      const el = m.marker.getElement();
      if (el) {
        const div = el.querySelector('.map-marker');
        if (div) {
          if (active) div.classList.add('active');
          else        div.classList.remove('active');
        }
      }
    }
  });
}

/* ── Resaltar card en la lista cuando se abre un popup ── */
function highlightCard(propId) {
  document.querySelectorAll('.prop-card').forEach(c => {
    const onclick = c.getAttribute('onclick') || '';
    if (onclick.includes(propId)) {
      c.style.outline = '2px solid var(--gold)';
      c.style.outlineOffset = '2px';
      c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function unhighlightCard(propId) {
  document.querySelectorAll('.prop-card').forEach(c => {
    c.style.outline = '';
    c.style.outlineOffset = '';
  });
}

/* ── Abrir popup de un marker desde la card (hover) ── */
function openMarkerPopup(propId) {
  const found = MapState.markers.find(m => m.propId === propId);
  if (found) {
    found.marker.openPopup();
    MapState.map.panTo([found.lat, found.lng], { animate: true, duration: 0.3 });
  }
}

/* ── Círculo de radio geo ── */
function drawRadiusCircle(lat, lng, radiusKm) {
  if (MapState.radiusCircle) {
    MapState.map.removeLayer(MapState.radiusCircle);
  }
  MapState.radiusCircle = L.circle([lat, lng], {
    radius:    radiusKm * 1000,
    className: 'map-radius-circle',
  }).addTo(MapState.map);
}

function clearRadiusCircle() {
  if (MapState.radiusCircle) {
    MapState.map.removeLayer(MapState.radiusCircle);
    MapState.radiusCircle = null;
  }
}

/* ── Marker de posición del usuario ── */
function setUserMarker(lat, lng) {
  if (MapState.userMarker) {
    MapState.map.removeLayer(MapState.userMarker);
  }
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;
      background:var(--gold);
      border:3px solid var(--white);
      border-radius:50%;
      box-shadow:0 0 0 3px rgba(201,169,110,0.3),var(--shadow-sm);
    "></div>`,
    iconSize:   [14, 14],
    iconAnchor: [7, 7],
  });
  MapState.userMarker = L.marker([lat, lng], { icon, zIndexOffset: 500 })
    .addTo(MapState.map)
    .bindTooltip('Tu ubicación', { direction: 'top', offset: [0, -10] });
}

/* ── Geo: buscar por mi ubicación ── */
async function geoLocateMe() {
  const btn = document.getElementById('btn-geo-locate');
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización.');
    return;
  }

  btn.classList.add('locating');
  btn.querySelector('.geo-locate-text').textContent = 'Localizando...';

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      applyGeoFilter(lat, lng, MapState.radiusKm);
      btn.classList.remove('locating');
      btn.querySelector('.geo-locate-text').textContent = 'Mi ubicación';
    },
    err => {
      console.error('[geo]', err);
      alert('No se pudo obtener tu ubicación. Verificá los permisos del navegador.');
      btn.classList.remove('locating');
      btn.querySelector('.geo-locate-text').textContent = 'Mi ubicación';
    },
    { timeout: 8000 }
  );
}

/* ── Aplicar filtro geo ── */
function applyGeoFilter(lat, lng, radiusKm) {
  MapState.geoLat   = lat;
  MapState.geoLon   = lng;
  MapState.radiusKm = radiusKm;

  // Mover mapa al punto
  MapState.map.setView([lat, lng], 13, { animate: true });

  // Dibujar círculo y marker de usuario
  setUserMarker(lat, lng);
  drawRadiusCircle(lat, lng, radiusKm);

  // Mostrar badge
  showGeoBadge(radiusKm);

  // Disparar búsqueda con coords
  doSearch();
}

/* ── Limpiar filtro geo ── */
function clearGeoFilter() {
  MapState.geoLat = null;
  MapState.geoLon = null;

  clearRadiusCircle();
  if (MapState.userMarker) {
    MapState.map.removeLayer(MapState.userMarker);
    MapState.userMarker = null;
  }

  hideGeoBadge();
  doSearch();
}

/* ── Badge geo ── */
function showGeoBadge(radiusKm) {
  const badge = document.getElementById('geo-badge');
  if (badge) {
    badge.style.display = 'inline-flex';
    badge.querySelector('.geo-badge-label').textContent = `Radio ${radiusKm} km`;
  }
}

function hideGeoBadge() {
  const badge = document.getElementById('geo-badge');
  if (badge) badge.style.display = 'none';
}

/* ── Toggle mobile: lista / mapa ── */
function showListView() {
  document.getElementById('map-panel').classList.remove('mobile-visible');
  document.getElementById('btn-toggle-list').classList.add('active');
  document.getElementById('btn-toggle-map').classList.remove('active');
}

function showMapView() {
  document.getElementById('map-panel').classList.add('mobile-visible');
  document.getElementById('btn-toggle-map').classList.add('active');
  document.getElementById('btn-toggle-list').classList.remove('active');
  // Invalidar tamaño del mapa al mostrarlo en mobile
  if (MapState.map) {
    setTimeout(() => MapState.map.invalidateSize(), 50);
  }
}

/* ── Hook: interceptar renderProperties para sincronizar mapa ── */
const _originalRenderProperties = window.renderProperties;
window.renderProperties = function(props) {
  // Llamar al render original de las cards
  _originalRenderProperties(props);

  // Sincronizar markers en el mapa
  renderMarkers(props);

  // Agregar hover en cards para iluminar marker
  props.forEach(p => {
    // Pequeño delay para que el DOM exista
    requestAnimationFrame(() => {
      document.querySelectorAll('.prop-card').forEach(card => {
        const onclick = card.getAttribute('onclick') || '';
        if (onclick.includes(p.id)) {
          card.addEventListener('mouseenter', () => openMarkerPopup(p.id));
        }
      });
    });
  });
};

/* ── Hook: interceptar loadProperties para pasar params geo ── */
const _originalLoadProperties = window.loadProperties;
window.loadProperties = async function() {
  // Si hay geo activo, inyectar params en la URL antes de fetchear
  // Lo hacemos sobreescribiendo los valores en el scope de index.js
  // a través de la función doSearch que ya existe

  // Llamar al original — que ahora leerá GeoState vía getGeoParams()
  await _originalLoadProperties();
};

/* ── Exportar params geo para que index.js los use ── */
window.getGeoParams = function() {
  if (MapState.geoLat && MapState.geoLon) {
    return {
      lat:       MapState.geoLat,
      lon:       MapState.geoLon,
      radius_km: MapState.radiusKm,
    };
  }
  return null;
};

/* ── Init al cargar ── */
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  // Invalidar tamaño tras primer render (por si el panel estaba oculto)
  setTimeout(() => {
    if (MapState.map) MapState.map.invalidateSize();
  }, 200);
});

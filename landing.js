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

function openDetail(p) {
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
    ? `<div class="detail-pet-note">🐾 Esta propiedad acepta mascotas en alquiler temporario. Puede aplicarse un cargo adicional de limpieza o depósito en garantía.</div>`
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

  document.getElementById('modal-detail').classList.add('open');
  document.body.style.overflow = 'hidden';
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
  const returnUrl  = encodeURIComponent(`landing.html?prop=${propId}&action=${action}`);
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

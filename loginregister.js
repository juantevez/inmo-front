'use strict';

const API_AUTH = 'http://localhost:8000';

let _ssoConfig = null;

async function loadSSOConfig() {
  try {
    const res = await fetch(`${API_AUTH}/api/v1/auth/sso/config`);
    if (res.ok) _ssoConfig = await res.json();
  } catch (_) {}
}

/* ─────────────────────────────────────────
   MAPEO ROLES: valor del radio → backend
   Buyer     → INTERESADO  (busca comprar/alquilar)
   Renter    → INQUILINO   (busca alquilar, firmará contrato)
   Owner     → PROPIETARIO (tiene propiedades para publicar)
   Provider  → PROVEEDOR   (técnico: plomero, electricista, etc.)
───────────────────────────────────────── */
const ROLE_MAP = {
  buyer:    'INTERESADO',
  renter:   'INQUILINO',
  owner:    'PROPIETARIO',
  provider: 'PROVEEDOR',
};

const ROLE_LABELS = {
  INTERESADO:  'Buscador de propiedades',
  INQUILINO:   'Inquilino',
  PROPIETARIO: 'Propietario',
  PROVEEDOR:   'Proveedor técnico',
};

/* ── SSO — Google ── */
function loginWithGoogle() {
  const clientId    = _ssoConfig?.google_client_id;
  const redirectUri = _ssoConfig?.google_redirect_uri || (window.location.origin + '/loginregister.html');
  if (!clientId) { showSSOMsg('Google SSO no está configurado en el servidor.'); return; }
  const state = btoa(JSON.stringify({ provider: 'google', return: getReturnUrl() }));
  const url = 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id='    + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope='        + encodeURIComponent('openid email profile') +
    '&access_type=offline' +
    '&state='        + encodeURIComponent(state);
  window.location.href = url;
}

async function handleGoogleCallback(code, returnUrl) {
  setSSOLoading(true);
  try {
    const res  = await fetch(`${API_AUTH}/api/v1/auth/sso/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status} al autenticar con Google`);
    await handleSSOSuccess(data, returnUrl);
  } catch (err) {
    setSSOLoading(false);
    showSSOMsg(err.message || 'No se pudo iniciar sesión con Google. Intentá de nuevo.');
  }
}

/* ── SSO — Meta ── */
function initFacebookSDK() {
  const appId = _ssoConfig?.meta_app_id;
  if (!appId || typeof FB === 'undefined') return;
  FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
}

window.fbAsyncInit = function () { initFacebookSDK(); };

function loginWithMeta() {
  if (!_ssoConfig?.meta_app_id) { showSSOMsg('Meta SSO no está configurado en el servidor.'); return; }
  if (typeof FB === 'undefined')  { showSSOMsg('El SDK de Meta no terminó de cargar. Recargá la página.'); return; }
  FB.login(async response => {
    if (response.status !== 'connected' || !response.authResponse?.accessToken) return;
    setSSOLoading(true);
    try {
      const res  = await fetch(`${API_AUTH}/api/v1/auth/sso/meta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: response.authResponse.accessToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status} al autenticar con Meta`);
      await handleSSOSuccess(data, getReturnUrl());
    } catch (err) {
      setSSOLoading(false);
      showSSOMsg(err.message || 'No se pudo iniciar sesión con Meta. Intentá de nuevo.');
    }
  }, { scope: 'email' });
}

async function handleSSOSuccess(data, returnUrl) {
  const token = data.AccessToken;
  localStorage.setItem('inmo_token', token);
  localStorage.setItem('inmo_user', JSON.stringify({}));
  const profile = await fetchProfile(token);
  if (!profile) {
    const qs = (returnUrl && returnUrl !== 'index.html') ? `?return=${encodeURIComponent(returnUrl)}` : '';
    window.location.href = `profile-setup.html${qs}`;
  } else {
    localStorage.setItem('inmo_user', JSON.stringify({
      firstName: profile.first_name, lastName: profile.last_name,
      profileType: profile.profile_type, profileStatus: profile.status,
    }));
    window.location.href = dashboardForProfile(profile, returnUrl || 'index.html');
  }
}

function showSSOMsg(text) {
  const activeForm = document.querySelector('.auth-form.active');
  const msgId = activeForm?.id === 'form-register' ? 'register-msg' : 'login-msg';
  showMsg(msgId, text, 'error');
}

function setSSOLoading(loading) {
  ['btn-sso-google-login','btn-sso-google-reg','btn-sso-meta-login','btn-sso-meta-reg']
    .forEach(id => { const b = document.getElementById(id); if (b) b.disabled = loading; });
}

/* ── Tab switching ── */
function switchTab(tab) {
  ['login','register'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`tab-${t}`).setAttribute('aria-selected', String(t === tab));
    document.getElementById(`form-${t}`).classList.toggle('active', t === tab);
  });
}

function getReturnUrl() {
  return new URLSearchParams(window.location.search).get('return') || 'index.html';
}

/* ── Login ── */
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  btn.classList.add('loading'); btn.disabled = true;
  hideMsg('login-msg');

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res  = await fetch(`${API_AUTH}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 403) throw new Error('Verificá tu email antes de iniciar sesión. Revisá tu casilla de correo.');
    if (res.status === 429) throw new Error('Demasiados intentos. Esperá 15 minutos antes de reintentar.');
    if (!res.ok)            throw new Error(data.error || 'Email o contraseña incorrectos.');

    const token = data.AccessToken;
    localStorage.setItem('inmo_token', token);
    localStorage.setItem('inmo_user', JSON.stringify({ email }));
    showMsg('login-msg', '¡Bienvenido!', 'success');

    const returnUrl = getReturnUrl();
    setTimeout(async () => {
      const profile = await fetchProfile(token);
      if (!profile) {
        const qs = returnUrl !== 'index.html' ? `?return=${encodeURIComponent(returnUrl)}` : '';
        window.location.href = `profile-setup.html${qs}`;
      } else {
        const user = JSON.parse(localStorage.getItem('inmo_user') || '{}');
        localStorage.setItem('inmo_user', JSON.stringify({
          ...user,
          firstName: profile.first_name, lastName: profile.last_name,
          profileType: profile.profile_type, profileStatus: profile.status,
        }));
        window.location.href = dashboardForProfile(profile, returnUrl);
      }
    }, 600);
  } catch (err) {
    showMsg('login-msg', err.message || 'No se pudo iniciar sesión. Intentá de nuevo.', 'error');
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

/* ── Register ── */
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  btn.classList.add('loading'); btn.disabled = true;
  hideMsg('register-msg');

  const email       = document.getElementById('reg-email').value.trim();
  const password    = document.getElementById('reg-password').value;
  const userTypeRaw = document.querySelector('input[name="user-type"]:checked')?.value;
  const role        = ROLE_MAP[userTypeRaw];

  // Validación: el rol es obligatorio — el backend rechaza sin él
  if (!role) {
    showMsg('register-msg', 'Seleccioná cómo vas a usar Inmo para continuar.', 'error');
    // Hacer scroll suave al selector para que el usuario lo vea
    document.querySelector('.user-type-grid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    btn.classList.remove('loading'); btn.disabled = false;
    return;
  }

  try {
    const res  = await fetch(`${API_AUTH}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),  // ← role requerido por el backend
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 409) throw new Error('Ese email ya tiene una cuenta. ¿Querés iniciar sesión?');
    if (res.status === 400) throw new Error(data.error || 'Verificá los datos ingresados.');
    if (!res.ok)            throw new Error(data.error || 'No se pudo crear la cuenta. Intentá de nuevo.');

    // El backend devuelve { UserID, Role } — confirmamos el rol asignado
    const assignedRole = data.Role || role;
    const roleLabel    = ROLE_LABELS[assignedRole] || assignedRole;

    localStorage.setItem('inmo_pending_email', email);
    localStorage.setItem('inmo_pending_role',  userTypeRaw);

    showMsg(
      'register-msg',
      `✓ Cuenta creada como ${roleLabel}. Revisá tu email para verificarla.`,
      'success'
    );
    setTimeout(() => switchTab('login'), 2800);
  } catch (err) {
    showMsg('register-msg', err.message || 'No se pudo crear la cuenta. Intentá de nuevo.', 'error');
    btn.classList.remove('loading'); btn.disabled = false;
  }
}

/* ── Profile check ── */
async function fetchProfile(token) {
  try {
    const res = await fetch(`${API_AUTH}/api/v1/catalog/profiles/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) return await res.json();
    return null;
  } catch { return null; }
}

function dashboardForProfile(profile, returnUrl) {
  if (returnUrl && returnUrl !== 'index.html') return decodeURIComponent(returnUrl);
  return 'app.html';
}

/* ── Helpers ── */
function showMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `form-msg ${type} visible`;
}

function hideMsg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'form-msg';
  el.textContent = '';
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', async () => {
  await loadSSOConfig();
  initFacebookSDK();

  const params   = new URLSearchParams(window.location.search);
  const code     = params.get('code');
  const stateRaw = params.get('state');

  if (code && stateRaw) {
    try {
      const state = JSON.parse(atob(stateRaw));
      if (state.provider === 'google') {
        history.replaceState({}, '', 'loginregister.html');
        handleGoogleCallback(code, state.return || 'index.html');
        return;
      }
    } catch (_) {}
  }

  if (params.get('tab') === 'register') {
    switchTab('register');
  } else {
    const pendingEmail = localStorage.getItem('inmo_pending_email');
    if (pendingEmail) {
      document.getElementById('login-email').value = pendingEmail;
      localStorage.removeItem('inmo_pending_email');
    }
  }
});

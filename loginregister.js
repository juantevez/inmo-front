'use strict';

const API_AUTH = 'http://localhost:8000';

// Config SSO cargada desde el backend al inicializar la página
let _ssoConfig = null;

async function loadSSOConfig() {
  try {
    const res = await fetch(`${API_AUTH}/api/v1/auth/sso/config`);
    if (res.ok) _ssoConfig = await res.json();
  } catch (_) { /* sin config SSO disponible */ }
}

/* ── SSO — Google ── */

function loginWithGoogle() {
  const clientId   = _ssoConfig?.google_client_id;
  const redirectUri = _ssoConfig?.google_redirect_uri || (window.location.origin + '/loginregister.html');
  if (!clientId) {
    showSSOMsg('Google SSO no está configurado en el servidor.');
    return;
  }
  const state = btoa(JSON.stringify({ provider: 'google', return: getReturnUrl() }));
  const url = 'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id='     + encodeURIComponent(clientId) +
    '&redirect_uri='  + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope='         + encodeURIComponent('openid email profile') +
    '&access_type=offline' +
    '&state='         + encodeURIComponent(state);
  window.location.href = url;
}

async function handleGoogleCallback(code, returnUrl) {
  setSSOLoading(true);
  try {
    const res = await fetch(`${API_AUTH}/api/v1/auth/sso/google`, {
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

// Inicializar Facebook SDK cuando carga (se llama desde fbAsyncInit después de loadSSOConfig)
function initFacebookSDK() {
  const appId = _ssoConfig?.meta_app_id;
  if (!appId || typeof FB === 'undefined') return;
  FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
}

window.fbAsyncInit = function () { initFacebookSDK(); };

function loginWithMeta() {
  if (!_ssoConfig?.meta_app_id) {
    showSSOMsg('Meta SSO no está configurado en el servidor.');
    return;
  }
  if (typeof FB === 'undefined') {
    showSSOMsg('El SDK de Meta no terminó de cargar. Recargá la página.');
    return;
  }
  FB.login(async response => {
    if (response.status !== 'connected' || !response.authResponse?.accessToken) {
      // El usuario canceló o falló la autorización — no hacer nada
      return;
    }
    setSSOLoading(true);
    try {
      const res = await fetch(`${API_AUTH}/api/v1/auth/sso/meta`, {
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

/* ── SSO — shared post-login ── */

async function handleSSOSuccess(data, returnUrl) {
  const token = data.AccessToken;
  localStorage.setItem('inmo_token', token);
  localStorage.setItem('inmo_user', JSON.stringify({}));

  const profile = await fetchProfile(token);
  if (!profile) {
    const qs = (returnUrl && returnUrl !== 'index.html')
      ? `?return=${encodeURIComponent(returnUrl)}` : '';
    window.location.href = `profile-setup.html${qs}`;
  } else {
    localStorage.setItem('inmo_user', JSON.stringify({
      firstName:     profile.first_name,
      lastName:      profile.last_name,
      profileType:   profile.profile_type,
      profileStatus: profile.status,
    }));
    window.location.href = dashboardForProfile(profile, returnUrl || 'index.html');
  }
}

function showSSOMsg(text) {
  // Reusar el msg del form activo
  const activeForm = document.querySelector('.auth-form.active');
  const msgId = activeForm?.id === 'form-register' ? 'register-msg' : 'login-msg';
  showMsg(msgId, text, 'error');
}

function setSSOLoading(loading) {
  ['btn-sso-google-login', 'btn-sso-google-reg',
   'btn-sso-meta-login',   'btn-sso-meta-reg'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = loading;
  });
}

/* ── Tab switching ── */

function switchTab(tab) {
  ['login', 'register'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`tab-${t}`).setAttribute('aria-selected', String(t === tab));
    document.getElementById(`form-${t}`).classList.toggle('active', t === tab);
  });
}

/* ── Return URL ── */

function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('return') || 'index.html';
}

/* ── Login ── */

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-login');
  btn.classList.add('loading');
  btn.disabled = true;
  hideMsg('login-msg');

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch(`${API_AUTH}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 403) {
      throw new Error('Verificá tu email antes de iniciar sesión. Revisá tu casilla de correo.');
    }
    if (res.status === 429) {
      throw new Error('Demasiados intentos. Esperá 15 minutos antes de reintentar.');
    }
    if (!res.ok) {
      throw new Error(data.error || 'Email o contraseña incorrectos.');
    }

    const token = data.AccessToken;
    localStorage.setItem('inmo_token', token);
    localStorage.setItem('inmo_user', JSON.stringify({ email }));

    showMsg('login-msg', '¡Bienvenido!', 'success');

    // Verificar en el backend si ya tiene perfil antes de redirigir
    const returnUrl = getReturnUrl();
    setTimeout(async () => {
      const profile = await fetchProfile(token);
      if (!profile) {
        const qs = returnUrl !== 'index.html' ? `?return=${encodeURIComponent(returnUrl)}` : '';
        window.location.href = `profile-setup.html${qs}`;
      } else {
        // Guardar datos del perfil en localStorage para uso en el dashboard
        const user = JSON.parse(localStorage.getItem('inmo_user') || '{}');
        localStorage.setItem('inmo_user', JSON.stringify({
          ...user,
          firstName:   profile.first_name,
          lastName:    profile.last_name,
          profileType: profile.profile_type,
          profileStatus: profile.status,
        }));
        window.location.href = dashboardForProfile(profile, returnUrl);
      }
    }, 600);
  } catch (err) {
    showMsg('login-msg', err.message || 'No se pudo iniciar sesión. Intentá de nuevo.', 'error');
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ── Register ── */

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-register');
  btn.classList.add('loading');
  btn.disabled = true;
  hideMsg('register-msg');

  const firstName = document.getElementById('reg-firstname').value.trim();
  const lastName  = document.getElementById('reg-lastname').value.trim();
  const email     = document.getElementById('reg-email').value.trim();
  const password  = document.getElementById('reg-password').value;
  const userType  = document.querySelector('input[name="user-type"]:checked').value;

  const roleMap = { buyer: 'buscador', renter: 'inquilino', owner: 'propietario' };

  try {
    const res = await fetch(`${API_AUTH}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 409) {
      throw new Error('Ese email ya tiene una cuenta. ¿Querés iniciar sesión?');
    }
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo crear la cuenta. Intentá de nuevo.');
    }

    // Guardamos email y rol para pre-rellenar en el próximo paso.
    localStorage.setItem('inmo_pending_email', email);
    localStorage.setItem('inmo_pending_role', roleMap[userType]);

    showMsg(
      'register-msg',
      `¡Cuenta creada, ${firstName}! Revisá tu email para verificar tu cuenta antes de iniciar sesión.`,
      'success'
    );
    // No redirigimos automáticamente — el usuario debe verificar el email primero.
    setTimeout(() => switchTab('login'), 2500);
  } catch (err) {
    showMsg('register-msg', err.message || 'No se pudo crear la cuenta. Intentá de nuevo.', 'error');
    btn.classList.remove('loading');
    btn.disabled = false;
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
  } catch {
    return null;
  }
}

function dashboardForProfile(profile, returnUrl) {
  // Si hay una URL de retorno explícita (no el default), respetarla siempre
  if (returnUrl && returnUrl !== 'index.html') {
    return decodeURIComponent(returnUrl);
  }
  // COMMERCIAL (inmobiliaria/corredor) o INDIVIDUAL que opera propiedades → dashboard
  return 'index.html';
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
  // Con la config ya cargada, inicializar el SDK de Meta si ya está disponible
  initFacebookSDK();

  const params = new URLSearchParams(window.location.search);

  // Callback de Google OAuth: ?code=...&state=...
  const code      = params.get('code');
  const stateRaw  = params.get('state');
  if (code && stateRaw) {
    try {
      const state = JSON.parse(atob(stateRaw));
      if (state.provider === 'google') {
        // Limpiar params de la URL
        history.replaceState({}, '', 'loginregister.html');
        handleGoogleCallback(code, state.return || 'index.html');
        return;
      }
    } catch (_) { /* state no era nuestro, ignorar */ }
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

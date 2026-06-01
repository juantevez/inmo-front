'use strict';

const API_AUTH = 'http://127.0.0.1:8000';

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
  return params.get('return') || 'landing.html';
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
        const qs = returnUrl !== 'landing.html' ? `?return=${encodeURIComponent(returnUrl)}` : '';
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
  if (returnUrl && returnUrl !== 'landing.html') {
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

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
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

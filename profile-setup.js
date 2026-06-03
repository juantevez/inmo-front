'use strict';

const API_GATEWAY = 'http://127.0.0.1:8000';

// Mapeo de roles del front → profile_type del backend
const ROLE_TO_PROFILE_TYPE = {
  buscador:     'INDIVIDUAL',
  propietario:  'INDIVIDUAL',
  inquilino:    'INDIVIDUAL',
  inmobiliaria: 'COMMERCIAL',
};

// Roles que tienen acceso al panel interno vs solo landing
const ROLE_TO_DASHBOARD = {
  buscador:     'app.html',
  inquilino:    'app.html',
  propietario:  'app.html',
  inmobiliaria: 'app.html',
};

/* ── Init ── */

document.addEventListener('DOMContentLoaded', () => {
  // Si no hay token, el usuario no debería estar acá
  const token = localStorage.getItem('inmo_token');
  if (!token) {
    window.location.href = 'loginregister.html';
    return;
  }

  // Escuchar cambio de rol para mostrar/ocultar secciones del form
  document.querySelectorAll('input[name="profile-role"]').forEach(radio => {
    radio.addEventListener('change', onRoleChange);
  });

  // Pre-seleccionar el rol guardado durante el registro si existe
  const savedRole = localStorage.getItem('inmo_pending_role');
  if (savedRole) {
    const radio = document.querySelector(`input[name="profile-role"][value="${savedRole}"]`);
    if (radio) {
      radio.checked = true;
      onRoleChange();
    }
  }
});

function onRoleChange() {
  const selected = document.querySelector('input[name="profile-role"]:checked')?.value;
  if (!selected) return;

  const personalData    = document.getElementById('personal-data');
  const commercialFields = document.getElementById('commercial-fields');

  personalData.hidden    = false;
  commercialFields.hidden = selected !== 'inmobiliaria';
}

/* ── Submit ── */

async function handleProfileSubmit(e) {
  e.preventDefault();

  const role = document.querySelector('input[name="profile-role"]:checked')?.value;
  if (!role) {
    showMsg('profile-msg', 'Elegí un rol para continuar.', 'error');
    return;
  }

  const firstName = document.getElementById('p-firstname').value.trim();
  const lastName  = document.getElementById('p-lastname').value.trim();
  const dniCuit   = document.getElementById('p-dnicuit').value.trim();
  const phone     = document.getElementById('p-phone').value.trim();

  if (!firstName || !lastName || !dniCuit) {
    showMsg('profile-msg', 'Nombre, apellido y DNI/CUIT son obligatorios.', 'error');
    return;
  }

  const profileType = ROLE_TO_PROFILE_TYPE[role];
  const isCommercial = profileType === 'COMMERCIAL';

  const companyName   = isCommercial ? document.getElementById('p-company').value.trim() : '';
  const licenseNumber = isCommercial ? document.getElementById('p-license').value.trim() : '';

  if (isCommercial && (!companyName || !licenseNumber)) {
    showMsg('profile-msg', 'Nombre de empresa y matrícula son obligatorios para inmobiliarias.', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit');
  btn.classList.add('loading');
  btn.disabled = true;
  hideMsg('profile-msg');

  const token = localStorage.getItem('inmo_token');

  try {
    const res = await fetch(`${API_GATEWAY}/api/v1/catalog/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        first_name:     firstName,
        last_name:      lastName,
        dni_cuit:       dniCuit,
        phone:          phone,
        profile_type:   profileType,
        company_name:   companyName,
        license_number: licenseNumber,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      localStorage.removeItem('inmo_token');
      localStorage.removeItem('inmo_user');
      window.location.href = 'loginregister.html';
      return;
    }
    if (res.status === 409) {
      throw new Error('Ya existe un perfil con ese DNI/CUIT. Si es tuyo, iniciá sesión con tu cuenta original.');
    }
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo guardar el perfil. Intentá de nuevo.');
    }

    // Guardar perfil en localStorage para navegación futura
    const user = JSON.parse(localStorage.getItem('inmo_user') || '{}');
    localStorage.setItem('inmo_user', JSON.stringify({
      ...user,
      firstName,
      lastName,
      role,
      profileType,
      profileStatus: 'PENDING_VERIFICATION',
    }));
    localStorage.removeItem('inmo_pending_role');

    showMsg('profile-msg', '¡Perfil guardado! Redirigiendo...', 'success');

    setTimeout(() => {
      const params  = new URLSearchParams(window.location.search);
      const returnUrl = params.get('return');
      window.location.href = returnUrl ? decodeURIComponent(returnUrl) : ROLE_TO_DASHBOARD[role];
    }, 800);

  } catch (err) {
    showMsg('profile-msg', err.message, 'error');
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ── Skip ── */

function skipSetup() {
  localStorage.removeItem('inmo_pending_role');
  window.location.href = 'app.html';
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

# inmo-front

Frontend del proyecto **Inmo Platform** — interfaz web estática (HTML/CSS/JS vanilla) sin frameworks ni build steps.

## Estructura

```
inmo-front/
├── landing.html          # Página pública de búsqueda de propiedades
├── landing.js            # Lógica de búsqueda y listado público
├── landing.css
│
├── loginregister.html    # Registro e inicio de sesión
├── loginregister.js      # Flujo de auth: register → email verify → login → perfil
├── loginregister.css
│
├── profile-setup.html    # Paso 2 del onboarding: rol y datos personales
├── profile-setup.js
├── profile-setup.css
│
├── index.html            # Dashboard principal (protegido)
├── app.js                # Lógica del dashboard: catálogo, CRM, navegación por roles
├── style.css
```

## Cómo correr

El frontend es HTML estático; solo necesitás un servidor local. La forma recomendada es la extensión **Live Server** de VS Code (puerto `:5500` por defecto).

```bash
# O con cualquier servidor HTTP simple
npx serve .
python3 -m http.server 5500
```

## Gateway y servicios backend

Todas las llamadas van al **API Gateway** en `http://127.0.0.1:8000`. Nunca apuntar directamente a los puertos de los microservicios individuales.

```js
// app.js
const GATEWAY = 'http://127.0.0.1:8000';
```

| Servicio      | Puerto interno | Prefijo en gateway           |
|---------------|---------------|------------------------------|
| Catalog       | `:8081`       | `GET/POST /api/v1/properties` |
| Finances      | `:8082`       | `/api/v1/finances`            |
| Contracts     | `:8083`       | `/api/v1/contracts`           |
| CRM           | `:8084`       | `/api/v1/leads`               |
| Maintenance   | `:8085`       | `/api/v1/maintenance`         |
| Auth          | `:8000`       | `/api/v1/auth`                |

El CORS está configurado únicamente en el gateway; los servicios individuales no tienen CORS.

## Flujo de navegación

```
landing.html
  └─ loginregister.html  (registro o login)
       └─ profile-setup.html  (solo usuarios nuevos sin perfil)
            └─ index.html  (dashboard, requiere token en localStorage)
```

## Autenticación

El token JWT se guarda en `localStorage` bajo la clave `inmo_token` después del login. Todas las requests mutantes lo incluyen en el header `Authorization: Bearer <token>`. Logout limpia las claves `inmo_token`, `inmo_user`, `inmo_pending_role` e `inmo_pending_email`.

## Roles del dashboard

El dashboard (`index.html`) tiene un **role switcher** en el sidebar que adapta la navegación sin recargar la página:

| Rol          | Vistas disponibles                              |
|--------------|-------------------------------------------------|
| Agente       | Catálogo, CRM/Leads, Contratos, Mantenimiento  |
| Propietario  | Mis propiedades, Contratos, Liquidaciones       |
| Buscador     | Buscar propiedades, Mis consultas               |
| Inquilino    | Mi contrato, Pagos, Mantenimiento               |
| Proveedor    | Órdenes de trabajo                              |
| Admin        | Todo + panel de Administración                  |

## Vistas implementadas

- **Catálogo**: grilla de propiedades con filtros (operación, estado, precio), paginación, modal de detalle con acción de reserva, modal de publicación.
- **CRM / Leads**: tabla de leads con estados (NEW → CONTACTED → VISIT_SCHEDULED → CLOSED), acción de agendar visita, modal de creación manual.
- **Contratos / Finanzas / Mantenimiento / Admin**: placeholders listos para conectar.

## Dependencias externas

- Fuentes: Google Fonts (`DM Serif Display`, `DM Sans`) — carga desde CDN.
- Sin librerías JS externas; sin build system.

# MCP connector (ZigZag tickets)

ZigZag expone un servidor [MCP](https://modelcontextprotocol.io) HTTP en `POST /api/mcp` para conectar agentes externos (ChatGPT Developer Mode, Cursor, Claude u otro cliente MCP con Streamable HTTP). Las tools operan sobre tickets y clientes — no sobre pagos ni finanzas.

## URL del conector

| Entorno | URL |
|---|---|
| Producción | `https://<tu-dominio>/api/mcp` |
| Local | `http://localhost:3069/api/mcp` |

El endpoint responde `OPTIONS` con CORS abierto. Sin un token válido ninguna tool devuelve datos (401 + `WWW-Authenticate` RFC 9728).

### Origen público (issuer / resource)

Los endpoints well-known OAuth, redirects de authorize, DCR y la validación del parámetro `resource` en token **derivan el host del request entrante** (`Host` / `x-forwarded-host`), no de un `NEXTAUTH_URL` fijo que pueda apuntar a otro despliegue de Vercel.

| Contexto | Origen usado |
|---|---|
| Request HTTP (well-known, `/api/oauth/*`, `/api/mcp`) | Host del request (p. ej. `https://zigzag-hazel.vercel.app`) |
| SSR sin request (p. ej. Ajustes → Conexiones) | `NEXTAUTH_URL`, luego `AUTH_URL` si está definido |
| Local sin env | `http://localhost:3069` |

Mantén `NEXTAUTH_URL` alineado con la URL canónica de NextAuth en Vercel; el conector MCP no lo usa cuando el cliente ya llamó a un host concreto.

## Autenticación

| Camino | Clientes típicos | Cómo se obtiene |
|---|---|---|
| **Bearer `zigzag_…`** | Cursor, Claude (header manual) | Ajustes → Conexiones → Nueva llave |
| **OAuth 2.1** | ChatGPT (Developer Mode + OAuth) | Login + consentimiento; DCR automático |

Ambos identifican al **mismo usuario** de ZigZag y respetan scopes `read` / `write`.

### Allow-list de compañías (fail closed)

Al crear una llave o autorizar OAuth, el usuario elige **qué compañías** puede ver el agente (mínimo una). La lista vacía implica **ningún acceso** — las tools responden con error explícito, no listas vacías silenciosas.

- Super-admin (`company.is_system`) **no** implica todas las compañías: solo las marcadas.
- RBAC de tenant sigue aplicando (`tickets.read`, `tickets.write`, etc.).
- La allow-list se edita en **Conexiones** sin rehacer OAuth.

### OAuth (ChatGPT)

- **Protected Resource Metadata:** `GET /.well-known/oauth-protected-resource` (también `…/api/mcp`).
- **Authorization Server Metadata:** `GET /.well-known/oauth-authorization-server`.
- **DCR:** `POST /api/oauth/register`.
- **CIMD:** soportado cuando `client_id` es una URL HTTPS con metadata JSON.
- **Flujo:** authorization code + PKCE (`S256`) + parámetro `resource` (RFC 8707).
- **Access token:** prefijo `zigzag_oauth_…`.
- **Expiry:** columnas `timestamptz` (instante UTC); no usar `timestamp` naive.

### Bearer token (manual)

1. Inicia sesión → **Conexiones** (`/settings/connections`).
2. Elige compañías, scopes y crea la llave.
3. Copia el token `zigzag_…` — **solo se muestra una vez**.

## Tools v1

Todas las tools (excepto `list_companies`) requieren `company_id` en la allow-list.

| Tool | Scope | Descripción |
|---|---|---|
| `list_companies` | read | Compañías allow-listed visibles para el usuario |
| `list_tickets` | read | Lista tickets (`company_id`, `limit?`, `finished?`) |
| `get_ticket` | read | Detalle de ticket |
| `create_ticket` | write | Crea ticket (shell; sin pagos) |
| `update_ticket_status` | write | Marca `finished` true/false |
| `list_clients` | read | Clientes (id, nombre, email, documento — sin teléfono/dirección) |

### Flujo típico del agente

1. `list_companies` → elige `company_id`.
2. `list_tickets` / `list_clients` con ese `company_id`.
3. Escrituras solo con scope `write`.

## Endpoints OAuth

| Endpoint | Método |
|---|---|
| `/.well-known/oauth-protected-resource` | GET |
| `/.well-known/oauth-authorization-server` | GET |
| `/api/oauth/register` | POST |
| `/api/oauth/authorize` | GET |
| `/api/oauth/token` | POST |
| `/api/oauth/revoke` | POST |
| `/oauth/consent` | GET (UI) |

## Fuera de alcance

- Pagos de tickets / movimiento de dinero.
- Plugins Directory de ChatGPT.
- Tools de finanzas (MiCasa).

## Límites

- **120 tool calls/min** por llave o grant OAuth (`mcp:tool`).
- **10 llaves/hora** por usuario al crear conexiones Bearer.

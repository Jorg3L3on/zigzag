# MCP connector (ZigZag tickets)

ZigZag expone un servidor [MCP](https://modelcontextprotocol.io) HTTP en `POST /api/mcp` para conectar agentes externos (ChatGPT Developer Mode, Cursor, Claude u otro cliente MCP con Streamable HTTP). Las tools operan sobre tickets y clientes — no sobre pagos ni finanzas.

## URL del conector

| Entorno | URL |
|---|---|
| Producción | `https://<tu-dominio>/api/mcp` |
| Local | `http://localhost:3069/api/mcp` |

`/mcp` es un alias de `/api/mcp` (mismo handler; algunos clientes, como ChatGPT, usan `origen + /mcp`). El endpoint responde `OPTIONS` con CORS abierto. Sin un token válido ninguna tool devuelve datos (401 + `WWW-Authenticate` RFC 9728).

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

- **Protected Resource Metadata:** `GET /.well-known/oauth-protected-resource` (también `…/api/mcp` y `…/mcp`).
- **Authorization Server Metadata:** `GET /.well-known/oauth-authorization-server`.
- **DCR:** `POST /api/oauth/register` (máximo 10 registros por hora por IP; después `429 too_many_requests`). Los `redirect_uris` deben ser `https://` (o `http://` solo en `127.0.0.1`, `localhost` o `[::1]`): otro esquema responde `invalid_redirect_uri`. Un `client_name` que se haga pasar por ChatGPT, OpenAI, Grok, xAI, Claude, Anthropic o Cursor responde `invalid_client_metadata`. Los clientes DCR que nunca obtuvieron un token se borran a los 7 días.
- **Consentimiento:** la pantalla muestra el host al que regresa el código, la insignia **Verificado** solo para clientes CIMD de un host de confianza (ChatGPT) y **Cliente no verificado** para el resto. La escritura es opt-in: la casilla empieza sin marcar y el servidor solo concede `write` cuando recibe `allow_write=true`.
- **Token:** `POST /api/oauth/token` (máximo 60 llamadas por minuto por IP).
- **CIMD:** soportado cuando `client_id` es una URL HTTPS con metadata JSON.
- **Flujo:** authorization code + PKCE (`S256`) + parámetro `resource` (RFC 8707).
- **Access token:** prefijo `zigzag_oauth_…`, dura 24 h; ChatGPT, Claude y Grok renuevan con el refresh token al recibir 401.
- **Refresh token:** rota en cada uso y vale 90 días desde su emisión, nunca más allá de un año desde el consentimiento. Reusar un refresh token ya rotado revoca la conexión (`invalid_grant`). Un código de autorización es de un solo uso: presentarlo otra vez revoca lo que ya emitió.
- **Revocación:** cambiar la contraseña, que un admin la restablezca o desactivar al usuario revoca todas sus llaves y conexiones OAuth. Las llaves vencen a los 365 días como máximo.
- **CIMD y JWKS:** solo `https://` a nombres públicos (sin IPs, `localhost`, `.local` ni `.internal`), máximo 64 KiB, una redirección al mismo host; el documento CIMD se vuelve a pedir pasadas 24 h. Un `jti` de `private_key_jwt` sirve una sola vez y la aserción no puede durar más de 10 minutos.
- **Retención:** los intentos al token endpoint (solo POST) se guardan 30 días.
- **Token vencido a mitad de sesión:** si una tool falla con 401, el resultado de error lleva `_meta['mcp/www_authenticate']` con el challenge `Bearer error="invalid_token", …, resource_metadata="…"` para que el cliente vuelva a pedir autorización.
- **Expiry:** columnas `timestamptz` (instante UTC); no usar `timestamp` naive.

### Bearer token (manual)

1. Inicia sesión → **Conexiones** (`/settings/connections`).
2. Elige compañías, scopes y crea la llave.
3. Copia el token `zigzag_…` — **solo se muestra una vez**.

## Tools

Todas las tools (excepto `whoami` y `list_companies`) requieren `company_id` en la allow-list.

| Tool | Scope | Descripción |
|---|---|---|
| `whoami` | read | Usuario, origen de auth (`api_key`/`oauth_grant`), etiqueta de la conexión, scopes y compañías |
| `list_companies` | read | Compañías allow-listed visibles para el usuario |
| `list_tickets` | read | Lista tickets (`company_id`, `limit?`, `finished?`) |
| `get_ticket` | read | Detalle de ticket |
| `create_ticket` | write | **Obsoleto** (una versión más): crea un ticket sin líneas. Usa `create_document` |
| `update_ticket_status` | write | Marca `finished` true/false |
| `create_document` | write | Ticket o presupuesto con líneas y materiales, con las reglas del compositor (folio siguiente, total del servidor, límites ZIG-I12). `client`: `{ client_id }` o `{ name, phone, email? }` (reusa el cliente con ese teléfono). `payment?` solo tickets (`pendiente`, `pagado`, `{ parcial }`): lo termina como el paso Listo. `idempotency_key?`: un reintento con la misma clave en 24 h por conexión devuelve el primer documento (`replayed: true`) |
| `update_document` | write | Cliente, fecha, líneas (reemplazo completo), notas o `finished`. Rechaza con `validation` un documento pagado por completo o un presupuesto convertido/cancelado; el folio no cambia |
| `convert_presupuesto` | write | Presupuesto vigente → ticket nuevo con folio R y las mismas líneas; devuelve el ticket con `source_presupuesto_folio` |
| `create_client` / `update_client` | write | Nombre, teléfono (7–20 dígitos, único por compañía: el error trae el `client_id` existente), email, documento, dirección estructurada y notas (`clients.write`) |
| `list_clients` | read | Clientes (id, nombre, email, documento — sin teléfono/dirección); `query?`, `limit?`, `cursor?` |
| `get_client` | read | Expediente: teléfono, email, dirección estructurada, notas, saldo y últimos 10 documentos (requiere también `tickets.read`) |
| `list_services` | read | Servicios con sus materiales por defecto (`services.read`); `query?`, `limit?`, `cursor?` |
| `list_materials` | read | Materiales con unidad y precio (`services.read`); `query?`, `limit?`, `cursor?` |

### Flujo típico del agente

1. `whoami` → confirma la cuenta y sus compañías; `list_companies` → elige `company_id`.
2. `list_tickets` / `list_clients` con ese `company_id`. `list_clients`, `list_services` y `list_materials` paginan con `next_cursor`: pásalo como `cursor` para la siguiente página.
3. Escrituras solo con scope `write` (opt-in en el consentimiento). Cada escritura queda en Auditoría y en el historial del documento como `Agente MCP: <tool> · <conexión>`.

### Contrato de resultados (v2)

- Cada tool declara `outputSchema` y anotaciones completas (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint: false`).
- Éxito: `structuredContent` con el JSON y el mismo JSON como bloque de texto. Ids BigInt como string, fechas ISO 8601, montos como número.
- Error: `isError: true` y `structuredContent.error = { code, message }` con `code` en `unauthorized`, `forbidden`, `not_found`, `validation`, `rate_limited`, `internal`. Los errores internos no exponen el mensaje original.

## Prompts y recursos

Para clientes que muestran prompts y recursos MCP (Claude, Cursor). Los prompts solo generan texto; cada lectura o escritura pasa por las tools, que validan la allow-list y los permisos.

| Prompt | Argumentos | Qué hace |
|--------|------------|----------|
| `cobranza_de_hoy` | `company_id` | Usa `get_company_summary` y redacta un recordatorio de WhatsApp por documento pendiente (no envía nada) |
| `ticket_desde_mensaje` | `company_id`, `mensaje` | Extrae cliente, líneas y fecha de un mensaje de WhatsApp y propone una llamada a `create_document` para confirmar |
| `resumen_cliente` | `company_id`, `client_id` | Resume contacto, saldo, documentos recientes y la siguiente acción con `get_client` |

| Recurso | Permiso | Contenido |
|---------|---------|-----------|
| `zigzag://company/<id>/profile` | `tickets.read` | Nombre, contacto, dirección, datos de transferencia y prefijos de folio |
| `zigzag://company/<id>/catalog` | `services.read` | Servicios con sus materiales por defecto (hasta 500; `truncated` si hay más) |

`resources/list` solo muestra compañías de la allow-list a las que el usuario tiene acceso y cuyo permiso tiene. Una compañía fuera de la allow-list o sin permiso responde como recurso no encontrado, con el mismo mensaje que las tools.

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

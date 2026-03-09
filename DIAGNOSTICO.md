# Diagnóstico del Proyecto: Tickets 2.0

> Análisis estático completo — Febrero 2026

---

## 🔴 PRIORIDAD 1 — CRÍTICO (riesgo de seguridad o bug en producción)

### 1. Bug de runtime: campo `sub_total` inexistente
- **Archivo:** `src/actions/tickets.ts:146`
- Se intenta escribir `sub_total: service.price * service.quantity` al crear un ticket con servicios
- El campo **no existe** en el modelo `ServicesTickets` del schema de Prisma
- **Impacto:** cualquier creación/actualización de ticket con servicios falla en runtime

### 2. API routes sin autenticación
Varios endpoints son accesibles sin ningún token o sesión:

| Endpoint | Archivo |
|----------|---------|
| `GET /api/services` | `src/app/api/services/route.ts` |
| `GET/PUT/DELETE /api/services/[id]` | `src/app/api/services/[id]/route.ts` |
| `POST /api/tickets/[id]/services` | `src/app/api/tickets/[id]/services/route.ts` |
| `PUT/DELETE /api/tickets/[id]/services/[serviceId]` | `src/app/api/tickets/[id]/services/[serviceId]/route.ts` |
| `GET /api/users` | `src/app/api/users/route.ts` (expone lista de usuarios) |

### 3. Endpoint de upload completamente desprotegido
- **Archivo:** `src/app/api/upload/route.ts`
- Sin autenticación
- Sin validación de tipo de archivo (acepta cualquier cosa, incluyendo ejecutables)
- Sin límite de tamaño (riesgo de DoS por disco lleno)
- Usa el nombre original del archivo → **path traversal** posible (`../../etc/passwd`)
- Archivos guardados en directorio `public/` → accesibles públicamente sin restricción

### 4. Sistema de permisos no implementado (TODO hardcodeado)
- **Archivo:** `src/lib/security.ts:72`
- `checkPermission()` siempre retorna `true` sin verificar nada
- Los roles y permisos existen en la base de datos pero **nunca se aplican** en ninguna operación
- Cualquier usuario autenticado puede hacer cualquier operación independientemente de su rol

### 5. Server actions sin verificación de autorización
Todos los archivos en `src/actions/` ejecutan operaciones de BD sin comprobar identidad ni permisos:
- `src/actions/tickets.ts` — acepta `companyId` del cliente sin verificar que le pertenezca
- `src/actions/users.ts`, `clients.ts`, `companies.ts`, `roles.ts`, `permissions.ts` — ídem

### 6. NEXTAUTH_SECRET es un placeholder
- **Archivo:** `.env` — valor actual: `your-secret-key-here`
- Si se despliega con este valor, los JWTs pueden ser **falsificados por cualquier persona**

---

## 🟠 PRIORIDAD 2 — ALTO (deuda técnica con impacto real)

### 7. 0% de cobertura de tests
- Jest y Playwright están configurados pero **sin ningún test escrito**
- **127 archivos fuente, 0 archivos `.test.ts`**
- Las funciones más críticas (auth, permisos, CRUD) nunca han sido testadas

### 8. Inconsistencia: hard delete vs soft delete
Modelos mezclados sin criterio definido:

| Modelo | Tipo | Archivo |
|--------|------|---------|
| User, Company, Ticket | Soft delete (`deleted_at`) | ✓ |
| Role | **Hard delete** | `src/actions/roles.ts:107` |
| Client | **Hard delete** | `src/actions/clients.ts:114` |
| Service | **Hard delete** | `src/actions/services.ts:90` |

Además, `src/app/api/clients/[clientId]/route.ts` usa soft delete para el mismo modelo que `src/actions/clients.ts` elimina con hard delete.

### 9. Duplicación de lógica: server actions + API routes para lo mismo
Las mismas operaciones CRUD están implementadas en dos capas sin criterio claro:
- `src/actions/clients.ts` + `src/app/api/clients/`
- `src/actions/users.ts` + `src/app/api/users/`
- `src/actions/services.ts` + `src/app/api/services/`

Esto duplica la lógica y genera divergencias (distintas validaciones en cada capa).

### 10. Formatos de respuesta inconsistentes en server actions
Cada archivo retorna una forma diferente sin un tipo compartido:

```
users.ts     → { user } o { error }
clients.ts   → { success: boolean, data?, error? }
roles.ts     → lanza excepciones en lugar de retornar
tickets.ts   → { success: boolean, data?, error? }
```

### 11. Código de debug en producción (49 console.logs)
- `src/lib/auth.ts` — loguea tokens y datos de sesión completos (líneas 52–91)
- `src/actions/dashboard.ts` — 7 logs con `safeStringify`
- Todos los action files tienen `console.error()` expuesto
- Riesgo de fuga de información sensible en logs de producción

---

## 🟡 PRIORIDAD 3 — MEDIO (mantenibilidad)

### 12. Código muerto: utilidades definidas pero nunca usadas
- `sanitizeInput()` — `src/lib/security.ts:6` — nunca se llama
- `RateLimiter` class — `src/lib/security.ts:15` — nunca se instancia
- `commonSchemas` — `src/lib/security.ts:101` — nunca se importa
- `sanitizeSQLInput()` — `src/lib/security.ts:120` — innecesario con Prisma ORM
- Utilidades de `src/lib/cache.ts` — definidas pero ningún action file las usa

### 13. IDs mezclados: BigInt vs Int
- `Ticket.id` y `User.id` usan `BigInt`
- `Client.id`, `Service.id`, `Role.id`, `Permission.id` usan `Int`
- Obliga a escribir código de conversión manual en toda la app (`src/lib/utils.ts`, `src/app/api/users/route.ts`)

### 14. Sin archivo `.env.example`
- No hay plantilla de variables de entorno
- Un nuevo desarrollador no sabe qué configurar sin leer el README

### 15. CSRF token con `Math.random()`
- **Archivo:** `src/lib/security.ts:112`
- Usa `Math.random()` en lugar de `crypto.randomBytes()` — no es criptográficamente seguro
- La función existe pero no se usa en ningún formulario

---

## 🟢 PRIORIDAD 4 — BAJO (monitorear)

### 16. next-auth en versión beta
- **package.json:** `next-auth: ^5.0.0-beta.28`
- Es la versión recomendada para Next.js App Router, pero sigue en beta
- Riesgo de breaking changes en actualizaciones menores

### 17. `radix-ui: "latest"` como versión
- **package.json:** versión `"latest"` en lugar de un número fijo
- Puede auto-actualizar a versiones incompatibles sin control

### 18. Dependencias generalmente actualizadas
- Next.js 15, React 19, Prisma 6, Zod 3, TypeScript 5.8 — al día
- No hay dependencias con CVEs conocidas evidentes

---

## Resumen ejecutivo

```
🔴 CRÍTICO  (hacer ahora)        → #1–6   → bugs activos + vectores de ataque abiertos
🟠 ALTO     (próximo sprint)     → #7–11  → sin tests + inconsistencias sistémicas
🟡 MEDIO    (backlog priorizado) → #12–15 → código muerto + deuda técnica
🟢 BAJO     (revisar al año)     → #16–18 → riesgo menor, monitorear
```

### Los 3 problemas más urgentes a resolver primero

1. **Proteger `/api/upload`** — cualquiera puede subir archivos maliciosos al servidor
2. **Corregir `sub_total` en `tickets.ts:146`** — bug que rompe la funcionalidad principal
3. **Configurar `NEXTAUTH_SECRET`** con un valor seguro antes de cualquier despliegue

---

## Archivos críticos afectados

| Archivo | Problema |
|---------|----------|
| `src/app/api/upload/route.ts` | Sin auth, sin validación, path traversal |
| `src/app/api/services/[id]/route.ts` | Sin auth en GET/PUT/DELETE |
| `src/app/api/users/route.ts` | Sin auth en GET |
| `src/actions/tickets.ts:146` | Campo `sub_total` inexistente en schema |
| `src/lib/security.ts:72` | `checkPermission()` siempre retorna `true` |
| `src/lib/auth.ts:52-91` | Logs de datos sensibles (tokens, sesiones) |
| `prisma/schema.prisma` | IDs mixtos BigInt/Int, `company_id` nullable en todos los modelos |
| `.env` | `NEXTAUTH_SECRET` es placeholder |

# Observability

Structured logging, request correlation, and Sentry error reporting for ZigZag.

## Request correlation (`x-request-id`)

Every request that passes through `src/proxy.ts` (app pages **and** `/api/*`) receives an `x-request-id` header:

1. If the client (or upstream proxy) already sent a valid `x-request-id` (8–128 chars of `[A-Za-z0-9_.:-]`), that value is kept.
2. Otherwise the edge generates a UUID via `correlationId()`.
3. The same id is written on the **request** (for Server Actions / route handlers) and the **response**.

### Binding inside Node handlers

Edge middleware cannot share `AsyncLocalStorage` with Node route handlers, so auth entry points re-bind the id from headers:

| Entry point | Where |
| --- | --- |
| Server Actions | `requireActionAuth()` → `bindRequestContextFromHeaders()` |
| Authenticated API | `requireSession()` → `bindRequestContextFromHeaders()` |
| Health / cron | `bindRequestIdFromRequest(request)` at handler start |

Once bound, `logger.*` and `captureException` automatically include `requestId`.

### Smoke-test tip

`GET /api/health` returns the id in JSON:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "ok",
    "blob": "configured",
    "requestId": "…",
    "timestamp": "…"
  }
}
```

The response also echoes the `x-request-id` header. Use either value when grepping Vercel logs.

## Log format

Logs are single-line JSON on stdout/stderr:

```json
{
  "level": "info",
  "message": "hello",
  "time": "2026-07-24T12:00:00.000Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Description |
| --- | --- |
| `level` | `debug` \| `info` \| `warn` \| `error` |
| `message` | Human-readable event summary |
| `time` | ISO-8601 timestamp |
| `requestId` | Correlation id when a request context is active |
| *(other)* | Caller-supplied meta (`route`, `span`, `durationMs`, serialized `error`, …) |

Errors serialize as `{ name, message, stack }`.

## Sentry

- Initialized once from `src/instrumentation.ts` via `initObservability()`.
- Disabled when neither `SENTRY_DSN` nor `NEXT_PUBLIC_SENTRY_DSN` is set.
- `captureException(error, meta)` always logs structurally and, when Sentry is enabled, sets tag/context `requestId` plus `extra` from meta.

## Key modules

| Module | Role |
| --- | --- |
| `src/lib/request-context.ts` | Id generation, ALS bind/get, header helpers |
| `src/lib/logger.ts` | JSON logger (auto-attaches `requestId`) |
| `src/lib/observability.ts` | Sentry init, `captureException`, `withSpan` |
| `src/proxy.ts` | Edge propagation of `x-request-id` |

# Mobile release checklist

Use this list before promoting a mobile-related change to production. Run automated checks first, then spot-check on real devices when the diff touches layout, PWA metadata, or PDF download.

## Automated (required)

```bash
npm run lint
npm test -- --runInBand
npm run test:e2e          # chromium + mobile-chrome projects
npm run test:e2e:mobile   # Pixel 5 only (includes mobile-core-flow)
npm run build
```

Set `E2E_EMAIL` and `E2E_PASSWORD` for authenticated Playwright cases. Optional: `E2E_SYSTEM_EMAIL` / `E2E_SYSTEM_PASSWORD` for system-operator nav tests.

Core business flows on mobile (create ticket → add service / total → collect payment → PDF) are covered by `e2e/mobile-core-flow.spec.ts` on the `mobile-chrome` project.

## Manual — iOS Safari

- [ ] Login with a tenant user; session persists after reload.
- [ ] Open **Tickets** — card layout (not broken horizontal scroll).
- [ ] Start **Nuevo ticket** — form controls readable; numeric keyboard on phone fields.
- [ ] Open an existing ticket detail — actions reachable; no overlap with safe area.
- [ ] Download ticket PDF on a finished ticket (Wi‑Fi); failure shows toast `PDF001`.
- [ ] Toggle airplane mode — offline banner appears; shell may load from cache on cold start after prior online visit; no offline data sync.
- [ ] **Share → Add to Home Screen** — icon installs; cold start opens **Dashboard** (`/dashboard`).
- [ ] Installed app cold start shows a white splash/theme background and readable default iOS status bar.
- [ ] Bottom tabs visible: **Hoy · Anotar · Clientes · Más**; Más opens navigation sheet.

## Manual — Android Chrome

- [ ] Login and open sidebar sheet from the menu button; navigation links work.
- [ ] When not installed, **Instalar ZigZag** banner may appear; dismiss hides it for 30 days (Más › Cuenta still offers it); after install banner does not return in standalone mode.
- [ ] Bottom tabs (**Hoy · Anotar · Clientes · Más**) visible on list pages; Más opens the sidebar sheet; Anotar opens ticket create.
- [ ] Ticket create sticky save bar hides bottom tabs.
- [ ] Tickets list cards and filters usable with touch targets.
- [ ] Create-ticket flow: client step and services step scroll without layout break.
- [ ] PDF download on finished ticket.
- [ ] Airplane mode — offline banner; shell may load from cache after prior online visit; still no offline data sync.
- [ ] **Install app** / **Add to home screen** — cold start opens Dashboard.

## Manual — Android: instalación, avisos y badge (ZIG-I21)

80 % de los usuarios usa Android. Corre esta lista en **al menos dos teléfonos de marcas distintas** (Pixel, Samsung, Xiaomi…) contra un deploy con `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, y registra cada corrida en Plania (`add_result` en ZIG-I21-5 con `device` y la versión de Chrome).

**Instalar**

- [ ] En Chrome (sin instalar) abre **Más › Cuenta**: aparece **Instalar ZigZag** con el motivo; un toque abre el diálogo de Chrome con las capturas (ficha ampliada) y la app queda en la pantalla de inicio.
- [ ] Si antes cerraste el banner de instalación, la tarjeta de Cuenta sigue ofreciendo instalar.
- [ ] Ya instalada, la tarjeta no aparece (ni en la app ni en Chrome si Chrome ya no la ofrece).
- [ ] La app abre en **Inicio** (`/dashboard`) a pantalla completa, sin barra del navegador.

**Avisos** (abre la app instalada › Más › Cuenta › **Activar avisos aquí**)

- [ ] Con la app **cerrada** llega un aviso de mantenimiento: la barra de estado muestra la **silueta blanca del recibo**, no un cuadro gris.
- [ ] Un **atrasado** vibra; un **próximo**, el resumen diario y la exportación llegan sin vibrar.
- [ ] Al expandir el aviso de mantenimiento salen **Crear ticket** y **Ver**: Crear ticket abre el ticket nuevo con cliente y servicio; Ver abre Mantenimientos en el filtro correcto.
- [ ] Exportación lista: **Descargar** abre el archivo; tocar el aviso abre Mi empresa.
- [ ] Tocar el aviso o Crear ticket / Ver lo deja **leído** en la campana.
- [ ] El ícono de ZigZag en la pantalla de inicio muestra el **número de no leídos** (punto o número según el launcher); baja al marcar leídos y desaparece con **Marcar todo**.
- [ ] **Apagar avisos aquí** deja de recibirlos; **Cerrar sesión** borra la suscripción del teléfono (no llegan más avisos a ese teléfono).

**Ahorro de batería (Xiaomi, Huawei, Samsung)**

Los avisos de una PWA llegan por Chrome; si el sistema duerme a Chrome, llegan tarde o al abrir la app. Si un aviso tarda, pide al usuario permitir a **Chrome**:

- Xiaomi / Redmi / POCO (MIUI, HyperOS): Ajustes › Apps › Administrar apps › Chrome › **Ahorro de batería: Sin restricciones** y **Inicio automático** activado.
- Huawei / Honor (EMUI): Ajustes › Batería › Inicio de aplicaciones › Chrome › **Administrar manualmente** con las tres opciones activadas.
- Samsung (One UI): Ajustes › Batería › Límites de uso en segundo plano › quitar Chrome de **Aplicaciones en suspensión** / **en suspensión profunda**.

**Lighthouse / instalable**

- [ ] `npm run lighthouse:mobile` sobre `/dashboard`: rendimiento ≥ 84 (línea base de ZIG-I20-5).
- [ ] Chrome DevTools › Application › Manifest: sin errores de instalabilidad, iconos y capturas cargan. (Lighthouse 12 quitó la categoría PWA; esta pestaña la reemplaza.)

| Fecha | Teléfono | Android | Chrome | Resultado / notas |
| --- | --- | --- | --- | --- |
| | | | | |

## Regression notes

- PWA service worker caches **app shell only**; **network required for Ticket/Company data** (see README Mobile & PWA).
- Ticket PDFs are **server-generated** (`GET /api/tickets/[id]/invoice`); do not re-enable client-only canvas PDF in production UI.
- Dashboard lists use **TanStack table on desktop** and **cards below 768px** — see `.cursor/rules/lists-and-responsive-tables.mdc`.

## Related docs

- [tasks/INDEX.md](./INDEX.md) — mobile PRD status
- [tasks/mobile-lighthouse-baseline.md](./mobile-lighthouse-baseline.md) — performance baseline procedure
- [README.md](../README.md) — Mobile & PWA install (ES + EN)

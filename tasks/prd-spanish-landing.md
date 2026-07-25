# PRD: Spanish public landing page (marketing + legal)

**Status:** Parent PRD — [GitHub #247](https://github.com/Jorg3L3on/zigzag/issues/247) (`ready-for-agent`)  
**Source:** grill-me planning conversation (Jul 2026); product narrative from `public/guides/resumen-ejecutivo.html`

## Problem Statement

Prospective buyers who visit ZigZag’s root URL never see what the product does. Today `/` is auth-gated: unauthenticated visitors are redirected to `/login`, and authenticated visitors are sent straight into the app. The site is globally noindex, there is no public Spanish marketing page, and there are no linked Aviso de privacidad or Términos y condiciones. ZigZag already has strong Spanish product narrative and screenshots in the static operator guides, but nothing buyer-facing that explains tickets → services → cobranza → factura PDF for dueños and gerentes of service businesses (HVAC, mantenimiento, instalaciones) in LATAM.

## Solution

Ship a public Spanish marketing landing at `/` that explains ZigZag with product screenshots, a clear problem → how-it-works → capabilities story, interim CTAs to sign in or scroll the product story, and separate legal pages. Guests can browse without an account; signed-in users keep going to the app. Search engines may index only the landing and legal pages. Demo-request intake and master-company lead CRUD are deferred to a later PRD.

## User Stories

1. As a prospective buyer, I want to open `/` without logging in, so that I can evaluate ZigZag before creating an account.
2. As a prospective buyer, I want the landing to be in Spanish, so that it matches how the product is presented to LATAM service businesses.
3. As a prospective buyer, I want ZigZag’s brand to dominate the first viewport, so that I immediately know which product I’m looking at.
4. As a prospective buyer, I want one clear headline and one short supporting sentence in the hero, so that I understand the value proposition in seconds.
5. As a prospective buyer, I want a dominant product visual (dashboard/tickets) in the hero, so that I see the real product rather than abstract marketing art.
6. As a prospective buyer, I want a primary CTA “Iniciar sesión” that goes to `/login`, so that existing tenants and evaluators can enter the app.
7. As a prospective buyer, I want a secondary CTA “Ver cómo funciona” that scrolls to the product explanation, so that I can learn without leaving the page.
8. As a prospective buyer, I want a nav with logo, section anchors, login, and the secondary CTA pattern, so that I can jump around the page.
9. As a prospective buyer, I want a “Problema” section about fragmented tools (spreadsheets, WhatsApp, manual invoices), so that I recognize my own operational pain.
10. As a prospective buyer, I want a “Cómo funciona” section showing Cliente → Ticket → Servicios → Cobro → Factura PDF, so that the core workflow is obvious.
11. As a prospective buyer, I want each how-it-works step illustrated with real product screenshots, so that the flow feels concrete.
12. As a prospective buyer, I want a capabilities section covering multi-Company isolation, server-generated PDF invoices, RBAC, audit, service reminders, and installable PWA, so that I understand differentiation.
13. As a prospective buyer, I want honest demo/social proof referencing ClimaTotal Demo evaluation data (not invented customer logos), so that trust is not undermined by fake testimonials.
14. As a prospective buyer, I want a final CTA band repeating login / learn actions, so that conversion is available after reading.
15. As a prospective buyer, I want a footer with Aviso de privacidad and Términos y condiciones, so that I can review legal basics before engaging.
16. As a prospective buyer, I want a soft footer link to the existing product guides, so that deeper documentation remains discoverable.
17. As a prospective buyer, I want `/aviso-de-privacidad` as a readable Spanish page, so that I understand how personal data is handled.
18. As a prospective buyer, I want `/terminos-y-condiciones` as a readable Spanish page, so that I understand acceptable use and service terms.
19. As a product owner, I want legal pages to use structured Spanish templates with clear placeholders for responsable, domicilio, email de privacidad, and vigencia, so that real entity details can be filled without a redesign.
20. As a product owner, I want legal copy framed as not a substitute for counsel review, so that shipping templates does not imply certified compliance.
21. As a signed-in Company user visiting `/`, I want to be redirected to `/dashboard`, so that daily operators are not dumped on marketing.
22. As a signed-in System company user visiting `/`, I want to be redirected to `/operator-console`, so that platform operators land in their primary console.
23. As a signed-in user, I want legal pages to remain reachable without being kicked into the app shell redirect loop, so that policies stay readable while authenticated.
24. As a guest, I want app routes (dashboard, tickets, clients, etc.) to remain protected, so that tenant data stays behind auth.
25. As a search engine crawler, I want `/`, `/aviso-de-privacidad`, and `/terminos-y-condiciones` to be indexable, so that buyers can discover ZigZag.
26. As a search engine crawler, I want app routes to remain noindex / disallowed, so that private SaaS surfaces are not marketed in SERPs.
27. As a search engine crawler, I want a sitemap limited to the three marketing/legal URLs, so that discovery stays intentional.
28. As a prospective buyer sharing the landing, I want Spanish Open Graph / metadata (title, description), so that previews look intentional.
29. As a mobile visitor, I want the landing to work well on narrow viewports, so that phone evaluation is first-class.
30. As a visitor with `prefers-reduced-motion`, I want decorative motion reduced or disabled, so that the page remains comfortable and accessible.
31. As a prospective buyer on a slow network, I want below-fold images lazy-loaded and hero media optimized, so that first paint stays usable.
32. As a designer/implementer, I want the landing to use operational blue consistent with the existing product primary, so that brand continuity with login/PWA holds.
33. As a designer/implementer, I want a light atmospheric landing (not flat white, not dark-first, not purple gradient cliché), so that the page feels premium without fighting the app chrome.
34. As a designer/implementer, I want the landing to use its own layout without the dashboard sidebar shell, so that marketing is not trapped in app chrome.
35. As a content author, I want buyer-facing copy adapted from the executive summary tone (shorter, benefit-led), so that the page sells without reading like an investor memo.
36. As a content author, I want screenshots reused from existing empresa guide WebP assets, so that we ship without inventing new UI captures.
37. As a product owner, I want GIF/MP4 product loops to be optional slots only if assets are provided later, so that v1 is not blocked on video production.
38. As a QA engineer, I want proxy/unit coverage proving guests can hit `/` and legal routes without login redirect, so that marketing does not regress to the old gate.
39. As a QA engineer, I want tests proving unauthenticated protected app routes still redirect to `/login`, so that opening the landing does not weaken auth.
40. As a QA engineer, I want robots/sitemap tests asserting only marketing/legal URLs are public to indexers, so that SEO policy stays enforceable.
41. As a QA engineer, I want landing/legal render tests for key sections, CTAs, and footer links, so that the marketing skeleton cannot silently empty out.
42. As an accessibility user, I want semantic headings, keyboard-reachable nav/CTAs, and meaningful image alt text, so that the landing is usable with assistive tech.
43. As a System company operator, I want no demo-request inbox in this PRD, so that lead CRM work stays deferred and scoped later.
44. As a prospective buyer, I want no broken “Solicitar demo” or contact-sales form in v1, so that CTAs always do something real.
45. As a maintainer, I want e2e expectations updated if any test assumed `/` always redirects guests to login, so that CI matches the new public root.
46. As a maintainer, I want domain vocabulary (Company, Ticket, Client, Service, System company, soft delete where relevant) used consistently in issues/PRs for this work, so that slices stay aligned with ZigZag architecture.
47. As a future implementer of demo intake, I want this PRD to explicitly defer DemoRequest persistence and master-only CRUD, so that later work can attach cleanly without rewriting the landing IA.
48. As a PWA user, I want `start_url` to remain `/dashboard`, so that installed app launches still open the product, not marketing.
49. As a bilingual stakeholder, I want no English locale toggle in v1, so that Spanish positioning stays focused.
50. As a sales/eval visitor, I want the how-it-works story to match real product capabilities already shipped (multi-tenant Company isolation, server PDF invoices, RBAC, audit, reminders, PWA), so that demos do not overpromise.

## Implementation Decisions

### Audience and conversion (v1)
- Primary audience: dueños / gerentes of service businesses in México/LATAM.
- Interim primary CTA: Iniciar sesión → `/login`.
- Interim secondary CTA: Ver cómo funciona → in-page scroll to how-it-works.
- No Solicitar demo form, no email provider integration, no DemoRequest schema, no System company lead CRUD in this PRD.

### Public route gate
- Guests may access `/`, `/aviso-de-privacidad`, `/terminos-y-condiciones`.
- Logged-in users hitting `/` redirect to `/dashboard`, or `/operator-console` when `company_is_system` is true (same destination rules as login success).
- Protected app prefixes remain auth-gated as today.
- Static `/guides/` remains publicly reachable as today; landing may soft-link to it.

### Marketing landing surface
- Replace root redirect-to-dashboard with a dedicated Spanish landing composition.
- Sections in order: Nav → Hero → Problema → Cómo funciona → Capacidades → Demo/social (ClimaTotal honest) → Final CTA → Footer.
- Own marketing layout: no Tripled/dashboard sidebar shell.
- Buyer rewrite of product story adapted from existing executive summary; reuse `empresa` guide screenshots.
- Visual direction: operational blue primary continuity, light atmospheric background, product-UI hero, Geist typography, 2–3 intentional motions, respect `prefers-reduced-motion`.
- Hero budget: brand, one headline, one supporting sentence, CTA group, one dominant product visual — no card soup, no fake overlay badges.

### Legal content pages
- Dedicated routes for Aviso de privacidad and Términos y condiciones.
- Spanish templates structured for SaaS + LFPDPPP-style topics (responsable, datos, finalidades, derechos ARCO, session cookies, retención, contacto) and SaaS terms (cuenta, multi-tenant use, acceptable use, limitation of liability).
- Placeholders for responsable, domicilio, email de privacidad, vigencia — fillable later without IA changes.
- Footer links from landing; pages readable logged-out and logged-in.

### Marketing SEO policy
- Allow indexing for landing + legal only.
- Keep app surfaces noindex / disallowed.
- Provide sitemap entries for exactly those three URLs.
- Spanish title/description/OG for the landing.
- Do not broaden indexing to guides in this PRD unless explicitly expanded later.
- PWA `start_url` stays `/dashboard`.

### Deep modules (testable boundaries)
1. **Public route gate** — pathname classification + session cookie presence → next | redirect-to-login | redirect-logged-in-home. Encapsulate “is public marketing path” vs “is protected app path” so proxy behavior is unit-tested without rendering React.
2. **Marketing landing surface** — presentational composition + section content model (anchors, CTA hrefs, screenshot refs). Keep copy/structure data separable from chrome where practical.
3. **Legal content pages** — shared legal document layout + placeholder-aware content blocks for the two policies.
4. **Marketing SEO policy** — robots rules + sitemap URL list + landing metadata helpers derived from one allowlist of public marketing paths (avoid drifting lists).
5. **Landing motion / media presentation** — screenshot sourcing, lazy-loading defaults, reduced-motion behavior; GIF/MP4 remain optional future slots.

### Architecture constraints
- No new tenant-scoped business tables in this PRD.
- No duplicate mutation API routes; no Server Actions required for v1 CTAs (links + in-page scroll only).
- Do not weaken multi-tenant auth on app routes while opening marketing paths.
- Reuse existing public guide WebP assets; do not require uploaded marketing PDFs or user-generated media.

## Testing Decisions

Good tests assert external behavior (status codes, redirect targets, visible contracts, robots/sitemap outputs), not private CSS class names or animation implementation details.

### Must test
- **Public route gate:** guests can `GET` `/` and legal paths without redirect to `/login`; unauthenticated protected app routes still redirect to `/login`; correlation id behavior remains intact.
- **Marketing SEO policy:** robots/sitemap allowlist is only landing + legal; app disallow/noindex policy remains for non-marketing surfaces.

### Should test
- **Marketing landing surface:** key sections render; primary CTA targets `/login`; secondary CTA has a real in-page target; footer links to both legal routes and optional guides entry.
- **Legal content pages:** both routes render Spanish headings and expose placeholder fields or clearly marked placeholder content; linked from landing footer.

### Light / optional
- **Motion/media:** reduced-motion smoke only if inexpensive; no pixel snapshot requirement in v1.

### Prior art
- Proxy redirect coverage in existing proxy unit tests.
- E2E auth redirect assumptions that currently treat unauthenticated root as login-bound must be updated or split so marketing root and protected app routes are asserted separately.
- Metadata/manifest tests elsewhere in the app for pattern of asserting exported metadata route outputs.

## Out of Scope

- Solicitar demo / contact sales form
- Email/SMS providers for lead delivery
- `DemoRequest` (or equivalent) schema, migrations, and System company CRUD inbox
- Pricing tables, FAQ accordion, blog, case-study CMS
- English locale / i18n toggle for marketing
- Fake testimonials or fabricated customer logos
- Indexing `/guides/*` as a deliberate SEO program (soft link only)
- Dark-cinematic or unrelated rebrand of the authenticated app shell
- Changing PWA `start_url` away from `/dashboard`
- Self-serve signup / tenant provisioning from the landing
- Lawyer-certified final legal text (templates + placeholders only)

## Further Notes

- Agreed in planning interview (grill-me → lock): demo-led conversion is the long-term intent; v1 ships login + scroll only until lead intake is designed (DB + System company CRUD, no email service yet).
- Existing Spanish assets to leverage: executive summary narrative and `public/guides/images/empresa/*` screenshots.
- Suggested feature slug for later shipping: `spanish-landing` (`feat/spanish-landing`).
- Slice issues (`to-issues`, Jul 2026):
  - [#249](https://github.com/Jorg3L3on/zigzag/issues/249) Public marketing route gate + SEO allowlist
  - [#250](https://github.com/Jorg3L3on/zigzag/issues/250) Spanish landing composition (content, media, motion) — blocked by #249
  - [#251](https://github.com/Jorg3L3on/zigzag/issues/251) Aviso de privacidad and Términos y condiciones pages — blocked by #249
  - [#252](https://github.com/Jorg3L3on/zigzag/issues/252) E2E: public root vs protected app auth redirects — blocked by #249–#251

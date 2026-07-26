# PRD: Login page visual redesign

**Status:** Ready for agent  
**GitHub:** [#276](https://github.com/Jorg3L3on/zigzag/issues/276)  
**Prototype (canonical visual source of truth):** [`tasks/prototypes/zigzag-login-redesign.html`](./prototypes/zigzag-login-redesign.html)  
**Brand asset (locked):** existing product logo at `/logo.png` (gradient “Z”) — replace the mock’s inline SVG mark + keep the “zigzag” wordmark treatment

This PRD was revised after reading the uploaded HTML mock end-to-end. Implementation must pixel-check against that file, not against earlier guesses.

## Problem Statement

The public login page is functional but visually dated and crowded. Returning users see a plain centered card, while first-time visitors get a full always-visible “Guías de inicio” panel that competes with the form for attention. A stakeholder HTML mock redesigns login as a **physical Ticket**: zigzag die-cut edges, folio number, amber “stamp” submit, perforated tear-line, and a guide stub below. That mock still uses a placeholder SVG logo (not `/logo.png`) and shows guides fully expanded inside the ticket. Operators, investors, and system users still need Spanish copy, NextAuth credentials sign-in, theme toggle, and discoverable onboarding guides — without the guide stub dominating the first viewport.

## Solution

Rebuild `/login` to match the HTML prototype’s ticket composition and atmosphere:

1. Ambient night-ink / day-paper stage with blue + violet blobs and grain.
2. A single **zigzag die-cut Ticket** as the primary surface (serrated top/bottom via clip-path, soft drop shadow).
3. Upper **login stub**: brand row (real `/logo.png` + “zigzag” wordmark + decorative folio), welcome headline/subcopy, underline fields, amber stamp CTA.
4. **Perforation** divider (dashed line + punch holes).
5. Lower **guide stub** for public onboarding guides — present in the mock, but **collapsed by default** via a clever ticket tear-off / fold disclosure so the first viewport stays form-first while staying true to the perforated-stub metaphor.
6. Footnote “Powered by zigzag”.

Auth behavior, Spanish labels/errors, password visibility, and public guide link set remain unchanged.

## User Stories

1. As a returning Company operator, I want a clean, modern login screen that looks like a ZigZag Ticket, so that signing in feels on-brand and trustworthy.
2. As a first-time visitor, I want the ticket silhouette (zigzag die-cut edges) to be obvious immediately, so that I understand the product metaphor before I type.
3. As a visitor, I want the brand row to show the real `/logo.png` beside the “zigzag” wordmark, so that branding matches marketing, PWA icons, and invoices.
4. As a visitor, I want a decorative folio chip (e.g. `N.º 000001` style from the mock), so that the surface reads as a ticket stub — without implying a real tenant Ticket id.
5. As a visitor, I want the headline “Bienvenido a ZigZag” and supporting subcopy, so that the page purpose is clear.
6. As a visitor, I want email and password fields with monospace uppercase labels and underline inputs (gradient focus underline as in the mock), so that the form matches the prototype typography/interaction.
7. As a visitor, I want to show/hide my password, so that I can verify what I typed on mobile.
8. As a visitor, I want the primary CTA to look like an amber validation stamp (“Iniciar sesión”), so that submit matches the ticket metaphor.
9. As a visitor who submits valid credentials, I want a brief “VALIDADO” stamp affirmation (respecting reduced motion) before or while routing, so that the mock’s stamp interaction is preserved without blocking auth.
10. As a visitor with wrong credentials, I want a clear Spanish error with the existing error code pattern (e.g. AU001), so that I can retry or report the issue.
11. As a visitor during a network/auth failure, I want a graceful Spanish error (e.g. GN001), so that I am not left on a blank failure.
12. As a Company operator who signs in successfully, I want to land on `/dashboard`, so that I can start work immediately.
13. As a System company user who signs in successfully, I want to land on `/operator-console`, so that cross-tenant work starts in the right place.
14. As an already-authenticated user who opens `/login`, I want to be redirected to my default destination, so that I do not see a redundant form.
15. As a visitor who prefers dark mode, I want the default “night ink” palette from the mock (deep navy stage, dark ticket body), so that the redesign matches the prototype’s primary look.
16. As a visitor who prefers light mode, I want the “day paper” palette from the mock (warm paper stage + light ticket body), so that theme toggle is intentional in both modes.
17. As a visitor, I want a fixed theme toggle in the top-right (as in the mock), so that I can switch night/day without hunting.
18. As a first-time visitor, I want the guide stub **hidden/collapsed by default**, so that the login stub stays the hero of the first viewport.
19. As a first-time visitor, I want to reveal guides through a clever ticket interaction tied to the perforation (tear-off / unfold the lower stub), so that help stays inside the ticket metaphor instead of a generic detached help card.
20. As a first-time visitor who opens guides, I want the public guide set only (Resumen ejecutivo + Guía para empresas), so that audience scoping stays correct.
21. As an investor evaluating ZigZag, I want the executive summary row (title, audience line, description, arrow), so that I can open the investor guide.
22. As a Company operator evaluating ZigZag, I want the empresa guide row with the same structure, so that I can open the operator guide.
23. As a visitor using a keyboard, I want theme toggle, fields, stamp button, guide disclosure, and guide rows fully operable, so that the page works without a pointer.
24. As a visitor using a screen reader, I want the page announced as a login form (not as a real Ticket resource), so that the metaphor stays visual.
25. As a visitor who opens a guide, I want it to open in a new tab with `noopener,noreferrer`, so that existing guide-open behavior is preserved.
26. As a visitor with reduced motion preference, I want blob drift, stamp flip, and stub unfold animations reduced or disabled, so that motion is respectful.
27. As a visitor, I want at least two intentional motions (e.g. ambient blob drift + stamp / stub unfold), so that the page feels alive without noise.
28. As a visitor on a phone, I want the ticket to remain readable at ~360px (tighter section padding as in the mock’s 400px breakpoint), so that nothing clips or scrolls horizontally.
29. As a visitor on desktop, I want the stage centered at ~420px max width with strong ticket shadow, so that composition matches the prototype.
30. As a visitor, I want the ambient blue/violet blobs and grain overlay behind the ticket, so that the stage has atmosphere rather than a flat fill.
31. As a visitor, I want the “Powered by zigzag” footnote under the ticket, so that the mock’s closing mark is preserved.
32. As a QA engineer, I want E2E login helpers to keep working (email/password/submit still findable), so that the suite does not flake after the redesign.
33. As a QA engineer, I want the login axe accessibility gate to still pass for serious/critical issues, so that the redesign does not regress a11y.
34. As a product owner, I want shipped login to never show the mock’s prefilled demo email/password, so that production hygiene is preserved.
35. As an implementer, I want auth logic (NextAuth `signIn`, session routing) unchanged in behavior, so that the redesign is presentation-scoped.
36. As an implementer, I want guide link data to continue coming from `PUBLIC_ONBOARDING_GUIDE_LINKS`, so that login does not hardcode URLs.
37. As an implementer, I want a deep module for the perforated guide-stub disclosure, so that open/close behavior can be tested without mounting full auth.
38. As a maintainer, I want Spanish product copy preserved (labels, button, errors, guide titles/descriptions), so that the public surface stays consistent.
39. As a design reviewer, I want the shipped page to be recognizably the HTML mock (die-cut, perforation, stamp, folio, ambient), so that design review is straightforward.
40. As a design reviewer, I want the only intentional brand deviation from the mock to be swapping the SVG Z for `/logo.png`, so that product identity stays real.
41. As a visitor coming from the marketing landing, I want enough continuity (logo asset + blue/violet accents) that `/` → `/login` still feels like ZigZag, even if login’s paper/ink stage differs from marketing mist.
42. As a visitor, I want focus rings visible on interactive controls (theme, inputs, stamp, guide rows), so that keyboard focus is never lost.
43. As a visitor, I want touch targets on stamp and disclosure controls to remain comfortable on mobile, so that taps are reliable.
44. As an implementer, I want to reuse PasswordInput / ModeToggle patterns where they can be restyled to the mock, so that we do not fork auth accessibility behavior.
45. As a stakeholder, I want the guide stub’s expanded state to visually match the mock’s guide rows (gradient icon tile, title, audience gradient line, description, arrow), so that expanded help still looks designed.
46. As a design reviewer, I want collapsed default state to still show the perforation (or a clear tear affordance), so that users can discover the hidden stub.
47. As a support agent, I want login error codes unchanged, so that troubleshooting docs remain valid.
48. As a PWA user who cold-starts into login, I want the page usable for sign-in when online (no fake offline auth), so that expectations match the PWA offline policy.

## Implementation Decisions

### Visual source of truth (from the HTML — locked)

Implementers must open `tasks/prototypes/zigzag-login-redesign.html` and reproduce these concrete decisions from the mock:

1. **Stage:** Centered column `max-width: 420px`; body padding ~48×20; ambient fixed blobs (accent blue top-left, violet bottom-right, blurred, slow drift) + grain overlay.
2. **Theme tokens:** Dual themes as in the mock — dark “night ink” (`--page-bg: #0b0d14`, dark ticket greys, light ink) and light “day paper” (`--page-bg: #ece5d3`, paper ticket, dark ink). Accents: blue `#5b7cfa` / `#3454d1`, violet `#b565f3` / `#8b3fd1`, stamp amber `#f2b441` / `#dd8f22`.
3. **Ticket die-cut:** Single `.ticket` surface with zigzag serrated top and bottom via `clip-path` polygon (same geometry as the prototype), left/right hairline borders, vertical gradient fill, heavy drop-shadow wrapper.
4. **Brand row:** Left = logo + wordmark “zigzag”; right = folio chip `N.º 000001` (decorative only). **Logo lock:** use `/logo.png` (Image) sized ~30–36px in the brand row — do not ship the prototype’s inline SVG Z path.
5. **Copy:** `h1` “Bienvenido a ZigZag”; sub “Ingresa tus datos para ver tus tickets de hoy.” (or equivalent current product Spanish if a tiny wording tweak is needed for accuracy — prefer the mock).
6. **Fields:** IBM Plex Mono–style uppercase micro labels; borderless inputs with bottom rule; focus reveals blue→violet gradient underline scale animation.
7. **Stamp CTA:** Full-width amber gradient button “Iniciar sesión”; on successful submit interaction, brief “✓ VALIDADO” stamped overlay (prototype timing ~1.1s). Must not prevent real auth errors from showing.
8. **Perforation:** Dashed horizontal tear line with circular punch holes that match page background.
9. **Guide stub content (expanded):** Eyebrow “¿Primera vez en ZigZag? Elige tu guía”; two rows matching current public guides (titles/audience/descriptions already in the mock and in `PUBLIC_ONBOARDING_GUIDE_LINKS`).
10. **Footnote:** “Powered by zigzag” under the ticket.
11. **Theme toggle:** Fixed top-right circular control; dark default as in the mock’s `data-theme="dark"`.
12. **Fonts:** Prototype uses Space Grotesk + Inter + IBM Plex Mono. Prefer matching that trio for fidelity on `/login`, or map Space Grotesk→existing marketing display and Inter→Figtree only if visual parity stays close. Do not silently fall back to system UI fonts.
13. **No demo credentials:** Prototype hardcodes sample email/password — shipped UI must use empty fields.

### Clever guides disclosure — locked (HTML-faithful)

The HTML shows guides **inside the ticket** below the perforation (not a separate card). User also asked to hide guides in a modern way. Lock this reconciliation:

- **Keep the perforated lower stub** as the guide container (do not invent a detached Sheet that abandons the ticket).
- **Default = collapsed:** Only the login stub (+ visible perforation / tear affordance) occupies the first viewport.
- **Expand interaction:** Activating the tear affordance unfolds/reveals the guide stub beneath the perforation (height/clip animation). Affordance copy can stay “¿Primera vez en ZigZag? Elige tu guía” or a shorter tear cue on the perforation.
- Expanded stub contents and row styling must match the mock.
- A11y: disclosure button with `aria-expanded`; guide list labeled; focus management; Escape collapses; `prefers-reduced-motion` respected.
- Scope unchanged: public links only (no empresa-maestra).

### Modules (deep where noted)

1. **Login page composition (modify)**  
   `/login` server page: keep session redirect; wrap client UI in ambient stage + theme-aware tokens.

2. **Login ticket surface / LoginForm (modify)**  
   Die-cut ticket chrome, brand row with `/logo.png`, folio, fields, stamp button, auth submit/errors/routing. Remove always-visible external guides nav from the old layout.

3. **LoginTicketGuideStub (new, deep)**  
   Perforation + collapsible guide stub disclosure; consumes `PUBLIC_ONBOARDING_GUIDE_LINKS` / `openOnboardingGuide`; owns a11y + reduced motion. No auth knowledge.

4. **Onboarding guides catalog (reuse)**  
   Keep `PUBLIC_ONBOARDING_GUIDE_LINKS` as source of truth.

### Auth & architecture constraints
- No new API routes or Server Actions for login UI.
- NextAuth credentials flow stays as-is.
- No schema/migrations.
- Multi-tenancy unaffected (`company_is_system` routing unchanged).
- Do not display seed/demo passwords.
- Folio number is decorative copy, not a database Ticket id.

### Prototype handling
- Canonical file committed at `tasks/prototypes/zigzag-login-redesign.html`.
- During implementation, side-by-side compare shipped `/login` to opening that HTML in a browser.

## Testing Decisions

### What makes a good test
Test external behavior: structure, disclosure open/close, which guides appear, auth success/failure routing, accessibility. Do not assert ephemeral animation class names from the prototype.

### Modules to test
- **LoginTicketGuideStub:** collapsed by default; opens/closes; renders only public links; opens guides via helper.
- **LoginForm / login page:** error strings; dashboard vs operator-console routing; empty default field values (no demo prefills).
- **E2E:** `e2e/helpers/auth.ts` still fills email/password and submits; `e2e/accessibility.spec.ts` login axe gate still passes serious/critical.
- **Optional visual smoke:** Playwright screenshots of `/login` (mobile + desktop, light + dark) compared qualitatively to the prototype.

### Prior art
- `src/lib/onboarding-guides.test.ts`
- `src/components/marketing/marketing-landing.test.tsx`
- `e2e/helpers/auth.ts`
- `e2e/accessibility.spec.ts`
- `e2e/marketing-landing.spec.ts`
- `e2e/theme-dark.spec.ts` (theme behavior prior art)

## Out of Scope

- Changing NextAuth providers, session strategy, or password reset flows
- Self-serve signup / registration
- Editing guide HTML content under `/guides`
- Dashboard or marketing landing redesign
- Replacing `/logo.png` with a new brand mark
- Creating or linking a real database Ticket on the login page
- Shipping the prototype’s prefilled demo credentials
- Showing System-only empresa-maestra guide on public login
- Offline authenticated login
- New analytics/telemetry specific to guide opens (unless already present)

## Further Notes

- Earlier PRD drafts guessed before the HTML was readable; **this revision supersedes those guesses**. The die-cut ticket + perforated guide stub are mandatory.
- Guides are hidden by collapsing the lower ticket stub, not by abandoning the mock for a generic Sheet — unless mobile constraints force a sheet that still visually continues the stub.
- Light theme in the mock is warm paper; that is intentional for this surface even if marketing uses cool mist.
- Feature integration branch for implementation: `feat/login-page-redesign` (slice PRs merge there, not directly to `main`).

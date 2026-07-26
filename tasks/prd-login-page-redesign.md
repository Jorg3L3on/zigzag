# PRD: Login page visual redesign

**Status:** Ready for agent  
**Prototype reference:** `zigzag-login-redesign.html` (stakeholder HTML mock; attach to the parent GitHub issue and/or place under `tasks/prototypes/` before implementation)  
**Brand asset (locked):** existing product logo at `/logo.png` (gradient “Z”), not any placeholder mark from the HTML mock

## Problem Statement

The public login page is functional but visually dated and crowded. Returning users see a plain centered card, while first-time visitors get a full always-visible “Guías de inicio” panel that competes with the form for attention. A stakeholder HTML mock improves atmosphere and hierarchy, but it does not use ZigZag’s real logo. Operators, investors, and system users still need Spanish copy, NextAuth credentials sign-in, theme toggle, and discoverable onboarding guides — without the guides dominating the first viewport.

## Solution

Redesign `/login` so the first viewport reads as one branded composition: real ZigZag logo, short welcome, credentials form, and theme control. Adapt the HTML mock’s layout, atmosphere, and motion language, while substituting the current `/logo.png` asset everywhere a brand mark appears. Hide public onboarding guides behind a modern progressive-disclosure pattern (a branded “zigzag peek” trigger that opens a sheet/panel) so guides remain one intentional action away without cluttering the login surface.

## User Stories

1. As a returning Company operator, I want a clean, modern login screen, so that signing in feels trustworthy and fast.
2. As a first-time visitor, I want the brand logo to be immediately recognizable, so that I know I am on ZigZag and not a generic template.
3. As a visitor, I want the real product logo (`/logo.png`) shown — not a mock placeholder — so that branding matches the marketing site, PWA icons, and invoices.
4. As a visitor, I want a clear “Bienvenido” (or equivalent Spanish welcome) near the brand, so that the page purpose is obvious.
5. As a visitor, I want email and password fields with labels and autocomplete, so that password managers and mobile keyboards work correctly.
6. As a visitor, I want to show/hide my password, so that I can verify what I typed on mobile.
7. As a visitor with wrong credentials, I want a clear Spanish error with the existing error code pattern (e.g. AU001), so that I can retry or report the issue.
8. As a visitor during a network/auth failure, I want a graceful Spanish error (e.g. GN001), so that I am not left on a blank failure.
9. As a Company operator who signs in successfully, I want to land on `/dashboard`, so that I can start work immediately.
10. As a System company user who signs in successfully, I want to land on `/operator-console`, so that cross-tenant work starts in the right place.
11. As an already-authenticated user who opens `/login`, I want to be redirected to my default destination, so that I do not see a redundant form.
12. As a visitor on a phone, I want the login composition to fit without horizontal scroll or cramped controls, so that I can sign in with one hand.
13. As a visitor on a large desktop, I want the redesigned atmosphere (background, hierarchy, spacing) to feel intentional — not a tiny card floating in empty space — so that the page matches the quality of the marketing landing.
14. As a visitor who prefers dark mode, I want the existing theme toggle to remain available, so that login respects my system/app preference.
15. As a visitor who prefers light mode, I want the redesign to look polished in light theme, so that the mock’s atmosphere is not dark-only.
16. As a first-time visitor, I want onboarding guides hidden by default, so that the form stays the primary focus.
17. As a first-time visitor, I want a clever but obvious control to reveal guides, so that help is discoverable without reading a wall of links.
18. As a first-time visitor who opens guides, I want the public guide set (executive summary + empresa guide) only — not the empresa-maestra platform guide — so that audience scoping stays correct.
19. As an investor evaluating ZigZag, I want to open the executive summary from login guides, so that I can learn the product without an account.
20. As a Company operator evaluating ZigZag, I want to open the empresa guide from login guides, so that I can learn tickets/clients/services/PDF flows.
21. As a visitor using a keyboard, I want the guides disclosure to be fully operable with Tab/Enter/Escape, so that help is accessible without a pointer.
22. As a visitor using a screen reader, I want the guides control to expose name, expanded state, and a labeled panel, so that progressive disclosure is announced correctly.
23. As a visitor who opens a guide, I want it to open in a new tab with `noopener,noreferrer`, so that existing guide-open behavior is preserved.
24. As a visitor with reduced motion preference, I want entrance and disclosure animations to reduce or disable, so that motion is respectful.
25. As a visitor, I want at least two intentional motions on the login experience (e.g. form entrance + guides sheet), so that the redesign feels alive without noise.
26. As a visitor coming from the marketing landing CTA, I want visual continuity with ZigZag’s public brand (logo, cool blue atmosphere cues), so that the journey from `/` to `/login` does not feel like a different product.
27. As a visitor, I want touch targets on the submit button and guides trigger to meet mobile usability (≥44px where interactive), so that taps are reliable.
28. As a visitor, I want focus rings visible on form controls and the guides trigger, so that keyboard focus is never lost visually.
29. As a QA engineer, I want E2E login helpers to keep working without brittle selectors tied to old card chrome, so that the suite does not flake after the redesign.
30. As a QA engineer, I want the login axe accessibility gate to still pass for serious/critical issues, so that the redesign does not regress a11y.
31. As a product owner, I want color-contrast debt on login addressed if the new palette makes it practical, so that the known contrast disable in axe can eventually be removed.
32. As an implementer, I want auth logic (NextAuth `signIn`, session routing) unchanged in behavior, so that the redesign is presentation-scoped.
33. As an implementer, I want guide link data to continue coming from the shared onboarding-guides module, so that login does not hardcode URLs.
34. As an implementer, I want a deep module for guides progressive disclosure, so that open/close behavior and a11y contracts can be tested without mounting full auth.
35. As a maintainer, I want Spanish product copy preserved (labels, button, errors, guides), so that the public surface stays consistent with the rest of the app.
36. As a PWA user who cold-starts into login, I want the page to remain usable offline only for shell chrome (no fake offline auth), so that expectations match the PWA offline policy.
37. As a visitor on a narrow viewport, I want the guides sheet to use a bottom sheet / full-width mobile pattern, so that guide reading is comfortable on phones.
38. As a visitor on desktop, I want the guides disclosure to use a polished panel/dialog that matches the redesigned surface, so that help does not feel bolted on.
39. As a stakeholder who approved the HTML mock, I want the shipped page to clearly reflect that mock’s composition and atmosphere, so that design review is straightforward.
40. As a stakeholder, I want any mock logo/wordmark replaced by the real asset and current product naming, so that we do not ship a prototype brand by mistake.
41. As a support agent, I want login error codes unchanged, so that troubleshooting docs remain valid.
42. As a security-conscious operator, I want no demo credentials or seed passwords displayed on the login page, so that production hygiene is preserved.
43. As a marketing visitor, I want a way back to the public landing (subtle link) if the mock includes it, so that navigation is not a dead end — without stealing focus from sign-in.
44. As an implementer, I want the redesign to reuse existing UI primitives (Button, Input, PasswordInput, Sheet/Dialog, ModeToggle) where possible, so that we do not invent a parallel component system.
45. As a design reviewer, I want the first viewport to avoid a second competing card of guides, so that the composition passes a “one job” test.

## Implementation Decisions

### Visual source of truth
- Primary visual reference: the stakeholder HTML mock (`zigzag-login-redesign.html`). Implement layout hierarchy, atmosphere (gradients/patterns/mesh), spacing, and motion intent from that mock.
- **Logo lock:** Always render the existing product logo from `/logo.png` (same asset used by marketing shell and current login). Do not ship SVG/text/CSS faux-logos from the mock. Size and framing may change; the asset may not.
- **Theme:** Keep `ModeToggle`. The page must look intentional in both light and dark using app theme tokens; borrow marketing atmosphere cues (cool mist/mesh/zigzag motifs) without forcing the marketing “light-locked” shell if that breaks dark mode.
- **Typography:** Prefer continuity with public brand where it helps (marketing display/sans variables are allowed on `/login` only if they do not break form control metrics). Do not introduce Inter/Roboto/Arial as a new default stack.
- **Cards:** Avoid stacking multiple bordered cards. The form may sit on a single focused surface; guides must not be a second always-visible card under it.
- **Hero budget:** First viewport = brand (logo) + short welcome + form + primary CTA + theme control (+ optional subtle back-to-home). No stats, guide list, or secondary marketing blocks in the default collapsed state.

### Clever guides disclosure (“zigzag peek”) — locked
Replace the always-visible guides `<nav>` with progressive disclosure:

1. **Collapsed (default):** A single low-emphasis trigger below the form (or anchored to the composition edge) labeled in Spanish for first-time help (e.g. “¿Primera vez? Ver guías”). Optionally decorate with a small zigzag stroke motif (same brand gesture language as the marketing landing) so the control feels native, not a generic “Help”.
2. **Expanded:** Opens a **Sheet on mobile** and a **Sheet or Dialog on desktop** listing `PUBLIC_ONBOARDING_GUIDE_LINKS` (label, audienceLabel, description) and opening guides via existing `openOnboardingGuide`.
3. **A11y:** Trigger has accessible name; `aria-expanded`; panel has accessible label (e.g. “Guías de inicio”); focus moves into the panel on open and returns to the trigger on close; Escape closes; backdrop click closes.
4. **Motion:** Sheet/panel uses a short entrance; respect `prefers-reduced-motion`.
5. **Scope unchanged:** Do not add empresa-maestra to the public login list.

### Modules (deep where noted)

1. **Login page composition (modify)**  
   Server page shell for `/login`: session redirect behavior unchanged; new full-viewport atmosphere and layout wrapper that hosts the form.

2. **LoginForm (modify)**  
   Preserve credentials submit, error handling, hydration attribute, and routing after success. Restyle to the new composition; remove the always-visible guides block from this component’s default render path.

3. **LoginGuidesDisclosure (new, deep)**  
   Encapsulates collapsed trigger + expanded panel/sheet, consumes `PUBLIC_ONBOARDING_GUIDE_LINKS` / `openOnboardingGuide`, owns a11y and reduced-motion behavior. Simple interface: render-only with optional `className`; no auth knowledge. Unit-testable via component tests for open/close and link rendering.

4. **Onboarding guides catalog (reuse)**  
   Keep `PUBLIC_ONBOARDING_GUIDE_LINKS` as the source of truth; no schema or API changes.

### Auth & architecture constraints
- No new API routes or Server Actions for login UI.
- NextAuth credentials flow stays as-is.
- No schema/migrations.
- Multi-tenancy unaffected (post-login destinations already branch on `company_is_system`).
- Do not display seed/demo passwords on the page.

### Prototype handling
- Before or during implementation, store the HTML mock in-repo under `tasks/prototypes/zigzag-login-redesign.html` (or attach it on the GitHub issue) so AFK agents can diff the mock without a local Downloads path.

## Testing Decisions

### What makes a good test
Test external behavior only: visible structure, disclosure open/close, which guides appear, auth success/failure routing, accessibility contracts. Do not assert on ephemeral CSS class names from the mock.

### Modules to test
- **LoginGuidesDisclosure:** collapsed by default; opens/closes; renders only public links; each control activates guide open helper (mock `window.open` or injected opener).
- **LoginForm / login page:** existing error strings still surface; successful sign-in still routes dashboard vs operator-console (prefer extending existing unit/integration patterns; keep E2E helpers green).
- **E2E:** `e2e/helpers/auth.ts` login flow still finds email/password/submit; `e2e/accessibility.spec.ts` login axe gate still passes for serious/critical.
- **Optional visual smoke:** Playwright screenshot of `/login` at mobile + desktop after redesign (follow `e2e/tickets-visual.spec.ts` prior art only if low-cost).

### Prior art
- `src/lib/onboarding-guides.test.ts` — public vs system guide scoping
- `src/components/marketing/marketing-landing.test.tsx` — public chrome + guides link
- `e2e/helpers/auth.ts` — login form interaction
- `e2e/accessibility.spec.ts` — login axe gate
- `e2e/marketing-landing.spec.ts` — landing → login CTA

## Out of Scope

- Changing NextAuth providers, session strategy, or password reset flows
- Self-serve signup / registration
- Editing guide HTML content under `/guides`
- Dashboard or marketing landing redesign (beyond visual continuity cues)
- Replacing `/logo.png` with a new brand mark
- Showing System-only empresa-maestra guide on the public login page
- Displaying demo/seed credentials on the login page
- Offline authenticated login
- New analytics/telemetry specific to guide opens (unless already present)

## Further Notes

- Cloud agents cannot read host paths like `/Users/jorgeleon/Downloads/...`. Attach the HTML mock to the GitHub issue and/or commit it under `tasks/prototypes/` so implementation can pixel-check against it.
- Spanish UI copy is canonical on this surface; keep tone aligned with current login and guides.
- Prefer shadcn `Sheet` for the disclosure panel to match mobile patterns already used by the app sidebar.
- If the mock’s first viewport conflicts with “keep ModeToggle”, keep the toggle in a non-competing corner as today.
- Feature branch naming for implementation slices should follow repo conventions (`feat/login-page-redesign` as integration branch; slice PRs merge there, not directly to `main`).

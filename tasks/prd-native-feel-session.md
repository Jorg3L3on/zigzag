# PRD: Native-feel — Session keep-alive and expiry UX

**Status:** ❌ Not applied  
**GitHub:** [#356](https://github.com/Jorg3L3on/zigzag/issues/356), [#357](https://github.com/Jorg3L3on/zigzag/issues/357)  
**Parent:** [`prd-native-feel-pwa.md`](./prd-native-feel-pwa.md)

## Introduction

NextAuth JWT sessions use `maxAge` 8h and `updateAge` 1h. Long shifts can hit expiry mid-flow with a jarring redirect. This slice adds **visibility-based** near-expiry refresh and a clearer standalone expiry screen — without extending `maxAge` or always-on polling.

## Goals

- Soft-refresh session when tab becomes visible and expiry is within ~15 minutes
- Clear expiry UX especially in `display-mode: standalone`
- Keep 8h hard cap and existing `token_version` revocation

## User Stories

### US-001: Visibility-based near-expiry refresh
**Description:** As a user returning to a backgrounded tab, I want my session refreshed if it is close to expiring so I do not lose work unnecessarily.

**Acceptance Criteria:**
- [ ] On `visibilitychange` → visible, if session expires within ~15 minutes, trigger a single session refresh (`getSession` / `update`)
- [ ] No aggressive `refetchInterval` polling (avoid free-tier burn)
- [ ] Failures do not loop-spam the auth endpoint
- [ ] Typecheck/lint passes

### US-002: Standalone session-expired screen
**Description:** As an installed PWA user whose session expired, I want a clear “Sesión expirada” state with a path to login instead of a confusing flash.

**Acceptance Criteria:**
- [ ] When unauthenticated in standalone (or on auth failure redirect path), show a clear expired/sign-in message before or on login
- [ ] Login destination still returns user to an appropriate app route after success
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Do not extend maxAge
**Description:** As a security owner, I want the 8h session cap unchanged.

**Acceptance Criteria:**
- [ ] `src/lib/auth.ts` `session.maxAge` remains 8 hours
- [ ] `token_version` revocation behavior unchanged
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Implement keep-alive via client `SessionProvider` companion component, not a new auth vendor.
- FR-2: Document behavior in mobile release checklist (long session / background tab).

## Non-Goals

- “Remember this device” multi-day sessions
- Biometric / WebAuthn unlock (future)
- Changing cookie `sameSite` / secure flags outside existing policy

## Technical Considerations

- `Providers` currently wraps bare `SessionProvider`
- Cost: occasional auth requests near expiry only when visible

## Success Metrics

- Users foregrounding the app near expiry get a refresh attempt instead of immediate surprise logout when refresh succeeds
- Expired standalone users understand they must sign in again

## Open Questions

- None

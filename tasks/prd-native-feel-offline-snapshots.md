# PRD: Native-feel — Offline list snapshots and form drafts

**Status:** ❌ Not applied  
**GitHub:** [#358](https://github.com/Jorg3L3on/zigzag/issues/358)–[#360](https://github.com/Jorg3L3on/zigzag/issues/360)  
**Parent:** [`prd-native-feel-pwa.md`](./prd-native-feel-pwa.md)

## Introduction

The Serwist service worker caches the **app shell** only; ticket/client data requires network. This slice adds **client-side IndexedDB** snapshots of last successful tickets/clients list payloads for read-only offline viewing, plus form draft persistence and retry-friendly mutation failures — without offline CRUD sync or SW caching of tenant JSON.

## Goals

- Persist last successful tickets and clients list snapshots in IndexedDB
- Show clear stale/offline messaging when serving snapshots
- Persist ticket create/edit drafts in `localStorage`; restore on remount; clear on success
- Keep `/api` and RSC **NetworkOnly** in the service worker

## User Stories

### US-001: IndexedDB list snapshots
**Description:** As a user who loses connectivity after loading lists, I want to still see my last tickets/clients list with a clear “last updated” warning.

**Acceptance Criteria:**
- [ ] After successful tickets list load, write versioned snapshot + `updatedAt` + tenant/company key to IndexedDB
- [ ] Same for clients list
- [ ] When offline (or list fetch fails while offline), render snapshot if present with banner: offline / last updated time; no save affordances that claim success
- [ ] Snapshots are never served from the service worker as API responses
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Form draft persistence
**Description:** As a user filling ticket create/edit, I want drafts restored if I accidentally navigate away or reload.

**Acceptance Criteria:**
- [ ] Ticket create and ticket edit persist draft fields to `localStorage` (keyed by route + ticket id when applicable)
- [ ] Restore on mount when draft exists; clear on successful submit
- [ ] Do not persist secrets (passwords); ticket forms only in this slice
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Mutation retry UX
**Description:** As a user whose save fails due to network, I want my form values kept and a clear retry path.

**Acceptance Criteria:**
- [ ] Failed ticket create/edit mutations keep form state and show toast with retry guidance (or retry action)
- [ ] No durable offline write queue / Background Sync API required
- [ ] Typecheck/lint passes

### US-004: SW policy unchanged for tenant data
**Description:** As a security reviewer, I want APIs and RSC to remain network-only in the service worker.

**Acceptance Criteria:**
- [ ] `src/app/sw.ts` continues NetworkOnly for `/api/**` and RSC/action traffic
- [ ] Offline E2E/docs updated to mention read-only snapshots (not full offline CRUD)
- [ ] README Mobile & PWA blurb updated if it still says only shell is cached with no mention of read-only snapshots
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Snapshot keys must include company/tenant identity so system users switching companies do not see the wrong snapshot.
- FR-2: Snapshot schema version field for forward-compatible clears.
- FR-3: Coordinate messaging with `NetworkStatusBanner`.

## Non-Goals

- Offline create/edit/sync of tickets, payments, or clients
- Caching PDF bytes for offline share
- `cacheOnNavigation` enabling broad HTML caching of authenticated pages with stale tenant HTML

## Technical Considerations

- Prefer a small IndexedDB wrapper; avoid adding a heavy sync framework
- Playwright offline tests may stub `navigator.onLine` / use context offline

## Success Metrics

- After online visit + airplane mode, user can open tickets list and see last snapshot with timestamp
- Draft ticket create survives reload until submit

## Open Questions

- None (IndexedDB chosen over sessionStorage)

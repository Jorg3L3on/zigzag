# PRD: Native-feel — Share ticket PDF

**Status:** ❌ Not applied  
**GitHub:** [#346](https://github.com/Jorg3L3on/zigzag/issues/346), [#347](https://github.com/Jorg3L3on/zigzag/issues/347)  
**Parent:** [`prd-native-feel-pwa.md`](./prd-native-feel-pwa.md)

## Introduction

Invoice PDFs are fetched from `GET /api/tickets/[id]/invoice` and saved via a download link. On phones, users expect the system share sheet (WhatsApp, Files, Mail). This slice adds Web Share when available and keeps download as fallback.

## Goals

- Share PDF via `navigator.share` when `canShare` supports files
- Single helper used by PDF download UI entry points
- No new backend or paid APIs

## User Stories

### US-001: Web Share for invoice PDF
**Description:** As a mobile user, I want to share a ticket PDF through the OS share sheet when my browser supports it.

**Acceptance Criteria:**
- [ ] After a successful PDF fetch, if `navigator.canShare` accepts a PDF `File`, offer share (button label or overflow: Compartir)
- [ ] If share unsupported or fails, fall back to existing `<a download>` behavior
- [ ] Success/error toasts remain clear (`PDF001` on hard failure)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Unify PDF blob download helpers
**Description:** As a developer, I want one shared download/share path so ticket row/detail buttons do not fork behavior.

**Acceptance Criteria:**
- [ ] `PDFDownloadButton` (or extracted helper) is the canonical fetch→blob→share/download path
- [ ] Duplicate inline download logic in ticket actions is migrated or thin-wrapped to the helper
- [ ] Typecheck/lint passes

### US-003: tel: links on client phone display
**Description:** As a mobile user, I want tappable phone numbers on client surfaces so I can call without copy-paste.

**Acceptance Criteria:**
- [ ] Client phone displays that are plain text become `tel:` links where a normalized number exists
- [ ] Forms keep `type="tel"` / autocomplete already shipped
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Reuse existing authenticated PDF endpoint; no new route.
- FR-2: Share only user-initiated (click); no automatic share on generate.
- FR-3: Filename for `File` matches current download filename convention.

## Non-Goals

- Server-side email/WhatsApp sending
- Changing PDF layout/renderer
- Push delivery of PDFs

## Technical Considerations

- iOS Safari share-file support varies; always keep download fallback
- Abort/timeout 60s behavior in `pdf-download-button.tsx` must remain

## Success Metrics

- On Android Chrome with share support, user can open system sheet from ticket PDF control
- Download still works on desktop

## Open Questions

- None

# ADR 001: Field program packaging — PWA first

**Status:** Accepted (2026-08-20)  
**Context:** First customer is Android-only, offline-heavy, low-tech. Native app and WhatsApp-bot were considered.  
**Decision:** Ship **installed PWA** as the field client; defer **Play Store native app** unless Background Sync / offline persistence fails on his device after Epic B.  
**Consequences:** IndexedDB + outbox in browser; `@serwist` shell unchanged; no Capacitor in vacation window. Revisit ADR after ride-along if battery/sync inadequate.

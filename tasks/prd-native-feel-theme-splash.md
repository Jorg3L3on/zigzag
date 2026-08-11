# PRD: Native-feel — Theme and splash continuity

**Status:** ❌ Not applied  
**GitHub:** [#343](https://github.com/Jorg3L3on/zigzag/issues/343), [#344](https://github.com/Jorg3L3on/zigzag/issues/344)  
**Parent:** [`prd-native-feel-pwa.md`](./prd-native-feel-pwa.md)

## Introduction

Manifest `theme_color` / `background_color` use brand blue (`#2563eb`) while runtime `ThemeColorMeta` sets light `#ffffff` / dark `#020817`. Cold start and installed chrome can flash mismatched colors. This slice aligns static and runtime chrome without full iOS splash image sets unless cheap.

## Goals

- Manifest background/theme match runtime light (and document dark handling)
- Installed PWA status bar / theme-color do not fight `ThemeColorMeta`
- Safe-area behavior remains correct if status bar style changes

## User Stories

### US-001: Align manifest colors with ThemeColorMeta
**Description:** As a user opening the installed app, I want the splash/background color to match the app background so startup does not flash blue then white.

**Acceptance Criteria:**
- [ ] `manifest.ts` `background_color` and `theme_color` aligned with light runtime background (`#ffffff`) unless product explicitly keeps a different splash brand (default: match ThemeColorMeta light)
- [ ] Root layout `viewport.themeColor` consistent with the same light default
- [ ] `ThemeColorMeta` remains source of truth after hydrate (light/dark)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-002: Apple web app status bar
**Description:** As an iOS Home Screen user, I want status bar styling that does not cover sticky headers incorrectly.

**Acceptance Criteria:**
- [ ] Evaluate `appleWebApp.statusBarStyle`: keep `default` **or** switch to `black-translucent` only if sticky header / safe-area offsets still pass visual check
- [ ] Document the chosen value in this PRD evidence section when applied
- [ ] Manual checklist line for iOS installed cold start
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Single documented pair of light/dark theme-color values used by meta + manifest light defaults.
- FR-2: No requirement to ship a full `apple-touch-startup-image` matrix in this slice; color alignment is enough for v1 of this epic.

## Non-Goals

- Marketing landing theme changes
- Custom per-route theme colors
- Full multi-device splash PNG set (optional follow-up)

## Technical Considerations

- Files: `src/app/manifest.ts`, `src/app/layout.tsx`, `src/components/theme-color-meta.tsx`
- Sticky headers consume `--network-status-banner-offset` and `env(safe-area-inset-*)`

## Success Metrics

- Cold start in standalone does not flash brand blue over white app chrome

## Open Questions

- None if default “match ThemeColorMeta light” is accepted (locked for this epic)

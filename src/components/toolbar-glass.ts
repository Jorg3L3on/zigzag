/**
 * Liquid-glass chrome recipes (ported from Micasa `toolbar-glass.ts`, same names).
 * Base CSS lives once in `globals.css` (`.liquid-glass*`, `shadow-panel`);
 * the dock, its + menu and future glass headers reuse these strings.
 */

/** Round glass button (dock +, header actions). Caller sets size (size-10 / size-12). */
export const TOOLBAR_GLASS_ICON = [
  'relative size-10 shrink-0 rounded-full',
  'border border-black/[0.08] bg-white/80 text-foreground/90',
  'shadow-panel',
  'backdrop-blur-xl backdrop-saturate-150',
  'transition-[background-color,box-shadow,border-color,transform,opacity,color] duration-200 ease-out',
  'hover:bg-white hover:text-foreground',
  'active:scale-[0.96] active:opacity-90',
  'dark:border-white/20 dark:bg-white/[0.10] dark:text-foreground/95',
  'dark:hover:bg-white/[0.16] dark:hover:border-white/28',
  "[&_svg:not([class*='size-'])]:size-5",
  'motion-reduce:transition-none motion-reduce:active:scale-100',
].join(' ');

/** Frosted action menu panel (dock + menu). */
export const GLASS_MENU_PANEL_CLASS = [
  'overflow-hidden rounded-2xl p-1.5',
  'border border-black/10 bg-background/90 shadow-panel',
  'supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl backdrop-saturate-150',
  'dark:border-white/10 dark:bg-[rgb(9_14_29/0.88)]',
].join(' ');

/** Two-line action row inside GLASS_MENU_PANEL_CLASS: icon pill + title + hint. */
export const GLASS_MENU_ITEM_CLASS =
  'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

/** Blue icon tile at the start of a GLASS_MENU_ITEM_CLASS row. */
export const GLASS_MENU_ICON_PILL_CLASS =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 [&_svg]:h-4 [&_svg]:w-4';

/** Content card for the creation flow (composer, review): soft panel shadow + glass rim. */
export const GLASS_CARD_CLASS = [
  'liquid-glass relative rounded-2xl border border-border/60 bg-card p-4 shadow-panel sm:p-6',
  'dark:border-white/[0.08]',
].join(' ');

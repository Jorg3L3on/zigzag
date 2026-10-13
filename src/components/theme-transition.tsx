'use client';

/**
 * Theme switch behind a View Transitions reveal, shared by the toolbar toggle
 * and the keyboard hotkey. Kept free of motion components so the root
 * providers (ThemeHotkey) do not pull framer-motion into every route (ZIG-I20-5).
 */
import * as React from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';

export type ThemeRevealVariant = 'circle' | 'circle-blur';

type ResolvedTheme = 'light' | 'dark';

type RevealOrigin = { x: number; y: number };

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/** Attribute + custom property read by the `::view-transition-*` rules in globals.css. */
export const THEME_VT_ATTRIBUTE = 'data-theme-vt';
export const THEME_VT_ORIGIN_PROPERTY = '--theme-vt-origin';

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const viewportCentre = (): RevealOrigin => ({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
});

const elementCentre = (element: Element): RevealOrigin => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

/**
 * Switch theme behind a circular clip-path reveal (beui Theme Toggle) growing
 * from `origin`. Without View Transitions support, or with reduced motion,
 * the theme switches instantly. The attribute and origin are always cleared.
 */
export const runThemeTransition = ({
  next,
  setTheme,
  origin,
  variant = 'circle-blur',
}: {
  next: ResolvedTheme;
  setTheme: (theme: string) => void;
  origin?: RevealOrigin;
  variant?: ThemeRevealVariant;
}) => {
  const doc = document as ViewTransitionDocument;

  if (typeof doc.startViewTransition !== 'function' || prefersReducedMotion()) {
    setTheme(next);
    return;
  }

  const root = document.documentElement;
  const { x, y } = origin ?? viewportCentre();
  const cleanup = () => {
    root.removeAttribute(THEME_VT_ATTRIBUTE);
    root.style.removeProperty(THEME_VT_ORIGIN_PROPERTY);
  };

  root.setAttribute(THEME_VT_ATTRIBUTE, variant);
  root.style.setProperty(THEME_VT_ORIGIN_PROPERTY, `${x}px ${y}px`);

  try {
    const transition = doc.startViewTransition(() => {
      // next-themes applies the class in an effect; set it here too so the
      // new snapshot is already in the target theme.
      root.classList.remove('light', 'dark');
      root.classList.add(next);
      root.style.colorScheme = next;
      flushSync(() => setTheme(next));
    });
    transition.finished.catch(() => undefined).finally(cleanup);
  } catch {
    cleanup();
    setTheme(next);
  }
};

/** Theme state for toggles: `toggle(element?)` reveals from that element's centre. */
export const useThemeToggle = (variant: ThemeRevealVariant = 'circle-blur') => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';

  const toggle = React.useCallback(
    (from?: Element | null) => {
      runThemeTransition({
        next: resolvedTheme === 'dark' ? 'light' : 'dark',
        setTheme,
        origin: from ? elementCentre(from) : undefined,
        variant,
      });
    },
    [resolvedTheme, setTheme, variant],
  );

  return { isDark, mounted, toggle };
};

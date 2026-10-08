'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { ActionSwap } from '@/components/motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

/** Cmd/Ctrl+Shift+D (and bare `d`) toggle the theme, revealing from the viewport centre. */
export const ThemeHotkey = () => {
  const { toggle } = useThemeToggle();

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const isChord =
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'd';
      const isBareD =
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'd';

      if (!isChord && !isBareD) {
        return;
      }

      event.preventDefault();
      toggle();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return null;
};

type ThemeToggleProps = {
  className?: string;
  variant?: ThemeRevealVariant;
};

export const ThemeToggle = ({
  className,
  variant = 'circle-blur',
}: ThemeToggleProps) => {
  const { isDark, mounted, toggle } = useThemeToggle(variant);

  // Same-size button before mount; the icon appears once the theme is known.
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('shrink-0', className)}
      aria-label={
        mounted
          ? isDark
            ? 'Activar modo claro'
            : 'Activar modo oscuro'
          : 'Cambiar tema'
      }
      onClick={(event) => toggle(event.currentTarget)}
    >
      {mounted ? (
        <ActionSwap swapKey={isDark ? 'dark' : 'light'}>
          {isDark ? (
            <Moon className="h-4 w-4" aria-hidden />
          ) : (
            <Sun className="h-4 w-4" aria-hidden />
          )}
        </ActionSwap>
      ) : (
        <span className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );
};

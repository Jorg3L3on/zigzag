'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const subscribeNoop = () => () => undefined;

const readIsApple = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** "⌘" on Apple keyboards, "Ctrl" elsewhere (and on the server). */
export const useShortcutModifierLabel = () =>
  React.useSyncExternalStore(
    subscribeNoop,
    () => (readIsApple() ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  );

/**
 * A keyboard key hint (ZIG-I24-2). Decorative: the control it sits in carries
 * `aria-keyshortcuts`, so the key is not read twice.
 */
export const Kbd = ({ className, children, ...props }: React.ComponentProps<'kbd'>) => (
  <kbd
    aria-hidden
    className={cn(
      'pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center rounded border border-current/25 px-1 font-sans text-caption font-medium leading-none opacity-80',
      className,
    )}
    {...props}
  >
    {children}
  </kbd>
);

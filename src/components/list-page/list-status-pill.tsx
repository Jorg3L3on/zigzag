import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ListStatusTone = 'emerald' | 'amber' | 'red' | 'slate' | 'blue' | 'violet';

/** Literal classes, so Tailwind keeps them: a /15 tint and a readable text in both themes. */
const TONE_CLASS: Record<ListStatusTone, string> = {
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
};

/**
 * The one status pill of desktop lists (ZIG-I33 §6). Paid / active / accepted /
 * scheduled are emerald; partial / upcoming amber; overdue / errors red; in progress /
 * cancelled / paused slate; open blue. `ui/badge` stays for labels, never for states.
 */
export const ListStatusPill = ({
  tone,
  children,
  className,
}: {
  tone: ListStatusTone;
  children: ReactNode;
  className?: string;
}) => (
  <span
    data-tone={tone}
    className={cn(
      'inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-caption font-semibold',
      TONE_CLASS[tone],
      className,
    )}
  >
    {children}
  </span>
);

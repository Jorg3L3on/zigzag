import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ListViewTab<TId extends string> = {
  id: TId;
  label: string;
  /** Counts only, never amounts (f18a2f7d); null while loading. */
  count: number | null;
  /** The second line, e.g. «60 tickets» or «4 · 1 vence hoy»; defaults to the count. */
  caption?: ReactNode;
  /** Tailwind background of the dot before the name (canvas), e.g. bg-amber-500. */
  dot?: string | null;
};

/**
 * Desktop view tabs over a list, as the canvas draws them (ListaA, ListaPresuA):
 * the name with a coloured dot over its count, the chosen one bold with a blue
 * underline (ZIG-I28-4, shared with presupuestos in ZIG-I29-3).
 */
export const ListViewTabs = <TId extends string>({
  label,
  tabs,
  isSelected,
  onSelect,
}: {
  label: string;
  tabs: ListViewTab<TId>[];
  isSelected: (id: TId) => boolean;
  onSelect: (id: TId) => void;
}) => (
  <nav aria-label={label} className="flex gap-1 border-b border-border/60">
    {tabs.map((tab) => {
      const selected = isSelected(tab.id);
      const caption = tab.caption ?? (tab.count == null ? null : String(tab.count));
      return (
        <button
          key={tab.id}
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(tab.id)}
          className={cn(
            '-mb-px flex min-w-[8.75rem] flex-col items-start gap-0.5 border-b-2 px-3.5 pb-3 pt-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            selected
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <span className={cn('flex items-center gap-2 text-sm', selected ? 'font-semibold' : 'font-medium')}>
            {tab.dot ? <span aria-hidden className={cn('h-2 w-2 rounded-full', tab.dot)} /> : null}
            {tab.label}
          </span>
          <span className="text-caption tabular-nums text-muted-foreground">{caption ?? ' '}</span>
        </button>
      );
    })}
  </nav>
);

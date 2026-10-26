import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type ListViewTab<TId extends string> = {
  id: TId;
  label: string;
  /** Counts only, never amounts (f18a2f7d); null while loading. */
  count: number | null;
  /** A short addition after the count, e.g. «1 vence hoy». */
  hint?: ReactNode;
};

/**
 * Desktop view tabs over a list (ZIG-I28-4, shared with presupuestos in
 * ZIG-I29-3): an underlined, tinted selection with the server counts.
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
      return (
        <button
          key={tab.id}
          type="button"
          aria-pressed={selected}
          onClick={() => onSelect(tab.id)}
          className={cn(
            '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            selected
              ? 'border-primary bg-primary/10 font-semibold text-primary'
              : 'border-transparent text-muted-foreground hover:bg-muted/50',
          )}
        >
          {tab.label}
          {tab.count != null ? <span className="tabular-nums">{tab.count}</span> : null}
          {tab.hint ? <span className="font-normal">{tab.hint}</span> : null}
        </button>
      );
    })}
  </nav>
);

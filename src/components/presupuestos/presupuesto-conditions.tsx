'use client';

import * as React from 'react';

import { collapseBlankLines } from '@/lib/collapse-blank-lines';
import { cn } from '@/lib/utils';

/** Notes longer than this fold behind Ver todas. */
const CONDITIONS_FOLD_CHARS = 160;

export const PresupuestoConditions = ({ notes }: { notes: string }) => {
  const [expanded, setExpanded] = React.useState(false);
  const text = collapseBlankLines(notes);
  const foldable = text.length > CONDITIONS_FOLD_CHARS || text.split('\n').length > 3;
  const handleToggle = () => {
    setExpanded((value) => !value);
  };

  return (
    <section aria-labelledby="presupuesto-conditions-heading" data-testid="presupuesto-conditions">
      <h2 id="presupuesto-conditions-heading" className="mb-1.5 text-[15px] font-semibold">
        Condiciones
      </h2>
      <p
        className={cn(
          'whitespace-pre-line text-caption leading-relaxed text-muted-foreground [overflow-wrap:anywhere]',
          foldable && !expanded && 'line-clamp-3',
        )}
        data-testid="presupuesto-notes"
      >
        {text}
      </p>
      {foldable ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={handleToggle}
          className="mt-1 min-h-11 text-caption font-medium text-primary underline-offset-4 hover:underline"
        >
          {expanded ? 'Ver menos' : 'Ver todas'}
        </button>
      ) : null}
    </section>
  );
};

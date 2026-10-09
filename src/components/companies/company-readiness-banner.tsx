'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';

import { CompanyReadinessPanel } from '@/components/companies/company-readiness-panel';
import type { CompanyReadinessAssessment } from '@/lib/company-readiness';
import { cn } from '@/lib/utils';

/** One-line readiness status for the Datos tab; expands to the full panel. */
export const readinessHeadline = (assessment: CompanyReadinessAssessment) => {
  if (assessment.productionReady) {
    return 'Lista para operar';
  }
  const [first, second, ...rest] = assessment.missingLabels;
  if (!first) {
    return 'Configuración pendiente';
  }
  const named = second ? `${first}, ${second}` : first;
  return rest.length > 0 ? `Falta: ${named} y ${rest.length} más` : `Falta: ${named}`;
};

export const CompanyReadinessBanner = ({
  assessment,
}: {
  assessment: CompanyReadinessAssessment;
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const detailId = React.useId();

  return (
    <div className="rounded-xl border bg-muted/30" data-testid="company-readiness-banner">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          aria-hidden
          className={cn(
            'size-2.5 shrink-0 rounded-full',
            assessment.productionReady ? 'bg-emerald-600' : 'bg-amber-500',
          )}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {readinessHeadline(assessment)}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {expanded ? 'Ocultar' : 'Detalle'}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      <div id={detailId} hidden={!expanded} className="px-2 pb-2">
        <CompanyReadinessPanel assessment={assessment} />
      </div>
    </div>
  );
};

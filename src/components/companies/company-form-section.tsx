'use client';

import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type CompanyFormSectionProps = {
  title: string;
  /** One line shown under the title while the section is closed. */
  summary: string;
  collapsible: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  testId?: string;
};

/**
 * A form section: a plain heading on desktop, a collapsible card on mobile
 * (ZIG-I3-2). Content stays mounted while closed so fields keep their refs
 * and can be focused when a validation error opens the section.
 */
export const CompanyFormSection = ({
  title,
  summary,
  collapsible,
  open,
  onOpenChange,
  children,
  testId,
}: CompanyFormSectionProps) => {
  if (!collapsible) {
    return (
      <div className="space-y-4" data-testid={testId}>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {children}
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="rounded-xl border bg-card"
      data-testid={testId}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {open ? null : (
              <span className="truncate text-xs text-muted-foreground">{summary}</span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount hidden={!open} className="px-4 pb-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

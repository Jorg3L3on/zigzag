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
  /** The form uses sections at all (self-service). Static for a form's life. */
  sectioned: boolean;
  /** Sections can collapse right now (mobile viewport). */
  collapsible: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  testId?: string;
};

/**
 * A form section (ZIG-I3-2). When the form is sectioned the DOM structure is
 * the same on every viewport, so switching to mobile after hydration never
 * remounts the fields (an open Select would lose its popup); only the open
 * state and the trigger change. Content stays mounted while closed so a
 * validation error can open the section and focus its field.
 */
export const CompanyFormSection = ({
  title,
  summary,
  sectioned,
  collapsible,
  open,
  onOpenChange,
  children,
  testId,
}: CompanyFormSectionProps) => {
  if (!sectioned) {
    return (
      <div className="space-y-4" data-testid={testId}>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {children}
      </div>
    );
  }

  const isOpen = collapsible ? open : true;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onOpenChange}
      disabled={!collapsible}
      className={collapsible ? 'rounded-xl border bg-card' : 'space-y-4'}
      data-testid={testId}
    >
      <h3 className="text-sm font-semibold text-foreground">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-3 text-left disabled:cursor-default',
              collapsible &&
                'min-h-14 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span>{title}</span>
              {collapsible && !isOpen ? (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {summary}
                </span>
              ) : null}
            </span>
            {collapsible ? (
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  isOpen && 'rotate-180',
                )}
              />
            ) : null}
          </button>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent
        forceMount
        hidden={!isOpen}
        className={collapsible ? 'px-4 pb-4' : undefined}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

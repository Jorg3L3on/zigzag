'use client';

import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TripledStep = {
  id: string;
  title: string;
};

type TripledStepperProps = {
  steps: TripledStep[];
  currentStepId: string;
  /** Accessible name for the progress navigation landmark */
  navigationLabel?: string;
};

export const TripledStepper = ({
  steps,
  currentStepId,
  navigationLabel = 'Progreso del ticket',
}: TripledStepperProps) => {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <nav
      aria-label={navigationLabel}
      className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-3"
    >
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isActive = step.id === currentStepId;

        const stepStatusLabel = isCompleted
          ? 'completado'
          : isActive
            ? 'paso actual'
            : 'pendiente';

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
            )}
            aria-current={isActive ? 'step' : undefined}
            aria-label={`${step.title}, ${stepStatusLabel}`}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" aria-hidden />
            ) : (
              <span
                className={cn(
                  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs',
                  isActive ? 'border-primary text-primary' : 'border-muted-foreground/40',
                )}
                aria-hidden
              >
                {index + 1}
              </span>
            )}
            <span className="font-medium">{step.title}</span>
          </div>
        );
      })}
    </nav>
  );
};

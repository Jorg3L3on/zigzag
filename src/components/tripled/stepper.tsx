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
};

export const TripledStepper = ({ steps, currentStepId }: TripledStepperProps) => {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStepId);

  return (
    <div className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-3">
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isActive = step.id === currentStepId;

        return (
          <div
            key={step.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
            )}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs',
                  isActive ? 'border-primary text-primary' : 'border-muted-foreground/40',
                )}
              >
                {index + 1}
              </span>
            )}
            <span className="font-medium">{step.title}</span>
          </div>
        );
      })}
    </div>
  );
};

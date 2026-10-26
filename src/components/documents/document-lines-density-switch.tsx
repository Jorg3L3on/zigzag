'use client';

import { Button } from '@/components/ui/button';
import { useDocumentLinesDensity } from '@/hooks/use-document-lines-density';
import type { DocumentLinesDensity } from '@/lib/document-lines-density';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: DocumentLinesDensity; label: string }> = [
  { value: 'detailed', label: 'Detallado' },
  { value: 'compact', label: 'Compacto' },
];

/**
 * Detallado shows material blocks; Compacto folds each line behind a chip.
 * The choice is stored per user (ZIG-I28-1).
 */
export const DocumentLinesDensitySwitch = () => {
  const { density, setDensity } = useDocumentLinesDensity();

  return (
    <div
      role="group"
      aria-label="Densidad de las líneas"
      data-testid="document-lines-density-switch"
      className="inline-flex rounded-lg bg-muted p-0.5"
    >
      {OPTIONS.map((option) => {
        const pressed = density === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={pressed}
            onClick={() => setDensity(option.value)}
            // Canvas segmented control: the chosen one is a white chip with dark text
            // (primary on primary/10 read 4.12:1, below AA).
            className={cn(
              'h-8 rounded-md px-3',
              pressed
                ? 'bg-background text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.10)] hover:bg-background hover:text-foreground'
                : 'text-slate-600 shadow-none hover:shadow-none dark:text-slate-300',
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};

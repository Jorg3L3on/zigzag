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
            className={cn(
              'h-8 rounded-md px-3 shadow-none hover:shadow-none',
              pressed && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
};

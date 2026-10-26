'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FormChangesBarProps = {
  /** Labels of the changed fields; the bar only shows while there is one. */
  changedFields: string[];
  formId: string;
  onDiscard: () => void;
  isSubmitting: boolean;
  className?: string;
};

/**
 * "Cambios sin guardar · <campos>" with Descartar and Guardar cambios, stuck
 * to the bottom of the page on md+ (ZIG-I32-1). One save for the whole form;
 * phones keep their sticky Guardar.
 */
export const FormChangesBar = ({
  changedFields,
  formId,
  onDiscard,
  isSubmitting,
  className,
}: FormChangesBarProps) => {
  if (changedFields.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Cambios sin guardar"
      className={cn(
        'sticky bottom-4 z-20 mt-6 flex items-center justify-between gap-4 rounded-xl border bg-background/95 px-4 py-3 shadow-panel backdrop-blur',
        className,
      )}
      data-testid="form-changes-bar"
    >
      <p className="min-w-0 truncate text-sm text-foreground/80">
        <span className="font-semibold text-foreground">Cambios sin guardar</span>
        {' · '}
        {changedFields.join(', ')}
      </p>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" onClick={onDiscard} disabled={isSubmitting}>
          Descartar
        </Button>
        <Button type="submit" form={formId} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
};

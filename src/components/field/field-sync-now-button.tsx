'use client';

import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type FieldSyncNowButtonProps = {
  pendingCount: number;
  syncing: boolean;
  onFlush: () => void;
  className?: string;
};

export const FieldSyncNowButton = ({
  pendingCount,
  syncing,
  onFlush,
  className,
}: FieldSyncNowButtonProps) => {
  if (pendingCount <= 0 && !syncing) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className={cn('min-h-10 rounded-lg', className)}
      onClick={onFlush}
      disabled={syncing}
      aria-label={
        syncing
          ? 'Subiendo trabajos pendientes'
          : `Subir ahora ${pendingCount} pendientes`
      }
      data-testid="field-sync-now-button"
    >
      {syncing ? (
        <Loader2
          className="h-4 w-4 animate-spin"
          aria-hidden
          data-icon="inline-start"
        />
      ) : (
        <Upload className="h-4 w-4" aria-hidden data-icon="inline-start" />
      )}
      {syncing ? 'Subiendo…' : `Subir ahora (${pendingCount})`}
    </Button>
  );
};

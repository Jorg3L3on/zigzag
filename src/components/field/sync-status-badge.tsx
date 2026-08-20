'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/lib/field-jobs/types';

const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  pending: 'Pendiente de subir',
  uploading: 'Subiendo…',
  synced: 'Subido',
  error: 'Error al subir',
};

type SyncStatusBadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  status: SyncStatus;
};

export const SyncStatusBadge = ({
  status,
  className,
  ...props
}: SyncStatusBadgeProps) => {
  const variant =
    status === 'error'
      ? 'destructive'
      : status === 'uploading'
        ? 'default'
        : status === 'synced'
          ? 'outline'
          : 'secondary';

  return (
    <Badge
      variant={variant}
      className={cn('gap-1 font-normal shadow-none', className)}
      aria-live="polite"
      {...props}
    >
      {status === 'uploading' ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : null}
      {SYNC_STATUS_LABEL[status]}
    </Badge>
  );
};

export { SYNC_STATUS_LABEL };

'use client';

import * as React from 'react';

import { useCompany } from '@/contexts/company-context';
import { useFieldJobSync } from '@/hooks/use-field-job-sync';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { usePermissions } from '@/hooks/use-permissions';
import { warmComposerPages } from '@/lib/offline-composer-cache';
import { canWriteTickets } from '@/lib/tickets-rbac';

/**
 * App-wide, invisible (ZIG-I35-4): uploads what was saved with no signal as soon
 * as signal comes back on any screen, not only on Hoy, and keeps the composer
 * pages in the service worker cache so they open offline.
 */
export const FieldSyncRunner = () => {
  const { selectedCompany } = useCompany();
  const { can, loading } = usePermissions();
  const { isOnline } = useNetworkStatus();
  const companyId =
    selectedCompany?.id && selectedCompany.name !== 'System' ? selectedCompany.id : null;
  const canWrite = !loading && canWriteTickets(can);

  useFieldJobSync(companyId, canWrite);

  React.useEffect(() => {
    if (!canWrite || !isOnline) return;
    const run = () => {
      void warmComposerPages().catch(() => undefined);
    };
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const handle = idleWindow.requestIdleCallback(run, { timeout: 5000 });
      return () => idleWindow.cancelIdleCallback?.(handle);
    }
    const timeoutId = window.setTimeout(run, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [canWrite, isOnline]);

  return null;
};

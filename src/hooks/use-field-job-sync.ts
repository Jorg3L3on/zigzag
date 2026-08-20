'use client';

import * as React from 'react';
import { toast } from 'sonner';

import {
  countPendingFieldUploads,
  fieldJobStore,
  flushFieldJobOutbox,
  type SyncFlushResult,
} from '@/lib/field-jobs';

export type UseFieldJobSyncState = {
  syncing: boolean;
  pendingCount: number;
  lastResult: SyncFlushResult | null;
  flushNow: () => Promise<SyncFlushResult | null>;
  reloadPending: () => void;
};

/**
 * Auto-flush outbox on online / visibility; expose Subir ahora.
 */
export const useFieldJobSync = (
  companyId: number | null | undefined,
  enabled = true,
): UseFieldJobSyncState => {
  const [syncing, setSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [lastResult, setLastResult] = React.useState<SyncFlushResult | null>(
    null,
  );
  const syncingRef = React.useRef(false);

  const reloadPending = React.useCallback(async () => {
    if (!enabled || companyId == null) {
      setPendingCount(0);
      return;
    }
    try {
      const jobs = await fieldJobStore.listLocalJobsByCompany(companyId);
      setPendingCount(countPendingFieldUploads(jobs));
    } catch {
      setPendingCount(0);
    }
  }, [companyId, enabled]);

  const flushNow = React.useCallback(async (): Promise<SyncFlushResult | null> => {
    if (!enabled || companyId == null || syncingRef.current) {
      return null;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.message('Sin internet', {
        description: 'Los trabajos se subirán cuando haya señal.',
      });
      return null;
    }

    syncingRef.current = true;
    setSyncing(true);
    try {
      const result = await flushFieldJobOutbox(fieldJobStore, { companyId });
      setLastResult(result);
      await reloadPending();
      if (result.succeeded > 0 && result.failed === 0) {
        toast.success(
          result.succeeded === 1
            ? 'Trabajo subido'
            : `${result.succeeded} trabajos subidos`,
        );
      } else if (result.failed > 0) {
        toast.error('No se pudieron subir algunos trabajos', {
          description: 'Toca Reintentar o Subir ahora cuando tengas señal.',
        });
      }
      return result;
    } catch {
      toast.error('No se pudo subir. Revisa tu conexión.');
      return null;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [companyId, enabled, reloadPending]);

  React.useEffect(() => {
    void reloadPending();
  }, [reloadPending]);

  React.useEffect(() => {
    if (!enabled || companyId == null) {
      return;
    }

    const handleOnline = () => {
      void flushNow();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void flushNow();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flushNow();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [companyId, enabled, flushNow]);

  return {
    syncing,
    pendingCount,
    lastResult,
    flushNow,
    reloadPending: () => {
      void reloadPending();
    },
  };
};

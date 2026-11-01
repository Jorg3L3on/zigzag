'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  countPendingFieldUploads,
  fieldJobStore,
  flushFieldJobOutbox,
  type SyncFlushResult,
} from '@/lib/field-jobs';

import { probeSession, sessionMayUploadFor } from '@/lib/session-probe';
import {
  FIELD_JOBS_CHANGED_EVENT,
  notifyFieldJobsChanged,
} from '@/lib/field-jobs/events';

export { FIELD_JOBS_CHANGED_EVENT, notifyFieldJobsChanged };

/**
 * One flush at a time for the whole app: Hoy and the app-wide runner share it,
 * so an entry is never sent twice in parallel.
 */
let flushInFlight: Promise<SyncFlushResult | null> | null = null;

export type UseFieldJobSyncState = {
  syncing: boolean;
  pendingCount: number;
  lastResult: SyncFlushResult | null;
  flushNow: () => Promise<SyncFlushResult | null>;
  reloadPending: () => void;
};

const documentHref = (doc: SyncFlushResult['documents'][number]) =>
  doc.kind === 'presupuesto' ? `/presupuestos/${doc.id}` : `/tickets/${doc.id}`;

/**
 * Auto-flush outbox on online / visibility; expose Subir ahora. Composer
 * documents saved offline (ZIG-I35) toast with the folio they got.
 */
export const useFieldJobSync = (
  companyId: number | null | undefined,
  enabled = true,
): UseFieldJobSyncState => {
  const router = useRouter();
  const [syncing, setSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [lastResult, setLastResult] = React.useState<SyncFlushResult | null>(
    null,
  );

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
    if (!enabled || companyId == null || flushInFlight) {
      return null;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.message('Sin internet', {
        description: 'Los trabajos se subirán cuando haya señal.',
      });
      return null;
    }

    setSyncing(true);
    try {
      // A dead session, or one for another company than the jobs on screen, uploads
      // nothing: the jobs stay queued and no false error is written on them.
      flushInFlight = probeSession().then((probe) =>
        sessionMayUploadFor(probe, companyId)
          ? flushFieldJobOutbox(fieldJobStore, { companyId })
          : null,
      );
      const result = await flushInFlight;
      if (!result) return null;
      setLastResult(result);
      await reloadPending();
      if (result.processed > 0) notifyFieldJobsChanged();
      // The list behind the toast now has the real ticket (ZIG-I36 M-23).
      if (result.documents.length > 0) router.refresh();

      for (const doc of result.documents) {
        const noun = doc.kind === 'presupuesto' ? 'Presupuesto' : 'Ticket';
        toast.success(`${noun} ${doc.folio ?? `#${doc.id}`} sincronizado`, {
          description: 'Ya tiene su folio.',
          action: { label: 'Ver', onClick: () => router.push(documentHref(doc)) },
        });
      }
      const jobsUploaded = result.succeeded - result.documents.length;
      if (jobsUploaded > 0 && result.failed === 0) {
        toast.success(
          jobsUploaded === 1 ? 'Trabajo subido' : `${jobsUploaded} trabajos subidos`,
        );
      } else if (result.failed > 0) {
        toast.error(
          result.failed === 1
            ? 'Un documento necesita revisión'
            : `${result.failed} documentos necesitan revisión`,
          { description: 'Ábrelo desde la lista, revísalo y guarda de nuevo.' },
        );
      }
      return result;
    } catch {
      toast.error('No se pudo subir. Revisa tu conexión.');
      return null;
    } finally {
      flushInFlight = null;
      setSyncing(false);
    }
  }, [companyId, enabled, reloadPending, router]);

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
    const handleChanged = () => {
      void reloadPending();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener(FIELD_JOBS_CHANGED_EVENT, handleChanged);
    document.addEventListener('visibilitychange', handleVisibility);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void flushNow();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(FIELD_JOBS_CHANGED_EVENT, handleChanged);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [companyId, enabled, flushNow, reloadPending]);

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

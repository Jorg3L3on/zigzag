'use client';

import * as React from 'react';
import { CloudCheck, Loader2 } from 'lucide-react';

import { getClients } from '@/actions/clients';
import { getServices } from '@/actions/services';
import { useCompany } from '@/contexts/company-context';
import { useFieldJobSync } from '@/hooks/use-field-job-sync';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { usePermissions } from '@/hooks/use-permissions';
import {
  isOfflineReady,
  markOfflineReady,
  warmComposerPages,
} from '@/lib/offline-composer-cache';
import {
  readComposerClients,
  refreshComposerClients,
  saveComposerServices,
} from '@/lib/offline-composer-catalog';
import { canWriteTickets } from '@/lib/tickets-rbac';

type Preparation = 'idle' | 'preparing' | 'ready';

/** How long the service worker gets to take control of a page that just installed it. */
const SERVICE_WORKER_WAIT_MS = 6000;
const READY_NOTICE_MS = 4000;

const waitForServiceWorkerControl = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration || navigator.serviceWorker.controller) return;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
      window.setTimeout(done, SERVICE_WORKER_WAIT_MS);
    });
  } catch {
    // No service worker here: the catalog copy is still worth having.
  }
};

/**
 * Right after sign-in (ZIG-I36-23): clients and services, then the pages that
 * open with no signal, so one online visit is enough. True when the phone can
 * now work offline.
 */
const prepareForOffline = async (companyId: number): Promise<boolean> => {
  const [, services] = await Promise.all([
    refreshComposerClients(companyId, (page) => getClients({ companyId, page, pageSize: 100 })).catch(
      () => false,
    ),
    getServices(companyId).catch(() => null),
  ]);
  if (services?.success && services.data) await saveComposerServices(companyId, services.data);
  const clientsReady = (await readComposerClients(companyId)) != null;
  if (!clientsReady || !services?.success) return false;
  await waitForServiceWorkerControl();
  await warmComposerPages({ force: true }).catch(() => []);
  return true;
};

/**
 * App-wide (ZIG-I35-4): uploads what was saved with no signal as soon as signal
 * comes back on any screen, not only on Hoy, and keeps the composer pages in the
 * service worker cache so they open offline. The first time on a phone it also
 * prepares the catalog and says so (ZIG-I36-23).
 */
export const FieldSyncRunner = () => {
  const { selectedCompany } = useCompany();
  const { can, loading } = usePermissions();
  const { isOnline } = useNetworkStatus();
  const [preparation, setPreparation] = React.useState<Preparation>('idle');
  const companyId =
    selectedCompany?.id && selectedCompany.name !== 'System' ? selectedCompany.id : null;
  const canWrite = !loading && canWriteTickets(can);

  useFieldJobSync(companyId, canWrite);

  React.useEffect(() => {
    if (!canWrite || !isOnline || companyId == null) return;
    if (!isOfflineReady(companyId)) {
      let cancelled = false;
      let noticeTimer: number | undefined;
      setPreparation('preparing');
      void prepareForOffline(companyId)
        .catch(() => false)
        .then((ready) => {
          if (cancelled) return;
          if (!ready) {
            setPreparation('idle');
            return;
          }
          markOfflineReady(companyId);
          setPreparation('ready');
          noticeTimer = window.setTimeout(() => setPreparation('idle'), READY_NOTICE_MS);
        });
      return () => {
        cancelled = true;
        window.clearTimeout(noticeTimer);
      };
    }
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
  }, [canWrite, isOnline, companyId]);

  if (preparation === 'idle') return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-40 flex justify-center px-4">
      <p
        role="status"
        aria-live="polite"
        data-testid="offline-preparation"
        className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-background px-4 py-2 text-sm font-medium shadow-lg"
      >
        {preparation === 'preparing' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
            Preparando para trabajar sin señal…
          </>
        ) : (
          <>
            <CloudCheck className="h-4 w-4 text-primary" aria-hidden />
            Listo para trabajar sin señal
          </>
        )}
      </p>
    </div>
  );
};

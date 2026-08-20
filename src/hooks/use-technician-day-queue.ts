'use client';

import * as React from 'react';
import {
  getTechnicianDayQueue,
  type TechnicianDayQueueData,
} from '@/actions/technician-day-queue';
import { useCompany } from '@/contexts/company-context';
import { useFieldJobStore } from '@/hooks/use-field-job-store';
import { useFieldJobSync } from '@/hooks/use-field-job-sync';
import { usePermissions } from '@/hooks/use-permissions';
import {
  mergeTechnicianDayWithLocalJobs,
  type MergedTechnicianDayTicket,
} from '@/lib/field-jobs';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canReadTickets } from '@/lib/tickets-rbac';

export type TechnicianDayQueueState = {
  canRead: boolean;
  missingCompany: boolean;
  permissionsLoading: boolean;
  loading: boolean;
  error: string | null;
  data: (Omit<TechnicianDayQueueData, 'items'> & {
    items: MergedTechnicianDayTicket[];
  }) | null;
  reload: () => void;
  pendingUploadCount: number;
  syncing: boolean;
  flushNow: () => Promise<unknown>;
};

type LoadSignal = {
  cancelled: boolean;
};

export const useTechnicianDayQueue = (
  enabled = true,
): TechnicianDayQueueState => {
  const { selectedCompany } = useCompany();
  const { can, isSystem, loading: permissionsLoading } = usePermissions();
  const canRead = canReadTickets(can);
  const missingCompany = needsSelectedCompanyContext(
    isSystem,
    selectedCompany?.id,
  );
  const companyId = selectedCompany?.id ?? null;
  const localStore = useFieldJobStore(companyId, enabled && !missingCompany);
  const fieldSync = useFieldJobSync(companyId, enabled && !missingCompany);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [serverData, setServerData] =
    React.useState<TechnicianDayQueueData | null>(null);

  const loadQueue = React.useCallback(
    async (signal?: LoadSignal) => {
      if (permissionsLoading) {
        return;
      }

      if (!canRead || missingCompany) {
        if (signal?.cancelled) {
          return;
        }
        setLoading(false);
        setError(null);
        setServerData(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          if (!signal?.cancelled) {
            setServerData({ items: [], todayCount: 0, overdueCount: 0 });
            setError(null);
          }
          return;
        }

        const result = await getTechnicianDayQueue(companyId);
        if (signal?.cancelled) {
          return;
        }

        if (!result.success || !result.data) {
          setError(
            getErrorDisplayMessage(
              result,
              'No se pudo cargar el trabajo de hoy',
            ),
          );
          setServerData(null);
          return;
        }

        setServerData(result.data);
      } catch {
        if (signal?.cancelled) {
          return;
        }
        // Offline / network: still show local jobs via merge.
        setServerData({ items: [], todayCount: 0, overdueCount: 0 });
        setError(null);
      } finally {
        if (!signal?.cancelled) {
          setLoading(false);
        }
      }
    },
    [canRead, companyId, missingCompany, permissionsLoading],
  );

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const signal: LoadSignal = { cancelled: false };
    void loadQueue(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [enabled, loadQueue]);

  const mergedItems = React.useMemo(
    () =>
      mergeTechnicianDayWithLocalJobs(
        serverData?.items ?? [],
        localStore.jobs,
      ),
    [localStore.jobs, serverData?.items],
  );

  const data = React.useMemo(() => {
    if (!serverData && mergedItems.length === 0) {
      return null;
    }
    const todayCount = mergedItems.filter((row) => !row.isOverdue).length;
    const overdueCount = mergedItems.filter((row) => row.isOverdue).length;
    return {
      items: mergedItems,
      todayCount,
      overdueCount,
    };
  }, [mergedItems, serverData]);

  const reload = React.useCallback(() => {
    void loadQueue();
    localStore.reload();
    fieldSync.reloadPending();
  }, [fieldSync, loadQueue, localStore]);

  return {
    canRead,
    missingCompany,
    permissionsLoading,
    loading: loading || localStore.loading,
    error,
    data,
    reload,
    pendingUploadCount: fieldSync.pendingCount,
    syncing: fieldSync.syncing,
    flushNow: fieldSync.flushNow,
  };
};

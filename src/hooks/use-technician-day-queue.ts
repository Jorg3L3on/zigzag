'use client';

import * as React from 'react';
import {
  getTechnicianDayQueue,
  type TechnicianDayQueueData,
} from '@/actions/technician-day-queue';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canReadTickets } from '@/lib/tickets-rbac';

export type TechnicianDayQueueState = {
  canRead: boolean;
  missingCompany: boolean;
  permissionsLoading: boolean;
  loading: boolean;
  error: string | null;
  data: TechnicianDayQueueData | null;
  reload: () => void;
};

type LoadSignal = {
  cancelled: boolean;
};

export const useTechnicianDayQueue = (): TechnicianDayQueueState => {
  const { selectedCompany } = useCompany();
  const { can, isSystem, loading: permissionsLoading } = usePermissions();
  const canRead = canReadTickets(can);
  const missingCompany = needsSelectedCompanyContext(
    isSystem,
    selectedCompany?.id,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<TechnicianDayQueueData | null>(null);

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
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);
      const companyId = selectedCompany?.id ?? null;

      try {
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
          setData(null);
          return;
        }

        setData(result.data);
      } catch {
        if (signal?.cancelled) {
          return;
        }
        setError('No se pudo cargar el trabajo de hoy');
        setData(null);
      } finally {
        if (!signal?.cancelled) {
          setLoading(false);
        }
      }
    },
    [canRead, missingCompany, permissionsLoading, selectedCompany?.id],
  );

  React.useEffect(() => {
    const signal: LoadSignal = { cancelled: false };
    void loadQueue(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadQueue]);

  const reload = React.useCallback(() => {
    void loadQueue();
  }, [loadQueue]);

  return {
    canRead,
    missingCompany,
    permissionsLoading,
    loading,
    error,
    data,
    reload,
  };
};

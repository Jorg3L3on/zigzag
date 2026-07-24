'use client';

import * as React from 'react';
import {
  listClientServiceSchedules,
  type ClientServiceScheduleListItem,
} from '@/actions/client-service-schedules';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import {
  canReadServiceSchedules,
  needsSelectedCompanyForSchedules,
} from '@/lib/service-schedules-rbac';

export type DashboardUrgentSchedulesState = {
  canRead: boolean;
  missingCompany: boolean;
  permissionsLoading: boolean;
  loading: boolean;
  error: string | null;
  proximos: ClientServiceScheduleListItem[];
  atrasados: ClientServiceScheduleListItem[];
  reload: () => void;
};

export const useDashboardUrgentSchedules = (): DashboardUrgentSchedulesState => {
  const { selectedCompany } = useCompany();
  const { can, isSystem, loading: permissionsLoading } = usePermissions();
  const canRead = canReadServiceSchedules(can);
  const missingCompany = needsSelectedCompanyForSchedules(
    isSystem,
    selectedCompany?.id,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [proximos, setProximos] = React.useState<ClientServiceScheduleListItem[]>(
    [],
  );
  const [atrasados, setAtrasados] = React.useState<ClientServiceScheduleListItem[]>(
    [],
  );
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSchedules = React.useCallback(async () => {
    if (permissionsLoading) {
      return;
    }

    if (!canRead) {
      setLoading(false);
      setError(null);
      setProximos([]);
      setAtrasados([]);
      return;
    }

    if (missingCompany) {
      setLoading(false);
      setError(null);
      setProximos([]);
      setAtrasados([]);
      return;
    }

    setLoading(true);
    setError(null);
    const companyId = selectedCompany?.id ?? null;

    const [proximosRes, atrasadosRes] = await Promise.all([
      listClientServiceSchedules({ companyId, filter: 'proximos' }),
      listClientServiceSchedules({ companyId, filter: 'atrasados' }),
    ]);

    if (!mountedRef.current) {
      return;
    }

    setLoading(false);

    if (!proximosRes.success || !atrasadosRes.success) {
      setError(
        getErrorDisplayMessage(
          proximosRes.success ? atrasadosRes : proximosRes,
          'No se pudieron cargar los recordatorios',
        ),
      );
      return;
    }

    setProximos(proximosRes.data ?? []);
    setAtrasados(atrasadosRes.data ?? []);
  }, [canRead, missingCompany, permissionsLoading, selectedCompany?.id]);

  React.useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const reload = React.useCallback(() => {
    void loadSchedules();
  }, [loadSchedules]);

  return {
    canRead,
    missingCompany,
    permissionsLoading,
    loading,
    error,
    proximos,
    atrasados,
    reload,
  };
};

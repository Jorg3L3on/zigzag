/**
 * @jest-environment jsdom
 */
import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDashboardUrgentSchedules } from '@/hooks/use-dashboard-urgent-schedules';

const listClientServiceSchedules = jest.fn();

jest.mock('@/actions/client-service-schedules', () => ({
  listClientServiceSchedules: (...args: unknown[]) =>
    listClientServiceSchedules(...args),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({
    selectedCompany: { id: 10, name: 'Acme', is_system: false },
  }),
}));

const permissionsState = {
  can: (permission?: string) => permission === 'tickets.read',
  isSystem: false,
  loading: false,
};

jest.mock('@/hooks/use-permissions', () => ({
  usePermissions: () => permissionsState,
}));

const strictWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(React.StrictMode, null, children);

describe('useDashboardUrgentSchedules', () => {
  beforeEach(() => {
    listClientServiceSchedules.mockReset();
    permissionsState.loading = false;
    permissionsState.isSystem = false;
    permissionsState.can = (permission?: string) =>
      permission === 'tickets.read';
  });

  it('clears loading after schedules resolve under Strict Mode remount', async () => {
    listClientServiceSchedules.mockResolvedValue({
      success: true,
      data: [],
    });

    const { result } = renderHook(() => useDashboardUrgentSchedules(), {
      wrapper: strictWrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.proximos).toEqual([]);
    expect(result.current.atrasados).toEqual([]);
  });

  it('loads proximos and atrasados for the selected company', async () => {
    const proximo = {
      id: 1,
      clientId: 2,
      clientName: 'Cliente',
      serviceId: 3,
      serviceName: 'Servicio',
      intervalValue: 30,
      intervalUnit: 'days' as const,
      lastServiceAt: null,
      nextDueAt: new Date().toISOString(),
      pausedAt: null,
      pauseReason: null,
      bucket: 'proximos' as const,
    };
    const atrasado = { ...proximo, id: 2, bucket: 'atrasados' as const };

    listClientServiceSchedules.mockImplementation(
      async ({ filter }: { filter?: string }) => {
        if (filter === 'proximos') {
          return { success: true, data: [proximo] };
        }
        return { success: true, data: [atrasado] };
      },
    );

    const { result } = renderHook(() => useDashboardUrgentSchedules());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.proximos).toEqual([proximo]);
    expect(result.current.atrasados).toEqual([atrasado]);
    expect(listClientServiceSchedules).toHaveBeenCalledWith({
      companyId: 10,
      filter: 'proximos',
    });
    expect(listClientServiceSchedules).toHaveBeenCalledWith({
      companyId: 10,
      filter: 'atrasados',
    });
  });

  it('surfaces an error and clears loading when a list call fails', async () => {
    listClientServiceSchedules.mockImplementation(
      async ({ filter }: { filter?: string }) => {
        if (filter === 'proximos') {
          return { success: true, data: [] };
        }
        return { success: false, error: 'Fallo de lectura' };
      },
    );

    const { result } = renderHook(() => useDashboardUrgentSchedules());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain('Fallo de lectura');
  });

  it('stops loading without fetching when the user cannot read schedules', async () => {
    permissionsState.can = () => false;

    const { result } = renderHook(() => useDashboardUrgentSchedules());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(listClientServiceSchedules).not.toHaveBeenCalled();
    expect(result.current.canRead).toBe(false);
  });

  it('reload retries after a failed load', async () => {
    listClientServiceSchedules
      .mockResolvedValueOnce({ success: false, error: 'Temporal' })
      .mockResolvedValueOnce({ success: false, error: 'Temporal' })
      .mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useDashboardUrgentSchedules());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toContain('Temporal');

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});

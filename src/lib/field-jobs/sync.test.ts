import { describe, expect, it, jest } from '@jest/globals';
import {
  createFieldJobStore,
  createMemoryFieldJobStoreAdapter,
} from '@/lib/field-jobs/store';
import { enqueueFieldJobCreate } from '@/lib/field-jobs/outbox';
import {
  countPendingFieldUploads,
  mergeTechnicianDayWithLocalJobs,
} from '@/lib/field-jobs/merge-day-queue';
import { flushFieldJobOutbox } from '@/lib/field-jobs/sync';
import type { TechnicianDayTicket } from '@/lib/technician-day-queue';

describe('field job merge + sync', () => {
  it('merges pending local jobs ahead of server day tickets', () => {
    const server: TechnicianDayTicket[] = [
      {
        id: '10',
        clientName: 'Servidor',
        clientTel: '5511111111',
        ticketDate: '2026-08-20T00:00:00.000Z',
        total: 100,
        paid: 0,
        finished: false,
        balanceDue: 100,
        paymentStatus: 'pending',
        isOverdue: false,
        servicesSummary: null,
      },
    ];

    const local = [
      {
        localJobId: 'local-1',
        companyId: 1,
        payload: {
          client_name: 'Local',
          client_tel: '5522222222',
          total: 50,
          paid: 0,
          finished: false,
        },
        syncStatus: 'pending' as const,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z',
      },
    ];

    const merged = mergeTechnicianDayWithLocalJobs(server, local);
    expect(merged[0]?.clientName).toBe('Local');
    expect(merged[0]?.pendingSync).toBe(true);
    expect(merged).toHaveLength(2);
    expect(countPendingFieldUploads(local)).toBe(1);
  });

  it('flushes create outbox via injected anotarCapture and marks synced', async () => {
    const store = createFieldJobStore(createMemoryFieldJobStoreAdapter());
    await enqueueFieldJobCreate(store, {
      companyId: 1,
      payload: {
        client_name: 'Ana',
        client_tel: '5512345678',
        work_notes: 'Cambio de filtro',
        total: 800,
        paid: 800,
      },
    });

    const anotarCapture = jest.fn(async () => ({
      success: true as const,
      data: { id: '555' },
    }));
    const updateTicket = jest.fn(async () => ({ success: true as const }));

    const result = await flushFieldJobOutbox(store, {
      companyId: 1,
      deps: { anotarCapture, updateTicket },
    });
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(anotarCapture).toHaveBeenCalled();

    const jobs = await store.listLocalJobsByCompany(1);
    expect(jobs[0]?.syncStatus).toBe('synced');
    expect(jobs[0]?.remoteTicketId).toBe('555');
    expect(await store.listOutboxEntries()).toHaveLength(0);
  });
});

import {
  coalesceOutboxEntry,
  enqueueFieldJobCreate,
  enqueueFieldJobUpdate,
} from '@/lib/field-jobs/outbox';
import {
  createFieldJobStore,
  createMemoryFieldJobStoreAdapter,
  mergeFieldJobPayload,
} from '@/lib/field-jobs/store';

describe('field job store', () => {
  it('merges payload patches while preserving unspecified service lines', () => {
    expect(
      mergeFieldJobPayload(
        {
          client_name: 'Cliente Alfa',
          services: [{ service_id: 1, quantity: 1, price: 100 }],
        },
        { client_tel: '5551234567' },
      ),
    ).toEqual({
      client_name: 'Cliente Alfa',
      client_tel: '5551234567',
      services: [{ service_id: 1, quantity: 1, price: 100 }],
    });
  });

  it('round-trips local jobs in the memory adapter', async () => {
    const store = createFieldJobStore(createMemoryFieldJobStoreAdapter());
    const saved = await store.saveLocalJob({
      companyId: 7,
      payload: { client_name: 'Cliente Alfa' },
    });

    expect(saved.localJobId).toEqual(expect.any(String));
    expect(saved.syncStatus).toBe('pending');

    const listed = await store.listLocalJobsByCompany(7);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.payload.client_name).toBe('Cliente Alfa');
  });
});

describe('field job outbox', () => {
  it('creates a pending create entry for new local jobs', async () => {
    const store = createFieldJobStore(createMemoryFieldJobStoreAdapter());
    const { job, outboxEntry } = await enqueueFieldJobCreate(store, {
      companyId: 3,
      payload: { client_name: 'Nuevo cliente' },
    });

    expect(job.syncStatus).toBe('pending');
    expect(outboxEntry.operation).toBe('create');
    expect(await store.listOutboxEntries()).toHaveLength(1);
  });

  it('coalesces multiple updates for the same local job into one outbox row', async () => {
    const store = createFieldJobStore(createMemoryFieldJobStoreAdapter());
    const created = await enqueueFieldJobCreate(store, {
      companyId: 3,
      payload: { client_name: 'Cliente' },
    });

    await store.updateSyncStatus(created.job.localJobId, 'uploading');
    await store.saveLocalJob({
      localJobId: created.job.localJobId,
      companyId: 3,
      payload: { client_name: 'Cliente' },
      syncStatus: 'uploading',
      remoteTicketId: '9001',
    });

    await enqueueFieldJobUpdate(store, {
      localJobId: created.job.localJobId,
      companyId: 3,
      payload: { client_tel: '5550000000' },
    });
    await enqueueFieldJobUpdate(store, {
      localJobId: created.job.localJobId,
      companyId: 3,
      payload: { email: 'campo@example.com' },
    });

    const outbox = await store.listOutboxEntries();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.operation).toBe('update');
    expect(outbox[0]?.payload).toEqual({
      client_name: 'Cliente',
      client_tel: '5550000000',
      email: 'campo@example.com',
    });
  });

  it('merges offline edits into a pending create instead of enqueueing an update', async () => {
    const store = createFieldJobStore(createMemoryFieldJobStoreAdapter());
    const created = await enqueueFieldJobCreate(store, {
      companyId: 5,
      payload: { client_name: 'Offline' },
    });

    await enqueueFieldJobUpdate(store, {
      localJobId: created.job.localJobId,
      companyId: 5,
      payload: { document: 'Falla en bomba' },
    });

    const outbox = await store.listOutboxEntries();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.operation).toBe('create');
    expect(outbox[0]?.payload).toEqual({
      client_name: 'Offline',
      document: 'Falla en bomba',
    });
  });

  it('builds a fresh outbox row when no existing entry is present', () => {
    const now = '2026-08-20T07:00:00.000Z';
    const entry = coalesceOutboxEntry(null, {
      localJobId: 'job-1',
      companyId: 1,
      operation: 'create',
      payload: { client_name: 'Nuevo' },
      now,
    });

    expect(entry.outboxId).toEqual(expect.any(String));
    expect(entry.createdAt).toBe(now);
    expect(entry.updatedAt).toBe(now);
  });
});

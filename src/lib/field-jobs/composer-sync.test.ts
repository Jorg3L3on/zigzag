import { describe, expect, it, jest } from '@jest/globals';
import {
  createFieldJobStore,
  createMemoryFieldJobStoreAdapter,
} from '@/lib/field-jobs/store';
import {
  discardLocalJob,
  enqueueComposerDocument,
  requeueLocalJob,
} from '@/lib/field-jobs/outbox';
import { mergeTechnicianDayWithLocalJobs } from '@/lib/field-jobs/merge-day-queue';
import { flushFieldJobOutbox, type FieldJobSyncDeps } from '@/lib/field-jobs/sync';
import type { ComposerDocumentPayload } from '@/lib/field-jobs/types';

const KEY = '7b0c7c3e-1f8a-4a51-9c39-2f4f0d6a1b11';

const ticketDocument = (
  overrides: Partial<ComposerDocumentPayload> = {},
): ComposerDocumentPayload => ({
  kind: 'ticket',
  client_request_id: KEY,
  client_id: 41,
  client_label: 'Cliente Prueba · 55 1234 5678',
  ticket_date: '2026-10-30T15:00:00.000Z',
  work_notes: 'Sin señal en el sótano',
  lines: [
    {
      key: 'l1',
      service_id: 7,
      service_name: 'Mantenimiento',
      quantity: 2,
      price: 500,
      materials: [
        {
          key: 'm1',
          material_id: 3,
          name: 'Gas',
          unit: 'kg',
          quantity: 1,
          price: 300,
          save_to_catalog: false,
        },
      ],
    },
    { key: 'l2', service_id: 8, service_name: 'Revisión', quantity: 1, price: 150 },
  ],
  ...overrides,
});

/**
 * A fake server keyed like the real one: the same client_request_id always
 * gives back the document it created first, and folios count up.
 */
const fakeServer = () => {
  const byKey = new Map<string, { id: string; folio: string }>();
  let nextNumber = 1;
  const created: Array<Record<string, unknown>> = [];
  const create = jest.fn(async (input: { client_request_id: string }) => {
    const existing = byKey.get(input.client_request_id);
    if (existing) return { success: true, data: { ...existing, replayed: true } };
    const doc = { id: String(900 + nextNumber), folio: `R-${String(nextNumber).padStart(4, '0')}` };
    nextNumber += 1;
    byKey.set(input.client_request_id, doc);
    created.push(input as Record<string, unknown>);
    return { success: true, data: { ...doc, replayed: false } };
  });
  return { create, created };
};

const depsWith = (create: FieldJobSyncDeps['createTicketWithLines']): FieldJobSyncDeps => ({
  anotarCapture: jest.fn(async () => ({ success: true, data: { id: 1 } })),
  updateTicket: jest.fn(async () => ({ success: true })),
  createTicketWithLines: create,
  createPresupuestoWithLines: create as FieldJobSyncDeps['createPresupuestoWithLines'],
});

const newStore = () => createFieldJobStore(createMemoryFieldJobStoreAdapter());

describe('composer documents saved offline (ZIG-I35-3)', () => {
  it('queues the whole document with its total, no folio and a pending status', async () => {
    const store = newStore();
    const { job, outboxEntry } = await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument(),
      clientName: 'Cliente Prueba',
      clientTel: '55 1234 5678',
    });
    expect(job).toMatchObject({
      localJobId: KEY,
      syncStatus: 'pending',
      remoteTicketId: null,
      remoteFolio: null,
    });
    expect(job.payload.total).toBe(1450);
    expect(job.payload.work_notes).toBe('Mantenimiento, Revisión');
    expect(outboxEntry.operation).toBe('create_document');
  });

  it('two edits before sync coalesce into one outbox entry with the last payload', async () => {
    const store = newStore();
    await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument(),
      clientName: 'Cliente Prueba',
    });
    await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument({ work_notes: 'Primera corrección' }),
      clientName: 'Cliente Prueba',
    });
    await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument({ lines: ticketDocument().lines.slice(1) }),
      clientName: 'Cliente Prueba',
    });
    const entries = await store.listOutboxEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].payload.composer?.lines).toHaveLength(1);
    expect((await store.getLocalJob(KEY))?.payload.total).toBe(150);
  });

  it('syncs once with the key, stores the real folio, and a lost response replays without a duplicate', async () => {
    const store = newStore();
    const server = fakeServer();
    await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument({ finish: { parcial: 400 } }),
      clientName: 'Cliente Prueba',
    });

    // The server saves it but the answer never arrives (signal drops).
    const lostAnswer = jest.fn(async (input: { client_request_id: string }) => {
      await server.create(input);
      throw new TypeError('Failed to fetch');
    });
    const first = await flushFieldJobOutbox(store, {
      companyId: 5,
      deps: depsWith(lostAnswer as FieldJobSyncDeps['createTicketWithLines']),
    });
    expect(first).toMatchObject({ deferred: 1, failed: 0, documents: [] });
    expect((await store.getLocalJob(KEY))?.syncStatus).toBe('pending');
    expect(await store.listOutboxEntries()).toHaveLength(1);

    const second = await flushFieldJobOutbox(store, {
      companyId: 5,
      deps: depsWith(server.create as FieldJobSyncDeps['createTicketWithLines']),
    });
    expect(second.documents).toEqual([
      { localJobId: KEY, kind: 'ticket', id: '901', folio: 'R-0001' },
    ]);
    expect(server.created).toHaveLength(1);
    expect(server.created[0]).toMatchObject({
      client_request_id: KEY,
      client_id: 41,
      finish: { parcial: 400 },
      lines: [
        { service_id: 7, quantity: 2, price: 500, materials: [expect.objectContaining({ material_id: 3 })] },
        { service_id: 8, quantity: 1, price: 150 },
      ],
    });
    expect(await store.getLocalJob(KEY)).toMatchObject({
      syncStatus: 'synced',
      remoteTicketId: '901',
      remoteFolio: 'R-0001',
    });
    expect(await store.listOutboxEntries()).toHaveLength(0);

    // Nothing left to send: a third flush does nothing.
    const third = await flushFieldJobOutbox(store, {
      companyId: 5,
      deps: depsWith(server.create as FieldJobSyncDeps['createTicketWithLines']),
    });
    expect(third.processed).toBe(0);
    expect(server.created).toHaveLength(1);
  });

  it('a refused document turns into Revisar with the reason, keeps its payload and waits for Reintentar', async () => {
    const store = newStore();
    await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument(),
      clientName: 'Cliente Prueba',
    });
    const refused = jest.fn(async () => ({
      success: false,
      error: 'Acceso denegado',
      errorType: 'auth',
    }));
    const result = await flushFieldJobOutbox(store, {
      companyId: 5,
      deps: depsWith(refused as FieldJobSyncDeps['createTicketWithLines']),
    });
    expect(result.failed).toBe(1);
    const job = await store.getLocalJob(KEY);
    expect(job?.syncStatus).toBe('error');
    expect(job?.syncError).toMatch(/servicio ya no está disponible/);
    expect(job?.payload.composer?.lines).toHaveLength(2);
    expect(await store.listOutboxEntries()).toHaveLength(1);

    // Revisar waits for the user: the next automatic flush leaves it alone.
    const again = await flushFieldJobOutbox(store, {
      companyId: 5,
      deps: depsWith(refused as FieldJobSyncDeps['createTicketWithLines']),
    });
    expect(again.processed).toBe(0);
    expect(refused).toHaveBeenCalledTimes(1);

    await requeueLocalJob(store, KEY);
    const server = fakeServer();
    const retried = await flushFieldJobOutbox(store, {
      companyId: 5,
      deps: depsWith(server.create as FieldJobSyncDeps['createTicketWithLines']),
    });
    expect(retried.documents).toHaveLength(1);
  });

  it('Descartar removes the local job and its outbox entry', async () => {
    const store = newStore();
    await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument(),
      clientName: 'Cliente Prueba',
    });
    await discardLocalJob(store, KEY);
    expect(await store.getLocalJob(KEY)).toBeNull();
    expect(await store.listOutboxEntries()).toHaveLength(0);
  });

  it('presupuestos replay with expires_at and stay off Hoy; tickets show there pending', async () => {
    const store = newStore();
    const server = fakeServer();
    const quoteKey = '0d7cf5e4-58a1-4c07-a3f6-7c6c0c2a9b22';
    await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument({
        kind: 'presupuesto',
        client_request_id: quoteKey,
        expires_at: '2026-11-15T12:00:00.000Z',
      }),
      clientName: 'Cliente Prueba',
    });
    await enqueueComposerDocument(store, {
      companyId: 5,
      document: ticketDocument(),
      clientName: 'Cliente Prueba',
    });

    const merged = mergeTechnicianDayWithLocalJobs([], await store.listLocalJobsByCompany(5));
    expect(merged.map((item) => item.localJobId)).toEqual([KEY]);
    expect(merged[0]).toMatchObject({ composerKind: 'ticket', pendingSync: true });

    await flushFieldJobOutbox(store, {
      companyId: 5,
      deps: depsWith(server.create as FieldJobSyncDeps['createTicketWithLines']),
    });
    const quoteCall = server.create.mock.calls.find(
      ([input]) => input.client_request_id === quoteKey,
    )?.[0] as Record<string, unknown>;
    expect(quoteCall.expires_at).toEqual(new Date('2026-11-15T12:00:00.000Z'));
    expect(quoteCall).not.toHaveProperty('finish');
  });

  it('only flushes the company it was asked for', async () => {
    const store = newStore();
    const server = fakeServer();
    await enqueueComposerDocument(store, {
      companyId: 6,
      document: ticketDocument(),
      clientName: 'Otra empresa',
    });
    const result = await flushFieldJobOutbox(store, {
      companyId: 5,
      deps: depsWith(server.create as FieldJobSyncDeps['createTicketWithLines']),
    });
    expect(result.processed).toBe(0);
    expect(server.create).not.toHaveBeenCalled();
  });
});

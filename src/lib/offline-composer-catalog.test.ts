const snapshots = new Map<string, { data: unknown; updatedAt: string }>();

jest.mock('@/lib/offline-snapshot', () => ({
  readOfflineSnapshot: jest.fn(async (resource: string, companyId: number) => {
    const hit = snapshots.get(`${resource}:${companyId}`);
    return hit ? { ...hit, schemaVersion: 2 } : null;
  }),
  writeOfflineSnapshot: jest.fn(async (resource: string, companyId: number, data: unknown) => {
    snapshots.set(`${resource}:${companyId}`, { data, updatedAt: new Date().toISOString() });
  }),
}));

import {
  filterComposerClients,
  readComposerClients,
  refreshComposerClients,
  rememberComposerClients,
} from '@/lib/offline-composer-catalog';

const clients = [
  { id: 1, name: 'José Pérez', phone: '55 1234 5678' },
  { id: 2, name: 'Ana López', phone: null },
  { id: 3, name: 'Refaccionaria Ñandú', phone: '(33) 4444-1111' },
];

describe('offline composer catalog (ZIG-I35-2)', () => {
  beforeEach(() => snapshots.clear());

  it('searches the copy by name without accents or by phone digits', () => {
    expect(filterComposerClients(clients, 'jose').map((c) => c.id)).toEqual([1]);
    expect(filterComposerClients(clients, 'nandu').map((c) => c.id)).toEqual([3]);
    expect(filterComposerClients(clients, '4444').map((c) => c.id)).toEqual([3]);
    expect(filterComposerClients(clients, '')).toHaveLength(3);
  });

  it('keeps clients per company and remembers the ones just seen first', async () => {
    await rememberComposerClients(7, [clients[0], clients[1]]);
    await rememberComposerClients(7, [{ ...clients[1], phone: '55 0000 0000' }]);
    await rememberComposerClients(8, [clients[2]]);
    const seven = await readComposerClients(7);
    expect(seven?.clients.map((c) => c.id)).toEqual([2, 1]);
    expect(seven?.clients[0].phone).toBe('55 0000 0000');
    expect((await readComposerClients(8))?.clients.map((c) => c.id)).toEqual([3]);
  });

  it('a full refresh pages through the clients and replaces the copy, at most every few hours', async () => {
    await rememberComposerClients(7, [{ id: 99, name: 'Borrado', phone: null }]);
    snapshots.get('composer-clients:7')!.updatedAt = '2000-01-01T00:00:00.000Z';
    const loadPage = jest.fn(async (page: number) => ({
      success: true,
      data: { items: page === 1 ? clients.slice(0, 2) : clients.slice(2), totalPages: 2 },
    }));
    expect(await refreshComposerClients(7, loadPage)).toBe(true);
    expect(loadPage).toHaveBeenCalledTimes(2);
    expect((await readComposerClients(7))?.clients.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(await refreshComposerClients(7, loadPage)).toBe(false);
  });
});

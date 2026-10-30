'use client';

/**
 * What the composer needs with no signal (ZIG-I35-2): the company's catalog
 * services with their default materials, and its clients (id, name, phone
 * only). Written whenever the composer loads them online, read when it is
 * offline or a load fails. Per company; wiped on logout with the other
 * snapshots.
 */
import type { ServiceWithMaterials } from '@/actions/services';
import { readOfflineSnapshot, writeOfflineSnapshot } from '@/lib/offline-snapshot';

export type ComposerClientOption = { id: number; name: string; phone: string | null };

/** Enough for any company we serve; the newest win when it is cut. */
export const COMPOSER_CLIENTS_SNAPSHOT_MAX = 2000;
const CLIENT_RESULTS_MAX = 50;
/** A full client refresh runs at most this often. */
export const COMPOSER_CLIENTS_REFRESH_MS = 6 * 60 * 60 * 1000;

const warn = (what: string) => (error: unknown) => {
  // No IndexedDB (private mode, old browser, tests): the composer works online only.
  if (error instanceof Error && error.message === 'IndexedDB is not available') return;
  console.warn(`Unable to write ${what} offline snapshot:`, error);
};

export const saveComposerServices = (
  companyId: number,
  services: ServiceWithMaterials[],
): void => {
  void writeOfflineSnapshot('composer-services', companyId, services).catch(warn('services'));
};

export const readComposerServices = async (
  companyId: number,
): Promise<ServiceWithMaterials[] | null> => {
  try {
    return (await readOfflineSnapshot<ServiceWithMaterials[]>('composer-services', companyId))
      ?.data ?? null;
  } catch {
    return null;
  }
};

const toOption = (item: ComposerClientOption): ComposerClientOption => ({
  id: item.id,
  name: item.name,
  phone: item.phone ?? null,
});

export const readComposerClients = async (
  companyId: number,
): Promise<{ clients: ComposerClientOption[]; updatedAt: string } | null> => {
  try {
    const snapshot = await readOfflineSnapshot<ComposerClientOption[]>(
      'composer-clients',
      companyId,
    );
    return snapshot ? { clients: snapshot.data, updatedAt: snapshot.updatedAt } : null;
  } catch {
    return null;
  }
};

/** Replace the client snapshot (a full refresh drops deleted clients). */
export const replaceComposerClients = (
  companyId: number,
  clients: ComposerClientOption[],
): Promise<unknown> =>
  writeOfflineSnapshot(
    'composer-clients',
    companyId,
    clients.slice(0, COMPOSER_CLIENTS_SNAPSHOT_MAX).map(toOption),
  ).catch(warn('clients'));

/** Add clients the composer just saw (a search, a new client) to the snapshot. */
export const rememberComposerClients = async (
  companyId: number,
  seen: ComposerClientOption[],
): Promise<void> => {
  if (seen.length === 0) return;
  const current = (await readComposerClients(companyId))?.clients ?? [];
  const byId = new Map(current.map((item) => [item.id, item]));
  seen.forEach((item) => byId.set(item.id, toOption(item)));
  const fresh = new Set(seen.map((item) => item.id));
  // Just seen first, so a cut never drops them.
  const merged = [
    ...seen.map(toOption),
    ...Array.from(byId.values()).filter((item) => !fresh.has(item.id)),
  ];
  await replaceComposerClients(companyId, merged);
};

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Offline client search: name (accents ignored) or phone digits. */
export const filterComposerClients = (
  clients: ComposerClientOption[],
  query: string,
): ComposerClientOption[] => {
  const text = normalize(query);
  const digits = query.replace(/\D/g, '');
  const matches = !text
    ? clients
    : clients.filter(
        (item) =>
          normalize(item.name).includes(text) ||
          (digits.length >= 3 && (item.phone ?? '').replace(/\D/g, '').includes(digits)),
      );
  return matches.slice(0, CLIENT_RESULTS_MAX);
};

type ClientsPage = {
  success: boolean;
  data?: { items: ComposerClientOption[]; totalPages: number };
};

/**
 * Pull the company's clients (newest first, up to the cap) into the snapshot,
 * at most every few hours. Online only; failures leave the old snapshot.
 */
export const refreshComposerClients = async (
  companyId: number,
  loadPage: (page: number) => Promise<ClientsPage>,
  now = Date.now(),
): Promise<boolean> => {
  const current = await readComposerClients(companyId);
  if (current && now - Date.parse(current.updatedAt) < COMPOSER_CLIENTS_REFRESH_MS) {
    return false;
  }
  const pageSize = 100;
  const all: ComposerClientOption[] = [];
  for (let page = 1; page <= COMPOSER_CLIENTS_SNAPSHOT_MAX / pageSize; page += 1) {
    const result = await loadPage(page);
    if (!result.success || !result.data) return false;
    all.push(...result.data.items);
    if (page >= result.data.totalPages) break;
  }
  await replaceComposerClients(companyId, all);
  return true;
};

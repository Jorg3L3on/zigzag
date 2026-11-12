import { deleteFieldJobDatabase } from '@/lib/field-jobs/idb';
import { deleteOfflineSnapshotDatabase } from '@/lib/offline-snapshot';
import { clearComposerPageCaches } from '@/lib/offline-composer-cache';

/**
 * Best-effort wipe of everything kept on the phone for offline work before
 * ending the session: the field-job queue, the offline snapshots (clients,
 * services, tickets) and the service worker's cached pages (ZIG-I35). A shared
 * phone keeps nothing of the last user. Failures must not block logout.
 */
export const clearFieldJobsOnLogout = async (): Promise<void> => {
  await Promise.all([
    deleteFieldJobDatabase().catch(() => undefined),
    deleteOfflineSnapshotDatabase().catch(() => undefined),
    clearComposerPageCaches().catch(() => undefined),
  ]);
};

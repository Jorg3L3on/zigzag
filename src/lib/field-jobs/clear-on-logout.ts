import { deleteFieldJobDatabase } from '@/lib/field-jobs/idb';

/**
 * Best-effort wipe of offline field jobs before ending the session.
 * Failures must not block logout.
 */
export const clearFieldJobsOnLogout = async (): Promise<void> => {
  try {
    await deleteFieldJobDatabase();
  } catch {
    // Ignore — logout must proceed even if IndexedDB clear fails.
  }
};

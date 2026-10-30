'use client';

/**
 * Ask the browser not to evict this origin's storage under pressure (ZIG-I35).
 * A document saved offline lives only in IndexedDB until it syncs. Chrome and
 * Safari grant or deny on their own heuristics (an installed PWA usually gets
 * it); nothing is shown to the user either way.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage?.persist) return false;
    if (await storage.persisted?.()) return true;
    return await storage.persist();
  } catch {
    return false;
  }
};

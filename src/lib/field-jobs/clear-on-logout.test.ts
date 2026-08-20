/**
 * @jest-environment jsdom
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { FIELD_JOB_DB_NAME } from '@/lib/field-jobs/types';
import { clearFieldJobsOnLogout } from '@/lib/field-jobs/clear-on-logout';
import { deleteFieldJobDatabase } from '@/lib/field-jobs/idb';

describe('clearFieldJobsOnLogout', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('deletes the field jobs IndexedDB database', async () => {
    const deleteDatabase = jest.fn(() => {
      const request = {
        result: undefined,
        error: null,
        onsuccess: null as ((ev: Event) => void) | null,
        onerror: null as ((ev: Event) => void) | null,
        onblocked: null as ((ev: Event) => void) | null,
      };
      queueMicrotask(() => {
        request.onsuccess?.(new Event('success'));
      });
      return request;
    });

    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: { deleteDatabase },
    });

    await clearFieldJobsOnLogout();
    expect(deleteDatabase).toHaveBeenCalledWith(FIELD_JOB_DB_NAME);
  });

  it('swallows delete failures so logout is not blocked', async () => {
    jest.spyOn({ deleteFieldJobDatabase }, 'deleteFieldJobDatabase');
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: () => {
          throw new Error('boom');
        },
      },
    });

    await expect(clearFieldJobsOnLogout()).resolves.toBeUndefined();
  });
});

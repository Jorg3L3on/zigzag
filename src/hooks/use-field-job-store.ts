'use client';

import * as React from 'react';

import {
  enqueueFieldJobCreate,
  enqueueFieldJobUpdate,
  fieldJobStore,
  type FieldJobPayload,
  type LocalJob,
} from '@/lib/field-jobs';

export type UseFieldJobStoreState = {
  loading: boolean;
  error: string | null;
  jobs: LocalJob[];
  reload: () => void;
  putCreate: (payload: FieldJobPayload) => Promise<LocalJob | null>;
  putUpdate: (
    localJobId: string,
    payload: FieldJobPayload,
  ) => Promise<LocalJob | null>;
};

type LoadSignal = {
  cancelled: boolean;
};

export const useFieldJobStore = (
  companyId: number | null | undefined,
  enabled = true,
): UseFieldJobStoreState => {
  const [loading, setLoading] = React.useState(Boolean(enabled && companyId));
  const [error, setError] = React.useState<string | null>(null);
  const [jobs, setJobs] = React.useState<LocalJob[]>([]);

  const loadJobs = React.useCallback(
    async (signal?: LoadSignal) => {
      if (!enabled || companyId == null) {
        if (signal?.cancelled) {
          return;
        }
        setLoading(false);
        setError(null);
        setJobs([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const nextJobs = await fieldJobStore.listLocalJobsByCompany(companyId);
        if (signal?.cancelled) {
          return;
        }
        setJobs(nextJobs);
      } catch (loadError) {
        if (signal?.cancelled) {
          return;
        }
        setJobs([]);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'No se pudieron cargar los trabajos locales',
        );
      } finally {
        if (!signal?.cancelled) {
          setLoading(false);
        }
      }
    },
    [companyId, enabled],
  );

  React.useEffect(() => {
    const signal: LoadSignal = { cancelled: false };
    void loadJobs(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [loadJobs]);

  const putCreate = React.useCallback(
    async (payload: FieldJobPayload): Promise<LocalJob | null> => {
      if (companyId == null) {
        return null;
      }

      const { job } = await enqueueFieldJobCreate(fieldJobStore, {
        companyId,
        payload,
      });
      await loadJobs();
      return job;
    },
    [companyId, loadJobs],
  );

  const putUpdate = React.useCallback(
    async (
      localJobId: string,
      payload: FieldJobPayload,
    ): Promise<LocalJob | null> => {
      if (companyId == null) {
        return null;
      }

      const { job } = await enqueueFieldJobUpdate(fieldJobStore, {
        localJobId,
        companyId,
        payload,
      });
      await loadJobs();
      return job;
    },
    [companyId, loadJobs],
  );

  return {
    loading,
    error,
    jobs,
    reload: () => {
      void loadJobs();
    },
    putCreate,
    putUpdate,
  };
};

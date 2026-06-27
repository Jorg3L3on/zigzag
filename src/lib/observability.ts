import * as Sentry from '@sentry/nextjs';
import { logger, type LogMeta } from '@/lib/logger';

let initialized = false;

const resolveDsn = (): string | undefined =>
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

/**
 * Initialize Sentry. Safe to call multiple times. When no DSN is configured
 * Sentry is disabled and the app falls back to structured console logging only.
 */
export const initObservability = (): void => {
  if (initialized) {
    return;
  }
  initialized = true;

  const dsn = resolveDsn();
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    environment: process.env.NODE_ENV,
  });
};

/**
 * Report an unexpected error to Sentry (when configured) and always emit a
 * structured error log. Returns a correlation id when one is supplied in meta.
 */
export const captureException = (error: unknown, meta?: LogMeta): void => {
  try {
    Sentry.captureException(error, meta ? { extra: meta } : undefined);
  } catch {
    // Never let observability throw into the request path.
  }
  logger.error(
    error instanceof Error ? error.message : 'Unhandled error',
    { ...meta, error },
  );
};

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

/** Threshold (ms) above which a span is logged as a slow operation. */
const SLOW_SPAN_MS = 500;

/**
 * Trace an async operation: opens a Sentry span (OpenTelemetry-compatible) when
 * configured, measures wall-clock duration, and logs slow operations. Errors
 * are reported and re-thrown so callers keep their existing control flow.
 *
 * Use to instrument hot paths such as dashboard aggregation or export jobs:
 *   const data = await withSpan('dashboard.load', () => loadMetrics(id));
 */
export const withSpan = async <T>(
  name: string,
  operation: () => Promise<T>,
  meta?: LogMeta,
): Promise<T> => {
  const start = Date.now();
  try {
    return await Sentry.startSpan({ name, op: 'function' }, () => operation());
  } catch (error) {
    captureException(error, { span: name, ...meta });
    throw error;
  } finally {
    const durationMs = Date.now() - start;
    if (durationMs >= SLOW_SPAN_MS) {
      logger.warn('Slow operation', { span: name, durationMs, ...meta });
    }
  }
};

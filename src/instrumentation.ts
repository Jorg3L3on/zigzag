/**
 * Next.js instrumentation hook. Initializes server-side observability (Sentry)
 * once per runtime. No-op when SENTRY_DSN is not configured.
 */
export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' ||
    process.env.NEXT_RUNTIME === 'edge'
  ) {
    const { initObservability } = await import('@/lib/observability');
    initObservability();
  }
}

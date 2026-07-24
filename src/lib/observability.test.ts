/**
 * @jest-environment node
 */
import * as Sentry from '@sentry/nextjs';
import { captureException } from '@/lib/observability';
import { runWithRequestId } from '@/lib/request-context';

jest.mock('@sentry/nextjs', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  withScope: jest.fn((cb: (scope: { setTag: jest.Mock; setContext: jest.Mock }) => void) => {
    cb({ setTag: jest.fn(), setContext: jest.fn() });
  }),
  startSpan: jest.fn((_opts: unknown, fn: () => unknown) => fn()),
}));

describe('captureException request correlation', () => {
  it('includes requestId from ALS in Sentry extra and logs', () => {
    const logSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const scope = { setTag: jest.fn(), setContext: jest.fn() };
    (Sentry.withScope as jest.Mock).mockImplementationOnce(
      (cb: (s: typeof scope) => void) => cb(scope),
    );

    runWithRequestId('req-sentry-0001', () => {
      captureException(new Error('boom'), { route: '/api/health' });
    });

    expect(scope.setTag).toHaveBeenCalledWith('requestId', 'req-sentry-0001');
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({
          requestId: 'req-sentry-0001',
          route: '/api/health',
        }),
      }),
    );

    const payload = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(payload.requestId).toBe('req-sentry-0001');
    logSpy.mockRestore();
  });
});

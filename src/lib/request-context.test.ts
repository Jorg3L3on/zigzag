/**
 * @jest-environment node
 */
import {
  REQUEST_ID_HEADER,
  bindRequestId,
  correlationId,
  getRequestId,
  normalizeRequestId,
  resolveRequestId,
  runWithRequestId,
  runWithRequestIdAsync,
} from '@/lib/request-context';
import { logger } from '@/lib/logger';

describe('request-context', () => {
  it('generates unique correlation ids', () => {
    expect(correlationId()).not.toBe(correlationId());
  });

  it('normalizes valid ids and rejects junk', () => {
    expect(normalizeRequestId('  abcdefgh  ')).toBe('abcdefgh');
    expect(normalizeRequestId('short')).toBeNull();
    expect(normalizeRequestId('bad id with spaces!!!')).toBeNull();
    expect(normalizeRequestId('a'.repeat(200))).toBeNull();
  });

  it('resolveRequestId keeps valid incoming values', () => {
    expect(resolveRequestId('client-ray-12345')).toBe('client-ray-12345');
    expect(resolveRequestId('nope')).toMatch(/./);
  });

  it('exposes requestId inside runWithRequestId', () => {
    expect(getRequestId()).toBeUndefined();
    runWithRequestId('req-test-0001', () => {
      expect(getRequestId()).toBe('req-test-0001');
    });
    expect(getRequestId()).toBeUndefined();
  });

  it('supports async ALS propagation', async () => {
    await runWithRequestIdAsync('req-async-0001', async () => {
      await Promise.resolve();
      expect(getRequestId()).toBe('req-async-0001');
    });
  });

  it('bindRequestId enters the current async context', () => {
    bindRequestId('req-bound-0001');
    expect(getRequestId()).toBe('req-bound-0001');
  });

  it('logger auto-attaches requestId from context', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    runWithRequestId('req-log-0001', () => {
      logger.info('correlated');
    });
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.requestId).toBe('req-log-0001');
    expect(payload.message).toBe('correlated');
    spy.mockRestore();
  });

  it('logger does not override explicit requestId meta', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    runWithRequestId('req-context', () => {
      logger.info('explicit', { requestId: 'req-explicit' });
    });
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.requestId).toBe('req-explicit');
    spy.mockRestore();
  });

  it('exports the canonical header name', () => {
    expect(REQUEST_ID_HEADER).toBe('x-request-id');
  });
});

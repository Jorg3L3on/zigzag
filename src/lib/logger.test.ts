import { correlationId, logger } from '@/lib/logger';

describe('logger', () => {
  it('generates unique correlation ids', () => {
    const a = correlationId();
    const b = correlationId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('emits structured JSON with level and message', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('hello', { requestId: 'abc', count: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({
      level: 'info',
      message: 'hello',
      requestId: 'abc',
      count: 2,
    });
    expect(typeof payload.time).toBe('string');
    spy.mockRestore();
  });

  it('serializes Error meta safely', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('boom', { error: new Error('kaboom') });
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.error.message).toBe('kaboom');
    spy.mockRestore();
  });
});

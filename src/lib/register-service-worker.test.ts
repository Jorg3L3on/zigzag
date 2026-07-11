import {
  SERWIST_SCOPE,
  SERWIST_SW_URL,
  shouldRegisterServiceWorker,
} from '@/lib/register-service-worker';

describe('shouldRegisterServiceWorker', () => {
  it('registers only in production', () => {
    expect(shouldRegisterServiceWorker({ nodeEnv: 'production' })).toBe(true);
    expect(shouldRegisterServiceWorker({ nodeEnv: 'development' })).toBe(false);
    expect(shouldRegisterServiceWorker({ nodeEnv: 'test' })).toBe(false);
    expect(shouldRegisterServiceWorker({ nodeEnv: undefined })).toBe(false);
  });

  it('exposes same-origin SW URL and root scope', () => {
    expect(SERWIST_SW_URL).toBe('/serwist/sw.js');
    expect(SERWIST_SCOPE).toBe('/');
    expect(SERWIST_SW_URL.startsWith('/')).toBe(true);
  });
});

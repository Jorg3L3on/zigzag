import { getPushSupport, isIosDevice, urlBase64ToUint8Array } from '@/lib/push-client';

jest.mock('@/actions/push-subscriptions', () => ({
  savePushSubscription: jest.fn(),
  removePushSubscription: jest.fn(),
}));

describe('push-client (ZIG-I20-2)', () => {
  const base = {
    hasServiceWorker: true,
    hasPushManager: true,
    hasNotification: true,
    permission: 'default' as NotificationPermission,
    isIos: false,
    isStandalone: false,
  };

  it('detects iPhone, iPad and iPadOS pretending to be a Mac', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(false);
  });

  it('asks iOS users to add the app to the home screen before offering push', () => {
    expect(getPushSupport({ ...base, isIos: true })).toBe('ios-needs-install');
    expect(getPushSupport({ ...base, isIos: true, isStandalone: true })).toBe('ready');
  });

  it('reports unsupported browsers and denied permission', () => {
    expect(getPushSupport({ ...base, hasPushManager: false })).toBe('unsupported');
    expect(getPushSupport({ ...base, permission: 'denied' })).toBe('denied');
    expect(getPushSupport(base)).toBe('ready');
  });

  it('decodes the URL-safe base64 VAPID key', () => {
    const bytes = urlBase64ToUint8Array('AQID_-8');
    expect(Array.from(bytes)).toEqual([1, 2, 3, 255, 239]);
  });
});

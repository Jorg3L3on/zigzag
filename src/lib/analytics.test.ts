import { captureServerEvent, isFeatureEnabled } from '@/lib/analytics';

describe('analytics (PostHog) without configuration', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('captureServerEvent is a no-op when unconfigured', async () => {
    await expect(
      captureServerEvent('user-1', 'test_event', { foo: 'bar' }),
    ).resolves.toBeUndefined();
  });

  it('isFeatureEnabled returns the default when unconfigured', async () => {
    await expect(isFeatureEnabled('new-thing', 'user-1')).resolves.toBe(false);
    await expect(isFeatureEnabled('new-thing', 'user-1', true)).resolves.toBe(
      true,
    );
  });
});

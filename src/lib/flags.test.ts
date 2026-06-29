import { isFlagEnabled } from '@/lib/flags';

describe('feature flags', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('honors an env override of true', async () => {
    process.env.FLAG_NEW_DASHBOARD = 'true';
    await expect(isFlagEnabled('new-dashboard', 'user-1')).resolves.toBe(true);
  });

  it('honors an env override of false even when default is true', async () => {
    process.env.FLAG_NEW_DASHBOARD = 'false';
    await expect(isFlagEnabled('new-dashboard', 'user-1', true)).resolves.toBe(
      false,
    );
  });

  it('falls back to the default when no override and PostHog is unconfigured', async () => {
    delete process.env.FLAG_NEW_DASHBOARD;
    delete process.env.POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    await expect(isFlagEnabled('new-dashboard', 'user-1')).resolves.toBe(false);
    await expect(
      isFlagEnabled('new-dashboard', 'user-1', true),
    ).resolves.toBe(true);
  });
});

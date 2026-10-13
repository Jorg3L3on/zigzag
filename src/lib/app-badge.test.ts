import { supportsAppBadge, syncAppBadge } from '@/lib/app-badge';

type BadgeNavigator = Navigator & {
  setAppBadge?: jest.Mock;
  clearAppBadge?: jest.Mock;
};

const nav = navigator as BadgeNavigator;

describe('app badge (ZIG-I21-3)', () => {
  afterEach(() => {
    delete nav.setAppBadge;
    delete nav.clearAppBadge;
  });

  it('is skipped where the Badging API is missing (desktop Firefox, old Safari)', async () => {
    expect(supportsAppBadge()).toBe(false);
    await expect(syncAppBadge(3)).resolves.toBeUndefined();
  });

  it('shows the unread count and clears it at zero', async () => {
    nav.setAppBadge = jest.fn().mockResolvedValue(undefined);
    nav.clearAppBadge = jest.fn().mockResolvedValue(undefined);
    expect(supportsAppBadge()).toBe(true);

    await syncAppBadge(4);
    expect(nav.setAppBadge).toHaveBeenCalledWith(4);

    await syncAppBadge(0);
    expect(nav.clearAppBadge).toHaveBeenCalledTimes(1);
  });

  it('never throws when the platform refuses', async () => {
    nav.setAppBadge = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
    nav.clearAppBadge = jest.fn();
    await expect(syncAppBadge(2)).resolves.toBeUndefined();
  });
});

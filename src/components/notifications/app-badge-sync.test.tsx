import { act, render } from '@testing-library/react';

import { AppBadgeSync } from '@/components/notifications/app-badge-sync';

jest.mock('@/actions/notifications', () => ({
  getUnreadNotificationCount: jest.fn(),
  getNotifications: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));

let standalone = true;
jest.mock('@/hooks/use-display-mode-standalone', () => ({
  useDisplayModeStandalone: () => standalone,
}));

const { getUnreadNotificationCount } = jest.requireMock<{
  getUnreadNotificationCount: jest.Mock;
}>('@/actions/notifications');

type BadgeNavigator = Navigator & { setAppBadge?: jest.Mock; clearAppBadge?: jest.Mock };
const nav = navigator as BadgeNavigator;

const flush = () => act(async () => {});

describe('AppBadgeSync (ZIG-I21-3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    standalone = true;
    nav.setAppBadge = jest.fn().mockResolvedValue(undefined);
    nav.clearAppBadge = jest.fn().mockResolvedValue(undefined);
    getUnreadNotificationCount.mockResolvedValue({ success: true, data: 3 });
  });

  afterEach(() => {
    delete nav.setAppBadge;
    delete nav.clearAppBadge;
  });

  it('puts the unread count on the installed app icon', async () => {
    render(<AppBadgeSync />);
    await flush();
    expect(nav.setAppBadge).toHaveBeenCalledWith(3);
  });

  it('refreshes on focus and clears the badge once everything is read', async () => {
    render(<AppBadgeSync />);
    await flush();

    getUnreadNotificationCount.mockResolvedValue({ success: true, data: 0 });
    await act(async () => {
      window.dispatchEvent(new Event('zigzag:notifications-changed'));
    });
    expect(nav.clearAppBadge).toHaveBeenCalledTimes(1);

    getUnreadNotificationCount.mockResolvedValue({ success: true, data: 5 });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(nav.setAppBadge).toHaveBeenLastCalledWith(5);
  });

  it('makes no requests in a browser tab or without the Badging API', async () => {
    standalone = false;
    const { unmount } = render(<AppBadgeSync />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    unmount();

    standalone = true;
    delete nav.setAppBadge;
    delete nav.clearAppBadge;
    render(<AppBadgeSync />);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(getUnreadNotificationCount).not.toHaveBeenCalled();
  });
});

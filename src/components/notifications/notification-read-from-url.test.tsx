import { act, render } from '@testing-library/react';

import { NotificationReadFromUrl } from '@/components/notifications/notification-read-from-url';

jest.mock('next/navigation', () => ({ usePathname: () => window.location.pathname }));
jest.mock('@/actions/notifications', () => ({ markNotificationRead: jest.fn() }));

const { markNotificationRead } = jest.requireMock<{ markNotificationRead: jest.Mock }>(
  '@/actions/notifications',
);

const flush = () => act(async () => {});

describe('NotificationReadFromUrl (ZIG-I21-2)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    markNotificationRead.mockResolvedValue({ success: true });
  });

  it('marks the notification from ?notification= read and drops the parameter', async () => {
    window.history.replaceState(null, '', '/tickets/create?clientId=7&serviceId=9&notification=42');
    const changed = jest.fn();
    window.addEventListener('zigzag:notifications-changed', changed);

    render(<NotificationReadFromUrl />);
    await flush();

    expect(markNotificationRead).toHaveBeenCalledWith(42);
    expect(window.location.pathname + window.location.search).toBe(
      '/tickets/create?clientId=7&serviceId=9',
    );
    expect(changed).toHaveBeenCalledTimes(1);
    window.removeEventListener('zigzag:notifications-changed', changed);
  });

  it('does nothing without the parameter', async () => {
    window.history.replaceState(null, '', '/service-schedules?filter=atrasados');
    render(<NotificationReadFromUrl />);
    await flush();
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?filter=atrasados');
  });

  it('ignores an id that is not a positive integer but still cleans the URL', async () => {
    window.history.replaceState(null, '', '/company?notification=abc');
    render(<NotificationReadFromUrl />);
    await flush();
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
  });
});

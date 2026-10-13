import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  NotificationBell,
  POLL_INTERVAL_MS,
} from '@/components/notifications/notification-bell';
import type { NotificationRow } from '@/db/schema';

jest.mock('@/actions/notifications', () => ({
  getNotifications: jest.fn(),
  getUnreadNotificationCount: jest.fn(),
  markAllNotificationsRead: jest.fn(),
  markNotificationRead: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

const notificationActions = jest.requireMock<{
  getNotifications: jest.Mock;
  getUnreadNotificationCount: jest.Mock;
  markAllNotificationsRead: jest.Mock;
  markNotificationRead: jest.Mock;
}>('@/actions/notifications');

const mockToast = jest.requireMock<{
  toast: { error: jest.Mock };
}>('sonner').toast;

const unreadNotification: NotificationRow = {
  id: 1,
  company_id: 7,
  user_id: null,
  type: 'ticket',
  title: 'Factura lista',
  body: 'El PDF del ticket esta listo.',
  resource_type: null,
  resource_id: null,
  dedupe_key: null,
  read_at: null,
  created_at: new Date('2026-08-10T00:00:00.000Z'),
};

describe('NotificationBell optimistic updates', () => {
  beforeEach(() => {
    notificationActions.getUnreadNotificationCount.mockResolvedValue({
      success: true,
      data: 1,
    });
    notificationActions.getNotifications.mockResolvedValue({
      success: true,
      data: [unreadNotification],
    });
    notificationActions.markNotificationRead.mockResolvedValue({
      success: false,
      error: 'No se pudo marcar la notificación como leída.',
      errorCode: 'GN001',
      errorTitle: 'Error del servidor',
      errorType: 'server',
    });
    notificationActions.markAllNotificationsRead.mockResolvedValue({
      success: true,
    });
    mockToast.error.mockClear();
  });

  it('rolls back mark-read when the server action fails', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);

    const trigger = await screen.findByLabelText(
      'Notificaciones (1 sin leer)',
    );
    await user.click(trigger);

    const item = await screen.findByRole('button', {
      name: /Factura lista/i,
    });
    await user.click(item);

    await waitFor(() => {
      expect(notificationActions.markNotificationRead).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error del servidor', {
        description: expect.stringContaining(
          'No se pudo marcar la notificación como leída.',
        ),
      });
    });

    expect(
      screen.getByLabelText('Notificaciones (1 sin leer)'),
    ).toBeInTheDocument();
  });
});

describe('NotificationBell refresh (ZIG-I20-3)', () => {
  const setVisibility = (state: 'visible' | 'hidden') => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    notificationActions.getUnreadNotificationCount.mockReset();
    notificationActions.getUnreadNotificationCount.mockResolvedValue({
      success: true,
      data: 0,
    });
    notificationActions.getNotifications.mockResolvedValue({
      success: true,
      data: [],
    });
  });

  afterEach(() => {
    setVisibility('visible');
    jest.useRealTimers();
  });

  it('never opens a live stream', () => {
    const eventSource = jest.fn();
    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: eventSource,
    });
    render(<NotificationBell />);
    expect(eventSource).not.toHaveBeenCalled();
  });

  it('refreshes on focus and on a visible-tab poll, never in the background', async () => {
    setVisibility('visible');
    render(<NotificationBell />);
    expect(notificationActions.getUnreadNotificationCount).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(notificationActions.getUnreadNotificationCount).toHaveBeenCalledTimes(2);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(notificationActions.getUnreadNotificationCount).toHaveBeenCalledTimes(3);

    await act(async () => {
      setVisibility('hidden');
      jest.advanceTimersByTime(POLL_INTERVAL_MS * 5);
    });
    expect(notificationActions.getUnreadNotificationCount).toHaveBeenCalledTimes(3);

    await act(async () => {
      setVisibility('visible');
    });
    expect(notificationActions.getUnreadNotificationCount).toHaveBeenCalledTimes(4);

    await act(async () => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(notificationActions.getUnreadNotificationCount).toHaveBeenCalledTimes(5);
  });
});

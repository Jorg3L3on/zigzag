import { act, render, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';

import { toast } from 'sonner';
import { SessionKeepAlive } from '@/components/session-keep-alive';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: { warning: jest.fn(), dismiss: jest.fn() },
}));

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

const setVisibility = (visibilityState: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState,
  });
};

const dispatchVisibilityChange = async (
  visibilityState: DocumentVisibilityState,
) => {
  setVisibility(visibilityState);
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

const authenticatedSession = (expires: string, update: jest.Mock) =>
  ({
    data: {
      expires,
      user: {
        id: '1',
        email: 'agent@example.com',
        name: 'Agent',
        company_id: 1,
        company_name: 'ZigZag',
        company_is_system: false,
        token_version: 0,
      },
    },
    status: 'authenticated',
    update,
  }) as unknown as ReturnType<typeof useSession>;

describe('SessionKeepAlive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setVisibility('hidden');
  });

  it('refreshes once when a visible document has a near-expiry session', async () => {
    const update = jest.fn().mockResolvedValue(null);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    mockUseSession.mockReturnValue(authenticatedSession(expires, update));

    render(<SessionKeepAlive />);

    await dispatchVisibilityChange('visible');

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
  });

  it('does not refresh when the session is outside the near-expiry window', async () => {
    const update = jest.fn().mockResolvedValue(null);
    const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    mockUseSession.mockReturnValue(authenticatedSession(expires, update));

    render(<SessionKeepAlive />);

    await dispatchVisibilityChange('visible');

    expect(update).not.toHaveBeenCalled();
  });

  it('does not spam refresh attempts after a failed update', async () => {
    const update = jest.fn().mockRejectedValue(new Error('network down'));
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    mockUseSession.mockReturnValue(authenticatedSession(expires, update));

    render(<SessionKeepAlive />);

    await dispatchVisibilityChange('visible');
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });

    await dispatchVisibilityChange('hidden');
    await dispatchVisibilityChange('visible');

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('warns when the session is about to end and the app keeps running', async () => {
    jest.useFakeTimers();
    try {
      setVisibility('hidden');
      const update = jest.fn().mockResolvedValue(null);
      const expires = new Date(Date.now() + 3 * 60 * 1000).toISOString();
      mockUseSession.mockReturnValue(authenticatedSession(expires, update));

      render(<SessionKeepAlive />);
      await act(async () => {
        jest.advanceTimersByTime(60 * 1000);
      });

      expect(toast.warning).toHaveBeenCalledWith(
        'Tu sesión está por vencer',
        expect.objectContaining({ id: 'session-expiry-warning' }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not renew a remembered session that still has weeks left', async () => {
    const update = jest.fn().mockResolvedValue(null);
    const expires = new Date(Date.now() + 29.5 * 24 * 60 * 60 * 1000).toISOString();
    const base = authenticatedSession(expires, update);
    mockUseSession.mockReturnValue({
      ...base,
      data: { ...base.data!, user: { ...base.data!.user, remember: true } },
    } as ReturnType<typeof useSession>);

    render(<SessionKeepAlive />);
    await dispatchVisibilityChange('visible');

    expect(update).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it } from '@jest/globals';

const mockRedirect = jest.fn();
const mockAuth = jest.fn();
const mockIsSessionCurrent = jest.fn();

jest.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => mockRedirect(...a) }));
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));
jest.mock('@/lib/session-revocation', () => ({
  isSessionCurrent: (...a: unknown[]) => mockIsSessionCurrent(...a),
}));
jest.mock('@/components/login-form', () => ({ LoginForm: () => null }));
jest.mock('@/components/login/login-stage', () => ({ LoginStage: () => null }));

import LoginPage from '@/app/login/page';

const signedIn = { user: { id: '7', token_version: 0, company_is_system: false } };

describe('/login with a stored session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a current session to the dashboard', async () => {
    mockAuth.mockResolvedValue(signedIn);
    mockIsSessionCurrent.mockResolvedValue(true);
    await LoginPage({ searchParams: Promise.resolve({}) });
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('shows the form for a revoked session instead of looping to the dashboard', async () => {
    mockAuth.mockResolvedValue(signedIn);
    mockIsSessionCurrent.mockResolvedValue(false);
    await LoginPage({ searchParams: Promise.resolve({ reason: 'expired' }) });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

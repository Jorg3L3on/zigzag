jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { redirect } from 'next/navigation';
import HomePage from '@/app/page';
import { auth } from '@/lib/auth';

const mockAuth = auth as unknown as jest.Mock;

describe('HomePage (/)', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    (redirect as unknown as jest.Mock).mockClear();
  });

  it('sends a signed-in tenant user to the dashboard', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', company_is_system: false } });
    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/dashboard');
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('sends a signed-in system user to the operator console', async () => {
    mockAuth.mockResolvedValue({ user: { id: '1', company_is_system: true } });
    await expect(HomePage()).rejects.toThrow('NEXT_REDIRECT:/operator-console');
  });

  it('renders the landing for guests', async () => {
    mockAuth.mockResolvedValue(null);
    const page = await HomePage();
    expect(page).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });
});

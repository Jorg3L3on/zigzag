import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getSession, signIn } from 'next-auth/react';

import { LoginForm } from '@/components/login-form';

const mockPush = jest.fn();
const mockRefresh = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

jest.mock('next-auth/react', () => ({
  getSession: jest.fn(),
  signIn: jest.fn(),
}));

jest.mock('framer-motion', () => ({
  useReducedMotion: () => true,
}));

const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;

const submitLogin = () => {
  fireEvent.change(screen.getByLabelText(/correo electrónico/i), {
    target: { value: 'agent@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/contraseña/i), {
    target: { value: 'secret' },
  });

  const submitButton = screen.getByRole('button', { name: /iniciar sesión/i });
  fireEvent.submit(submitButton.closest('form')!);
};

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the expired session message when requested', () => {
    render(<LoginForm sessionExpired />);

    expect(screen.getByRole('alert')).toHaveTextContent('Sesión expirada');
    expect(screen.getByText(/vuelve a iniciar sesión/i)).toBeInTheDocument();
  });

  it('returns to a safe callback path after successful login', async () => {
    mockSignIn.mockResolvedValue({
      error: undefined,
      ok: true,
      status: 200,
      url: null,
    });
    mockGetSession.mockResolvedValue({
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: '1',
        email: 'agent@example.com',
        name: 'Agent',
        company_id: 1,
        company_name: 'ZigZag',
        company_is_system: false,
        token_version: 0,
      },
    });

    render(<LoginForm callbackUrl="/tickets/123?step=review" sessionExpired />);

    submitLogin();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/tickets/123?step=review');
    });
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('falls back to the role destination for unsafe callback paths', async () => {
    mockSignIn.mockResolvedValue({
      error: undefined,
      ok: true,
      status: 200,
      url: null,
    });
    mockGetSession.mockResolvedValue({
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: '1',
        email: 'operator@example.com',
        name: 'Operator',
        company_id: 1,
        company_name: 'ZigZag',
        company_is_system: true,
        token_version: 0,
      },
    });

    render(<LoginForm callbackUrl="//evil.example.com" />);

    submitLogin();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/operator-console');
    });
  });
});

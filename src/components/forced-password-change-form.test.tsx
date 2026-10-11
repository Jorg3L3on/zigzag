import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForcedPasswordChangeForm } from '@/components/forced-password-change-form';

const mockAssign = jest.fn();
jest.mock('@/lib/browser-navigation', () => ({
  navigateTo: (...args: unknown[]) => mockAssign(...args),
}));
jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));
const mockComplete = jest.fn();
jest.mock('@/actions/users', () => ({
  completeForcedPasswordChange: (...args: unknown[]) => mockComplete(...args),
}));

describe('ForcedPasswordChangeForm (ZIG-I18-11)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks for the same password twice before calling the server', async () => {
    const user = userEvent.setup();
    render(<ForcedPasswordChangeForm homePath="/dashboard" />);

    await user.type(screen.getByLabelText('Contraseña nueva'), 'mi-clave-2026');
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'otra-clave-2026');
    await user.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no son iguales/i);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('saves and goes home', async () => {
    mockComplete.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ForcedPasswordChangeForm homePath="/dashboard" />);

    await user.type(screen.getByLabelText('Contraseña nueva'), 'mi-clave-2026');
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'mi-clave-2026');
    await user.click(screen.getByRole('button', { name: 'Guardar y entrar' }));

    expect(mockComplete).toHaveBeenCalledWith({
      newPassword: 'mi-clave-2026',
      confirmPassword: 'mi-clave-2026',
    });
    expect(mockAssign).toHaveBeenCalledWith('/dashboard');
  });
});

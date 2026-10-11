import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemporaryPasswordDialog } from '@/components/users/temporary-password-dialog';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe('TemporaryPasswordDialog (ZIG-I18-11)', () => {
  it('confirms, then shows the password once with Copiar and WhatsApp', async () => {
    const user = userEvent.setup();
    const onReset = jest.fn().mockResolvedValue({
      success: true,
      data: { temporaryPassword: 'kemo-7pdx', userName: 'Carlos' },
    });
    const onDone = jest.fn();
    render(
      <TemporaryPasswordDialog
        target={{ name: 'Carlos' }}
        onReset={onReset}
        onOpenChange={jest.fn()}
        onDone={onDone}
      />,
    );

    expect(screen.getByText(/dar contraseña temporal a carlos/i)).toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /dar contraseña temporal/i }));

    expect(await screen.findByTestId('temporary-password')).toHaveTextContent('kemo-7pdx');
    expect(screen.getByRole('button', { name: /copiar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /enviar por whatsapp/i })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/?text='),
    );

    await user.click(screen.getByRole('button', { name: 'Listo' }));
    expect(onDone).toHaveBeenCalled();
  });

  it('shows the server error and keeps the dialog on the confirmation', async () => {
    const user = userEvent.setup();
    render(
      <TemporaryPasswordDialog
        target={{ name: 'Carlos' }}
        onReset={jest.fn().mockResolvedValue({ success: false, error: 'No tienes permisos' })}
        onOpenChange={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /dar contraseña temporal/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No tienes permisos');
    expect(screen.queryByTestId('temporary-password')).not.toBeInTheDocument();
  });
});

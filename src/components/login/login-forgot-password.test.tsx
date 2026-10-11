import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForgotPassword } from '@/components/login/login-forgot-password';

describe('LoginForgotPassword (ZIG-I18-11)', () => {
  it('explains who to ask and offers WhatsApp to the configured number', async () => {
    const user = userEvent.setup();
    render(<LoginForgotPassword supportWhatsapp="+52 998 345 7712" getLogin={() => 'ana@demo.mx'} />);

    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));

    expect(await screen.findByText(/quien administra tu empresa/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /escribir por whatsapp/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('https://wa.me/529983457712'));
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain('ana@demo.mx');
  });

  it('hides the WhatsApp button when no number is configured', async () => {
    const user = userEvent.setup();
    render(<LoginForgotPassword />);

    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));

    expect(await screen.findByText(/quien administra tu empresa/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /whatsapp/i })).not.toBeInTheDocument();
  });
});

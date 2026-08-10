import { render, screen } from '@testing-library/react';
import { ClientPhoneLink } from '@/components/client-phone-link';

describe('ClientPhoneLink', () => {
  it('renders a normalized tel link for dialable phone values', () => {
    render(<ClientPhoneLink phone="(55) 1234-5678" />);

    expect(
      screen.getByRole('link', { name: 'Llamar a (55) 1234-5678' }),
    ).toHaveAttribute('href', 'tel:5512345678');
  });

  it('renders plain fallback text when the value is not dialable', () => {
    render(<ClientPhoneLink phone="sin teléfono" fallback="No disponible" />);

    expect(screen.getByText('sin teléfono')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingFunciones } from '@/components/marketing/landing/landing-funciones';
import { LandingTelefonoComputadora } from '@/components/marketing/landing/landing-telefono-computadora';

const rowFor = (client: string) =>
  screen.getAllByTestId('cobranza-row').find((row) => row.textContent?.includes(client))!;

describe('LandingFunciones', () => {
  it('renders section #funciones with the Cobranza tile and five small tiles in canvas order', () => {
    const { container } = render(<LandingFunciones />);
    expect(container.querySelector('section#funciones')).not.toBeNull();
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Lo que pasa después del trabajo también es trabajo.',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Quién te debe, cuánto y desde cuándo.',
      'Del presupuesto al ticket sin volver a escribir.',
      'El mantenimiento de cada seis meses ya no se te pasa.',
      '¿Sótano sin señal? Guarda el ticket igual.',
      'Letras grandes con un toque.',
      'Cada quien ve lo que le toca.',
    ]);
    expect(screen.getByText('Convertir a ticket')).toBeInTheDocument();
    expect(screen.getByText('Próximo · 12 días')).toBeInTheDocument();
    expect(screen.getByText('Atrasado · 4 días')).toBeInTheDocument();
    expect(screen.getByText('Pendiente de sincronizar')).toBeInTheDocument();
    expect(screen.getByText('Rol: Técnico')).toBeInTheDocument();
    expect(container.querySelector('img, picture')).toBeNull();
  });

  it('Registrar pago marks the row paid and lowers total and count; Deshacer restores it', async () => {
    const user = userEvent.setup();
    render(<LandingFunciones />);
    const total = screen.getByTestId('cobranza-total');
    expect(total).toHaveTextContent('Por cobrar · 4 saldos');
    expect(total).toHaveTextContent('$5,650.00');
    expect(screen.getAllByTestId('cobranza-row')).toHaveLength(4);

    await user.click(within(rowFor('Sra. Lupita')).getByRole('button', { name: /Registrar pago/ }));

    const lupita = rowFor('Sra. Lupita');
    expect(lupita).toHaveTextContent('Pagado hoy');
    expect(lupita).toHaveTextContent('$0.00');
    expect(within(lupita).getByRole('button', { name: /Deshacer/ })).toBeInTheDocument();
    expect(total).toHaveTextContent('Por cobrar · 3 saldos');
    expect(total).toHaveTextContent('$4,450.00');
    expect(rowFor('Gimnasio FitPro')).toHaveTextContent('Hace 9 días');

    await user.click(within(lupita).getByRole('button', { name: /Deshacer/ }));

    expect(rowFor('Sra. Lupita')).toHaveTextContent('Hace 21 días');
    expect(rowFor('Sra. Lupita')).toHaveTextContent('$1,200.00');
    expect(total).toHaveTextContent('Por cobrar · 4 saldos');
    expect(total).toHaveTextContent('$5,650.00');
  });

  it('uses the singular when one saldo is left', async () => {
    const user = userEvent.setup();
    render(<LandingFunciones />);
    for (const button of screen.getAllByRole('button', { name: /Registrar pago/ }).slice(0, 3)) {
      await user.click(button);
    }
    expect(screen.getByTestId('cobranza-total')).toHaveTextContent('Por cobrar · 1 saldo');
    expect(screen.getByTestId('cobranza-total')).toHaveTextContent('$1,000.00');
  });

  it('Texto grande is a switch that toggles aria-checked and the sample size', async () => {
    const user = userEvent.setup();
    render(<LandingFunciones />);
    const toggle = screen.getByRole('switch', { name: 'Texto grande' });
    const name = within(screen.getByTestId('texto-grande-sample')).getByText('Hotel Riviera Dorada');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(name).toHaveClass('text-[15px]');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(name).toHaveClass('text-[22px]');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(name).toHaveClass('text-[15px]');
  });

  it('stacks on phones: tiles and Cobranza rows wrap, buttons are 44px tall', () => {
    render(<LandingFunciones />);
    expect(screen.getByTestId('cobranza-tile')).toHaveClass('flex-[2_1_520px]', 'min-w-0');
    screen.getAllByTestId('cobranza-row').forEach((row) => {
      expect(row).toHaveClass('flex-wrap');
      expect(within(row).getByRole('button')).toHaveClass('min-h-11');
    });
    screen.getAllByTestId('funciones-tile').forEach((tile) => expect(tile).toHaveClass('min-w-0'));
  });
});

describe('LandingTelefonoComputadora', () => {
  it('shows the desktop table (five rows) cropped in its own box next to the phone', () => {
    const { container } = render(<LandingTelefonoComputadora />);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: /En la obra, el teléfono\.\s*En la oficina, la computadora\./,
      }),
    ).toBeInTheDocument();
    const desktop = screen.getByTestId('desktop-mock');
    expect(desktop).toHaveClass('overflow-hidden', 'min-w-0');
    expect(within(desktop).getAllByTestId('desktop-row')).toHaveLength(5);
    expect(within(desktop).getByText('Recordatorios de servicio')).toBeInTheDocument();
    expect(within(desktop).getByText('Todos · 60')).toBeInTheDocument();

    const phone = screen.getByTestId('phone-mock');
    expect(within(phone).getByText('Pago parcial · mié 11 nov')).toBeInTheDocument();
    expect(within(screen.getByTestId('phone-dock')).getByText('Cobranza')).toBeInTheDocument();
    expect(container.querySelector('img, picture')).toBeNull();
  });
});

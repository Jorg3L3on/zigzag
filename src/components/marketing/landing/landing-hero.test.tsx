import { fireEvent, render, screen, within } from '@testing-library/react';
import { LandingHero } from '@/components/marketing/landing/landing-hero';
import {
  HERO_TRADES,
  computeHeroReceipt,
  formatHeroMoney,
} from '@/components/marketing/landing/landing-hero-data';

const phone = () => screen.getByRole('group', { name: 'Ejemplo: nuevo ticket' });
const receipt = () => screen.getByRole('group', { name: 'Ejemplo: recibo' });
const payGroup = () => screen.getByRole('group', { name: '¿Cómo pagó el cliente?' });

describe('computeHeroReceipt', () => {
  it('Todo pays everything', () => {
    expect(computeHeroReceipt([850, 1400], 'full')).toEqual({
      total: 2250,
      paid: 2250,
      saldo: 0,
      owes: false,
      status: 'PAGADO',
    });
  });

  it('Una parte pays half rounded to 50', () => {
    expect(computeHeroReceipt([850, 1400], 'partial')).toMatchObject({
      paid: 1150,
      saldo: 1100,
      owes: true,
      status: 'PAGO PARCIAL',
    });
    expect(computeHeroReceipt([450, 380], 'partial').paid).toBe(400);
  });

  it('Nada aún is PENDIENTE and no services is SIN SERVICIOS', () => {
    expect(computeHeroReceipt([650], 'pending')).toMatchObject({
      paid: 0,
      saldo: 650,
      status: 'PENDIENTE',
    });
    for (const mode of ['full', 'partial', 'pending'] as const) {
      expect(computeHeroReceipt([], mode)).toEqual({
        total: 0,
        paid: 0,
        saldo: 0,
        owes: false,
        status: 'SIN SERVICIOS',
      });
    }
  });

  it('formats money es-MX', () => {
    expect(formatHeroMoney(1400)).toBe('$1,400.00');
    expect(formatHeroMoney(0)).toBe('$0.00');
  });
});

describe('LandingHero', () => {
  it('renders the three-line headline, CTAs and access line', () => {
    render(<LandingHero />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Haz el trabajo.Manda el recibo.Cobra completo.');
    expect(within(h1).getByText('completo.')).toHaveClass('text-[#E8482E]');
    expect(screen.getByRole('link', { name: 'Pedir acceso' })).toHaveAttribute(
      'href',
      '#acceso',
    );
    expect(screen.getByRole('link', { name: 'Ver cómo funciona' })).toHaveAttribute(
      'href',
      '#como-funciona',
    );
    expect(
      screen.getByText(
        'Nosotros damos de alta tu empresa. Tú entras desde tu teléfono, sin tienda de apps.',
      ),
    ).toBeInTheDocument();
  });

  it('picking each trade swaps the client and the three services', () => {
    render(<LandingHero />);
    const tradeGroup = screen.getByRole('group', { name: 'Oficio' });
    for (const trade of HERO_TRADES) {
      const button = within(tradeGroup).getByRole('button', { name: trade.label });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('hero-phone-client')).toHaveTextContent(trade.client);
      expect(screen.getByTestId('hero-receipt-client')).toHaveTextContent(trade.client);
      const [first, second, third] = trade.services;
      expect(
        within(phone()).getByRole('button', { name: `Quitar ${first.name}` }),
      ).toBeInTheDocument();
      expect(
        within(phone()).getByRole('button', { name: `Quitar ${second.name}` }),
      ).toBeInTheDocument();
      expect(
        within(phone()).getByRole('button', { name: `Agregar ${third.name}` }),
      ).toBeInTheDocument();
      expect(within(receipt()).getByText(first.name)).toBeInTheDocument();
      expect(within(receipt()).queryByText(third.name)).not.toBeInTheDocument();
      expect(screen.getByTestId('hero-phone-total')).toHaveTextContent(
        formatHeroMoney(first.amount + second.amount),
      );
    }
  });

  it('adding and removing services changes the total on phone and receipt', () => {
    render(<LandingHero />);
    const expectTotal = (text: string) => {
      expect(screen.getByTestId('hero-phone-total')).toHaveTextContent(text);
      expect(screen.getByTestId('hero-receipt-total')).toHaveTextContent(text);
    };
    expectTotal('$2,250.00');

    fireEvent.click(
      within(phone()).getByRole('button', { name: 'Agregar Limpieza de evaporadora' }),
    );
    expectTotal('$2,790.00');
    expect(within(receipt()).getByText('Limpieza de evaporadora')).toBeInTheDocument();

    fireEvent.click(
      within(phone()).getByRole('button', { name: 'Quitar Recarga de gas refrigerante' }),
    );
    expectTotal('$1,390.00');
    expect(within(receipt()).queryByText('Recarga de gas refrigerante')).toBeNull();

    fireEvent.click(
      within(phone()).getByRole('button', { name: 'Quitar Mantenimiento preventivo A/C' }),
    );
    fireEvent.click(
      within(phone()).getByRole('button', { name: 'Quitar Limpieza de evaporadora' }),
    );
    expectTotal('$0.00');
    expect(screen.getByTestId('hero-receipt-status')).toHaveTextContent('SIN SERVICIOS');
  });

  it('payment modes set PAGADO, PAGO PARCIAL with saldo, and PENDIENTE', () => {
    render(<LandingHero />);
    const status = () => screen.getByTestId('hero-receipt-status');
    const pay = (name: string) => within(payGroup()).getByRole('button', { name });

    expect(pay('Todo')).toHaveAttribute('aria-pressed', 'true');
    expect(status()).toHaveTextContent('PAGADO');
    expect(within(receipt()).queryByText('Saldo por pagar')).toBeNull();

    fireEvent.click(pay('Una parte'));
    expect(pay('Una parte')).toHaveAttribute('aria-pressed', 'true');
    expect(pay('Todo')).toHaveAttribute('aria-pressed', 'false');
    expect(status()).toHaveTextContent('PAGO PARCIAL');
    expect(screen.getByTestId('hero-receipt-paid')).toHaveTextContent('$1,150.00');
    expect(within(receipt()).getByText('Saldo por pagar')).toBeInTheDocument();
    expect(screen.getByTestId('hero-receipt-saldo')).toHaveTextContent('$1,100.00');

    fireEvent.click(pay('Nada aún'));
    expect(status()).toHaveTextContent('PENDIENTE');
    expect(screen.getByTestId('hero-receipt-saldo')).toHaveTextContent('$2,250.00');

    fireEvent.click(pay('Todo'));
    expect(status()).toHaveTextContent('PAGADO');
    expect(screen.queryByTestId('hero-receipt-saldo')).toBeNull();
  });

  it('demo controls are real buttons, 44px tall, with aria-pressed on toggles', () => {
    render(<LandingHero />);
    const toggles = [
      ...within(screen.getByRole('group', { name: 'Oficio' })).getAllByRole('button'),
      ...within(payGroup()).getAllByRole('button'),
    ];
    expect(toggles).toHaveLength(7);
    for (const button of toggles) {
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-pressed');
      expect(button.className).toMatch(/(?:^|\s)(?:min-h-11|h-11)(?:\s|$)/);
    }
    for (const button of within(phone()).getAllByRole('button')) {
      expect(button.tagName).toBe('BUTTON');
      expect(button.className).toMatch(/(?:^|\s)min-h-11(?:\s|$)/);
    }
    // Guardar is decorative, not a control.
    expect(within(phone()).queryByRole('button', { name: 'Guardar' })).toBeNull();
  });

  it('stacks the receipt under the phone on small screens and rotates it only from sm', () => {
    render(<LandingHero />);
    const r = receipt();
    expect(r.className).toMatch(/(?:^|\s)mt-6(?:\s|$)/);
    expect(r.className).toContain('sm:rotate-3');
    expect(r.className).not.toMatch(/(?:^|\s)rotate-/);
    expect(r.className).not.toMatch(/(?:^|\s)-ml-/);
    expect(r.parentElement?.className).toMatch(/(?:^|\s)flex-col(?:\s|$)/);
    expect(screen.getByRole('heading', { level: 1 }).className).toContain(
      'text-[clamp(36px,8vw,116px)]',
    );
  });
});

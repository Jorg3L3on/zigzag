import { render, screen, within } from '@testing-library/react';
import { LandingComoFunciona } from '@/components/marketing/landing/landing-como-funciona';
import { LandingFacts } from '@/components/marketing/landing/landing-facts';
import { LandingProblem } from '@/components/marketing/landing/landing-problem';

const ANIMATION_CLASS = /(?:^|\s)(?:motion-safe:)?(?:animate-|transition)/;

const expectStatic = (container: HTMLElement) => {
  expect(container.querySelector('img, picture')).toBeNull();
  const animated = Array.from(container.querySelectorAll('[class]')).filter((el) =>
    ANIMATION_CLASS.test(el.getAttribute('class') ?? ''),
  );
  expect(animated).toEqual([]);
};

describe('LandingFacts', () => {
  it('lists the four facts in canvas order', () => {
    const { container } = render(<LandingFacts />);
    const strip = screen.getByRole('region', { name: 'En pocas palabras' });
    expect(within(strip).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Sin tienda de apps',
      'Guarda tickets sin señal',
      'Recibo PDF con tu logo',
      'AaTexto grande con un toque',
    ]);
    expectStatic(container);
  });
});

describe('LandingProblem', () => {
  it('shows the problem copy, the three scraps and the Sra. Lupita ticket', () => {
    const { container } = render(<LandingProblem />);
    expect(
      screen.getByRole('heading', { level: 2, name: /El trabajo ya lo hiciste\.\s*¿Y el cobro\?/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/La nota en la libreta\./)).toBeInTheDocument();

    const scraps = screen.getByTestId('problem-scraps');
    expect(scraps.children).toHaveLength(3);
    expect(within(scraps).getByText(/debe \$1,200 \?\?\?/)).toBeInTheDocument();
    expect(within(scraps).getByText('Luego le deposito lo que falta, joven.')).toBeInTheDocument();
    expect(within(scraps).getByText('#¡REF!')).toBeInTheDocument();

    const ticket = screen.getByTestId('problem-ticket');
    expect(within(ticket).getByText('Sra. Lupita')).toBeInTheDocument();
    expect(within(ticket).getByText('Pago parcial · sáb 7 nov')).toBeInTheDocument();
    expect(within(ticket).getByText('Saldo $1,200.00')).toBeInTheDocument();
    expectStatic(container);
  });
});

describe('LandingComoFunciona', () => {
  it('renders section #como-funciona on the zigzag paper band with steps 01..04', () => {
    const { container } = render(<LandingComoFunciona />);
    const section = container.querySelector('section#como-funciona');
    expect(section).not.toBeNull();
    expect(section).toHaveClass('zz-edge-y');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Del trabajo al cobro, en zigzag.' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Guarda al cliente una vez',
      'Arma el ticket en la obra',
      'Anota cómo te pagaron',
      'Manda el recibo',
    ]);
    expect(screen.getAllByTestId('step-connector')).toHaveLength(3);
    expectStatic(container);
  });

  it('puts text before the piece in every step; only md+ alternates sides', () => {
    render(<LandingComoFunciona />);
    const steps = screen.getAllByTestId('como-funciona-step');
    expect(steps).toHaveLength(4);
    steps.forEach((step, index) => {
      const [text, piece] = Array.from(step.children);
      expect(within(text as HTMLElement).getByRole('heading', { level: 3 })).toBeInTheDocument();
      expect(piece).toHaveAttribute('data-testid', 'como-funciona-piece');
      expect(step).toHaveClass('flex-col');
      expect(step).not.toHaveClass('flex-row-reverse');
      expect(step).toHaveClass(index % 2 ? 'md:flex-row-reverse' : 'md:flex-row');
    });
  });
});

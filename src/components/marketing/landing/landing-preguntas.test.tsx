import { render, screen } from '@testing-library/react';
import { LandingPreguntas } from '@/components/marketing/landing/landing-preguntas';

describe('LandingPreguntas', () => {
  it('renders seven native details/summary items with the first open', () => {
    const { container } = render(<LandingPreguntas />);
    const details = Array.from(container.querySelectorAll('section#preguntas details'));

    expect(details).toHaveLength(7);
    details.forEach((item) => {
      expect(item.firstElementChild?.tagName).toBe('SUMMARY');
    });
    expect(details.map((item) => item.hasAttribute('open'))).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(
      details.map((item) => item.querySelector('summary')?.textContent),
    ).toEqual([
      '¿Tengo que instalar algo?',
      '¿Funciona sin internet?',
      '¿El recibo es una factura?',
      '¿ZigZag cobra por mí?',
      '¿Sirve para mi oficio?',
      '¿Puedo usarlo con mi equipo?',
      '¿Quién puede ver mis datos?',
    ]);
  });

  it('answers the CFDI and money questions as on the canvas', () => {
    render(<LandingPreguntas />);
    expect(
      screen.getByText(
        'No. ZigZag hace recibos y presupuestos en PDF con tu logo. No timbra facturas (CFDI): para eso sigues usando tu sistema de facturación.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'No mueve tu dinero. Tú anotas cuánto te pagaron y ZigZag lleva la cuenta de lo que falta y te lo muestra en Cobranza.',
      ),
    ).toBeInTheDocument();
  });
});

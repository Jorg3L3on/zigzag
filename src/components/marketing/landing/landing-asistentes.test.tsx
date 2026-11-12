import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingAsistentes } from '@/components/marketing/landing/landing-asistentes';
import { MCP_DOCS_PATH } from '@/lib/marketing-routes';

describe('LandingAsistentes', () => {
  it('renders the dark band with its title and assistant names as text', () => {
    const { container } = render(<LandingAsistentes />);
    const section = container.querySelector('section#asistentes');

    expect(section).toHaveClass('zz-edge-y');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pregúntale a tu negocio.' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ChatGPT, Claude o Grok/)).toBeInTheDocument();
    expect(section?.querySelector('img')).toBeNull();
  });

  it('each prompt button shows its own conversation and sets aria-pressed', async () => {
    const user = userEvent.setup();
    render(<LandingAsistentes />);
    const group = screen.getByRole('group', { name: 'Ejemplos de lo que puedes pedir' });
    const buttons = within(group).getAllByRole('button');
    const chat = screen.getByTestId('asistentes-conversation');

    expect(buttons.map((b) => b.textContent)).toEqual([
      '01Cobranza de hoy',
      '02Ticket desde un mensaje',
      '03Resumen de un cliente',
    ]);

    const cases = [
      { name: /Cobranza de hoy/, text: '¿A quién le tengo que cobrar hoy?' },
      { name: /Ticket desde un mensaje/, text: 'Listo. Lo dejé preparado para que lo revises:' },
      { name: /Resumen de un cliente/, text: '¿Cómo vamos con Plaza Comercial Aurora?' },
    ];

    // Start from the last one so the first button's click is a real switch back.
    for (const current of [...cases].reverse()) {
      await user.click(within(group).getByRole('button', { name: current.name }));
      for (const other of cases) {
        const button = within(group).getByRole('button', { name: other.name });
        expect(button).toHaveAttribute('aria-pressed', String(other === current));
        if (other === current) {
          expect(within(chat).getByText(other.text)).toBeInTheDocument();
        } else {
          expect(within(chat).queryByText(other.text)).toBeNull();
        }
      }
    }
  });

  it('starts on Cobranza de hoy', () => {
    render(<LandingAsistentes />);
    expect(screen.getByRole('button', { name: /Cobranza de hoy/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/Tienes 4 saldos pendientes por \$5,650\.00/)).toBeInTheDocument();
  });

  it('notes company scope and write access, and links to the connector docs', () => {
    render(<LandingAsistentes />);
    expect(
      screen.getByText(
        'Tú decides qué empresas puede ver y si puede crear tickets. Cada consulta queda registrada.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver cómo se conecta' })).toHaveAttribute(
      'href',
      MCP_DOCS_PATH,
    );
  });
});

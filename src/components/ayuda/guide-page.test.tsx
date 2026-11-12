import { fireEvent, render, screen, within } from '@testing-library/react';
import { getWrittenGuide } from '@/components/ayuda/guide-registry';
import { GuidePage } from '@/components/ayuda/guide-page';

const guide = getWrittenGuide('crear-un-ticket')!;

const renderGuide = (whatsappHref: string | null = null) =>
  render(<GuidePage guide={guide} whatsappHref={whatsappHref} />);

describe('guide page: Crear un ticket (ZIG-I40-2)', () => {
  it('renders the eyebrow, title and the five steps in order', () => {
    renderGuide();
    expect(screen.getByText('Tickets · 5 pasos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Crear un ticket' })).toBeInTheDocument();
    const steps = screen.getAllByTestId('ayuda-step');
    expect(steps).toHaveLength(5);
    expect(steps.map((step) => within(step).getByRole('heading', { level: 2 }).textContent)).toEqual([
      'Paso 1: Toca el botón +',
      'Paso 2: Elige al cliente',
      'Paso 3: Agrega lo que hiciste',
      'Paso 4: Di cómo te pagó',
      'Paso 5: Toca Guardar',
    ]);
    expect(screen.getByText('¿No hay señal?')).toBeInTheDocument();
  });

  it('highlights the current topic and links the others', () => {
    renderGuide();
    const topics = screen.getByRole('navigation', { name: 'Temas' });
    const links = within(topics).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Tickets',
      'Cobro',
      'Presupuestos',
      'Clientes y servicios',
      'Teléfono',
      'Equipo',
      'Asistentes IA',
    ]);
    expect(within(topics).getByRole('link', { name: 'Tickets' })).toHaveAttribute('aria-current', 'true');
    expect(within(topics).getByRole('link', { name: 'Cobro' })).not.toHaveAttribute('aria-current');
    expect(within(topics).getByRole('link', { name: 'Asistentes IA' })).toHaveAttribute(
      'href',
      '/ayuda/asistentes',
    );
  });

  it('the three payment options change the explanation and aria-pressed', () => {
    renderGuide();
    const group = screen.getByRole('group', { name: '¿Cómo pagó el cliente?' });
    const todo = within(group).getByRole('button', { name: 'Todo' });
    const parte = within(group).getByRole('button', { name: 'Una parte' });
    const nada = within(group).getByRole('button', { name: 'Nada aún' });
    const explanation = screen.getByTestId('ayuda-pay-explanation');

    expect(parte).toHaveAttribute('aria-pressed', 'true');
    expect(explanation).toHaveTextContent('lo que falta queda por cobrar en Cobranza');

    fireEvent.click(todo);
    expect(todo).toHaveAttribute('aria-pressed', 'true');
    expect(parte).toHaveAttribute('aria-pressed', 'false');
    expect(explanation).toHaveTextContent('El ticket se termina al guardar y queda Pagado.');

    fireEvent.click(nada);
    expect(nada).toHaveAttribute('aria-pressed', 'true');
    expect(todo).toHaveAttribute('aria-pressed', 'false');
    expect(explanation).toHaveTextContent('queda Por cobrar en Cobranza hasta que te pague');
  });

  it('Sí / No only change the feedback text and send nothing', () => {
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    const beacon = jest.fn();
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    try {
      const { unmount } = renderGuide('https://wa.me/529983457712');
      expect(screen.getByText('¿Te sirvió esta guía?')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
      expect(screen.getByText('Gracias por avisar.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'No' })).not.toBeInTheDocument();
      unmount();

      renderGuide('https://wa.me/529983457712');
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
      expect(
        screen.getByText('Gracias. Escríbenos por WhatsApp y te ayudamos.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Escribir por WhatsApp' })).toHaveAttribute(
        'href',
        'https://wa.me/529983457712',
      );

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(beacon).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('without a next written guide, the button goes back to /ayuda', () => {
    renderGuide();
    expect(screen.getByRole('link', { name: 'Ver todas las guías' })).toHaveAttribute('href', '/ayuda');
  });
});

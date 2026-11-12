import { fireEvent, render, screen, within } from '@testing-library/react';
import AyudaPage from '@/app/ayuda/page';
import { getHelpCards, GUIDES } from '@/components/ayuda/guide-registry';
import { HelpHome } from '@/components/ayuda/help-home';

const ALL_CARDS = getHelpCards(
  GUIDES.map((guide) => ({ ...guide, content: { description: '', intro: '', steps: [] } })),
  true,
);

const cardTitles = () =>
  within(screen.getByRole('list', { name: 'Guías' }))
    .queryAllByRole('link')
    .map((link) => link.querySelector('strong')?.textContent);

describe('/ayuda home (ZIG-I40-1)', () => {
  const originalNumber = process.env.SUPPORT_WHATSAPP_NUMBER;

  afterEach(() => {
    if (originalNumber === undefined) delete process.env.SUPPORT_WHATSAPP_NUMBER;
    else process.env.SUPPORT_WHATSAPP_NUMBER = originalNumber;
  });

  it('renders the top bar, title, five first steps and the legal links', () => {
    render(<HelpHome cards={ALL_CARDS} whatsappHref={null} />);
    const nav = screen.getByRole('navigation', { name: 'Ayuda' });
    expect(within(nav).getByRole('link', { name: 'ZigZag, ayuda' })).toHaveAttribute('href', '/ayuda');
    expect(within(nav).getByRole('link', { name: 'Guías' })).toHaveAttribute('href', '/ayuda');
    expect(within(nav).getByRole('link', { name: 'Asistentes IA' })).toHaveAttribute(
      'href',
      '/ayuda/asistentes',
    );
    expect(within(nav).getByRole('link', { name: 'Abrir ZigZag' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('¿Cómo se usa?');
    const steps = screen.getByRole('heading', { name: 'Tus primeros cinco minutos' }).closest('section')!;
    expect(within(steps).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'Aviso de privacidad' })).toHaveAttribute(
      'href',
      '/aviso-de-privacidad',
    );
    expect(screen.getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute(
      'href',
      '/terminos-y-condiciones',
    );
  });

  it('search narrows the cards as you type and shows the empty message when nothing matches', () => {
    render(<HelpHome cards={ALL_CARDS} whatsappHref="https://wa.me/529983457712" />);
    expect(cardTitles()).toHaveLength(17);

    const search = screen.getByLabelText('Busca una guía');
    fireEvent.change(search, { target: { value: 'presupuesto' } });
    expect(cardTitles()).toEqual(['Hacer un presupuesto', 'Convertir un presupuesto a ticket']);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    fireEvent.change(search, { target: { value: 'telefono' } });
    expect(cardTitles()).toHaveLength(3);

    fireEvent.change(search, { target: { value: 'factura electrónica' } });
    expect(cardTitles()).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent(
      'No hay una guía con esas palabras. Prueba con otra o escríbenos por WhatsApp.',
    );

    fireEvent.change(search, { target: { value: '' } });
    expect(cardTitles()).toHaveLength(17);
  });

  it('shows the WhatsApp band with a wa.me link when SUPPORT_WHATSAPP_NUMBER is set', () => {
    process.env.SUPPORT_WHATSAPP_NUMBER = '998 345 7712';
    render(<AyudaPage />);
    const band = screen.getByTestId('ayuda-whatsapp-band');
    expect(within(band).getByRole('link', { name: 'Escribir por WhatsApp' }).getAttribute('href')).toMatch(
      /^https:\/\/wa\.me\/529983457712\?text=/,
    );
  });

  it('has no WhatsApp band (and no WhatsApp hint) when SUPPORT_WHATSAPP_NUMBER is unset', () => {
    delete process.env.SUPPORT_WHATSAPP_NUMBER;
    render(<AyudaPage />);
    expect(screen.queryByTestId('ayuda-whatsapp-band')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Escribir por WhatsApp' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Busca una guía'), { target: { value: 'zzz' } });
    expect(screen.getByRole('status')).not.toHaveTextContent('WhatsApp');
  });
});

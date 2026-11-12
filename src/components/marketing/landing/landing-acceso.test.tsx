import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as accessRequest from '@/components/marketing/landing/access-request';
import { LandingAcceso } from '@/components/marketing/landing/landing-acceso';
import { PRIVACY_PATH } from '@/lib/marketing-routes';

// Wrap the real local function so calls can be counted (ESM exports are not spyable).
jest.mock('@/components/marketing/landing/access-request', () => {
  const actual = jest.requireActual('@/components/marketing/landing/access-request');
  return { ...actual, submitAccessRequest: jest.fn(actual.submitAccessRequest) };
});

describe('LandingAcceso', () => {
  let fetchSpy: jest.Mock;
  let xhrOpen: jest.SpyInstance;
  let xhrSend: jest.SpyInstance;
  let setItem: jest.SpyInstance;
  const submitSpy = accessRequest.submitAccessRequest as jest.Mock;

  beforeEach(() => {
    fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    xhrOpen = jest.spyOn(XMLHttpRequest.prototype, 'open');
    xhrSend = jest.spyOn(XMLHttpRequest.prototype, 'send');
    setItem = jest.spyOn(Storage.prototype, 'setItem');
    submitSpy.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const expectNoNetworkOrStorage = () => {
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(xhrSend).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  };

  it('renders the dark band, steps and the receipt form', () => {
    const { container } = render(<LandingAcceso />);
    expect(container.querySelector('section#acceso')).toHaveClass('zz-edge-y');
    expect(screen.getByRole('heading', { level: 2, name: 'Pide tu acceso.' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '01Te escribimos por WhatsApp para conocer tu negocio.',
      '02Damos de alta tu empresa, con tu logo.',
      '03Entras desde tu teléfono y haces tu primer ticket.',
    ]);
    expect(screen.getByText('SOLICITUD DE ACCESO')).toBeInTheDocument();
    expect(screen.getByLabelText('WhatsApp')).toHaveAttribute('type', 'tel');
    expect(screen.getByRole('link', { name: 'Aviso de privacidad' })).toHaveAttribute(
      'href',
      PRIVACY_PATH,
    );
  });

  it('every field has a visible <label>', () => {
    const { container } = render(<LandingAcceso />);
    const fields = Array.from(container.querySelectorAll('form input, form select'));
    expect(fields).toHaveLength(4);
    fields.forEach((field) => {
      const label = container.querySelector(`label[for="${field.id}"]`);
      expect(label).not.toBeNull();
      expect(label?.textContent?.trim()).not.toBe('');
    });
    expect(screen.getByLabelText('Tu nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Tu negocio')).toBeInTheDocument();
    expect(screen.getByLabelText('Tu oficio').tagName).toBe('SELECT');
  });

  it('keyboard only: Tab through, type, Enter submits locally without network and shows RECIBIDO', async () => {
    const user = userEvent.setup();
    render(<LandingAcceso />);
    const form = screen.getByRole('form', { name: 'Solicitud de acceso' });

    // Nothing before the form is focusable, so the first Tab lands on Tu nombre.
    await user.tab();
    expect(screen.getByLabelText('Tu nombre')).toHaveFocus();
    await user.keyboard('Ana López');
    await user.tab();
    expect(screen.getByLabelText('Tu negocio')).toHaveFocus();
    await user.keyboard('Clima Ana');
    await user.tab();
    expect(screen.getByLabelText('WhatsApp')).toHaveFocus();
    await user.keyboard('9981234567');
    await user.tab();
    expect(screen.getByLabelText('Tu oficio')).toHaveFocus();
    // jsdom has no native select keyboard UI; pick the option, focus stays put.
    await user.selectOptions(screen.getByLabelText('Tu oficio'), 'Plomería');
    expect(screen.getByLabelText('Tu oficio')).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Pedir acceso' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('RECIBIDO')).toBeInTheDocument();
    expect(screen.getByText('Gracias. Te escribimos pronto por WhatsApp.')).toHaveFocus();
    expect(form).not.toBeInTheDocument();
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledWith({
      nombre: 'Ana López',
      negocio: 'Clima Ana',
      whatsapp: '9981234567',
      oficio: 'Plomería',
    });
    expectNoNetworkOrStorage();

    await user.keyboard('{Tab}');
    const again = screen.getByRole('button', { name: 'Enviar otra solicitud' });
    expect(again).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(screen.getByLabelText('Tu nombre')).toHaveValue('');
    expect(screen.getByLabelText('Tu nombre')).toHaveFocus();
    expect(screen.getByLabelText('WhatsApp')).toHaveValue('');
    expect(screen.queryByText('RECIBIDO')).toBeNull();
  });

  it('empty nombre shows the error under the field and does not submit', async () => {
    const user = userEvent.setup();
    render(<LandingAcceso />);
    await user.type(screen.getByLabelText('WhatsApp'), '9981234567');
    await user.click(screen.getByRole('button', { name: 'Pedir acceso' }));

    const nombre = screen.getByLabelText('Tu nombre');
    expect(nombre).toHaveAttribute('aria-invalid', 'true');
    expect(nombre).toHaveAccessibleDescription('Escribe tu nombre.');
    expect(nombre.nextElementSibling).toHaveTextContent('Escribe tu nombre.');
    expect(nombre).toHaveFocus();
    expect(screen.getByLabelText('WhatsApp')).not.toHaveAttribute('aria-invalid');
    expect(submitSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('RECIBIDO')).toBeNull();
    expectNoNetworkOrStorage();
  });

  it('empty WhatsApp shows the error under the field and does not submit', async () => {
    const user = userEvent.setup();
    render(<LandingAcceso />);
    await user.type(screen.getByLabelText('Tu nombre'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Pedir acceso' }));

    const whatsapp = screen.getByLabelText('WhatsApp');
    expect(whatsapp).toHaveAttribute('aria-invalid', 'true');
    expect(whatsapp).toHaveAccessibleDescription('Escribe tu WhatsApp.');
    expect(whatsapp.nextElementSibling).toHaveTextContent('Escribe tu WhatsApp.');
    expect(whatsapp).toHaveFocus();
    expect(submitSpy).not.toHaveBeenCalled();

    // Typing clears the error.
    await user.type(whatsapp, '9');
    expect(whatsapp).not.toHaveAttribute('aria-invalid');
    expect(within(screen.getByRole('form')).queryByText('Escribe tu WhatsApp.')).toBeNull();
  });
});

describe('submitAccessRequest', () => {
  it('resolves locally without network or storage', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const xhrOpen = jest.spyOn(XMLHttpRequest.prototype, 'open');
    const setItem = jest.spyOn(Storage.prototype, 'setItem');

    const { submitAccessRequest } = jest.requireActual<typeof accessRequest>(
      '@/components/marketing/landing/access-request',
    );
    await expect(
      submitAccessRequest({
        nombre: 'Ana',
        negocio: '',
        whatsapp: '9981234567',
        oficio: 'Otro',
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrOpen).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});

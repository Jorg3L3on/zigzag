/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DocumentLineRow } from '@/components/documents/document-line-row';

const LONG_NAME = 'Mantenimiento'.repeat(8) + 'x'.repeat(10); // 114 chars, no spaces

describe('DocumentLineRow (ZIG-I13-1)', () => {
  it('gives the name the full width and keeps the amount unsqueezed', () => {
    render(
      <DocumentLineRow
        name={LONG_NAME}
        quantity={2}
        price={1_234_567.89}
        amount={9_999_999_999.99}
        onClick={() => undefined}
      />,
    );
    expect(screen.getByText(LONG_NAME).className).toContain('[overflow-wrap:anywhere]');
    const amount = screen.getByTestId('document-line-amount');
    expect(amount).toHaveTextContent('$9,999,999,999.99');
    expect(amount.parentElement?.className).toContain('shrink-0');
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent('2 × $1,234,567.89');
  });

  it('pluralises materials and omits the count at 0', () => {
    const { rerender } = render(
      <DocumentLineRow name="A" quantity={1} price={10} amount={10} materialCount={0} />,
    );
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent(/^1 × \$10\.00$/);
    rerender(<DocumentLineRow name="A" quantity={1} price={10} amount={10} materialCount={1} />);
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent('1 × $10.00 · 1 material');
    rerender(<DocumentLineRow name="A" quantity={1} price={10} amount={10} materialCount={21} />);
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent('· 21 materiales');
  });

  it('is one tap target whose accessible name includes the line, with no menu', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<DocumentLineRow name="Carga de gas" quantity={1} price={10} amount={10} onClick={onClick} />);
    const row = screen.getByRole('button', { name: /Carga de gas/ });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a link when given an href, and a plain row otherwise', () => {
    const { rerender } = render(
      <DocumentLineRow name="A" quantity={1} price={1} amount={1} href="/tickets/1" />,
    );
    expect(screen.getByRole('link', { name: /A/ })).toHaveAttribute('href', '/tickets/1');
    rerender(<DocumentLineRow name="A" quantity={1} price={1} amount={1} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('opens N materiales with the keyboard and leaves the amount alone (ZIG-18)', async () => {
    const user = userEvent.setup();
    render(
      <DocumentLineRow
        name="Mantenimiento"
        quantity={1}
        price={850}
        amount={900}
        materials={[{ id: 1, name: 'Filtro', quantity: 2, unit: 'pza', price: 25 }]}
        onClick={() => undefined}
      />,
    );
    const amount = screen.getByTestId('document-line-amount');
    expect(amount).toHaveTextContent('$900.00');
    const toggle = screen.getByRole('button', { name: '1 material' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/Filtro/)).toBeNull();

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('list', { name: 'Materiales de Mantenimiento' })).toHaveTextContent(
      'Filtro',
    );
    expect(screen.getByText(/2 pza/)).toBeInTheDocument();
    expect(screen.getByText(/\$25\.00/)).toBeInTheDocument();
    expect(amount).toHaveTextContent('$900.00');
  });

  it('opens a breakdown with Servicio, Materiales and each material amount', async () => {
    const user = userEvent.setup();
    render(
      <DocumentLineRow
        name="Instalación mini-split"
        quantity={2}
        price={4200}
        amount={8700}
        materials={[
          { id: 1, name: 'Filtro de aire', quantity: 1, unit: 'pza', price: 150 },
          { id: 2, name: 'Tubo de cobre', quantity: 2, unit: 'm', price: 75 },
        ]}
        onClick={() => undefined}
      />,
    );
    await user.click(screen.getByRole('button', { name: '2 materiales' }));

    const breakdown = screen.getByRole('group', { name: 'Desglose de Instalación mini-split' });
    expect(within(breakdown).getByTestId('line-breakdown-service')).toHaveTextContent(
      'Servicio · 2 × $4,200.00$8,400.00',
    );
    expect(within(breakdown).getByTestId('line-breakdown-materials')).toHaveTextContent(
      'Materiales$300.00',
    );
    const items = within(breakdown).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Filtro de aire · 1 pza × $150.00$150.00');
    expect(items[1]).toHaveTextContent('Tubo de cobre · 2 m × $75.00$150.00');
    // The line total stays on the line: Servicio + Materiales.
    expect(screen.getByTestId('document-line-amount')).toHaveTextContent('$8,700.00');
  });

  it('offers Quitar on desktop hover only when onRemove is set (ZIG-I24)', async () => {
    const user = userEvent.setup();
    const onRemove = jest.fn();
    const onClick = jest.fn();
    const { rerender } = render(
      <DocumentLineRow name="Recarga" quantity={1} price={10} amount={10} onClick={onClick} />,
    );
    expect(screen.queryByRole('button', { name: 'Quitar Recarga' })).toBeNull();

    rerender(
      <DocumentLineRow
        name="Recarga"
        quantity={1}
        price={10}
        amount={10}
        onClick={onClick}
        onRemove={onRemove}
      />,
    );
    const remove = screen.getByRole('button', { name: 'Quitar Recarga' });
    // Hidden on phones, shown on hover or focus from lg.
    expect(remove).toHaveClass('hidden', 'lg:inline-flex', 'opacity-0', 'group-hover:opacity-100');
    expect(screen.getByTestId('document-line-row')).toContainElement(remove);
    await user.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows the changed marker and the server error, and never a Nuevo pill', () => {
    render(
      <DocumentLineRow
        name="A"
        quantity={1}
        price={1}
        amount={1}
        changed
        error="El precio es demasiado alto"
        onClick={() => undefined}
      />,
    );
    expect(screen.getByTestId('document-line-changed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('El precio es demasiado alto');
    expect(screen.queryByText('Nuevo')).toBeNull();
  });
});

const mockDesktopWidth = (desktop: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: desktop && query === '(min-width: 1024px)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

const receiptMaterials = [
  { id: 1, name: 'Filtro de aire', quantity: 1, unit: 'pza', price: 150 },
  { id: 2, name: 'Tubo de cobre', quantity: 2, unit: 'm', price: 75 },
];

describe('DocumentLineRow receipt grid (ZIG-I28-1)', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.localStorage.clear();
    mockDesktopWidth(true);
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('shows the description, a service-only importe and the group subtotal', () => {
    render(
      <DocumentLineRow
        layout="receipt"
        index={1}
        name="Instalación mini-split"
        description="Equipo de 1 tonelada en recámara"
        serviceId={null}
        quantity={1.5}
        price={4200}
        amount={6600}
        materials={receiptMaterials}
      />,
    );

    const row = screen.getByTestId('document-line-row');
    expect(row).toHaveAttribute('data-layout', 'receipt');
    expect(row).toHaveTextContent('01');
    expect(screen.getByTestId('document-line-description')).toHaveTextContent(
      'Equipo de 1 tonelada en recámara',
    );
    expect(screen.getByTestId('document-line-uncatalogued')).toHaveTextContent('Fuera de catálogo');
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent('1.5');
    // Importe is quantity × unit price, not the line total with materials.
    expect(screen.getByTestId('document-line-amount')).toHaveTextContent('$6,300.00');
    expect(screen.getByText('Materiales · 2')).toBeInTheDocument();
    expect(screen.getByText('Filtro de aire')).toBeInTheDocument();
    expect(screen.getByText('1 pza')).toBeInTheDocument();
    expect(screen.getByTestId('document-line-subtotal')).toHaveTextContent(
      'Subtotal Instalación mini-split · servicio + materiales',
    );
    expect(screen.getByTestId('document-line-subtotal').parentElement).toHaveTextContent('$6,600.00');
    expect(row.className).not.toContain('truncate');
    expect(screen.getByText('Instalación mini-split').className).toContain('[overflow-wrap:anywhere]');
  });

  it('in Compacto the chip names the materials total and opens only that line', async () => {
    const user = userEvent.setup();
    render(
      <>
        <DocumentLineRow
          layout="receipt"
          name="Instalación"
          quantity={2}
          price={4200}
          amount={8700}
          density="compact"
          materials={receiptMaterials}
        />
        <DocumentLineRow
          layout="receipt"
          name="Mantenimiento"
          quantity={1}
          price={100}
          amount={125}
          density="compact"
          materials={[{ id: 3, name: 'Gas', quantity: 1, unit: 'kg', price: 25 }]}
        />
      </>,
    );

    const chip = screen.getByRole('button', { name: '2 materiales · $300.00' });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Filtro de aire')).toBeNull();
    expect(screen.getAllByTestId('document-line-subtotal')).toHaveLength(2);

    await user.click(chip);
    expect(chip).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Filtro de aire')).toBeInTheDocument();
    expect(screen.queryByText('Gas')).toBeNull();
  });

  it('keeps the phone row when the receipt layout is below 1024px', () => {
    mockDesktopWidth(false);
    render(
      <DocumentLineRow
        layout="receipt"
        name="Instalación mini-split"
        description="No se muestra en el teléfono"
        serviceId={null}
        quantity={2}
        price={4200}
        amount={8700}
        materials={receiptMaterials}
        onClick={() => undefined}
      />,
    );

    expect(screen.getByTestId('document-line-row')).not.toHaveAttribute('data-layout', 'receipt');
    expect(screen.queryByTestId('document-line-description')).toBeNull();
    expect(screen.queryByText('Fuera de catálogo')).toBeNull();
    expect(screen.getByTestId('document-line-meta')).toHaveTextContent('2 × $4,200.00');
    expect(screen.getByTestId('document-line-amount')).toHaveTextContent('$8,700.00');
    expect(screen.queryByText('Filtro de aire')).toBeNull();
  });
});

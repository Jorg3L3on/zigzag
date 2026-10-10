import { fireEvent, render, screen } from '@testing-library/react';
import { TicketAddServicePanel } from '@/components/tickets/ticket-add-service-panel';

// Materials UI (ZIG-I10) searches the catalog through this server action.
jest.mock('@/actions/services', () => ({
  searchMaterials: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock('@/contexts/company-context', () => ({
  useCompany: () => ({ selectedCompany: { id: 10, name: 'Demo Co' } }),
}));

const service = {
  id: 1,
  name: 'Consultoría',
  description: 'Asesoría',
  price: '100.00',
  company_id: 1,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: new Date('2026-05-01T00:00:00Z'),
  deleted_at: null,
};

const baseProps = {
  isOpen: false,
  onOpenChange: jest.fn(),
  services: [service],
  filteredServices: [service],
  selectedService: '',
  onServiceSelect: jest.fn(),
  searchTerm: '',
  onSearchTermChange: jest.fn(),
  quantity: '1',
  onQuantityChange: jest.fn(),
  onQuantityAdjust: jest.fn(),
  price: '100',
  onPriceChange: jest.fn(),
  onPriceAdjust: jest.fn(),
  lineMode: 'catalog' as const,
  onLineModeChange: jest.fn(),
  customName: '',
  onCustomNameChange: jest.fn(),
  customDescription: '',
  onCustomDescriptionChange: jest.fn(),
  saveToCatalog: false,
  onSaveToCatalogChange: jest.fn(),
  materials: [],
  onMaterialsChange: jest.fn(),
  isSubmitting: false,
  onAddService: jest.fn(),
};

describe('TicketAddServicePanel', () => {
  it('renders the add-service trigger', () => {
    render(<TicketAddServicePanel {...baseProps} />);

    expect(
      screen.getByRole('button', { name: /agregar servicio/i }),
    ).toBeInTheDocument();
  });

  it('shows the add-service dialog content when open', () => {
    render(<TicketAddServicePanel {...baseProps} isOpen />);

    expect(
      screen.getByRole('heading', { name: /agregar servicio al ticket/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/selecciona un servicio de tu catálogo/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /del catálogo/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('switches to Nuevo mode through the segmented control (ZIG-I5)', () => {
    const onLineModeChange = jest.fn();
    render(
      <TicketAddServicePanel
        {...baseProps}
        isOpen
        onLineModeChange={onLineModeChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /nuevo/i }));
    expect(onLineModeChange).toHaveBeenCalledWith('custom');
  });

  it('Nuevo mode shows name, description and an off Guardar en mi catálogo switch', () => {
    const onSaveToCatalogChange = jest.fn();
    const onCustomNameChange = jest.fn();
    render(
      <TicketAddServicePanel
        {...baseProps}
        isOpen
        lineMode="custom"
        onCustomNameChange={onCustomNameChange}
        onSaveToCatalogChange={onSaveToCatalogChange}
      />,
    );

    expect(screen.queryByRole('combobox', { name: 'Servicio' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre del servicio'), {
      target: { value: 'Cambio de capacitor' },
    });
    expect(onCustomNameChange).toHaveBeenCalledWith('Cambio de capacitor');

    const toggle = screen.getByRole('switch', { name: /guardar en mi catálogo/i });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/sólo en este ticket/i)).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(onSaveToCatalogChange).toHaveBeenCalledWith(true);

    // No name yet: the add button stays disabled.
    expect(screen.getByRole('button', { name: /agregar al ticket/i })).toBeDisabled();
  });

  it('enables Agregar in Nuevo mode once a name is typed', () => {
    render(
      <TicketAddServicePanel
        {...baseProps}
        isOpen
        lineMode="custom"
        customName="Visita"
        saveToCatalog
      />,
    );

    expect(screen.getByRole('button', { name: /agregar al ticket/i })).toBeEnabled();
    expect(screen.getByText(/también quedará en servicios/i)).toBeInTheDocument();
  });

  it('shows a live subtotal of Cantidad × Precio', () => {
    const { rerender } = render(
      <TicketAddServicePanel
        {...baseProps}
        isOpen
        selectedService="1"
        quantity="3"
        price="4200"
      />,
    );

    expect(screen.getByTestId('ticket-add-service-subtotal-value')).toHaveTextContent(
      '$12,600.00',
    );
    expect(screen.getByTestId('ticket-add-service-subtotal')).toHaveTextContent(
      '3 × $4,200.00',
    );

    rerender(
      <TicketAddServicePanel {...baseProps} isOpen quantity="2" price="10.005" />,
    );
    expect(
      screen.getByTestId('ticket-add-service-subtotal-value'),
    ).toHaveAttribute('data-value', '20.01');
  });

  it('shows the line materials and adds them to the subtotal (ZIG-I10-4)', () => {
    render(
      <TicketAddServicePanel
        {...baseProps}
        isOpen
        selectedService="1"
        quantity="2"
        price="100"
        materials={[
          {
            key: 'm1',
            material_id: 9,
            name: 'Gas R410A',
            unit: 'kg',
            quantity: 1.5,
            price: 380,
            save_to_catalog: false,
          },
        ]}
      />,
    );

    expect(screen.getByText('1.5 kg × $380.00')).toBeTruthy();
    expect(screen.getByTestId('ticket-add-service-subtotal')).toHaveTextContent(
      'Servicio $200.00 · Materiales $570.00',
    );
  });
});


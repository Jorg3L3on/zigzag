import { render, screen } from '@testing-library/react';
import { TicketAddServicePanel } from '@/components/tickets/ticket-add-service-panel';

jest.mock('@/components/services/service-form', () => ({
  ServiceForm: () => <div>Formulario de servicio</div>,
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
  isCreatingNewService: false,
  onStartCreateService: jest.fn(),
  onCancelCreateService: jest.fn(),
  onServiceCreated: jest.fn(),
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
    expect(screen.getByText(/selecciona un servicio existente/i)).toBeInTheDocument();
  });

  it('shows the create-service form when creating inline', () => {
    render(
      <TicketAddServicePanel
        {...baseProps}
        isOpen
        isCreatingNewService
      />,
    );

    expect(
      screen.getByRole('heading', { name: /crear nuevo servicio/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Formulario de servicio')).toBeInTheDocument();
  });
});

const mockRequirePagePermission = jest.fn();
const mockGetTicketById = jest.fn();

jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
jest.mock('@/lib/page-authz', () => ({
  requirePagePermission: (...args: unknown[]) => mockRequirePagePermission(...args),
}));
jest.mock('@/actions/tickets', () => ({
  getTicketById: (...args: unknown[]) => mockGetTicketById(...args),
}));
jest.mock('@/components/pdf/document-pdf-viewer', () => ({
  DocumentPdfViewer: () => null,
}));

import TicketReciboPage from './page';

const ticket = {
  id: BigInt(1113),
  document_kind: 'ticket',
  finished: true,
  client_name: 'Cliente Demo',
  client_tel: '9613151559',
  ticket_date: new Date('2026-10-08T12:00:00Z'),
  total: 1000,
  paid: 1000,
  services_tickets: [
    { id: BigInt(1), service_id: 7, quantity: 1, price: 1000, service: { name: 'Mantenimiento' } },
  ],
};

const call = (id: string, from?: string) =>
  TicketReciboPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(from ? { from } : {}),
  });

describe('/tickets/[id]/recibo page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePagePermission.mockResolvedValue(undefined);
  });

  it('requires tickets.read before loading anything', async () => {
    mockRequirePagePermission.mockRejectedValue(new Error('FORBIDDEN'));
    await expect(call('1113')).rejects.toThrow('FORBIDDEN');
    expect(mockGetTicketById).not.toHaveBeenCalled();
    expect(mockRequirePagePermission).toHaveBeenCalledWith('tickets.read');
  });

  it('renders not found for a cross-tenant id (action denies it)', async () => {
    mockGetTicketById.mockResolvedValue({ success: false, error: 'not found' });
    await expect(call('1113')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetTicketById).toHaveBeenCalledWith(1113);
  });

  it.each(['abc', '0', '-4'])('renders not found for invalid id %s', async (id) => {
    await expect(call(id)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetTicketById).not.toHaveBeenCalled();
  });

  it('renders not found for a presupuesto', async () => {
    mockGetTicketById.mockResolvedValue({
      success: true,
      data: { ...ticket, document_kind: 'presupuesto' },
    });
    await expect(call('1113')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders not found for a ticket that is not finished yet', async () => {
    mockGetTicketById.mockResolvedValue({
      success: true,
      data: { ...ticket, finished: false },
    });
    await expect(call('1113')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('goes back to the ticket detail by default', async () => {
    mockGetTicketById.mockResolvedValue({ success: true, data: ticket });
    const element = await call('1113');

    expect(element.props).toMatchObject({
      ticketId: '1113',
      kind: 'recibo',
      title: 'Recibo #1113',
      subtitle: 'Finalizado · Saldado',
      backHref: '/tickets/1113',
    });
  });

  it('goes back to the creation review when reached from it', async () => {
    mockGetTicketById.mockResolvedValue({ success: true, data: { ...ticket, paid: 0 } });
    const element = await call('1113', 'listo');

    expect(element.props).toMatchObject({
      subtitle: 'Finalizado · Pendiente',
      backHref: '/tickets/1113/listo',
    });
  });
});

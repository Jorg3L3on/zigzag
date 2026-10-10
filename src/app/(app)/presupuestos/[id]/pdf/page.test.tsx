const mockRequirePagePermission = jest.fn();
const mockGetPresupuestoById = jest.fn();

jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
jest.mock('@/lib/page-authz', () => ({
  requirePagePermission: (...args: unknown[]) => mockRequirePagePermission(...args),
}));
jest.mock('@/actions/presupuestos', () => ({
  getPresupuestoById: (...args: unknown[]) => mockGetPresupuestoById(...args),
}));
jest.mock('@/components/pdf/document-pdf-viewer', () => ({
  DocumentPdfViewer: () => null,
}));

import PresupuestoPdfPage, { generateMetadata } from './page';

const row = {
  id: BigInt(1069),
  client_id: 5,
  client_name: 'Cliente Demo',
  client_tel: '9613151559',
  ticket_date: new Date('2026-10-08T12:00:00Z'),
  expires_at: null,
  work_notes: null,
  total: 1000,
  converted_to_ticket_id: null,
  canceled_at: null,
  services_tickets: [
    { id: BigInt(1), service_id: 7, quantity: 1, price: 1000, service: { name: 'Mantenimiento' } },
  ],
};

const call = (id: string) => PresupuestoPdfPage({ params: Promise.resolve({ id }) });

describe('/presupuestos/[id]/pdf page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequirePagePermission.mockResolvedValue(undefined);
  });

  it('requires tickets.read before loading anything', async () => {
    mockRequirePagePermission.mockRejectedValue(new Error('FORBIDDEN'));
    await expect(call('1069')).rejects.toThrow('FORBIDDEN');
    expect(mockGetPresupuestoById).not.toHaveBeenCalled();
    expect(mockRequirePagePermission).toHaveBeenCalledWith('tickets.read');
  });

  it('renders not found for a cross-tenant or non-presupuesto id (action denies it)', async () => {
    mockGetPresupuestoById.mockResolvedValue({ success: false, error: 'not found' });
    await expect(call('1069')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetPresupuestoById).toHaveBeenCalledWith(1069);
  });

  it.each(['abc', '0', '-4', '1.5'])('renders not found for invalid id %s', async (id) => {
    await expect(call(id)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetPresupuestoById).not.toHaveBeenCalled();
  });

  it('passes the presupuesto to the viewer with back to the detail', async () => {
    mockGetPresupuestoById.mockResolvedValue({ success: true, data: row });
    const element = await call('1069');

    expect(element.props).toMatchObject({
      ticketId: '1069',
      kind: 'presupuesto',
      title: 'Presupuesto #1069',
      backHref: '/presupuestos/1069',
    });
  });

  it('titles the document', async () => {
    await expect(generateMetadata({ params: Promise.resolve({ id: '1069' }) })).resolves.toEqual({
      title: 'Presupuesto #1069 · PDF',
    });
  });
});

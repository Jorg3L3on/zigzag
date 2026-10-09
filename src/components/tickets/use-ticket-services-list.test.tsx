/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';

import { useTicketServicesList } from '@/components/tickets/use-ticket-services-list';

const mockCreateServiceTicket = jest.fn();

jest.mock('@/actions/ticket-services', () => ({
  createServiceTicket: (...args: unknown[]) => mockCreateServiceTicket(...args),
  updateServiceTicket: jest.fn(),
  deleteServiceTicket: jest.fn(),
  getTicketServices: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock('@/actions/services', () => ({
  getServices: jest.fn(async () => ({
    success: true,
    data: [{ id: 7, name: 'Mantenimiento', description: 'x', price: 4200 }],
  })),
}));

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe('useTicketServicesList inline lines (ZIG-I5)', () => {
  beforeEach(() => mockCreateServiceTicket.mockReset());

  it('submits an inline line and, when saved to the catalog, adds it to the services list', async () => {
    mockCreateServiceTicket.mockResolvedValue({
      success: true,
      data: {
        id: 12,
        service_id: 77,
        quantity: 2,
        price: 3500,
        service: { id: 77, name: 'Instalación', description: 'Instalación', price: 3500 },
      },
    });
    const { result } = renderHook(() =>
      useTicketServicesList({ ticketId: '42', companyId: 10 }),
    );
    await waitFor(() => expect(result.current.services).toHaveLength(1));

    act(() => {
      result.current.setLineMode('custom');
      result.current.setCustomName('  Instalación ');
      result.current.setCustomDescription('');
      result.current.setSaveToCatalog(true);
      result.current.setQuantity('2');
      result.current.setPrice('3500');
    });
    await act(async () => {
      await result.current.handleAddService();
    });

    expect(mockCreateServiceTicket).toHaveBeenCalledWith(
      '42',
      {
        kind: 'custom',
        name: 'Instalación',
        description: undefined,
        save_to_catalog: true,
        quantity: 2,
        price: 3500,
      },
      10,
    );
    expect(result.current.ticketServices).toHaveLength(1);
    expect(result.current.services.map((item) => item.id)).toEqual([77, 7]);
    // The form resets to catalog mode after a successful add.
    expect(result.current.lineMode).toBe('catalog');
    expect(result.current.customName).toBe('');
    expect(result.current.saveToCatalog).toBe(false);
  });

  it('does not submit an inline line without a name', async () => {
    const { result } = renderHook(() =>
      useTicketServicesList({ ticketId: '42', companyId: 10 }),
    );
    act(() => {
      result.current.setLineMode('custom');
      result.current.setPrice('100');
    });
    await act(async () => {
      await result.current.handleAddService();
    });
    expect(mockCreateServiceTicket).not.toHaveBeenCalled();
  });
});

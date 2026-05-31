import { PERMISSIONS } from '@/lib/permissions';
import {
  canCollectTicketPayment,
  canDownloadTicketInvoice,
  canEditTicket,
  canFinishTicket,
  canReadTickets,
  canWriteTickets,
  TICKETS_READ_PERMISSION,
  TICKETS_WRITE_PERMISSION,
} from '@/lib/tickets-rbac';
import {
  requireTicketRead,
  requireTicketWrite,
} from '@/lib/tickets-rbac-server';
import { requireActionPermission } from '@/lib/security';

jest.mock('@/lib/security', () => ({
  requireActionPermission: jest.fn(),
}));

const mockRequireActionPermission =
  requireActionPermission as jest.MockedFunction<typeof requireActionPermission>;

describe('tickets RBAC contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps read/write to tickets permissions', () => {
    expect(TICKETS_READ_PERMISSION).toBe(PERMISSIONS.tickets.read);
    expect(TICKETS_WRITE_PERMISSION).toBe(PERMISSIONS.tickets.write);
  });

  it('gates capabilities by read/write', () => {
    const readOnly = (permission?: string) => permission === PERMISSIONS.tickets.read;
    const writeUser = (permission?: string) =>
      permission === PERMISSIONS.tickets.write || permission === PERMISSIONS.tickets.read;

    expect(canReadTickets(readOnly)).toBe(true);
    expect(canWriteTickets(readOnly)).toBe(false);
    expect(canEditTicket(readOnly)).toBe(false);
    expect(canCollectTicketPayment(readOnly)).toBe(false);
    expect(canDownloadTicketInvoice(readOnly)).toBe(true);

    expect(canWriteTickets(writeUser)).toBe(true);
    expect(canFinishTicket(writeUser)).toBe(true);
  });

  it('delegates server read to tickets.read', async () => {
    mockRequireActionPermission.mockResolvedValueOnce({
      context: { userId: '1', companyId: 1, companyIsSystem: false },
      companyId: 1,
    });

    await requireTicketRead(1);
    expect(mockRequireActionPermission).toHaveBeenCalledWith(
      PERMISSIONS.tickets.read,
      1,
    );
  });

  it('delegates server write to tickets.write', async () => {
    mockRequireActionPermission.mockResolvedValueOnce({
      context: { userId: '1', companyId: 1, companyIsSystem: false },
      companyId: 1,
    });

    await requireTicketWrite(1);
    expect(mockRequireActionPermission).toHaveBeenCalledWith(
      PERMISSIONS.tickets.write,
      1,
    );
  });
});

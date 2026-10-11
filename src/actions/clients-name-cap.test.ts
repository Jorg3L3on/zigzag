import { createClient, updateClient } from '@/actions/clients';
import { CLIENT_NAME_MAX_LENGTH } from '@/lib/client-limits';
import { db } from '@/lib/db';
import { requireTenantActionPermission } from '@/lib/security';

jest.mock('@/lib/db', () => ({
  db: {
    insert: jest.fn(),
    update: jest.fn(),
    select: jest.fn(),
    query: { client: { findFirst: jest.fn() } },
  },
}));
jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
  requireTenantActionPermission: jest.fn(),
}));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/resource-audit', () => ({ recordResourceAudit: jest.fn() }));
jest.mock('@/lib/client-service-schedule-lifecycle', () => ({
  pauseSchedulesForClient: jest.fn(),
}));

const mockDb = db as unknown as {
  insert: jest.Mock;
  update: jest.Mock;
  query: { client: { findFirst: jest.Mock } };
};

const payload = (name: string) => ({
  name,
  phone: '5551234567',
  email: null,
  address: null,
  street: null,
  exterior_number: null,
  interior_number: null,
  neighborhood: null,
  city: null,
  state: null,
  postal_code: null,
  country: null,
  company_id: 10,
});

describe('client name cap (ZIG-I12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTenantActionPermission as jest.Mock).mockResolvedValue({
      context: { userId: '1', companyId: 10, companyIsSystem: false },
      companyId: 10,
    });
    mockDb.insert.mockReturnValue({
      values: () => ({ returning: async () => [{ id: 1, name: 'ok' }] }),
    });
    mockDb.update.mockReturnValue({
      set: () => ({ where: () => ({ returning: async () => [{ id: 1, name: 'ok' }] }) }),
    });
  });

  it('rejects a 101-character name on create with CL008', async () => {
    const result = await createClient(payload('N'.repeat(CLIENT_NAME_MAX_LENGTH + 1)));

    expect(result).toMatchObject({ success: false, errorCode: 'CL008', errorType: 'validation' });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('accepts exactly 100 characters', async () => {
    const result = await createClient(payload('N'.repeat(CLIENT_NAME_MAX_LENGTH)));

    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('rejects a changed name over 100 on update', async () => {
    mockDb.query.client.findFirst.mockResolvedValue({ id: 1, name: 'Corto' });

    const result = await updateClient({ id: 1, ...payload('N'.repeat(101)) });

    expect(result).toMatchObject({ success: false, errorCode: 'CL008' });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('lets a client saved with a longer name keep saving it unchanged', async () => {
    const legacy = 'L'.repeat(157);
    mockDb.query.client.findFirst.mockResolvedValue({ id: 1, name: legacy });

    const result = await updateClient({ id: 1, ...payload(legacy) });

    expect(result.success).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });
});

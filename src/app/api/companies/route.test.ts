import { GET, POST, PUT } from '@/app/api/companies/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  mockTenantBCrossTenantDenied,
  makeGetRequest,
  makeJsonRequest,
} from '@/test/cross-tenant-helpers';

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
    query: { user: { findFirst: jest.fn() }, company: { findFirst: jest.fn() } },
  },
}));

jest.mock('@/lib/company-schema', () => ({
  companyApiCreateSchema: { safeParse: jest.fn() },
  companyApiUpdateSchema: {
    safeParse: jest.fn((raw: unknown) => ({ success: true, data: raw })),
  },
  normalizeCompanySettingsForDb: jest.fn((settings) => settings ?? null),
}));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockDb = db as unknown as {
  select: jest.Mock;
  update: jest.Mock;
  query: { user: { findFirst: jest.Mock }; company: { findFirst: jest.Mock } };
};

describe('cross-tenant IDOR - /api/companies', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET denies tenant B while requesting foreign context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(makeGetRequest('http://localhost/api/companies'));

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith('companies.read');
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('POST denies tenant B for operator-only create surface', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await POST(
      makeJsonRequest('http://localhost/api/companies', {
        name: 'Foreign Co',
        owner: { name: 'Owner', email: 'owner@example.com', password: 'password' },
      }),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith('companies.write');
    expect(mockDb.query.user.findFirst).not.toHaveBeenCalled();
  });

  it('PUT denies tenant B when targeting company A id', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await PUT(
      makeJsonRequest(
        'http://localhost/api/companies',
        {
          id: IDOR_COMPANY_A.id,
          name: 'IDOR Company A',
          phone: '5551234567',
          email: 'a@example.com',
          street: 'Street',
          exterior_number: '1',
          interior_number: null,
          neighborhood: 'Center',
          city: 'CDMX',
          state: 'CDMX',
          country: 'MX',
          postal_code: '01000',
          status: 'ACTIVE',
          settings: {},
        },
        'PUT',
      ),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'companies.write',
      IDOR_COMPANY_A.id,
    );
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});

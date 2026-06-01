import { requireApiPermission, requireSession } from '@/lib/api-helpers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkPermission } from '@/lib/security';
import { recordPermissionDeniedAudit } from '@/lib/audit-security';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({ body, init })),
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      user: {
        findFirst: jest.fn(),
      },
    },
  },
}));

jest.mock('@/lib/security', () => ({
  checkPermission: jest.fn(),
}));

jest.mock('@/lib/audit-security', () => ({
  recordPermissionDeniedAudit: jest.fn(),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCheckPermission = checkPermission as jest.MockedFunction<
  typeof checkPermission
>;
const mockRecordPermissionDeniedAudit =
  recordPermissionDeniedAudit as jest.MockedFunction<
    typeof recordPermissionDeniedAudit
  >;
const mockDb = db as unknown as {
  query: {
    user: {
      findFirst: jest.Mock;
    };
  };
};

describe('api helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes company claims from persisted user data', async () => {
    const session = {
      user: {
        id: '7',
        company_id: 99,
        company_name: 'Stale Co',
        company_is_system: true,
      },
    } as Awaited<ReturnType<typeof auth>>;

    mockAuth.mockResolvedValue(session);
    mockDb.query.user.findFirst.mockResolvedValue({
      id: 7n,
      company_id: 10,
      company: {
        id: 10,
        name: 'Fresh Co',
        deleted_at: null,
        status: 'ACTIVE',
        is_system: false,
      },
    });

    const result = await requireSession();

    expect(result.unauthorized).toBeNull();
    expect(result.session?.user.company_id).toBe(10);
    expect(result.session?.user.company_name).toBe('Fresh Co');
    expect(result.session?.user.company_is_system).toBe(false);
  });

  it('records API denied audit rows for invalid requested company context', async () => {
    const session = {
      user: {
        id: '8',
        company_id: 10,
        company_name: 'Tenant Co',
        company_is_system: false,
      },
    } as Awaited<ReturnType<typeof auth>>;

    mockAuth.mockResolvedValue(session);
    mockDb.query.user.findFirst.mockResolvedValue({
      id: 8n,
      company_id: 10,
      company: {
        id: 10,
        name: 'Tenant Co',
        deleted_at: null,
        status: 'ACTIVE',
        is_system: false,
      },
    });

    const result = await requireApiPermission('tickets.write', 99, {
      route: '/api/tickets/1',
      method: 'PATCH',
    });

    expect(result.session).toBeNull();
    expect(result.unauthorized?.init?.status).toBe(403);
    expect(mockCheckPermission).not.toHaveBeenCalled();
    expect(mockRecordPermissionDeniedAudit).toHaveBeenCalledWith({
      actor: {
        userId: '8',
        companyId: 10,
        companyIsSystem: false,
      },
      targetCompanyId: 99,
      permission: 'tickets.write',
      source: 'api',
      reason: 'invalid_company_context',
      actorCompanyId: 10,
      requestedCompanyId: 99,
      requestMeta: {
        route: '/api/tickets/1',
        method: 'PATCH',
      },
    });
  });
});

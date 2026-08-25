import {
  AgentAuthError,
  assertAgentCompanyAccess,
  resolveAccessibleCompanyIds,
} from '@/lib/server/resolve-agent-context';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      user: { findFirst: jest.fn() },
      company: { findFirst: jest.fn() },
      role: { findFirst: jest.fn() },
    },
    select: jest.fn(),
  },
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockUserFindFirst = db.query.user.findFirst as jest.Mock;
const mockCompanyFindFirst = db.query.company.findFirst as jest.Mock;
const mockRoleFindFirst = db.query.role.findFirst as jest.Mock;
const mockSelect = db.select as jest.Mock;

const mockSelectRows = (rows: unknown[]) => ({
  from: jest.fn(() => ({
    where: jest.fn(async () => rows),
  })),
});

const mockSelectLimitRows = (rows: unknown[]) => ({
  from: jest.fn(() => ({
    where: jest.fn(() => ({
      limit: jest.fn(async () => rows),
    })),
  })),
});

/** MCP / API-key calls have no NextAuth cookie session. */
const noCookieSession = () => mockAuth.mockResolvedValue(null);

describe('resolve-agent-context allow-list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    noCookieSession();
  });

  it('returns empty when allow-list is empty (fail closed)', async () => {
    const result = await resolveAccessibleCompanyIds(1n, []);
    expect(result).toEqual([]);
  });

  it('assertAgentCompanyAccess rejects empty allow-list with 403', async () => {
    await expect(
      assertAgentCompanyAccess(
        { userId: 1n, allowedCompanyIds: [] },
        10,
        'tickets.read',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('assertAgentCompanyAccess rejects company not on allow-list', async () => {
    await expect(
      assertAgentCompanyAccess(
        { userId: 1n, allowedCompanyIds: [1] },
        99,
        'tickets.read',
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Compañía no autorizada para esta conexión',
    });
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it('assertAgentCompanyAccess allows system user without cookie session (MCP)', async () => {
    mockUserFindFirst.mockResolvedValue({
      company_id: 1,
      company: { is_system: true, deleted_at: null, status: 'ACTIVE' },
    });
    mockSelect.mockReturnValue({
      from: jest.fn(() => ({
        where: jest.fn(async () => [{ id: 10 }]),
      })),
    });

    await expect(
      assertAgentCompanyAccess(
        { userId: 1n, allowedCompanyIds: [10] },
        10,
        'tickets.read',
      ),
    ).resolves.toBeUndefined();

    expect(mockAuth).not.toHaveBeenCalled();
    expect(mockRoleFindFirst).not.toHaveBeenCalled();
  });

  it('assertAgentCompanyAccess allows tenant with tickets.read without cookie session (MCP)', async () => {
    mockUserFindFirst.mockResolvedValue({
      company_id: 10,
      role_id: 7,
      company: { is_system: false, deleted_at: null, status: 'ACTIVE' },
    });
    mockCompanyFindFirst.mockResolvedValue({ id: 10, status: 'ACTIVE' });
    mockRoleFindFirst.mockResolvedValue({ id: 7, company_id: 10 });
    mockSelect
      .mockReturnValueOnce(mockSelectRows([{ id: 11 }]))
      .mockReturnValueOnce(mockSelectLimitRows([{ role_id: 7 }]));

    await expect(
      assertAgentCompanyAccess(
        { userId: 3n, allowedCompanyIds: [10] },
        10,
        'tickets.read',
      ),
    ).resolves.toBeUndefined();

    expect(mockAuth).not.toHaveBeenCalled();
  });

  it('assertAgentCompanyAccess enforces RBAC after allow-list without cookie session', async () => {
    mockUserFindFirst.mockResolvedValue({
      company_id: 1,
      role_id: null,
      company: { is_system: false, deleted_at: null, status: 'ACTIVE' },
    });
    mockCompanyFindFirst.mockResolvedValue({ id: 1, status: 'ACTIVE' });

    await expect(
      assertAgentCompanyAccess(
        { userId: 1n, allowedCompanyIds: [1] },
        1,
        'tickets.read',
      ),
    ).rejects.toMatchObject({
      status: 403,
      message: 'Permiso "tickets.read" requerido para esta compañía',
    });

    expect(mockAuth).not.toHaveBeenCalled();
  });
});

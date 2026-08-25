import {
  AgentAuthError,
  assertAgentCompanyAccess,
  resolveAccessibleCompanyIds,
} from '@/lib/server/resolve-agent-context';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      user: { findFirst: jest.fn() },
      company: { findFirst: jest.fn() },
    },
    select: jest.fn(),
  },
}));

jest.mock('@/lib/security', () => ({
  checkPermission: jest.fn(),
}));

import { db } from '@/lib/db';
import { checkPermission } from '@/lib/security';

const mockUserFindFirst = db.query.user.findFirst as jest.Mock;
const mockCompanyFindFirst = db.query.company.findFirst as jest.Mock;
const mockCheckPermission = checkPermission as jest.Mock;

describe('resolve-agent-context allow-list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    ).rejects.toBeInstanceOf(AgentAuthError);
  });

  it('assertAgentCompanyAccess enforces RBAC after allow-list', async () => {
    mockUserFindFirst.mockResolvedValue({
      company_id: 1,
      company: { is_system: false, deleted_at: null },
    });
    mockCompanyFindFirst.mockResolvedValue({ id: 1, status: 'ACTIVE' });
    mockCheckPermission.mockResolvedValue(false);

    await expect(
      assertAgentCompanyAccess(
        { userId: 1n, allowedCompanyIds: [1] },
        1,
        'tickets.read',
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

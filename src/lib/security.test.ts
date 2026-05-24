import {
  resolveWritableCompanyId,
  requireSystemUser,
  type ActionAuthContext,
} from '@/lib/authz-context';
import { checkPermission, requireActionAuth } from '@/lib/security';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      user: {
        findFirst: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
      },
    },
    select: jest.fn(),
  },
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockDb = db as unknown as {
  query: {
    user: {
      findFirst: jest.Mock;
    };
    role: {
      findFirst: jest.Mock;
    };
  };
  select: jest.Mock;
};

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

describe('security helpers', () => {
  const regularContext: ActionAuthContext = {
    userId: '1',
    companyId: 10,
    companyIsSystem: false,
  };

  const systemContext: ActionAuthContext = {
    userId: '2',
    companyId: 1,
    companyIsSystem: true,
  };

  it('denies cross-tenant writable company for regular users', () => {
    expect(() => resolveWritableCompanyId(regularContext, 99)).toThrow(
      'Access denied to requested company',
    );
  });

  it('allows requested company for system users', () => {
    expect(resolveWritableCompanyId(systemContext, 99)).toBe(99);
  });

  it('denies system-only operation for regular users', () => {
    expect(() => requireSystemUser(regularContext)).toThrow(
      'System-level access required',
    );
  });

  describe('checkPermission', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('allows root-company users without role lookups', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '1',
          company_id: 1,
          company_is_system: true,
        },
      } as Awaited<ReturnType<typeof auth>>);

      await expect(checkPermission('1', 99, 'users.write')).resolves.toBe(true);
      expect(mockDb.query.user.findFirst).not.toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('denies regular users without a role', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '2',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({ id: 2n, role_id: null });

      await expect(checkPermission('2', 10, 'clients.read')).resolves.toBe(
        false,
      );
    });

    it('allows regular users with a matching company permission', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '3',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({ id: 3n, role_id: 7 });
      mockDb.query.role.findFirst.mockResolvedValue({ id: 7 });
      mockDb.select
        .mockReturnValueOnce(mockSelectRows([{ id: 11 }]))
        .mockReturnValueOnce(mockSelectLimitRows([{ role_id: 7 }]));

      await expect(checkPermission('3', 10, 'tickets.read')).resolves.toBe(
        true,
      );
    });

    it('denies regular users outside their company', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '4',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);

      await expect(checkPermission('4', 99, 'tickets.read')).resolves.toBe(
        false,
      );
      expect(mockDb.query.user.findFirst).not.toHaveBeenCalled();
    });

    it('fails closed when the permission row is missing', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '5',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({ id: 5n, role_id: 8 });
      mockDb.query.role.findFirst.mockResolvedValue({ id: 8 });
      mockDb.select.mockReturnValueOnce(mockSelectRows([]));

      await expect(checkPermission('5', 10, 'missing.permission')).resolves.toBe(
        false,
      );
    });

    it('denies permissions granted through a deleted role', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '6',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({ id: 6n, role_id: 9 });
      mockDb.query.role.findFirst.mockResolvedValue(null);

      await expect(checkPermission('6', 10, 'tickets.read')).resolves.toBe(
        false,
      );
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe('requireActionAuth', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns auth context for active users in active companies', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '7',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 7n,
        company_id: 10,
        company: { id: 10, deleted_at: null, status: 'ACTIVE' },
      });

      await expect(requireActionAuth()).resolves.toEqual({
        userId: '7',
        companyId: 10,
        companyIsSystem: false,
      });
    });

    it('rejects stale sessions for deleted users or inactive companies', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '8',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 8n,
        company: { id: 10, deleted_at: null, status: 'INACTIVE' },
      });

      await expect(requireActionAuth()).rejects.toThrow(
        'Authentication required',
      );
    });
  });
});

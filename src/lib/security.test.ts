import {
  resolveWritableCompanyId,
  requireSystemUser,
  type ActionAuthContext,
} from '@/lib/authz-context';
import {
  checkPermission,
  requireActionAuth,
  requireActionPermission,
} from '@/lib/security';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recordPermissionDeniedAudit } from '@/lib/audit-security';

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

jest.mock('@/lib/audit-security', () => ({
  recordPermissionDeniedAudit: jest.fn(),
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockRecordPermissionDeniedAudit =
  recordPermissionDeniedAudit as jest.MockedFunction<
    typeof recordPermissionDeniedAudit
  >;
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

    it('allows persisted root-company users without role permission lookups', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '1',
          company_id: 1,
          company_is_system: true,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 1n,
        company_id: 1,
        role_id: null,
        company: {
          id: 1,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: true,
        },
      });

      await expect(checkPermission('1', 99, 'users.write')).resolves.toBe(true);
      expect(mockDb.query.user.findFirst).toHaveBeenCalledTimes(1);
      expect(mockDb.query.role.findFirst).not.toHaveBeenCalled();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('does not grant root access from stale session claims alone', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '9',
          company_id: 1,
          company_is_system: true,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 9n,
        company_id: 1,
        role_id: null,
        company: {
          id: 1,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: false,
        },
      });

      await expect(checkPermission('9', 99, 'users.write')).resolves.toBe(false);
      expect(mockDb.query.role.findFirst).not.toHaveBeenCalled();
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
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 2n,
        company_id: 10,
        role_id: null,
        company: {
          id: 10,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: false,
        },
      });

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
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 3n,
        company_id: 10,
        role_id: 7,
        company: {
          id: 10,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: false,
        },
      });
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
      expect(mockDb.query.user.findFirst).toHaveBeenCalledTimes(1);
      expect(mockDb.query.role.findFirst).not.toHaveBeenCalled();
    });

    it('denies when the permission exists but the role lacks a grant', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '12',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 12n,
        company_id: 10,
        role_id: 10,
        company: {
          id: 10,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: false,
        },
      });
      mockDb.query.role.findFirst.mockResolvedValue({ id: 10 });
      mockDb.select
        .mockReturnValueOnce(mockSelectRows([{ id: 11 }]))
        .mockReturnValueOnce(mockSelectLimitRows([]));

      await expect(checkPermission('12', 10, 'tickets.read')).resolves.toBe(
        false,
      );
    });

    it('fails closed when the permission row is missing', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '5',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 5n,
        company_id: 10,
        role_id: 8,
        company: {
          id: 10,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: false,
        },
      });
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
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 6n,
        company_id: 10,
        role_id: 9,
        company: {
          id: 10,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: false,
        },
      });
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
        company: { id: 10, deleted_at: null, status: 'SUSPENDED' },
      });

      await expect(requireActionAuth()).rejects.toThrow(
        'Authentication required',
      );
    });
  });

  describe('requireActionPermission', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('records denied audit rows for invalid Server Action company context', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '10',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 10n,
        company_id: 10,
        company: {
          id: 10,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: false,
        },
      });

      await expect(
        requireActionPermission('tickets.write', 99),
      ).rejects.toThrow('Access denied to requested company');

      expect(mockRecordPermissionDeniedAudit).toHaveBeenCalledWith({
        actor: {
          userId: '10',
          companyId: 10,
          companyIsSystem: false,
        },
        targetCompanyId: 99,
        permission: 'tickets.write',
        source: 'action',
        reason: 'invalid_company_context',
        actorCompanyId: 10,
        requestedCompanyId: 99,
      });
    });

    it('continues recording missing-permission denials', async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: '11',
          company_id: 10,
          company_is_system: false,
        },
      } as Awaited<ReturnType<typeof auth>>);
      mockDb.query.user.findFirst.mockResolvedValue({
        id: 11n,
        company_id: 10,
        role_id: null,
        company: {
          id: 10,
          deleted_at: null,
          status: 'ACTIVE',
          is_system: false,
        },
      });

      await expect(
        requireActionPermission('tickets.write', 10),
      ).rejects.toThrow('Missing permission: tickets.write');

      expect(mockRecordPermissionDeniedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          targetCompanyId: 10,
          permission: 'tickets.write',
          source: 'action',
          reason: 'missing_permission',
          actorCompanyId: 10,
          requestedCompanyId: 10,
        }),
      );
    });
  });
});

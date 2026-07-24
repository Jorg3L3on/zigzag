import { AuthorizationError } from '@/lib/errors';
import { PERMISSIONS } from '@/lib/permissions';
import { requireActionPermission } from '@/lib/security';
import {
  requireClientRead,
  requireClientWrite,
} from '@/lib/clients-rbac-server';
import {
  requireCompanyRead,
  requireCompanyWrite,
} from '@/lib/companies-rbac-server';
import {
  requirePermissionRead,
  requirePermissionWrite,
} from '@/lib/permissions-rbac-server';
import {
  requireRoleRead,
  requireRoleWrite,
} from '@/lib/roles-rbac-server';
import {
  requireScheduleRead,
  requireScheduleWrite,
} from '@/lib/service-schedules-rbac-server';
import {
  requireServiceRead,
  requireServiceWrite,
} from '@/lib/services-rbac-server';
import {
  requireTicketRead,
  requireTicketWrite,
} from '@/lib/tickets-rbac-server';
import {
  requireUserRead,
  requireUserWrite,
} from '@/lib/users-rbac-server';

jest.mock('@/lib/security', () => ({
  requireActionPermission: jest.fn(),
}));

const mockRequireActionPermission =
  requireActionPermission as jest.MockedFunction<typeof requireActionPermission>;

const authContext = {
  context: { userId: '1', companyId: 10, companyIsSystem: false },
  companyId: 10,
};

type RequireFn = (companyId?: number | null) => Promise<unknown>;

const resourceGuards: Array<{
  label: string;
  read: RequireFn;
  write: RequireFn;
  readPermission: string;
  writePermission: string;
}> = [
  {
    label: 'tickets',
    read: requireTicketRead,
    write: requireTicketWrite,
    readPermission: PERMISSIONS.tickets.read,
    writePermission: PERMISSIONS.tickets.write,
  },
  {
    label: 'clients',
    read: requireClientRead,
    write: requireClientWrite,
    readPermission: PERMISSIONS.clients.read,
    writePermission: PERMISSIONS.clients.write,
  },
  {
    label: 'services',
    read: requireServiceRead,
    write: requireServiceWrite,
    readPermission: PERMISSIONS.services.read,
    writePermission: PERMISSIONS.services.write,
  },
  {
    label: 'users',
    read: requireUserRead,
    write: requireUserWrite,
    readPermission: PERMISSIONS.users.read,
    writePermission: PERMISSIONS.users.write,
  },
  {
    label: 'roles',
    read: requireRoleRead,
    write: requireRoleWrite,
    readPermission: PERMISSIONS.roles.read,
    writePermission: PERMISSIONS.roles.write,
  },
  {
    label: 'permissions',
    read: requirePermissionRead,
    write: requirePermissionWrite,
    readPermission: PERMISSIONS.permissions.read,
    writePermission: PERMISSIONS.permissions.write,
  },
  {
    label: 'companies',
    read: requireCompanyRead,
    write: requireCompanyWrite,
    readPermission: PERMISSIONS.companies.read,
    writePermission: PERMISSIONS.companies.write,
  },
];

describe('resource RBAC server helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireActionPermission.mockResolvedValue(authContext);
  });

  it.each(resourceGuards)(
    '$label delegates read/write to the canonical permissions',
    async ({ read, write, readPermission, writePermission }) => {
      await expect(read(10)).resolves.toEqual(authContext);
      await expect(write(10)).resolves.toEqual(authContext);

      expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
        1,
        readPermission,
        10,
      );
      expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
        2,
        writePermission,
        10,
      );
    },
  );

  it.each(resourceGuards)(
    '$label normalizes null/undefined company id to undefined',
    async ({ read, write, readPermission, writePermission }) => {
      await read(null);
      await write(undefined);
      await read();

      expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
        1,
        readPermission,
        undefined,
      );
      expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
        2,
        writePermission,
        undefined,
      );
      expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
        3,
        readPermission,
        undefined,
      );
    },
  );

  it('schedule read delegates to tickets.read', async () => {
    await expect(requireScheduleRead(10)).resolves.toEqual(authContext);
    expect(mockRequireActionPermission).toHaveBeenCalledWith(
      PERMISSIONS.tickets.read,
      10,
    );
  });

  it('schedule read normalizes null company id to undefined', async () => {
    await requireScheduleRead(null);
    expect(mockRequireActionPermission).toHaveBeenCalledWith(
      PERMISSIONS.tickets.read,
      undefined,
    );
  });

  it('schedule write prefers tickets.write then falls back to clients.write', async () => {
    mockRequireActionPermission
      .mockRejectedValueOnce(new AuthorizationError('Missing permission'))
      .mockResolvedValueOnce(authContext);

    await expect(requireScheduleWrite(null)).resolves.toEqual(authContext);

    expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
      1,
      PERMISSIONS.tickets.write,
      undefined,
    );
    expect(mockRequireActionPermission).toHaveBeenNthCalledWith(
      2,
      PERMISSIONS.clients.write,
      undefined,
    );
  });

  it('schedule write succeeds on primary tickets.write without fallback', async () => {
    await expect(requireScheduleWrite(10)).resolves.toEqual(authContext);
    expect(mockRequireActionPermission).toHaveBeenCalledTimes(1);
    expect(mockRequireActionPermission).toHaveBeenCalledWith(
      PERMISSIONS.tickets.write,
      10,
    );
  });

  it('schedule write rethrows non-authorization errors from the primary check', async () => {
    mockRequireActionPermission.mockRejectedValueOnce(new Error('db down'));

    await expect(requireScheduleWrite(10)).rejects.toThrow('db down');
    expect(mockRequireActionPermission).toHaveBeenCalledTimes(1);
  });
});

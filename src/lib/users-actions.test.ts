import { updateOwnAccount, updateUser } from '@/actions/users';
import { db } from '@/lib/db';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';
import { compare, hash } from 'bcryptjs';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      user: {
        findFirst: jest.fn(),
      },
    },
    update: jest.fn(),
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
  requireSystemUser: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/governance-audit', () => ({
  actionAuthToGovernanceActor: jest.fn(() => ({ type: 'user', id: '1' })),
  recordGovernanceAudit: jest.fn(),
  sanitizeUserForAudit: jest.fn((row) => row),
}));

const mockDb = db as unknown as {
  query: {
    user: {
      findFirst: jest.Mock;
    };
  };
  update: jest.Mock;
};

const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;
const mockRequireActionPermission =
  requireActionPermission as jest.MockedFunction<typeof requireActionPermission>;
const mockRequireSystemUser = requireSystemUser as jest.MockedFunction<
  typeof requireSystemUser
>;
const mockCompare = compare as jest.MockedFunction<typeof compare>;
const mockHash = hash as jest.MockedFunction<typeof hash>;

function mockUpdateReturning(row: unknown) {
  const returning = jest.fn(async () => [row]);
  const where = jest.fn(() => ({ returning }));
  const set = jest.fn(() => ({ where }));
  mockDb.update.mockReturnValue({ set });

  return { set, where, returning };
}

describe('user actions', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireActionAuth.mockResolvedValue({
      userId: '1',
      companyId: 10,
      companyIsSystem: false,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('updateOwnAccount', () => {
    const existingUser = {
      id: 1n,
      name: 'Alice',
      email: 'alice@example.com',
      password: 'stored-hash',
      company_id: 10,
      role_id: 7,
      deleted_at: null,
    };

    it('requires the current password before changing email', async () => {
      mockDb.query.user.findFirst.mockResolvedValue(existingUser);

      const result = await updateOwnAccount({
        name: 'Alice',
        email: 'alice.new@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('US005');
      expect(mockCompare).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('rejects password changes when the current password is wrong', async () => {
      mockDb.query.user.findFirst.mockResolvedValue(existingUser);
      mockCompare.mockResolvedValue(false);

      const result = await updateOwnAccount({
        name: 'Alice',
        email: 'alice@example.com',
        currentPassword: 'wrong-password',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('US005');
      expect(mockCompare).toHaveBeenCalledWith('wrong-password', 'stored-hash');
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('rejects mismatched new password confirmation on the server', async () => {
      const result = await updateOwnAccount({
        name: 'Alice',
        email: 'alice@example.com',
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'different-password',
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('US005');
      expect(mockDb.query.user.findFirst).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('hashes and stores the new password after current password verification', async () => {
      const updatedUser = {
        ...existingUser,
        password: 'new-hash',
        updated_at: new Date('2026-06-20T00:00:00.000Z'),
      };
      mockDb.query.user.findFirst.mockResolvedValue(existingUser);
      mockCompare.mockResolvedValue(true);
      mockHash.mockResolvedValue('new-hash');
      const updateChain = mockUpdateReturning(updatedUser);

      const result = await updateOwnAccount({
        name: 'Alice Updated',
        email: 'alice@example.com',
        currentPassword: 'old-password',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      });

      expect(result.success).toBe(true);
      expect(mockCompare).toHaveBeenCalledWith('old-password', 'stored-hash');
      expect(mockHash).toHaveBeenCalledWith('new-password', 10);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Alice Updated',
          email: 'alice@example.com',
          password: 'new-hash',
        }),
      );
    });
  });

  describe('updateUser', () => {
    it('rejects short admin-set passwords before updating the user row', async () => {
      mockRequireActionPermission.mockResolvedValue(undefined);
      mockRequireSystemUser.mockReturnValue(undefined);

      const result = await updateUser(2n, {
        name: 'Bob',
        email: 'bob@example.com',
        password: 'short',
        company_id: 10,
        role_id: 7,
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('US005');
      expect(mockDb.query.user.findFirst).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });
});

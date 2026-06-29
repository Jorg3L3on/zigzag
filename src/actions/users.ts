'use server';

import { count, desc, eq, and, ilike, isNull, or } from 'drizzle-orm';
import { role, user, type Company, type Role } from '@/db/schema';
import { db } from '@/lib/db';
import {
  AppError,
  buildActionError,
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  assertCompanyEntitlementAllows,
  CompanyEntitlementExceededError,
} from '@/lib/company-entitlement-guard';
import {
  requireActionAuth,
  requireActionPermission,
} from '@/lib/security';
import { compare, hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  actionAuthToGovernanceActor,
  recordGovernanceAudit,
  sanitizeUserForAudit,
} from '@/lib/governance-audit';
import { bumpUserTokenVersion } from '@/lib/session-revocation';

const PASSWORD_MIN_LENGTH = 8;
const passwordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
  );

const userSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('El correo electrónico no es válido'),
  password: passwordSchema.optional(),
  company_id: z.number().min(1, 'La empresa es requerida'),
  role_id: z.number().optional(),
});

const createUserSchema = userSchema.extend({
  password: passwordSchema,
});

const accountSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('El correo electrónico no es válido'),
    currentPassword: z.string().optional(),
    newPassword: passwordSchema.optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isChangingPassword = Boolean(
      data.newPassword || data.confirmPassword,
    );

    if (!isChangingPassword) {
      return;
    }

    if (!data.currentPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La contraseña actual es requerida',
        path: ['currentPassword'],
      });
    }

    if (!data.newPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'La nueva contraseña es requerida',
        path: ['newPassword'],
      });
    }

    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword'],
      });
    }
  });

export type UserFormData = z.infer<typeof userSchema>;
export type CreateUserFormData = z.infer<typeof createUserSchema>;
export type AccountFormData = z.infer<typeof accountSchema>;

type UserWithRelations = typeof user.$inferSelect & {
  company: Company | null;
  role: Role | null;
};

/**
 * Ensure an assigned role belongs to the target company (or is a global role).
 * Prevents assigning another tenant's role, which would leak its permissions.
 */
async function assertRoleAssignableToCompany(
  roleId: number | undefined,
  companyId: number,
): Promise<void> {
  if (roleId === undefined) {
    return;
  }

  const roleRow = await db.query.role.findFirst({
    where: and(eq(role.id, roleId), isNull(role.deleted_at)),
  });

  if (
    !roleRow ||
    (roleRow.company_id !== null && roleRow.company_id !== companyId)
  ) {
    throw new AppError(
      'El rol seleccionado no pertenece a esta empresa',
      400,
      true,
      'US005',
    );
  }
}

export async function getUsers(): Promise<{
  success: boolean;
  data?: UserWithRelations[];
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const authContext = await requireActionAuth();
    await requireActionPermission('users.read', authContext.companyId);
    const users = await db.query.user.findMany({
      with: {
        company: true,
        role: true,
      },
      orderBy: [desc(user.created_at)],
      where: authContext.companyIsSystem
        ? isNull(user.deleted_at)
        : and(
            isNull(user.deleted_at),
            eq(user.company_id, authContext.companyId as number),
          ),
    });
    const visibleUsers = users.map((userRow) => ({
      ...userRow,
      company: userRow.company?.deleted_at ? null : userRow.company,
      role: userRow.role?.deleted_at ? null : userRow.role,
    }));

    return { success: true, data: visibleUsers as UserWithRelations[] };
  } catch (e) {
    return handleCodedServerActionError('users.list', 'US001', e);
  }
}

export interface PaginatedUsersData {
  items: UserWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Server-side paginated + searchable user list, scoped to the caller's company
 * (system operators see all). Mirrors `getClients` so large directories stay
 * responsive instead of loading every row to filter client-side. Search uses
 * `ilike` (accelerated by the pg_trgm GIN indexes from migration 0018).
 */
export async function getUsersPaginated(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{
  success: boolean;
  data?: PaginatedUsersData;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const authContext = await requireActionAuth();
    await requireActionPermission('users.read', authContext.companyId);

    const page = Math.max(1, Math.floor(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
    const search = params.search?.trim();

    const scope = authContext.companyIsSystem
      ? isNull(user.deleted_at)
      : and(
          isNull(user.deleted_at),
          eq(user.company_id, authContext.companyId as number),
        );

    const searchCondition = search
      ? or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`))
      : undefined;

    const whereCondition = and(
      scope,
      ...(searchCondition ? [searchCondition] : []),
    );

    const [{ total }] = await db
      .select({ total: count() })
      .from(user)
      .where(whereCondition);

    const rows = await db.query.user.findMany({
      where: whereCondition,
      with: { company: true, role: true },
      orderBy: [desc(user.created_at)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const items = rows.map((userRow) => ({
      ...userRow,
      company: userRow.company?.deleted_at ? null : userRow.company,
      role: userRow.role?.deleted_at ? null : userRow.role,
    })) as UserWithRelations[];

    return {
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  } catch (e) {
    return handleCodedServerActionError('users.list', 'US001', e);
  }
}

export async function createUser(data: CreateUserFormData): Promise<{
  success: boolean;
  data?: typeof user.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    // Company-scoped: system operators may target any company; tenant admins
    // with `users.write` may only target their own company (enforced by
    // resolveWritableCompanyId inside requireActionPermission).
    const { context: authContext, companyId: effectiveCompanyId } =
      await requireActionPermission('users.write', data.company_id);

    const validatedData = createUserSchema.parse(data);

    await assertCompanyEntitlementAllows(effectiveCompanyId, 'users');
    await assertRoleAssignableToCompany(
      validatedData.role_id,
      effectiveCompanyId,
    );

    const hashedPassword = await hash(validatedData.password, 10);

    const [created] = await db
      .insert(user)
      .values({
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        company_id: effectiveCompanyId,
        role_id: validatedData.role_id,
        updated_at: new Date(),
      })
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'user',
      resourceId: created.id,
      targetCompanyId: effectiveCompanyId,
      eventType: 'created',
      after: sanitizeUserForAudit(created),
    });

    revalidatePath('/users');
    return { success: true, data: created };
  } catch (e) {
    if (e instanceof CompanyEntitlementExceededError) {
      return handleCodedServerActionError('users.create.entitlement', 'CO011', e);
    }
    if (
      e instanceof z.ZodError ||
      (e instanceof AppError && e.errorCode === 'US005')
    ) {
      return handleCodedServerActionError('users.create.validation', 'US005', e);
    }
    return handleCodedServerActionError('users.create', 'US002', e);
  }
}

export async function updateUser(
  id: bigint,
  data: UserFormData,
): Promise<{
  success: boolean;
  data?: typeof user.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context: authContext, companyId: effectiveCompanyId } =
      await requireActionPermission('users.write', data.company_id);

    const validatedData = userSchema.parse(data);
    await assertRoleAssignableToCompany(
      validatedData.role_id,
      effectiveCompanyId,
    );

    const existing = await db.query.user.findFirst({
      where: and(eq(user.id, id), isNull(user.deleted_at)),
    });
    if (!existing) {
      return handleCodedServerActionError(
        'users.update',
        'US003',
        new Error('User not found'),
      );
    }

    // Tenant admins may only edit users that already belong to their company.
    if (!authContext.companyIsSystem && existing.company_id !== effectiveCompanyId) {
      return buildActionError('AU002');
    }

    const hashedPassword = validatedData.password
      ? await hash(validatedData.password, 10)
      : undefined;

    const [updated] = await db
      .update(user)
      .set({
        name: validatedData.name,
        email: validatedData.email,
        ...(validatedData.password && { password: hashedPassword }),
        company_id: effectiveCompanyId,
        role_id: validatedData.role_id,
        updated_at: new Date(),
      })
      .where(and(eq(user.id, id), isNull(user.deleted_at)))
      .returning();

    // Revoke existing sessions when an admin resets the password or changes the
    // user's role, so the change takes effect immediately.
    const passwordChanged = Boolean(validatedData.password);
    const roleChanged = existing.role_id !== (validatedData.role_id ?? null);
    if (passwordChanged || roleChanged) {
      await bumpUserTokenVersion(id);
    }

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'user',
      resourceId: id,
      targetCompanyId: effectiveCompanyId,
      eventType: 'updated',
      before: sanitizeUserForAudit(existing),
      after: sanitizeUserForAudit(updated),
    });

    revalidatePath('/users');
    return { success: true, data: updated };
  } catch (e) {
    if (
      e instanceof z.ZodError ||
      (e instanceof AppError && e.errorCode === 'US005')
    ) {
      return handleCodedServerActionError('users.update.validation', 'US005', e);
    }
    return handleCodedServerActionError('users.update', 'US003', e);
  }
}

export async function updateOwnAccount(
  data: AccountFormData,
): Promise<{
  success: boolean;
  data?: typeof user.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const authContext = await requireActionAuth();
    const validatedData = accountSchema.parse(data);

    const existing = await db.query.user.findFirst({
      where: and(
        eq(user.id, BigInt(authContext.userId)),
        isNull(user.deleted_at),
      ),
    });

    if (!existing) {
      return handleCodedServerActionError(
        'users.account',
        'US003',
        new Error('User not found'),
      );
    }

    const requiresCurrentPassword =
      existing.email !== validatedData.email ||
      Boolean(validatedData.newPassword);

    if (requiresCurrentPassword && !validatedData.currentPassword) {
      throw new AppError(
        'La contraseña actual es requerida',
        400,
        true,
        'US005',
      );
    }

    if (requiresCurrentPassword) {
      const currentPasswordIsValid = await compare(
        validatedData.currentPassword as string,
        existing.password,
      );

      if (!currentPasswordIsValid) {
        throw new AppError(
          'La contraseña actual no es correcta',
          400,
          true,
          'US005',
        );
      }
    }

    const hashedPassword = validatedData.newPassword
      ? await hash(validatedData.newPassword, 10)
      : undefined;

    const [updated] = await db
      .update(user)
      .set({
        name: validatedData.name,
        email: validatedData.email,
        ...(validatedData.newPassword && { password: hashedPassword }),
        updated_at: new Date(),
      })
      .where(
        and(eq(user.id, BigInt(authContext.userId)), isNull(user.deleted_at)),
      )
      .returning();

    revalidatePath('/account');
    return { success: true, data: updated };
  } catch (e) {
    if (
      e instanceof z.ZodError ||
      (e instanceof AppError && e.errorCode === 'US005')
    ) {
      return handleCodedServerActionError(
        'users.account.validation',
        'US005',
        e,
      );
    }
    return handleCodedServerActionError('users.account', 'US003', e);
  }
}

export async function deleteUser(id: bigint): Promise<{
  success: boolean;
  data?: typeof user.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    const { context: authContext, companyId: effectiveCompanyId } =
      await requireActionPermission('users.write');

    const existing = await db.query.user.findFirst({
      where: and(eq(user.id, id), isNull(user.deleted_at)),
    });
    if (!existing) {
      return handleCodedServerActionError(
        'users.delete',
        'US004',
        new Error('User not found'),
      );
    }

    // Tenant admins may only delete users within their own company.
    if (!authContext.companyIsSystem && existing.company_id !== effectiveCompanyId) {
      return buildActionError('AU002');
    }

    // Never allow deleting your own account here.
    if (existing.id === BigInt(authContext.userId)) {
      return buildActionError('US004');
    }

    const [updated] = await db
      .update(user)
      .set({
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(eq(user.id, id), isNull(user.deleted_at)))
      .returning();

    // Immediately invalidate any active sessions for the deleted user.
    await bumpUserTokenVersion(id);

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'user',
      resourceId: id,
      targetCompanyId: existing.company_id,
      eventType: 'deleted',
      before: sanitizeUserForAudit(existing),
      after: sanitizeUserForAudit(updated),
    });

    revalidatePath('/users');
    return { success: true, data: updated };
  } catch (e) {
    return handleCodedServerActionError('users.delete', 'US004', e);
  }
}

'use server';

import { desc, eq, and, isNull } from 'drizzle-orm';
import { user, type Company, type Role } from '@/db/schema';
import { db } from '@/lib/db';
import {
  AppError,
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
  requireSystemUser,
} from '@/lib/security';
import { compare, hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  actionAuthToGovernanceActor,
  recordGovernanceAudit,
  sanitizeUserForAudit,
} from '@/lib/governance-audit';

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

export async function createUser(data: CreateUserFormData): Promise<{
  success: boolean;
  data?: typeof user.$inferSelect;
  error?: string;
  errorType?: ActionErrorType;
}> {
  try {
    await requireActionPermission('users.write', data.company_id);
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const validatedData = createUserSchema.parse(data);

    await assertCompanyEntitlementAllows(validatedData.company_id, 'users');

    const hashedPassword = await hash(validatedData.password, 10);

    const [created] = await db
      .insert(user)
      .values({
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        company_id: validatedData.company_id,
        role_id: validatedData.role_id,
        updated_at: new Date(),
      })
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'user',
      resourceId: created.id,
      targetCompanyId: validatedData.company_id,
      eventType: 'created',
      after: sanitizeUserForAudit(created),
    });

    revalidatePath('/users');
    return { success: true, data: created };
  } catch (e) {
    if (e instanceof CompanyEntitlementExceededError) {
      return handleCodedServerActionError('users.create.entitlement', 'CO011', e);
    }
    if (e instanceof z.ZodError) {
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
    await requireActionPermission('users.write', data.company_id);
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

    const validatedData = userSchema.parse(data);

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

    const hashedPassword = validatedData.password
      ? await hash(validatedData.password, 10)
      : undefined;

    const [updated] = await db
      .update(user)
      .set({
        name: validatedData.name,
        email: validatedData.email,
        ...(validatedData.password && { password: hashedPassword }),
        company_id: validatedData.company_id,
        role_id: validatedData.role_id,
        updated_at: new Date(),
      })
      .where(and(eq(user.id, id), isNull(user.deleted_at)))
      .returning();

    await recordGovernanceAudit(db, {
      actor: actionAuthToGovernanceActor(authContext),
      resourceType: 'user',
      resourceId: id,
      targetCompanyId: validatedData.company_id,
      eventType: 'updated',
      before: sanitizeUserForAudit(existing),
      after: sanitizeUserForAudit(updated),
    });

    revalidatePath('/users');
    return { success: true, data: updated };
  } catch (e) {
    if (e instanceof z.ZodError) {
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
    await requireActionPermission('users.write');
    const authContext = await requireActionAuth();
    requireSystemUser(authContext);

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

    const [updated] = await db
      .update(user)
      .set({
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(eq(user.id, id), isNull(user.deleted_at)))
      .returning();

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

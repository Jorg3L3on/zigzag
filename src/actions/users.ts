'use server';

import { desc, eq, and, isNull } from 'drizzle-orm';
import { user, type Company, type Role } from '@/db/schema';
import { db } from '@/lib/db';
import {
  handleCodedServerActionError,
  type ActionErrorType,
} from '@/lib/errors';
import {
  requireActionAuth,
  requireActionPermission,
  requireSystemUser,
} from '@/lib/security';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('El correo electrónico no es válido'),
  password: z.string().optional(),
  company_id: z.number().min(1, 'La empresa es requerida'),
  role_id: z.number().optional(),
});

const createUserSchema = userSchema.extend({
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type UserFormData = z.infer<typeof userSchema>;
export type CreateUserFormData = z.infer<typeof createUserSchema>;

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
    return { success: true, data: users as UserWithRelations[] };
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

    revalidatePath('/dashboard/users');
    return { success: true, data: created };
  } catch (e) {
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

    revalidatePath('/dashboard/users');
    return { success: true, data: updated };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return handleCodedServerActionError('users.update.validation', 'US005', e);
    }
    return handleCodedServerActionError('users.update', 'US003', e);
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

    const [updated] = await db
      .update(user)
      .set({
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(eq(user.id, id), isNull(user.deleted_at)))
      .returning();

    revalidatePath('/dashboard/users');
    return { success: true, data: updated };
  } catch (e) {
    return handleCodedServerActionError('users.delete', 'US004', e);
  }
}

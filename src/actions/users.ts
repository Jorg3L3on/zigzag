'use server';

import { desc, eq, and, isNull } from 'drizzle-orm';
import { user } from '@/db/schema';
import { db } from '@/lib/db';
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

export async function getUsers() {
  try {
    const users = await db.query.user.findMany({
      with: {
        company: true,
        role: true,
      },
      orderBy: [desc(user.created_at)],
      where: isNull(user.deleted_at),
    });
    return { users };
  } catch (e) {
    console.error(e);
    return { error: 'Error al obtener los usuarios' };
  }
}

export async function createUser(data: CreateUserFormData) {
  try {
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
    return { user: created };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) {
      return { error: e.issues[0]?.message ?? 'Datos inválidos' };
    }
    return { error: 'Error al crear el usuario' };
  }
}

export async function updateUser(id: bigint, data: UserFormData) {
  try {
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
    return { user: updated };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) {
      return { error: e.issues[0]?.message ?? 'Datos inválidos' };
    }
    return { error: 'Error al actualizar el usuario' };
  }
}

export async function deleteUser(id: bigint) {
  try {
    const [updated] = await db
      .update(user)
      .set({
        deleted_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(eq(user.id, id), isNull(user.deleted_at)))
      .returning();

    revalidatePath('/dashboard/users');
    return { user: updated };
  } catch (e) {
    console.error(e);
    return { error: 'Error al eliminar el usuario' };
  }
}

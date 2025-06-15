'use server';

import { db } from '@/lib/db';
import { hash } from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('El correo electrónico no es válido'),
  password: z.string().optional(),
  company_id: z.number().min(1, 'La empresa es requerida'),
});

const createUserSchema = userSchema.extend({
  password: z.string().min(1, 'La contraseña es requerida'),
});

export type UserFormData = z.infer<typeof userSchema>;
export type CreateUserFormData = z.infer<typeof createUserSchema>;

export async function getUsers() {
  try {
    const users = await db.user.findMany({
      include: {
        company: true,
      },
      orderBy: {
        created_at: 'desc',
      },
      where: {
        deleted_at: null,
      },
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

    const user = await db.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        company_id: validatedData.company_id,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/users');
    return { user };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) {
      return { error: e.errors[0].message };
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

    const user = await db.user.update({
      where: { id, deleted_at: null },
      data: {
        name: validatedData.name,
        email: validatedData.email,
        ...(validatedData.password && { password: hashedPassword }),
        company_id: validatedData.company_id,
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/users');
    return { user };
  } catch (e) {
    console.error(e);
    if (e instanceof z.ZodError) {
      return { error: e.errors[0].message };
    }
    return { error: 'Error al actualizar el usuario' };
  }
}

export async function deleteUser(id: bigint) {
  try {
    const user = await db.user.update({
      where: { id, deleted_at: null },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });

    revalidatePath('/dashboard/users');
    return { user };
  } catch (e) {
    console.error(e);
    return { error: 'Error al eliminar el usuario' };
  }
}

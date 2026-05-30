import { hash } from 'bcryptjs';
import { and, eq, isNull } from 'drizzle-orm';
import { user } from '@/db/schema';
import { fail, ok, requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { z } from 'zod';

export async function GET() {
  try {
    const { session, unauthorized } = await requireApiPermission('users.read');
    if (unauthorized || !session) {
      return unauthorized;
    }

    const isSystemUser = session.user.company_is_system;
    const users = isSystemUser
      ? await db.select().from(user).where(isNull(user.deleted_at))
      : await db
          .select()
          .from(user)
          .where(
            and(
              isNull(user.deleted_at),
              eq(user.company_id, session.user.company_id as number),
            ),
          );

    return ok(users);
  } catch (error) {
    console.error(error);
    return fail('US001', 500, 'server');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        company_id: z.number().int().positive().optional(),
        role_id: z.number().int().positive().optional(),
        email_verified_at: z.coerce.date().optional(),
        remember_token: z.string().optional(),
      })
      .parse(body);

    const { session, unauthorized } = await requireApiPermission(
      'users.write',
      parsed.company_id,
    );
    if (unauthorized || !session) {
      return unauthorized;
    }

    if (!session.user.company_is_system) {
      return fail('AU002', 403, 'auth');
    }

    const targetCompanyId = parsed.company_id ?? session.user.company_id;
    if (!targetCompanyId) {
      return fail('AU002', 400, 'auth');
    }

    const hashedPassword = await hash(parsed.password, 10);

    const [created] = await db
      .insert(user)
      .values({
        name: parsed.name,
        email: parsed.email,
        company_id: targetCompanyId,
        role_id: parsed.role_id ?? null,
        email_verified_at: parsed.email_verified_at ?? null,
        remember_token: parsed.remember_token ?? null,
        password: hashedPassword,
      })
      .returning();

    return ok(created, 201);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return fail('US005', 400, 'validation');
    }
    console.error(e);
    return fail('US002', 500, 'server');
  }
}

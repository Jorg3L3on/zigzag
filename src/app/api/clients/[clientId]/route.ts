import { and, eq, isNull } from 'drizzle-orm';
import { client } from '@/db/schema';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { fail, ok, requireSession } from '@/lib/api-helpers';

export async function GET(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const { session, unauthorized } = await requireSession();
    if (unauthorized || !session) {
      return unauthorized;
    }

    const [row] = await db
      .select()
      .from(client)
      .where(
        and(
          eq(client.id, parseInt(clientId, 10)),
          eq(client.company_id, session.user.company_id as number),
          isNull(client.deleted_at),
        ),
      )
      .limit(1);

    if (!row) {
      return fail('Client not found', 404, 'validation');
    }

    return ok(row);
  } catch (error) {
    console.error('[CLIENT_GET]', error);
    return fail('Internal error', 500, 'server');
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const { session, unauthorized } = await requireSession();
    if (unauthorized || !session) {
      return unauthorized;
    }

    const body = await req.json();
    const { name, email, phone, document, address } = body;

    if (!name) {
      return fail('Name is required', 400, 'validation');
    }

    const [updated] = await db
      .update(client)
      .set({
        name,
        email,
        phone,
        document,
        address,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(client.id, parseInt(clientId, 10)),
          eq(client.company_id, session.user.company_id as number),
        ),
      )
      .returning();

    if (!updated) {
      return fail('Client not found', 404, 'validation');
    }

    return ok(updated);
  } catch (error) {
    console.error('[CLIENT_PATCH]', error);
    return fail('Internal error', 500, 'server');
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const { session, unauthorized } = await requireSession();
    if (unauthorized || !session) {
      return unauthorized;
    }

    const [deleted] = await db
      .update(client)
      .set({ deleted_at: new Date() })
      .where(
        and(
          eq(client.id, parseInt(clientId, 10)),
          eq(client.company_id, session.user.company_id as number),
        ),
      )
      .returning();
    if (!deleted) {
      return fail('Client not found', 404, 'validation');
    }

    return ok({ deleted: true });
  } catch (error) {
    console.error('[CLIENT_DELETE]', error);
    return fail('Internal error', 500, 'server');
  }
}

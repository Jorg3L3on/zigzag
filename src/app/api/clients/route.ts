import { desc, eq, and, isNull } from 'drizzle-orm';
import { client } from '@/db/schema';
import { db } from '@/lib/db';
import { fail, ok, requireSession } from '@/lib/api-helpers';

export async function GET() {
  try {
    const { session, unauthorized } = await requireSession();
    if (unauthorized || !session) {
      return unauthorized;
    }

    const clients = await db
      .select()
      .from(client)
      .where(
        and(
          eq(client.company_id, session.user.company_id as number),
          isNull(client.deleted_at),
        ),
      )
      .orderBy(desc(client.created_at));

    return ok(clients);
  } catch (error) {
    console.error('[CLIENTS_GET]', error);
    return fail('Internal error', 500, 'server');
  }
}

export async function POST(req: Request) {
  try {
    const { session, unauthorized } = await requireSession();
    if (unauthorized || !session) {
      return unauthorized;
    }

    const body = await req.json();
    const { name, email, phone, document, address } = body;

    if (!name) {
      return fail('Name is required', 400, 'validation');
    }

    const [created] = await db
      .insert(client)
      .values({
        name,
        email,
        phone,
        document,
        address,
        company_id: session.user.company_id as number,
      })
      .returning();

    return ok(created, 201);
  } catch (error) {
    console.error('[CLIENTS_POST]', error);
    return fail('Internal error', 500, 'server');
  }
}

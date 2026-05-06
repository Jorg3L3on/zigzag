import { and, eq, isNull } from 'drizzle-orm';
import { client } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return new NextResponse('Client not found', { status: 404 });
    }

    return NextResponse.json(row);
  } catch (error) {
    console.error('[CLIENT_GET]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, phone, document, address } = body;

    if (!name) {
      return new NextResponse('Name is required', { status: 400 });
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

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CLIENT_PATCH]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await context.params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await db
      .update(client)
      .set({ deleted_at: new Date() })
      .where(
        and(
          eq(client.id, parseInt(clientId, 10)),
          eq(client.company_id, session.user.company_id as number),
        ),
      );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[CLIENT_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

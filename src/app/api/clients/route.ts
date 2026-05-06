import { desc, eq, and, isNull } from 'drizzle-orm';
import { client } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
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

    return NextResponse.json(clients);
  } catch (error) {
    console.error('[CLIENTS_GET]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { name, email, phone, document, address } = body;

    if (!name) {
      return new NextResponse('Name is required', { status: 400 });
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

    return NextResponse.json(created);
  } catch (error) {
    console.error('[CLIENTS_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

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

    const client = await db.client.findFirst({
      where: {
        id: parseInt(clientId),
        company_id: session.user.company_id as number,
        deleted_at: null,
      },
    });

    if (!client) {
      return new NextResponse('Client not found', { status: 404 });
    }

    return NextResponse.json(client);
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

    const client = await db.client.update({
      where: {
        id: parseInt(clientId),
        company_id: session.user.company_id as number,
      },
      data: {
        name,
        email,
        phone,
        document,
        address,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(client);
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

    await db.client.update({
      where: {
        id: parseInt(clientId),
        company_id: session.user.company_id as number,
      },
      data: {
        deleted_at: new Date(),
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[CLIENT_DELETE]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const clients = await prisma.client.findMany({
      where: {
        company_id: session.user.company_id as number,
        deleted_at: null,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

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

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        document,
        address,
        company_id: session.user.company_id as number,
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    console.error('[CLIENTS_POST]', error);
    return new NextResponse('Internal error', { status: 500 });
  }
}

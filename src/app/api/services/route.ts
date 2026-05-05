import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const companyId = new URL(request.url).searchParams.get('company_id');
    if (!companyId) {
      return NextResponse.json(
        { error: 'company_id query parameter is required' },
        { status: 400 },
      );
    }

    const services = await db.service.findMany({
      orderBy: {
        name: 'asc',
      },
      where: {
        company_id: parseInt(companyId, 10),
      },
    });

    return NextResponse.json(services);
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, price } = body;

    const service = await db.service.create({
      data: {
        name,
        description,
        price,
        company_id: session.user.company_id as number,
      },
    });

    return NextResponse.json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear el servicio',
      },
      { status: 500 },
    );
  }
}

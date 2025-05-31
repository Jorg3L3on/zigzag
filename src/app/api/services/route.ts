import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: {
        name: 'asc',
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
    const body = await request.json();
    const { name, description, price } = body;

    const service = await prisma.service.create({
      data: {
        name,
        description,
        price,
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

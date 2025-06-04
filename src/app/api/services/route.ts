import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { company_id: string } },
) {
  try {
    const services = await prisma.service.findMany({
      orderBy: {
        name: 'asc',
      },
      where: {
        company_id: parseInt(params.company_id),
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

export async function POST(
  request: Request,
  { params }: { params: { company_id: string } },
) {
  try {
    const body = await request.json();
    const { name, description, price } = body;

    const service = await prisma.service.create({
      data: {
        name,
        description,
        price,
        company_id: parseInt(params.company_id),
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

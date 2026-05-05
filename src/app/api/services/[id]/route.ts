import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const service = await db.service.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!service) {
      return NextResponse.json(
        {
          success: false,
          error: 'Servicio no encontrado',
        },
        { status: 404 },
      );
    }

    // Convert BigInt values to regular numbers
    const serializedService = {
      ...service,
      id: Number(service.id),
      price: Number(service.price),
    };

    return NextResponse.json({
      success: true,
      data: serializedService,
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener el servicio',
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { name, description, price, company_id } = body;

    const service = await db.service.update({
      where: {
        id: parseInt(id),
      },
      data: {
        name,
        description,
        price,
        company_id: parseInt(company_id),
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al actualizar el servicio',
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await db.service.delete({
      where: {
        id: parseInt(id),
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al eliminar el servicio',
      },
      { status: 500 },
    );
  }
}

import { and, eq, isNull } from 'drizzle-orm';
import { service } from '@/db/schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const serviceId = Number.parseInt(id, 10);
    if (Number.isNaN(serviceId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const [row] = session.user.company_is_system
      ? await db
          .select()
          .from(service)
          .where(and(eq(service.id, serviceId), isNull(service.deleted_at)))
          .limit(1)
      : await db
          .select()
          .from(service)
          .where(
            and(
              eq(service.id, serviceId),
              eq(service.company_id, session.user.company_id as number),
              isNull(service.deleted_at),
            ),
          )
          .limit(1);

    if (!row) {
      return NextResponse.json(
        {
          success: false,
          error: 'Servicio no encontrado',
        },
        { status: 404 },
      );
    }

    const serializedService = {
      ...row,
      id: Number(row.id),
      price: Number(row.price),
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const serviceId = Number.parseInt(id, 10);
    if (Number.isNaN(serviceId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = z
      .object({
        name: z.string().min(1),
        description: z.string().min(1),
        price: z.number().nonnegative(),
      })
      .parse(body);

    const [updated] = await db
      .update(service)
      .set({
        name: parsed.name,
        description: parsed.description,
        price: parsed.price,
        updated_at: new Date(),
      })
      .where(
        session.user.company_is_system
          ? and(eq(service.id, serviceId), isNull(service.deleted_at))
          : and(
              eq(service.id, serviceId),
              eq(service.company_id, session.user.company_id as number),
              isNull(service.deleted_at),
            ),
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Servicio no encontrado' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: error.issues[0]?.message ?? 'Datos invalidos',
        },
        { status: 400 },
      );
    }
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const serviceId = Number.parseInt(id, 10);
    if (Number.isNaN(serviceId)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    const [deleted] = await db
      .update(service)
      .set({ deleted_at: new Date(), updated_at: new Date() })
      .where(
        session.user.company_is_system
          ? and(eq(service.id, serviceId), isNull(service.deleted_at))
          : and(
              eq(service.id, serviceId),
              eq(service.company_id, session.user.company_id as number),
              isNull(service.deleted_at),
            ),
      )
      .returning();

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Servicio no encontrado' },
        { status: 404 },
      );
    }

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

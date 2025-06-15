import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function PUT(
  request: Request,
  { params }: { params: { id: string; serviceId: string } },
) {
  try {
    const body = await request.json();
    const { quantity, price } = body;

    const ticketService = await db.servicesTickets.update({
      where: {
        id: parseInt(params.serviceId),
      },
      data: {
        quantity,
        price,
      },
      include: {
        service: true,
      },
    });

    // Update ticket total
    const ticketServices = await db.servicesTickets.findMany({
      where: {
        ticket_id: BigInt(params.id),
      },
    });

    const total = ticketServices.reduce(
      (sum, service) => sum + service.quantity * service.price,
      0,
    );

    await db.ticket.update({
      where: {
        id: BigInt(params.id),
      },
      data: {
        total,
      },
    });

    return NextResponse.json(ticketService);
  } catch (error) {
    console.error('Error updating ticket service:', error);
    return NextResponse.json(
      { error: 'Failed to update ticket service' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; serviceId: string } },
) {
  try {
    await db.servicesTickets.delete({
      where: {
        id: parseInt(params.serviceId),
      },
    });

    // Update ticket total
    const ticketServices = await db.servicesTickets.findMany({
      where: {
        ticket_id: BigInt(params.id),
      },
    });

    const total = ticketServices.reduce(
      (sum, service) => sum + service.quantity * service.price,
      0,
    );

    await db.ticket.update({
      where: {
        id: BigInt(params.id),
      },
      data: {
        total,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ticket service:', error);
    return NextResponse.json(
      { error: 'Failed to delete ticket service' },
      { status: 500 },
    );
  }
}

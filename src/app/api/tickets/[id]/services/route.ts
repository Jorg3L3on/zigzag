import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ticketServices = await db.servicesTickets.findMany({
      where: {
        ticket_id: BigInt(id),
      },
      include: {
        service: true,
      },
    });

    return NextResponse.json(ticketServices);
  } catch (error) {
    console.error('Error fetching ticket services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket services' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { service_id, quantity, price } = body;

    const ticketService = await db.servicesTickets.create({
      data: {
        service_id,
        ticket_id: BigInt(id),
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
        ticket_id: BigInt(id),
      },
    });

    const total = ticketServices.reduce(
      (sum, service) => sum + service.quantity * service.price,
      0,
    );

    await db.ticket.update({
      where: {
        id: BigInt(id),
      },
      data: {
        total,
      },
    });

    return NextResponse.json(ticketService);
  } catch (error) {
    console.error('Error adding service to ticket:', error);
    return NextResponse.json(
      { error: 'Failed to add service to ticket' },
      { status: 500 },
    );
  }
}

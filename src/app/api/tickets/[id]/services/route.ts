import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const ticketServices = await prisma.servicesTickets.findMany({
      where: {
        ticket_id: BigInt(params.id),
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
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json();
    const { service_id, quantity, price } = body;

    const ticketService = await prisma.servicesTickets.create({
      data: {
        service_id,
        ticket_id: BigInt(params.id),
        quantity,
        price,
      },
      include: {
        service: true,
      },
    });

    // Update ticket total
    const ticketServices = await prisma.servicesTickets.findMany({
      where: {
        ticket_id: BigInt(params.id),
      },
    });

    const total = ticketServices.reduce(
      (sum, service) => sum + service.quantity * service.price,
      0,
    );

    await prisma.ticket.update({
      where: {
        id: BigInt(params.id),
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

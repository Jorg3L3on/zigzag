'use server';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ticketSchema = z.object({
  client_name: z.string().min(1, 'Client name is required'),
  client_tel: z.string().min(1, 'Client phone is required'),
  email: z.string().email('Invalid email address').optional(),
  document: z.string().optional(),
  ticket_date: z.date(),
  services: z.array(
    z.object({
      service_id: z.number(),
      quantity: z.number().min(1),
      price: z.number().min(0),
    }),
  ),
});

export type CreateTicketInput = z.infer<typeof ticketSchema>;

export async function createTicket(data: CreateTicketInput) {
  try {
    const validatedData = ticketSchema.parse(data);

    const ticket = await prisma.ticket.create({
      data: {
        client_name: validatedData.client_name,
        client_tel: validatedData.client_tel,
        email: validatedData.email,
        document: validatedData.document,
        ticket_date: validatedData.ticket_date,
        total: validatedData.services.reduce(
          (acc: number, service) => acc + service.price * service.quantity,
          0,
        ),
        services_tickets: {
          create: validatedData.services.map((service) => ({
            service_id: service.service_id,
            quantity: service.quantity,
            price: service.price,
            sub_total: service.price * service.quantity,
          })),
        },
      },
      include: {
        services_tickets: {
          include: {
            service: true,
          },
        },
      },
    });

    return { success: true, data: ticket };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors };
    }
    return { success: false, error: 'Failed to create ticket' };
  }
}

export async function getTickets() {
  try {
    const tickets = await prisma.ticket.findMany({
      include: {
        services_tickets: {
          include: {
            service: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return { success: true, data: tickets };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Error al obtener los tickets' };
  }
}

export async function getTicketById(id: number) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        services_tickets: {
          include: {
            service: true,
          },
        },
      },
    });

    if (!ticket) {
      return { success: false, error: 'Ticket no encontrado' };
    }

    return { success: true, data: ticket };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Error al obtener el ticket' };
  }
}

export async function updateTicket(
  id: number,
  data: Partial<CreateTicketInput>,
) {
  try {
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        client_name: data.client_name,
        client_tel: data.client_tel,
        email: data.email,
        document: data.document,
        ticket_date: data.ticket_date,
        total: data.services?.reduce(
          (acc: number, service) => acc + service.price * service.quantity,
          0,
        ),
        services_tickets: {
          deleteMany: {},
          create: data.services?.map((service) => ({
            service_id: service.service_id,
            quantity: service.quantity,
            price: service.price,
            sub_total: service.price * service.quantity,
          })),
        },
      },
      include: {
        services_tickets: {
          include: {
            service: true,
          },
        },
      },
    });

    return { success: true, data: ticket };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Error al actualizar el ticket' };
  }
}

export async function deleteTicket(id: number) {
  try {
    await prisma.ticket.delete({
      where: { id },
    });

    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Error al eliminar el ticket' };
  }
}

export async function finishTicket(
  id: number,
  documentName: string,
  total: number,
) {
  try {
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        finished: true,
        document: documentName,
        total: total,
      },
    });

    return { success: true, data: ticket };
  } catch (e) {
    console.error(e);
    return { success: false, error: 'Error al finalizar el ticket' };
  }
}

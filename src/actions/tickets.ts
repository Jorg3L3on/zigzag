'use server';

import { db } from '@/lib/db';
import { z } from 'zod';

const ticketSchema = z.object({
  client_id: z.number().optional(),
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
  company_id: z.number(),
});

export type CreateTicketInput = z.infer<typeof ticketSchema>;

export type Ticket = {
  id: bigint;
  client_id: number | null;
  client_name: string | null;
  client_tel: string | null;
  email: string | null;
  document: string | null;
  ticket_date: Date | null;
  total: number | null;
  finished: boolean;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  company_id: number | null;
};

export async function createTicket(
  data: CreateTicketInput,
): Promise<{ success: boolean; data?: Ticket; error?: string }> {
  try {
    console.log('Creating ticket with data:', data);
    const validatedData = ticketSchema.parse(data);
    console.log('Validated data:', validatedData);

    const ticket = await db.ticket.create({
      data: {
        client_id: validatedData.client_id,
        client_name: validatedData.client_name,
        client_tel: validatedData.client_tel,
        email: validatedData.email,
        document: validatedData.document,
        ticket_date: validatedData.ticket_date,
        company_id: validatedData.company_id,
      },
    });

    console.log('Created ticket:', ticket);
    return { success: true, data: ticket };
  } catch (error) {
    console.error('Error creating ticket:', error);
    if (error instanceof z.ZodError) {
      console.error('Validation errors:', error.errors);
      return { success: false, error: 'Invalid ticket data' };
    }
    return { success: false, error: 'Error creating ticket' };
  }
}

export async function getTickets(companyId: number | null) {
  try {
    const tickets = await db.ticket.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
      },
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
    const ticket = await db.ticket.findUnique({
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
    const ticket = await db.ticket.update({
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
    await db.ticket.update({
      where: { id },
      data: {
        deleted_at: new Date(),
      },
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
    const ticket = await db.ticket.update({
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

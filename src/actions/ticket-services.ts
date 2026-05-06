'use server';

import { and, eq } from 'drizzle-orm';
import { servicesTickets } from '@/db/schema';
import type { Service } from '@/db/schema';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

export interface ServiceTicket {
  id: number;
  service_id: number;
  quantity: number;
  price: number;
  service: Service;
}

export interface CreateServiceTicketData {
  service_id: number;
  quantity: number;
  price: number;
}

export interface UpdateServiceTicketData {
  quantity: number;
  price: number;
}

const ticketIdBigInt = (ticketId: string) => BigInt(ticketId);

export async function getTicketServices(
  ticketId: string,
): Promise<{ success: boolean; data?: ServiceTicket[]; error?: string }> {
  try {
    const ticketServicesRows = await db.query.servicesTickets.findMany({
      where: eq(servicesTickets.ticket_id, ticketIdBigInt(ticketId)),
      with: {
        service: true,
      },
    });

    return { success: true, data: ticketServicesRows as ServiceTicket[] };
  } catch (error) {
    console.error('Error fetching ticket services:', error);
    return {
      success: false,
      error: 'Error al cargar los servicios del ticket',
    };
  }
}

export async function createServiceTicket(
  ticketId: string,
  data: CreateServiceTicketData,
): Promise<{ success: boolean; data?: ServiceTicket; error?: string }> {
  try {
    const [serviceTicket] = await db
      .insert(servicesTickets)
      .values({
        ticket_id: ticketIdBigInt(ticketId),
        service_id: data.service_id,
        quantity: data.quantity,
        price: data.price,
      })
      .returning();

    const full = await db.query.servicesTickets.findFirst({
      where: eq(servicesTickets.id, serviceTicket.id),
      with: { service: true },
    });

    revalidatePath(`/dashboard/tickets/${ticketId}/services`);
    return { success: true, data: full as ServiceTicket };
  } catch (error) {
    console.error('Error creating service ticket:', error);
    return { success: false, error: 'Error al agregar el servicio al ticket' };
  }
}

export async function updateServiceTicket(
  ticketId: string,
  serviceTicketId: number,
  data: UpdateServiceTicketData,
): Promise<{ success: boolean; data?: ServiceTicket; error?: string }> {
  try {
    const [updated] = await db
      .update(servicesTickets)
      .set({
        quantity: data.quantity,
        price: data.price,
      })
      .where(
        and(
          eq(servicesTickets.id, serviceTicketId),
          eq(servicesTickets.ticket_id, ticketIdBigInt(ticketId)),
        ),
      )
      .returning();

    const full = await db.query.servicesTickets.findFirst({
      where: eq(servicesTickets.id, updated.id),
      with: { service: true },
    });

    revalidatePath(`/dashboard/tickets/${ticketId}/services`);
    return { success: true, data: full as ServiceTicket };
  } catch (error) {
    console.error('Error updating service ticket:', error);
    return {
      success: false,
      error: 'Error al actualizar el servicio del ticket',
    };
  }
}

export async function deleteServiceTicket(
  ticketId: string,
  serviceTicketId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .delete(servicesTickets)
      .where(
        and(
          eq(servicesTickets.id, serviceTicketId),
          eq(servicesTickets.ticket_id, ticketIdBigInt(ticketId)),
        ),
      );

    revalidatePath(`/dashboard/tickets/${ticketId}/services`);
    return { success: true };
  } catch (error) {
    console.error('Error deleting service ticket:', error);
    return {
      success: false,
      error: 'Error al eliminar el servicio del ticket',
    };
  }
}

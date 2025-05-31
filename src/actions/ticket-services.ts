'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { Service } from './services';

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

export async function getTicketServices(
  ticketId: string,
): Promise<{ success: boolean; data?: ServiceTicket[]; error?: string }> {
  try {
    const ticketServices = await db.servicesTickets.findMany({
      where: {
        ticket_id: parseInt(ticketId),
      },
      include: {
        service: true,
      },
    });

    return { success: true, data: ticketServices };
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
    const serviceTicket = await db.servicesTickets.create({
      data: {
        ticket_id: parseInt(ticketId),
        service_id: data.service_id,
        quantity: data.quantity,
        price: data.price,
      },
      include: {
        service: true,
      },
    });

    revalidatePath(`/dashboard/tickets/${ticketId}/services`);
    return { success: true, data: serviceTicket };
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
    const serviceTicket = await db.servicesTickets.update({
      where: {
        id: serviceTicketId,
        ticket_id: parseInt(ticketId),
      },
      data: {
        quantity: data.quantity,
        price: data.price,
      },
      include: {
        service: true,
      },
    });

    revalidatePath(`/dashboard/tickets/${ticketId}/services`);
    return { success: true, data: serviceTicket };
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
    await db.servicesTickets.delete({
      where: {
        id: serviceTicketId,
        ticket_id: parseInt(ticketId),
      },
    });

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

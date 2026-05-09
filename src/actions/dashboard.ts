'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { client, company, service, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { classifyServerErrorType, type ActionErrorType } from '@/lib/errors';

export interface DashboardMetrics {
  totalTickets: number;
  totalRevenue: number;
  totalClients: number;
  totalServices: number;
  totalServicesSold: number;
  clientMetrics: {
    id: number;
    name: string;
    ticketCount: number;
    totalSpent: number;
  }[];
}

export interface DashboardMetricsResponse {
  success: boolean;
  data?: DashboardMetrics;
  error?: string;
  errorType?: ActionErrorType;
}

export async function getDashboardMetrics(
  companyId: number,
): Promise<DashboardMetricsResponse> {
  try {
    const [companyRow] = await db
      .select()
      .from(company)
      .where(eq(company.id, companyId))
      .limit(1);

    if (!companyRow) {
      return {
        success: false,
        error: 'Empresa no encontrada',
        errorType: 'validation',
      };
    }

    const tickets = await db.query.ticket.findMany({
      where: and(eq(ticket.company_id, companyId), isNull(ticket.deleted_at)),
      with: {
        services_tickets: true,
      },
    });

    const totalTickets = tickets.length;
    const totalRevenue = tickets
      .filter((t) => t.finished)
      .reduce((sum, t) => sum + (t.total ?? 0), 0);
    const totalServicesSold = tickets.reduce(
      (sum, t) =>
        sum +
        t.services_tickets.reduce(
          (ticketSum, st) => ticketSum + st.quantity,
          0,
        ),
      0,
    );

    const clients = await db.query.client.findMany({
      where: and(eq(client.company_id, companyId), isNull(client.deleted_at)),
      with: {
        tickets: {
          where: isNull(ticket.deleted_at),
        },
      },
    });

    const totalClients = clients.length;

    const services = await db
      .select()
      .from(service)
      .where(and(eq(service.company_id, companyId), isNull(service.deleted_at)));

    const totalServices = services.length;

    const clientMetrics = clients.map((c) => ({
      id: c.id,
      name: c.name,
      ticketCount: c.tickets.length,
      totalSpent: c.tickets.reduce((sum, t) => sum + (t.total ?? 0), 0),
    }));

    return {
      success: true,
      data: {
        totalTickets,
        totalRevenue,
        totalClients,
        totalServices,
        totalServicesSold,
        clientMetrics,
      },
    };
  } catch (error) {
    console.error('Error obteniendo metricas del dashboard:', error);
    return {
      success: false,
      error: 'Error al obtener metricas del dashboard',
      errorType: classifyServerErrorType(error),
    };
  }
}

'use server';

import { db } from '@/lib/db';

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

// Helper function to safely stringify objects with BigInt
function safeStringify(obj: unknown): string {
  return JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}

export async function getDashboardMetrics(
  companyId: number,
): Promise<DashboardMetrics> {
  console.log('Getting metrics for company ID:', companyId);

  // First, let's verify the company exists
  const company = await db.company.findUnique({
    where: { id: companyId },
  });

  console.log('Company:', safeStringify(company));

  if (!company) {
    console.error('Company not found');
    return {
      totalTickets: 0,
      totalRevenue: 0,
      totalClients: 0,
      totalServices: 0,
      totalServicesSold: 0,
      clientMetrics: [],
    };
  }

  // Get all tickets for this company
  const tickets = await db.ticket.findMany({
    where: {
      company_id: companyId,
      deleted_at: null,
    },
    include: {
      services_tickets: true,
    },
  });

  console.log('Found tickets:', safeStringify(tickets));

  // Calculate metrics from the tickets
  const totalTickets = tickets.length;
  const totalRevenue = tickets
    .filter((ticket) => ticket.finished)
    .reduce((sum, ticket) => sum + (ticket.total || 0), 0);
  const totalServicesSold = tickets.reduce(
    (sum, ticket) =>
      sum +
      ticket.services_tickets.reduce(
        (ticketSum, service) => ticketSum + service.quantity,
        0,
      ),
    0,
  );

  // Get clients
  const clients = await db.client.findMany({
    where: {
      company_id: companyId,
      deleted_at: null,
    },
    include: {
      tickets: {
        where: {
          deleted_at: null,
        },
      },
    },
  });

  console.log('Found clients:', safeStringify(clients));

  const totalClients = clients.length;

  // Get services
  const services = await db.service.findMany({
    where: {
      company_id: companyId,
      deleted_at: null,
    },
  });

  console.log('Found services:', safeStringify(services));

  const totalServices = services.length;

  // Calculate client metrics
  const clientMetrics = clients.map((client) => ({
    id: client.id,
    name: client.name,
    ticketCount: client.tickets.length,
    totalSpent: client.tickets.reduce(
      (sum, ticket) => sum + (ticket.total || 0),
      0,
    ),
  }));

  const metrics = {
    totalTickets,
    totalRevenue,
    totalClients,
    totalServices,
    totalServicesSold,
    clientMetrics,
  };

  console.log('Final metrics:', safeStringify(metrics));

  return metrics;
}

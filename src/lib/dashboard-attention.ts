import { isSameDay } from 'date-fns';
import type { PaymentStatusBreakdownItem } from '@/lib/dashboard-kpi';

export type DashboardAttentionTone = 'default' | 'urgent';

export type DashboardAttentionItem = {
  key: string;
  title: string;
  count: number;
  explanation: string;
  href: string;
  ctaLabel: string;
  tone: DashboardAttentionTone;
};

export type BuildDashboardAttentionItemsInput = {
  paymentStatusBreakdown: PaymentStatusBreakdownItem[];
  activeTickets: number;
  /** Null when schedules are unavailable (RBAC / missing company). */
  overdueSchedules: number | null;
  dueTodaySchedules: number | null;
};

const countByStatus = (
  breakdown: PaymentStatusBreakdownItem[],
  status: PaymentStatusBreakdownItem['status'],
): number =>
  breakdown.find((row) => row.status === status)?.count ?? 0;

export const countSchedulesDueToday = (
  items: { nextDueAt: Date | string }[],
  today: Date = new Date(),
): number =>
  items.filter((item) => isSameDay(new Date(item.nextDueAt), today)).length;

/**
 * Builds attention rows from existing dashboard + schedule aggregates.
 * Items with count 0 are omitted. Schedule rows are omitted when counts are null.
 */
export const buildDashboardAttentionItems = (
  input: BuildDashboardAttentionItemsInput,
): DashboardAttentionItem[] => {
  const items: DashboardAttentionItem[] = [];

  if (input.overdueSchedules != null && input.overdueSchedules > 0) {
    items.push({
      key: 'schedules-overdue',
      title:
        input.overdueSchedules === 1
          ? 'Servicio atrasado'
          : 'Servicios atrasados',
      count: input.overdueSchedules,
      explanation: 'Recordatorios vencidos que requieren seguimiento',
      href: '/service-schedules?filter=atrasados',
      ctaLabel: 'Ver recordatorios',
      tone: 'urgent',
    });
  }

  if (input.dueTodaySchedules != null && input.dueTodaySchedules > 0) {
    items.push({
      key: 'schedules-today',
      title:
        input.dueTodaySchedules === 1
          ? 'Servicio programado para hoy'
          : 'Servicios programados para hoy',
      count: input.dueTodaySchedules,
      explanation: 'Agenda del día para no perder visitas',
      href: '/service-schedules?filter=proximos',
      ctaLabel: 'Ver agenda',
      tone: 'default',
    });
  }

  const pendingCount = countByStatus(input.paymentStatusBreakdown, 'pending');
  if (pendingCount > 0) {
    items.push({
      key: 'tickets-pending-payment',
      title:
        pendingCount === 1
          ? 'Ticket pendiente de pago'
          : 'Tickets pendientes de pago',
      count: pendingCount,
      explanation: 'Sin abonos registrados — revisa cobros',
      href: '/tickets?status=pending',
      ctaLabel: 'Ver tickets',
      tone: 'urgent',
    });
  }

  const partialCount = countByStatus(input.paymentStatusBreakdown, 'partial');
  if (partialCount > 0) {
    items.push({
      key: 'tickets-partial-payment',
      title:
        partialCount === 1 ? 'Ticket con pago parcial' : 'Tickets con pago parcial',
      count: partialCount,
      explanation: 'Cobros incompletos que puedes cerrar',
      href: '/tickets?status=partial',
      ctaLabel: 'Ver tickets',
      tone: 'default',
    });
  }

  if (input.activeTickets > 0) {
    items.push({
      key: 'tickets-active',
      title:
        input.activeTickets === 1 ? 'Ticket activo' : 'Tickets activos',
      count: input.activeTickets,
      explanation: 'Trabajo abierto pendiente de finalizar',
      href: '/tickets?finished=no',
      ctaLabel: 'Ver tickets',
      tone: 'default',
    });
  }

  return items;
};

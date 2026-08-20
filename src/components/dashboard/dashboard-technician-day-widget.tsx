'use client';

import * as React from 'react';
import Link from 'next/link';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldJobCard } from '@/components/field/field-job-card';
import type { TicketListCollectPaymentResult } from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TripledEmptyState } from '@/components/tripled';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { toFieldJobSnapshotFromDayTicket } from '@/lib/field-job-snapshot';
import type { TechnicianDayTicket } from '@/lib/technician-day-queue';
import { canWriteTickets } from '@/lib/tickets-rbac';
import { cn } from '@/lib/utils';

export type DashboardTechnicianDayWidgetProps = {
  canRead: boolean;
  missingCompany: boolean;
  permissionsLoading: boolean;
  loading: boolean;
  error: string | null;
  items: TechnicianDayTicket[];
  todayCount: number;
  overdueCount: number;
  onRetry: () => void;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
};

export const DashboardTechnicianDayWidget = ({
  canRead,
  missingCompany,
  permissionsLoading,
  loading,
  error,
  items,
  todayCount,
  overdueCount,
  onRetry,
  onPaymentApplied,
}: DashboardTechnicianDayWidgetProps) => {
  const { selectedCompany } = useCompany();
  const { can } = usePermissions();
  const canWrite = canWriteTickets(can);
  const companyId = selectedCompany?.id ?? null;
  const companyName = selectedCompany?.name ?? null;

  if (!canRead && !permissionsLoading) {
    return null;
  }

  const summaryParts: string[] = [];
  if (todayCount > 0) summaryParts.push(`${todayCount} hoy`);
  if (overdueCount > 0) summaryParts.push(`${overdueCount} atrasados`);
  const summary =
    summaryParts.length > 0 ? summaryParts.join(' · ') : 'Sin pendientes';

  return (
    <Card
      className={cn(DASHBOARD_CARD_CLASS)}
      data-testid="technician-day-widget"
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base sm:text-lg">Trabajo de hoy</CardTitle>
          <CardDescription>{summary}</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-lg text-muted-foreground"
            onClick={onRetry}
            aria-label="Actualizar trabajo de hoy"
            disabled={loading || missingCompany}
          >
            <RefreshCw
              className={cn('h-4 w-4', loading && 'animate-spin')}
              aria-hidden
            />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg text-muted-foreground"
            asChild
          >
            <Link href="/tickets?finished=no">Ver todos</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-lg text-muted-foreground"
            asChild
          >
            <Link href="/cobranza" aria-label="Ver cobranza por cobrar">
              Por cobrar
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-4 pt-0 sm:p-5 sm:pt-0">
        {missingCompany ? (
          <TripledEmptyState
            icon={<ClipboardList className="h-4 w-4" />}
            title="Selecciona una empresa"
            description="Selecciona una empresa para ver el trabajo de hoy."
          />
        ) : loading ? (
          <div
            className="space-y-3"
            role="status"
            aria-label="Cargando trabajo de hoy"
          >
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-4/5 rounded-xl" />
          </div>
        ) : error ? (
          <TripledEmptyState
            icon={<ClipboardList className="h-4 w-4" />}
            title="Error al cargar"
            description={error}
            role="alert"
            action={
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Reintentar
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <TripledEmptyState
            icon={<ClipboardList className="h-4 w-4" />}
            title="Sin trabajo pendiente"
            description="No hay tickets sin terminar para hoy ni atrasados."
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/cobranza">Ir a cobranza</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3" aria-label="Lista de trabajo de hoy">
            {items.map((item) => (
              <FieldJobCard
                key={item.id}
                job={toFieldJobSnapshotFromDayTicket(item, {
                  companyId,
                  companyName,
                })}
                canWrite={canWrite}
                onPaymentApplied={onPaymentApplied}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

// Payment result type re-exported for dashboard consumers.
export type { TicketListCollectPaymentResult };

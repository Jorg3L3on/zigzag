'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Banknote,
  ClipboardList,
  MessageCircle,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FieldSyncNowButton } from '@/components/field/field-sync-now-button';
import { SyncStatusBadge } from '@/components/field/sync-status-badge';
import { FormattedDate } from '@/components/formatted-date';
import { TicketPaymentBadge } from '@/components/tickets/ticket-payment-badge';
import {
  TicketListCollectPaymentDialog,
  type TicketListCollectPaymentResult,
} from '@/components/tickets/ticket-list-collect-payment-dialog';
import { TripledEmptyState } from '@/components/tripled';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import type { MergedTechnicianDayTicket } from '@/lib/field-jobs';
import { buildTelHref } from '@/lib/phone-links';
import {
  formatTicketListAmount,
} from '@/lib/ticket-payment-status';
import {
  getTechnicianDayCardActions,
} from '@/lib/technician-day-queue';
import { canWriteTickets } from '@/lib/tickets-rbac';
import { buildWhatsAppDayVisitShare } from '@/lib/whatsapp-share';
import { cn } from '@/lib/utils';

export type DashboardTechnicianDayWidgetProps = {
  canRead: boolean;
  missingCompany: boolean;
  permissionsLoading: boolean;
  loading: boolean;
  error: string | null;
  items: MergedTechnicianDayTicket[];
  todayCount: number;
  overdueCount: number;
  onRetry: () => void;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
  pendingUploadCount?: number;
  syncing?: boolean;
  onFlushNow?: () => void;
};

const TechnicianDayCard = ({
  item,
  canWrite,
  companyId,
  companyName,
  onPaymentApplied,
}: {
  item: MergedTechnicianDayTicket;
  canWrite: boolean;
  companyId?: number | null;
  companyName?: string | null;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
}) => {
  const [collectOpen, setCollectOpen] = React.useState(false);
  const isLocalOnly = Boolean(item.pendingSync && item.localJobId);
  const { showOpenEdit, showCollect } = getTechnicianDayCardActions({
    finished: item.finished,
    balanceDue: item.balanceDue,
    canWrite: canWrite && !isLocalOnly,
  });
  const telHref = buildTelHref(item.clientTel);
  const whatsapp = buildWhatsAppDayVisitShare({
    phone: item.clientTel,
    clientName: item.clientName,
    ticketId: item.id,
    companyName,
  });
  const openHref = isLocalOnly
    ? '/tickets/create'
    : showOpenEdit
      ? `/tickets/${item.id}/edit`
      : `/tickets/${item.id}`;

  return (
    <li className="rounded-xl border border-border/60 bg-background/80 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold sm:text-base">
              {item.clientName?.trim() || 'Cliente sin nombre'}
            </p>
            {item.isOverdue ? (
              <Badge variant="destructive" className="shadow-none">
                Atrasado
              </Badge>
            ) : (
              <Badge variant="secondary" className="shadow-none">
                Hoy
              </Badge>
            )}
            {item.syncStatus && item.pendingSync ? (
              <SyncStatusBadge status={item.syncStatus} />
            ) : null}
            <TicketPaymentBadge total={item.total} paid={item.paid} />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">#{item.id}</span>
            {' · '}
            <FormattedDate date={new Date(item.ticketDate)} />
            {item.balanceDue > 0 ? (
              <>
                {' · '}
                Saldo {formatTicketListAmount(item.balanceDue)}
              </>
            ) : null}
          </p>
          {item.servicesSummary ? (
            <p className="truncate text-xs text-muted-foreground">
              {item.servicesSummary}
            </p>
          ) : null}
          {item.clientTel ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              {item.clientTel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          className="min-h-11 rounded-lg sm:min-h-9"
          asChild
        >
          <Link
            href={openHref}
            aria-label={
              showOpenEdit
                ? `Abrir y editar ticket ${item.id}`
                : `Ver ticket ${item.id}`
            }
          >
            {showOpenEdit ? 'Abrir' : 'Ver'}
          </Link>
        </Button>

        {showCollect ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 rounded-lg sm:min-h-9"
            onClick={() => setCollectOpen(true)}
            aria-label={`Cobrar ticket ${item.id}`}
          >
            <Banknote className="h-4 w-4" aria-hidden data-icon="inline-start" />
            Cobrar
          </Button>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          className="min-h-11 rounded-lg sm:min-h-9"
          disabled={!telHref}
          asChild={Boolean(telHref)}
          aria-label={
            telHref
              ? `Llamar a ${item.clientName ?? item.clientTel}`
              : `Sin teléfono para ticket ${item.id}`
          }
        >
          {telHref ? (
            <a href={telHref}>
              <Phone className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Llamar
            </a>
          ) : (
            <span>
              <Phone className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Llamar
            </span>
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="min-h-11 rounded-lg sm:min-h-9"
          disabled={!whatsapp}
          asChild={Boolean(whatsapp)}
          aria-label={
            whatsapp
              ? `WhatsApp visita de hoy para ticket ${item.id}`
              : `WhatsApp no disponible para ticket ${item.id}`
          }
        >
          {whatsapp ? (
            <a href={whatsapp.href} target="_blank" rel="noopener noreferrer">
              <MessageCircle
                className="h-4 w-4"
                aria-hidden
                data-icon="inline-start"
              />
              WhatsApp
            </a>
          ) : (
            <span>
              <MessageCircle
                className="h-4 w-4"
                aria-hidden
                data-icon="inline-start"
              />
              WhatsApp
            </span>
          )}
        </Button>
      </div>

      {showCollect ? (
        <TicketListCollectPaymentDialog
          open={collectOpen}
          onOpenChange={setCollectOpen}
          ticketId={Number(item.id)}
          total={item.total}
          paid={item.paid}
          companyId={companyId}
          onPaymentApplied={(result) => {
            onPaymentApplied?.(result);
          }}
        />
      ) : null}
    </li>
  );
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
  pendingUploadCount = 0,
  syncing = false,
  onFlushNow,
}: DashboardTechnicianDayWidgetProps) => {
  const { selectedCompany } = useCompany();
  const { can } = usePermissions();
  const canWrite = canWriteTickets(can);

  if (permissionsLoading) {
    return null;
  }

  if (!canRead) {
    return null;
  }

  return (
    <Card
      className={cn(DASHBOARD_CARD_CLASS, 'flex h-full flex-col')}
      data-testid="technician-day-widget"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">
            Trabajo de hoy
          </CardTitle>
          <CardDescription>
            {pendingUploadCount > 0
              ? `${pendingUploadCount} pendiente${pendingUploadCount === 1 ? '' : 's'} de subir · tickets de hoy y atrasados`
              : 'Tickets sin terminar de hoy y atrasados. Para cobros de tickets finalizados, usa Cobranza.'}
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {onFlushNow ? (
            <FieldSyncNowButton
              pendingCount={pendingUploadCount}
              syncing={syncing}
              onFlush={onFlushNow}
            />
          ) : null}
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
          <ul
            className="space-y-3"
            aria-label="Lista de trabajo de hoy"
          >
            {items.map((item) => (
              <TechnicianDayCard
                key={item.id}
                item={item}
                canWrite={canWrite}
                companyId={selectedCompany?.id ?? null}
                companyName={selectedCompany?.name}
                onPaymentApplied={onPaymentApplied}
              />
            ))}
          </ul>
        )}
        {!missingCompany && !loading && !error ? (
          <p className="mt-auto pt-3 text-xs text-muted-foreground">
            {todayCount} hoy · {overdueCount} atrasados
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};

'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, MessageCircle } from 'lucide-react';
import { getCobranzaList } from '@/actions/cobranza';
import { JobWhatsAppSendMenu } from '@/components/field/job-whatsapp-send-menu';
import {
  TicketListCollectPaymentDialog,
  type TicketListCollectPaymentResult,
} from '@/components/tickets/ticket-list-collect-payment-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { useCompany } from '@/contexts/company-context';
import {
  applyCobranzaPaymentToRows,
  type CobranzaRow,
} from '@/lib/cobranza';
import {
  pickHoyCobranzaRows,
  toFieldJobSnapshotFromCobranzaRow,
} from '@/lib/field-job-snapshot';
import { formatTicketListAmount } from '@/lib/ticket-payment-status';
import { buildWhatsAppBalanceShare } from '@/lib/whatsapp-share';
import { cn } from '@/lib/utils';

const HOY_COBRANZA_LIMIT = 5;

export type HoyPorCobrarStripProps = {
  canWrite?: boolean;
  className?: string;
  /** External refresh token (e.g. after day-widget collect). */
  refreshKey?: number;
  onPaymentApplied?: (result: TicketListCollectPaymentResult) => void;
};

export const HoyPorCobrarStrip = ({
  canWrite = false,
  className,
  refreshKey = 0,
  onPaymentApplied,
}: HoyPorCobrarStripProps) => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const companyName = selectedCompany?.name ?? null;
  const [loading, setLoading] = React.useState(true);
  const [rows, setRows] = React.useState<CobranzaRow[]>([]);
  const [collectTicketId, setCollectTicketId] = React.useState<string | null>(
    null,
  );

  const load = React.useCallback(async () => {
    if (!companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await getCobranzaList(companyId);
    if (result.success && result.data?.rows) {
      setRows(pickHoyCobranzaRows(result.data.rows, HOY_COBRANZA_LIMIT));
    } else {
      setRows([]);
    }
    setLoading(false);
  }, [companyId]);

  React.useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const collectRow = rows.find((row) => row.id === collectTicketId) ?? null;

  if (!companyId) {
    return null;
  }

  if (!loading && rows.length === 0) {
    return null;
  }

  return (
    <Card
      className={cn(DASHBOARD_CARD_CLASS, className)}
      data-testid="hoy-por-cobrar-strip"
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 p-4 pb-2 sm:p-5 sm:pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base sm:text-lg">Por cobrar</CardTitle>
          <CardDescription>
            {loading
              ? 'Cargando saldos…'
              : `${rows.length} con saldo · cobranza del día`}
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg text-muted-foreground"
          asChild
        >
          <Link href="/cobranza" aria-label="Ver toda la cobranza">
            Ver toda la cobranza
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {loading ? (
          <div className="space-y-2" role="status" aria-label="Cargando por cobrar">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Lista por cobrar">
            {rows.map((row) => {
              const job = toFieldJobSnapshotFromCobranzaRow(row, {
                companyName,
              });
              const saldoShare = buildWhatsAppBalanceShare({
                phone: row.client_tel,
                clientName: row.client_name,
                ticketId: row.id,
                balanceDue: row.balanceDue,
                companyName,
              });
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {row.client_name?.trim() || 'Cliente sin nombre'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono tabular-nums">#{row.id}</span>
                      {' · '}
                      <span className="tabular-nums font-medium text-foreground">
                        {formatTicketListAmount(row.balanceDue)}
                      </span>
                      {row.daysOutstanding > 0 ? (
                        <>
                          {' · '}
                          {row.daysOutstanding}d
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {saldoShare ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg"
                        asChild
                        aria-label={`WhatsApp saldo ticket ${row.id}`}
                      >
                        <a
                          href={saldoShare.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden />
                        </a>
                      </Button>
                    ) : null}
                    <JobWhatsAppSendMenu
                      job={job}
                      triggerLabel="Enviar"
                      size="sm"
                      highlightId="recordar_saldo"
                    />
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-10 rounded-lg"
                        onClick={() => setCollectTicketId(row.id)}
                        aria-label={`Cobrar ticket ${row.id}`}
                      >
                        <Banknote
                          className="h-4 w-4"
                          aria-hidden
                          data-icon="inline-start"
                        />
                        Cobrar
                      </Button>
                    ) : null}
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-10 rounded-lg"
                      asChild
                    >
                      <Link href={`/tickets/${row.id}`}>Ver</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {collectRow ? (
        <TicketListCollectPaymentDialog
          open={Boolean(collectTicketId)}
          onOpenChange={(next) => {
            if (!next) setCollectTicketId(null);
          }}
          ticketId={Number(collectRow.id)}
          total={collectRow.total}
          paid={collectRow.paid}
          companyId={collectRow.company_id}
          onPaymentApplied={(result) => {
            setRows((prev) =>
              applyCobranzaPaymentToRows(prev, {
                ticketId: result.ticketId,
                paid: result.paid,
                total: result.total,
              }),
            );
            setCollectTicketId(null);
            onPaymentApplied?.(result);
          }}
        />
      ) : null}
    </Card>
  );
};

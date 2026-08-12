'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  cancelPresupuesto,
  convertPresupuestoToTicket,
  getPresupuestosList,
  type PresupuestoListItem,
} from '@/actions/presupuestos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PDFDownloadButton } from '@/components/pdf-download-button';
import { FormattedCurrency } from '@/components/formatted-currency';
import { FormattedDate } from '@/components/formatted-date';
import {
  TripledEmptyState,
  TripledListLoadingState,
  TripledMobileRecordCard,
} from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorDisplayMessage } from '@/lib/network-awareness';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canWriteTickets } from '@/lib/tickets-rbac';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusVariant = (
  status: PresupuestoListItem['status'],
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'cancelado') return 'outline';
  if (status === 'vencido') return 'destructive';
  if (status === 'convertido') return 'secondary';
  return 'default';
};

export const PresupuestosList = () => {
  const router = useRouter();
  const { selectedCompany } = useCompany();
  const { can, isSystem, loading: permissionsLoading } = usePermissions();
  const canWrite = canWriteTickets(can);
  const missingCompany = needsSelectedCompanyContext(
    isSystem,
    selectedCompany?.id,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<PresupuestoListItem[]>([]);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (permissionsLoading) return;
    if (missingCompany) {
      setLoading(false);
      setItems([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getPresupuestosList(selectedCompany?.id ?? null);
      if (!result.success || !result.data) {
        setError(
          getErrorDisplayMessage(result, 'No se pudieron cargar los presupuestos'),
        );
        setItems([]);
        return;
      }
      setItems(result.data);
    } catch {
      setError('No se pudieron cargar los presupuestos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [missingCompany, permissionsLoading, selectedCompany?.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleConvert = async (id: string) => {
    setBusyId(id);
    try {
      const result = await convertPresupuestoToTicket(
        Number(id),
        selectedCompany?.id ?? null,
      );
      if (!result.success || !result.data) {
        toast.error(
          getErrorDisplayMessage(result, 'No se pudo convertir el presupuesto'),
        );
        return;
      }
      toast.success(`Convertido a ticket #${result.data.ticketId}`);
      router.push(`/tickets/${result.data.ticketId}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setBusyId(id);
    try {
      const result = await cancelPresupuesto(
        Number(id),
        selectedCompany?.id ?? null,
      );
      if (!result.success) {
        toast.error(
          getErrorDisplayMessage(result, 'No se pudo cancelar el presupuesto'),
        );
        return;
      }
      toast.success('Presupuesto cancelado');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (permissionsLoading || loading) {
    return <TripledListLoadingState label="Cargando presupuestos…" />;
  }

  if (missingCompany) {
    return (
      <TripledEmptyState
        icon={<FileText className="h-4 w-4" />}
        title="Selecciona una empresa"
        description="Selecciona una empresa para ver presupuestos."
      />
    );
  }

  if (error) {
    return (
      <TripledEmptyState
        icon={<FileText className="h-4 w-4" />}
        title="Error al cargar"
        description={error}
        role="alert"
        action={
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cotizaciones. No cuentan en cobranza ni en trabajo de hoy hasta convertirlas.
        </p>
        {canWrite ? (
          <Button asChild className="min-h-11 sm:min-h-9">
            <Link href="/presupuestos/create">
              <Plus className="h-4 w-4" aria-hidden data-icon="inline-start" />
              Nuevo presupuesto
            </Link>
          </Button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <TripledEmptyState
          icon={<FileText className="h-4 w-4" />}
          title="Sin presupuestos"
          description="Crea un presupuesto para cotizar trabajo antes de abrirlo como ticket."
          action={
            canWrite ? (
              <Button asChild>
                <Link href="/presupuestos/create">Nuevo presupuesto</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {items.map((item) => {
              const canAct =
                canWrite &&
                (item.status === 'abierto' || item.status === 'vencido');
              return (
                <TripledMobileRecordCard key={item.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold">
                        {item.clientName || 'Cliente sin nombre'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        #{item.id}
                        {item.ticketDate ? (
                          <>
                            {' · '}
                            <FormattedDate date={new Date(item.ticketDate)} />
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Badge variant={statusVariant(item.status)} className="shadow-none">
                      {item.statusLabel}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xl font-semibold tabular-nums">
                    <FormattedCurrency amount={item.total ?? 0} />
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PDFDownloadButton
                      ticketId={item.id}
                      downloadFileName={`presupuesto_${item.id}.pdf`}
                      companyId={selectedCompany?.id}
                      label="PDF"
                      variant="outline"
                    />
                    {item.convertedToTicketId ? (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href={`/tickets/${item.convertedToTicketId}`}>
                          Ver ticket
                        </Link>
                      </Button>
                    ) : null}
                    {canAct ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => void handleConvert(item.id)}
                        >
                          Convertir a ticket
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === item.id}
                          onClick={() => void handleCancel(item.id)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TripledMobileRecordCard>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const canAct =
                    canWrite &&
                    (item.status === 'abierto' || item.status === 'vencido');
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium">
                            {item.clientName || 'Cliente sin nombre'}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            #{item.id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.ticketDate ? (
                          <FormattedDate date={new Date(item.ticketDate)} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {item.expiresAt ? (
                          <FormattedDate date={new Date(item.expiresAt)} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <FormattedCurrency amount={item.total ?? 0} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={statusVariant(item.status)}
                          className="shadow-none"
                        >
                          {item.statusLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <PDFDownloadButton
                            ticketId={item.id}
                            downloadFileName={`presupuesto_${item.id}.pdf`}
                            companyId={selectedCompany?.id}
                            label="PDF"
                            variant="ghost"
                          />
                          {item.convertedToTicketId ? (
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/tickets/${item.convertedToTicketId}`}>
                                Ticket
                              </Link>
                            </Button>
                          ) : null}
                          {canAct ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                disabled={busyId === item.id}
                                onClick={() => void handleConvert(item.id)}
                              >
                                Convertir
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busyId === item.id}
                                onClick={() => void handleCancel(item.id)}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

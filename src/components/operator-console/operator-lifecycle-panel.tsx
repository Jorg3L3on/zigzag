'use client';

import React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { setCompanyLifecycleStatus } from '@/actions/company-lifecycle';
import { offboardCompany } from '@/actions/company-portability';
import {
  getOperatorCompanyLifecycle,
  type OperatorLifecycleData,
} from '@/actions/operator-company-lifecycle';
import { ListError, ListStatusPill } from '@/components/list-page';
import { useOperatorCompany } from '@/components/operator-console/operator-company-context';
import { useOperatorCompanyActions } from '@/components/operator-console/use-operator-company-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LIST_TABLE_CARD_CLASS,
  LIST_TABLE_CLASS,
  LIST_TABLE_PADDING_CLASS,
} from '@/components/list-page';
import type { CompanyLifecycleStatus } from '@/db/schema';
import { COMPANY_OFFBOARDING_RETENTION_POLICY } from '@/lib/company-offboarding';
import type { CompanyOperatorSummary } from '@/lib/company-operator-summary';
import { presentActionError } from '@/lib/network-awareness';
import { formatFullDay, plural } from '@/lib/operator-console-format';
import { operatorConsoleCompanyHref } from '@/lib/operator-tenant-scope';
import { cn } from '@/lib/utils';

const RETENTION_DAYS = COMPANY_OFFBOARDING_RETENTION_POLICY.retention_days_after_archive;
const DAY_MS = 24 * 60 * 60 * 1000;

const STAGES: { id: CompanyLifecycleStatus; label: string; note: string }[] = [
  { id: 'SETUP', label: 'En configuración', note: 'Mientras se completa el perfil' },
  { id: 'ACTIVE', label: 'Activa', note: 'Opera con normalidad' },
  { id: 'SUSPENDED', label: 'Suspendida', note: 'Se puede revertir' },
  { id: 'ARCHIVED', label: 'Archivada', note: 'Definitivo' },
];

const accessSentence = (summary: CompanyOperatorSummary): string => {
  const people = plural(summary.peopleCount, 'persona', 'personas');
  switch (summary.lifecycle) {
    case 'ACTIVE':
      return `Sus ${people} pueden iniciar sesión y trabajar según su rol.`;
    case 'SETUP':
      return `Sus ${people} pueden entrar mientras se completa el perfil; actívala cuando esté lista.`;
    case 'SUSPENDED':
      return `Sus ${people} no pueden iniciar sesión. No se borró nada.`;
    default:
      return 'Nadie puede iniciar sesión.';
  }
};

const SECTION = 'rounded-xl border border-border bg-card';

type DialogKind = 'suspend' | 'archive' | null;

/**
 * Ciclo de vida (ZIG-I38-7, frames 5, 6B, 6D, 6E): current status with its
 * stages, the status history, data and retention, and a risk zone where
 * suspending and archiving ask for a reason (archiving also for the name).
 */
export const OperatorLifecyclePanel = () => {
  const { companyId, summary, refresh } = useOperatorCompany();
  const { exportData, exporting } = useOperatorCompanyActions();
  const [data, setData] = React.useState<OperatorLifecycleData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const [reason, setReason] = React.useState('');
  const [typedName, setTypedName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    const result = await getOperatorCompanyLifecycle(companyId).catch(() => null);
    if (result?.success && result.data) setData(result.data);
    else setError(result?.error || 'No se pudo cargar el ciclo de vida');
  }, [companyId]);

  React.useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!dialog) {
      setReason('');
      setTypedName('');
    }
  }, [dialog]);

  if (error) return <ListError description={error} onRetry={() => void load()} />;
  if (!summary || !data) {
    return (
      <div className="space-y-5" role="status" aria-busy="true" aria-label="Cargando ciclo de vida">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const lastExport = data.lastExportAt ? formatFullDay(data.lastExportAt) : null;
  const retentionEnd = new Date(Date.now() + RETENTION_DAYS * DAY_MS).toISOString();
  const currentIndex = STAGES.findIndex((stage) => stage.id === summary.lifecycle);

  const handleExport = async () => {
    const ok = await exportData(companyId);
    if (ok) void load();
  };

  const confirm = async () => {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog === 'suspend') {
        const result = await setCompanyLifecycleStatus(companyId, 'SUSPENDED', reason);
        if (!result.success) {
          toast.error(result.error || 'No se pudo suspender');
          return;
        }
        toast.success('Empresa suspendida');
      } else {
        const result = await offboardCompany(companyId, reason);
        if (!result.success || !result.data) {
          const content = presentActionError(result, 'No se pudo archivar.');
          toast.error(content.title, { description: content.description });
          return;
        }
        toast.success(
          `Empresa archivada. Datos hasta el ${formatFullDay(result.data.summary.retention_ends_at)}.`,
        );
      }
      setDialog(null);
      await Promise.all([refresh(), load()]);
    } finally {
      setBusy(false);
    }
  };

  const nameMatches = typedName.trim() === summary.name.trim();
  const canConfirm = reason.trim().length > 0 && (dialog !== 'archive' || nameMatches);

  if (summary.lifecycle === 'ARCHIVED') {
    return (
      <section aria-label="Empresa archivada" className={cn(SECTION, 'space-y-3 p-5')}>
        <ListStatusPill tone="slate">Archivada</ListStatusPill>
        <h2 className="text-lg font-semibold">
          Archivada{data.archived ? ` el ${formatFullDay(data.archived.at)} por ${data.archived.who}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          {data.archived?.reason ? `Motivo: ${data.archived.reason}. ` : ''}
          Nadie puede iniciar sesión.
          {summary.retentionEndsAt
            ? ` Los datos se conservan hasta el ${formatFullDay(summary.retentionEndsAt)}.`
            : ` Los datos se conservan ${RETENTION_DAYS} días.`}
        </p>
        <Button type="button" variant="outline" disabled={exporting} onClick={() => void handleExport()}>
          {exporting ? 'Exportando…' : 'Exportar datos'}
        </Button>
        <HistoryTable data={data} companyId={companyId} />
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="lifecycle-now" className={cn(SECTION, 'p-5')}>
        <p className="text-caption text-muted-foreground" id="lifecycle-now">
          Estado actual
        </p>
        <h2 className="mt-1 text-lg font-semibold">
          {summary.lifecycleLabel}
          {summary.statusSince ? ` desde el ${formatFullDay(summary.statusSince)}` : ''}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{accessSentence(summary)}</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {STAGES.map((stage, index) => {
            const current = index === currentIndex;
            return (
              <li
                key={stage.id}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'rounded-lg border px-3 py-2.5',
                  current ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <p className={cn('text-sm', current ? 'font-semibold' : 'font-medium text-muted-foreground')}>
                  {stage.label}
                </p>
                <p className="text-caption text-muted-foreground">{current ? 'Ahora' : stage.note}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <HistoryTable data={data} companyId={companyId} />

      <section aria-labelledby="lifecycle-data" className={cn(SECTION, 'divide-y divide-border/60')}>
        <h2 id="lifecycle-data" className="px-4 py-3.5 text-[15px] font-semibold">
          Datos
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-[1_1_20rem]">
            <p className="font-medium">Exportar datos</p>
            <p className="text-sm text-muted-foreground">
              Un archivo JSON con todo lo de la empresa, incluida la papelera.{' '}
              {lastExport ? `Última exportación: ${lastExport}.` : 'Nunca se ha exportado.'}
            </p>
          </div>
          <Button type="button" variant="outline" disabled={exporting} onClick={() => void handleExport()}>
            {exporting ? 'Exportando…' : 'Exportar'}
          </Button>
        </div>
        <div className="px-4 py-3.5">
          <p className="font-medium">Retención</p>
          <p className="text-sm text-muted-foreground">
            Si la empresa se archiva, sus datos se conservan {RETENTION_DAYS} días antes de una purga manual revisada.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="lifecycle-risk"
        className="divide-y divide-red-200 rounded-xl border border-red-200 bg-card dark:divide-red-900 dark:border-red-900"
      >
        <div className="px-4 py-3.5">
          <h2 id="lifecycle-risk" className="text-[15px] font-semibold text-red-700 dark:text-red-300">
            Zona de riesgo
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada acción pide confirmación y queda en la auditoría con tu nombre y el motivo.
          </p>
        </div>
        {summary.lifecycle !== 'SUSPENDED' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-[1_1_20rem]">
              <p className="font-medium">Suspender empresa</p>
              <p className="text-sm text-muted-foreground">
                Bloquea el inicio de sesión de sus {plural(summary.peopleCount, 'persona', 'personas')}. No se borra nada y puedes restaurar el acceso cuando quieras.
              </p>
            </div>
            <Button type="button" variant="outline" className="text-red-700 dark:text-red-300" onClick={() => setDialog('suspend')}>
              Suspender
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-[1_1_20rem]">
            <p className="font-medium">Archivar empresa</p>
            <p className="text-sm text-muted-foreground">
              Definitivo: una empresa archivada ya no cambia de estado. Los datos se conservan {RETENTION_DAYS} días. Pide escribir el nombre de la empresa.{' '}
              {lastExport ? `Exportación reciente: ${lastExport}.` : 'Todavía no se ha exportado.'}
            </p>
          </div>
          <Button type="button" variant="outline" className="text-red-700 dark:text-red-300" onClick={() => setDialog('archive')}>
            Archivar
          </Button>
        </div>
      </section>

      <AlertDialog open={dialog !== null} onOpenChange={(open) => !open && !busy && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === 'archive' ? `Archivar ${summary.name}` : `Suspender ${summary.name}`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {dialog === 'archive' ? (
                <div className="space-y-2 text-sm">
                  <p className="rounded-lg bg-red-500/10 px-3 py-2 font-medium text-red-700 dark:text-red-300">
                    Esto es definitivo. Una empresa archivada ya no cambia de estado.
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    <li>Nadie podrá iniciar sesión.</li>
                    <li>Los datos se conservan hasta el {formatFullDay(retentionEnd)}.</li>
                    <li>{lastExport ? `Última exportación: ${lastExport}.` : 'Todavía no se ha exportado.'}</li>
                  </ul>
                </div>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Sus {plural(summary.peopleCount, 'persona', 'personas')} no podrán iniciar sesión.</li>
                  <li>No se borra ningún dato.</li>
                  <li>Puedes restaurar el acceso cuando quieras.</li>
                </ul>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lifecycle-reason">Motivo</Label>
              <Textarea
                id="lifecycle-reason"
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                aria-describedby="lifecycle-reason-hint"
                disabled={busy}
              />
              <p id="lifecycle-reason-hint" className="text-caption text-muted-foreground">
                Se guarda en la auditoría y aparece en el historial de estado.
              </p>
            </div>
            {dialog === 'archive' ? (
              <div className="space-y-1.5">
                <Label htmlFor="lifecycle-name">Escribe {summary.name} para confirmar</Label>
                <Input
                  id="lifecycle-name"
                  value={typedName}
                  onChange={(event) => setTypedName(event.target.value)}
                  autoComplete="off"
                  disabled={busy}
                  className="h-11"
                />
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !canConfirm}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirm();
              }}
            >
              {busy ? 'Aplicando…' : dialog === 'archive' ? 'Archivar definitivamente' : 'Suspender empresa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const HistoryTable = ({ data, companyId }: { data: OperatorLifecycleData; companyId: number }) => (
  <section aria-labelledby="lifecycle-history" className={LIST_TABLE_CARD_CLASS}>
    <div className="flex items-baseline justify-between gap-3 px-4 py-3.5">
      <h2 id="lifecycle-history" className="text-[15px] font-semibold">
        Historial de estado
      </h2>
      <Link
        href={operatorConsoleCompanyHref(companyId, 'actividad')}
        className="text-sm font-medium text-primary hover:underline lg:text-[13px]"
      >
        Ver en Actividad
      </Link>
    </div>
    {data.history.length === 0 ? (
      <p className="border-t border-border/60 px-4 py-6 text-sm text-muted-foreground">
        Sin cambios de estado registrados.
      </p>
    ) : (
      <Table className={cn(LIST_TABLE_CLASS, LIST_TABLE_PADDING_CLASS)} aria-label="Historial de estado">
        <TableHeader>
          <TableRow>
            <TableHead className="w-36 border-t border-border/60">Fecha</TableHead>
            <TableHead className="border-t border-border/60">Cambio</TableHead>
            <TableHead className="w-48 border-t border-border/60">Quién</TableHead>
            <TableHead className="w-64 border-t border-border/60">Motivo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.history.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap tabular-nums text-slate-700 dark:text-slate-300">
                {formatFullDay(row.at)}
              </TableCell>
              <TableCell>
                <p className="font-medium">{row.title}</p>
                <p className="text-caption text-muted-foreground">{row.change}</p>
              </TableCell>
              <TableCell className="truncate">
                {row.who}
                {row.operator ? <span className="ml-1.5 text-caption text-muted-foreground">(operador)</span> : null}
              </TableCell>
              <TableCell className="truncate text-slate-700 dark:text-slate-300" title={row.reason ?? undefined}>
                {row.reason ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </section>
);

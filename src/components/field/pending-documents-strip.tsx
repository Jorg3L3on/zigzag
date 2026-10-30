'use client';

import * as React from 'react';
import Link from 'next/link';
import { CloudOff, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

import { FormattedCurrency } from '@/components/formatted-currency';
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
import { useCompany } from '@/contexts/company-context';
import { useFieldJobStore } from '@/hooks/use-field-job-store';
import { notifyFieldJobsChanged, useFieldJobSync } from '@/hooks/use-field-job-sync';
import { useNetworkStatus } from '@/hooks/use-network-status';
import {
  discardLocalJob,
  fieldJobStore,
  requeueLocalJob,
  type LocalJob,
} from '@/lib/field-jobs';
import { cn } from '@/lib/utils';

type DocumentKind = 'ticket' | 'presupuesto';

const COPY: Record<DocumentKind, { heading: string; composer: string; noun: string }> = {
  ticket: { heading: 'Tickets sin sincronizar', composer: '/tickets/create', noun: 'ticket' },
  presupuesto: {
    heading: 'Presupuestos sin sincronizar',
    composer: '/presupuestos/create',
    noun: 'presupuesto',
  },
};

/** Not uploaded yet: pending, on its way, or waiting for Revisar. */
export const isUnsyncedDocument = (job: LocalJob, kind: DocumentKind): boolean =>
  job.payload.composer?.kind === kind && !job.remoteTicketId && job.syncStatus !== 'synced';

const PendingDocumentRow = ({
  job,
  kind,
  onRetry,
  onDiscard,
}: {
  job: LocalJob;
  kind: DocumentKind;
  onRetry: (job: LocalJob) => void;
  onDiscard: (job: LocalJob) => void;
}) => {
  const failed = job.syncStatus === 'error';
  const uploading = job.syncStatus === 'uploading';
  const clientName = job.payload.client_name?.trim() || 'Cliente';
  const openHref = `${COPY[kind].composer}?pendiente=${encodeURIComponent(job.localJobId)}`;

  return (
    <li
      className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
      data-testid="pending-document-row"
      data-sync-status={job.syncStatus}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug [overflow-wrap:anywhere]">{clientName}</p>
          {job.payload.work_notes ? (
            <p className="truncate text-sm text-muted-foreground">{job.payload.work_notes}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          <FormattedCurrency amount={job.payload.total ?? 0} />
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-medium',
            failed
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary',
          )}
          aria-live="polite"
        >
          {uploading ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : failed ? (
            <TriangleAlert className="size-3" aria-hidden />
          ) : (
            <CloudOff className="size-3" aria-hidden />
          )}
          {uploading ? 'Subiendo…' : failed ? 'Revisar' : 'Pendiente de sincronizar'}
        </span>
        <span className="text-muted-foreground">Sin folio todavía · no es factura</span>
      </div>

      {failed && job.syncError ? (
        <p className="text-sm text-destructive" role="alert">
          {job.syncError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={failed ? 'default' : 'outline'} className="min-h-11 rounded-xl">
          <Link href={openHref}>{failed ? 'Revisar' : 'Abrir'}</Link>
        </Button>
        {failed ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 rounded-xl"
              onClick={() => onRetry(job)}
            >
              Reintentar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11 rounded-xl text-muted-foreground"
              onClick={() => onDiscard(job)}
            >
              Descartar
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
};

/**
 * Tickets or presupuestos saved with no signal (ZIG-I35-4), above the list:
 * pending with no folio yet, or Revisar with the server's reason. Nothing shows
 * when there are none.
 */
export const PendingDocumentsStrip = ({ kind }: { kind: DocumentKind }) => {
  const { selectedCompany } = useCompany();
  const companyId =
    selectedCompany?.id && selectedCompany.name !== 'System' ? selectedCompany.id : null;
  const store = useFieldJobStore(companyId);
  const sync = useFieldJobSync(companyId);
  const { isOnline } = useNetworkStatus();
  const [discarding, setDiscarding] = React.useState<LocalJob | null>(null);

  const documents = store.jobs.filter((job) => isUnsyncedDocument(job, kind));
  if (documents.length === 0) return null;

  const retry = async (job: LocalJob) => {
    await requeueLocalJob(fieldJobStore, job.localJobId);
    notifyFieldJobsChanged();
    if (isOnline) await sync.flushNow();
  };

  const confirmDiscard = async () => {
    if (!discarding) return;
    await discardLocalJob(fieldJobStore, discarding.localJobId);
    setDiscarding(null);
    notifyFieldJobsChanged();
  };

  return (
    <section
      aria-labelledby={`pending-${kind}-heading`}
      data-testid="pending-documents"
      className="mb-4 rounded-2xl border border-primary/25 bg-primary/5 p-4"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`pending-${kind}-heading`} className="text-base font-semibold">
          {COPY[kind].heading} · {documents.length}
        </h2>
        {isOnline ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="min-h-11 gap-1.5 rounded-xl text-primary"
            disabled={sync.syncing}
            onClick={() => void sync.flushNow()}
          >
            <RefreshCw className={cn('h-4 w-4', sync.syncing && 'animate-spin')} aria-hidden />
            Subir ahora
          </Button>
        ) : (
          <span className="text-caption text-muted-foreground">Se suben con señal</span>
        )}
      </div>
      <ul className="divide-y divide-border/60">
        {documents.map((job) => (
          <PendingDocumentRow
            key={job.localJobId}
            job={job}
            kind={kind}
            onRetry={(item) => void retry(item)}
            onDiscard={setDiscarding}
          />
        ))}
      </ul>

      <AlertDialog open={discarding != null} onOpenChange={(open) => !open && setDiscarding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este {COPY[kind].noun}?</AlertDialogTitle>
            <AlertDialogDescription>
              Nunca se subió: se borra de este teléfono y no se puede recuperar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Conservar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDiscard()}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

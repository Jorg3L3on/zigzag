'use client';

import Link from 'next/link';
import React from 'react';
import { useRouter } from 'next/navigation';
import { getCompanyOperatorSummary } from '@/actions/company-operator';
import { setCompanyLifecycleStatus } from '@/actions/company-lifecycle';
import { OperatorAccessPanel } from '@/components/operator-console/operator-access-panel';
import { OperatorActivityPanel } from '@/components/operator-console/operator-activity-panel';
import { OperatorCompanyMetrics } from '@/components/operator-console/operator-company-metrics';
import { OperatorCompanyOverview } from '@/components/operator-console/operator-company-overview';
import { OperatorLifecyclePanel } from '@/components/operator-console/operator-lifecycle-panel';
import { TripledEmptyState } from '@/components/tripled';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useCompany } from '@/contexts/company-context';
import {
  buildOperatorAttentionSignals,
  type OperatorAttentionSignal,
} from '@/lib/operator-attention';
import {
  resolveOperatorPrimaryCta,
  type OperatorPrimaryCta,
} from '@/lib/operator-primary-cta';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { operatorIncidentLabel } from '@/lib/operator-audit-incidents';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type DetailTab = 'resumen' | 'actividad' | 'acceso' | 'ciclo';

const TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'actividad', label: 'Actividad' },
  { id: 'acceso', label: 'Acceso' },
  { id: 'ciclo', label: 'Ciclo de vida' },
];

const attentionBadgeVariant = (
  tone: OperatorAttentionSignal['tone'],
): 'secondary' | 'destructive' | 'outline' => {
  if (tone === 'destructive') return 'destructive';
  if (tone === 'warning') return 'secondary';
  return 'outline';
};

export const OperatorConsoleDetail = () => {
  const { selectedCompany } = useCompany();
  const router = useRouter();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;

  const [tab, setTab] = React.useState<DetailTab>('resumen');
  const [visited, setVisited] = React.useState<Record<DetailTab, boolean>>({
    resumen: true,
    actividad: false,
    acceso: false,
    ciclo: false,
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [cta, setCta] = React.useState<OperatorPrimaryCta | null>(null);
  const [lifecycleLabel, setLifecycleLabel] = React.useState<string | null>(
    null,
  );
  const [productionReady, setProductionReady] = React.useState(false);
  const [missingCount, setMissingCount] = React.useState(0);
  const [attention, setAttention] = React.useState<OperatorAttentionSignal[]>(
    [],
  );
  const [editHref, setEditHref] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    setTab('resumen');
    setVisited({
      resumen: true,
      actividad: false,
      acceso: false,
      ciclo: false,
    });
  }, [companyId]);

  React.useEffect(() => {
    if (!companyId || isSystemTenant) {
      setLoading(false);
      setError(null);
      setCta(null);
      setLifecycleLabel(null);
      setAttention([]);
      setEditHref(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        const [summaryResult, incidentResponse] = await Promise.all([
          getCompanyOperatorSummary(companyId),
          fetch(
            `/api/audit/events?target_company_id=${companyId}&incidents_only=true&limit=1`,
          ),
        ]);

        if (cancelled) return;

        if (!summaryResult.success || !summaryResult.data) {
          const errorType = classifyClientError(
            null,
            undefined,
            summaryResult.errorType,
          );
          setError(
            getErrorMessageByType(
              errorType,
              summaryResult.error || 'No se pudo cargar el resumen',
            ),
          );
          setCta(null);
          setAttention([]);
          return;
        }

        const summary = summaryResult.data;
        setLifecycleLabel(summary.lifecycleLabel);
        setProductionReady(summary.readiness.productionReady);
        setMissingCount(summary.readiness.missing.length);
        setEditHref(summary.editHref);
        setCta(
          resolveOperatorPrimaryCta({
            companyId: summary.companyId,
            lifecycle: summary.lifecycle,
            productionReady: summary.readiness.productionReady,
            editHref: summary.editHref,
          }),
        );

        let lastIncidentAt: string | null = null;
        let lastIncidentLabel: string | null = null;
        if (incidentResponse.ok) {
          const payload = (await incidentResponse.json()) as {
            data?: Array<{
              occurred_at: string;
              action: string;
              result: string;
              resource_type: string;
              payload?: Record<string, unknown> | null;
            }>;
          };
          const first = payload.data?.[0];
          if (first) {
            lastIncidentAt = first.occurred_at;
            lastIncidentLabel = operatorIncidentLabel(first);
          }
        }

        setAttention(
          buildOperatorAttentionSignals({
            productionReady: summary.readiness.productionReady,
            missingCount: summary.readiness.missing.length,
            missingLabels: summary.readiness.missingLabels,
            allowsAuthentication: summary.allowsAuthentication,
            lastIncidentAt,
            lastIncidentLabel,
          }),
        );
      } catch (loadError) {
        if (cancelled) return;
        setError(
          getErrorMessageByType(
            classifyClientError(loadError),
            'No se pudo cargar el resumen',
          ),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, isSystemTenant, reloadToken]);

  const handleSelectTab = (next: DetailTab) => {
    setTab(next);
    setVisited((prev) => ({ ...prev, [next]: true }));
  };

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + delta + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    if (!next) return;
    handleSelectTab(next.id);
    const tablist = event.currentTarget.parentElement;
    const nextButton = tablist?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    )[nextIndex];
    nextButton?.focus();
  };

  const handlePrimaryClick = async () => {
    if (!cta || !companyId) return;

    if (cta.href && !cta.lifecycleTarget) {
      router.push(cta.href);
      return;
    }

    if (cta.lifecycleTarget) {
      setConfirmOpen(true);
    }
  };

  const handleConfirmLifecycle = async () => {
    if (!cta?.lifecycleTarget || !companyId) return;
    setConfirmBusy(true);
    try {
      const result = await setCompanyLifecycleStatus(
        companyId,
        cta.lifecycleTarget,
      );
      if (!result.success) {
        toast.error(result.error || 'No se pudo actualizar el estado');
        return;
      }
      toast.success(
        cta.kind === 'restore_access'
          ? 'Acceso restaurado'
          : 'Empresa activada',
      );
      setConfirmOpen(false);
      setReloadToken((value) => value + 1);
    } finally {
      setConfirmBusy(false);
    }
  };

  if (!companyId) {
    return (
      <div className="border-t border-border/60 pt-6">
        <TripledEmptyState
          icon={<Building2 className="h-4 w-4" aria-hidden />}
          title="Sin empresa seleccionada"
          description="Selecciona una empresa en la flota para ver su resumen y operarla."
        />
      </div>
    );
  }

  if (isSystemTenant) {
    return (
      <div className="border-t border-border/60 pt-6">
        <TripledEmptyState
          icon={<Building2 className="h-4 w-4" aria-hidden />}
          title="Empresa del sistema"
          description="Elige una empresa operativa (no la empresa Sistema) para revisar salud operativa."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 border-t border-border/60 pt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {selectedCompany?.name}
            </h2>
            {lifecycleLabel ? (
              <Badge variant="secondary">{lifecycleLabel}</Badge>
            ) : null}
            {productionReady ? (
              <Badge variant="default">Lista</Badge>
            ) : (
              <Badge variant="secondary">
                {missingCount > 0
                  ? `${missingCount} pendientes`
                  : 'Con pendientes'}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Contexto activo para operar esta empresa.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Cargando resumen…
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {editHref ? (
            <Button asChild variant="outline" className="min-h-11 rounded-xl">
              <Link href={editHref}>Editar empresa</Link>
            </Button>
          ) : null}
          {cta ? (
            <Button
              type="button"
              className="min-h-11 rounded-xl"
              onClick={() => void handlePrimaryClick()}
              disabled={loading}
            >
              {cta.label}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Secciones de la empresa seleccionada"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((item, index) => (
          <Button
            key={item.id}
            type="button"
            role="tab"
            id={`operator-tab-${item.id}`}
            aria-selected={tab === item.id}
            aria-controls={`operator-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            variant={tab === item.id ? 'default' : 'outline'}
            className="min-h-11 rounded-xl"
            onClick={() => handleSelectTab(item.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="operator-panel-resumen"
        aria-labelledby="operator-tab-resumen"
        hidden={tab !== 'resumen'}
        className={cn(tab === 'resumen' ? 'space-y-4' : 'hidden')}
      >
        {attention.length > 0 ? (
          <div
            className="flex flex-wrap gap-2"
            aria-label="Señales de atención"
          >
            {attention.map((signal) => (
              <Badge
                key={signal.id}
                variant={attentionBadgeVariant(signal.tone)}
                className="max-w-full whitespace-normal rounded-full px-2.5 py-1 text-left leading-snug"
              >
                {signal.label}
              </Badge>
            ))}
          </div>
        ) : null}
        <OperatorCompanyOverview embedded />
        <OperatorCompanyMetrics />
      </div>

      {visited.actividad ? (
        <div
          role="tabpanel"
          id="operator-panel-actividad"
          aria-labelledby="operator-tab-actividad"
          hidden={tab !== 'actividad'}
          className={cn(tab === 'actividad' ? 'block' : 'hidden')}
        >
          <OperatorActivityPanel />
        </div>
      ) : null}

      {visited.acceso ? (
        <div
          role="tabpanel"
          id="operator-panel-acceso"
          aria-labelledby="operator-tab-acceso"
          hidden={tab !== 'acceso'}
          className={cn(tab === 'acceso' ? 'block' : 'hidden')}
        >
          <OperatorAccessPanel />
        </div>
      ) : null}

      {visited.ciclo ? (
        <div
          role="tabpanel"
          id="operator-panel-ciclo"
          aria-labelledby="operator-tab-ciclo"
          hidden={tab !== 'ciclo'}
          className={cn(tab === 'ciclo' ? 'block' : 'hidden')}
        >
          <OperatorLifecyclePanel />
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cta?.kind === 'restore_access'
                ? '¿Restaurar acceso?'
                : '¿Activar empresa?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cta?.kind === 'restore_access'
                ? 'Los usuarios podrán iniciar sesión de nuevo si la empresa cumple los requisitos de preparación.'
                : 'Los usuarios podrán autenticarse cuando la empresa cumpla los requisitos de preparación.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmBusy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmLifecycle();
              }}
            >
              {confirmBusy ? 'Aplicando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

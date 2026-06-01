'use client';

import React from 'react';
import { getCompany } from '@/actions/companies';
import { setCompanyLifecycleStatus } from '@/actions/company-lifecycle';
import { CompanyPortabilityPanel } from '@/components/companies/company-portability-panel';
import { useCompany } from '@/contexts/company-context';
import { TripledEmptyState } from '@/components/tripled';
import type { Company } from '@/db/schema';
import type { CompanyLifecycleStatus } from '@/db/schema';
import { companyLifecycleSummary } from '@/lib/company-lifecycle-change';
import { companyLifecycleLabel } from '@/lib/company-lifecycle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';

type LifecycleAction = {
  label: string;
  nextStatus: CompanyLifecycleStatus;
  variant?: 'default' | 'destructive' | 'outline';
  impact: string;
};

const buildLifecycleActions = (
  company: Company,
): LifecycleAction[] => {
  const { lifecycle } = companyLifecycleSummary(company);
  if (lifecycle === 'ARCHIVED') {
    return [];
  }
  if (lifecycle === 'SETUP') {
    return [
      {
        label: 'Activar empresa',
        nextStatus: 'ACTIVE',
        impact:
          'Los usuarios podrán autenticarse cuando la empresa cumpla los requisitos de preparación.',
      },
    ];
  }
  if (lifecycle === 'ACTIVE') {
    return [
      {
        label: 'Suspender empresa',
        nextStatus: 'SUSPENDED',
        variant: 'destructive',
        impact:
          'Los usuarios no podrán iniciar sesión hasta que restaures la empresa.',
      },
    ];
  }
  if (lifecycle === 'SUSPENDED') {
    return [
      {
        label: 'Restaurar acceso (activar)',
        nextStatus: 'ACTIVE',
        impact:
          'Los usuarios volverán a poder autenticarse si la empresa cumple los requisitos de preparación.',
      },
    ];
  }
  return [];
};

export const OperatorLifecyclePanel = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;

  const [company, setCompany] = React.useState<Company | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<LifecycleAction | null>(
    null,
  );
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [blockerLabels, setBlockerLabels] = React.useState<string[]>([]);

  const reloadCompany = React.useCallback(async () => {
    if (!companyId || isSystemTenant) {
      setCompany(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getCompany(companyId);
      if (!result.success || !result.data) {
        const errorType = classifyClientError(null, undefined, result.errorType);
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo cargar la empresa',
          ),
        );
        setCompany(null);
        return;
      }
      setCompany(result.data);
    } catch (error) {
      setLoadError(
        getErrorMessageByType(
          classifyClientError(error),
          'No se pudo cargar la empresa',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, isSystemTenant]);

  React.useEffect(() => {
    void reloadCompany();
  }, [reloadCompany]);

  const handleConfirmLifecycle = async () => {
    if (!company || !pendingAction) {
      return;
    }
    setIsUpdating(true);
    setBlockerLabels([]);
    try {
      const result = await setCompanyLifecycleStatus(
        company.id,
        pendingAction.nextStatus,
      );
      if (!result.success || !result.data) {
        if (result.missingLabels?.length) {
          setBlockerLabels(result.missingLabels);
        }
        const errorType = classifyClientError(null, undefined, result.errorType);
        toast.error(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudo actualizar el estado',
          ),
        );
        return;
      }
      setCompany(result.data);
      toast.success(
        `Estado actualizado a ${companyLifecycleLabel(result.data.status)}.`,
      );
      setPendingAction(null);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!companyId || isSystemTenant) {
    return null;
  }

  const summary = company ? companyLifecycleSummary(company) : null;
  const actions = company ? buildLifecycleActions(company) : [];

  return (
    <section className="space-y-4 border-t border-border/60 pt-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Ciclo de vida y acciones sensibles
        </h2>
        <p className="text-sm text-muted-foreground">
          Operaciones para{' '}
          <span className="font-medium text-foreground">
            {selectedCompany?.name}
          </span>
          . Confirma cada cambio antes de aplicarlo.
        </p>
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : !company || !summary ? (
        <TripledEmptyState
          icon={<Settings2 className="h-4 w-4" aria-hidden />}
          title="Empresa no disponible"
          description="No se pudo cargar la empresa seleccionada."
        />
      ) : (
        <>
          <Alert
            variant={summary.isArchived ? 'destructive' : 'default'}
            className={summary.isArchived ? 'border-destructive/40 bg-destructive/5' : undefined}
          >
            <AlertTitle>
              Estado: {summary.label}
              {summary.isArchived ? ' (solo lectura operativa)' : ''}
            </AlertTitle>
            <AlertDescription>
              {summary.allowsAuthentication
                ? 'Los usuarios pueden autenticarse en esta empresa.'
                : 'Los usuarios no pueden autenticarse con el estado actual.'}
            </AlertDescription>
          </Alert>

          {blockerLabels.length > 0 ? (
            <Alert variant="destructive">
              <AlertTitle>Activación bloqueada</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {blockerLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          {actions.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {actions.map((action) => (
                <Button
                  key={action.nextStatus}
                  type="button"
                  variant={action.variant ?? 'outline'}
                  className="min-h-11 rounded-xl"
                  onClick={() => setPendingAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}

          {pendingAction ? (
            <AlertDialog
              open
              onOpenChange={(open) => {
                if (!open) {
                  setPendingAction(null);
                }
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{pendingAction.label}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Empresa objetivo:{' '}
                    <strong>{company.name}</strong> (ID {company.id}).
                    <br />
                    {pendingAction.impact}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPendingAction(null)}>
                    Cancelar
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={isUpdating}
                    onClick={handleConfirmLifecycle}
                  >
                    {isUpdating ? 'Aplicando…' : 'Confirmar'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}

          {!summary.isArchived ? (
            <Alert>
              <AlertTitle>Antes del offboarding</AlertTitle>
              <AlertDescription>
                Exporta los datos de la empresa antes de archivarla, salvo que ya
                tengas una copia reciente para portabilidad o cumplimiento.
              </AlertDescription>
            </Alert>
          ) : null}

          <CompanyPortabilityPanel company={company} />
        </>
      )}

    </section>
  );
};

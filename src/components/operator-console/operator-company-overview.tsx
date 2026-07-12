'use client';

import Link from 'next/link';
import React from 'react';
import { getCompanyReadiness } from '@/actions/companies';
import { getCompanyOperatorSummary } from '@/actions/company-operator';
import { useCompany } from '@/contexts/company-context';
import { TripledEmptyState } from '@/components/tripled';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Building2, ListChecks } from 'lucide-react';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';

type PanelState<T> = {
  loading: boolean;
  error: string | null;
  data: T | null;
};

const initialPanelState = <T,>(): PanelState<T> => ({
  loading: false,
  error: null,
  data: null,
});

export const OperatorCompanyOverview = () => {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;

  const [identity, setIdentity] = React.useState(
    initialPanelState<Awaited<
      ReturnType<typeof getCompanyOperatorSummary>
    >['data']>(),
  );
  const [readiness, setReadiness] = React.useState(
    initialPanelState<Awaited<ReturnType<typeof getCompanyReadiness>>['data']>(),
  );

  React.useEffect(() => {
    if (!companyId || isSystemTenant) {
      setIdentity(initialPanelState());
      setReadiness(initialPanelState());
      return;
    }

    let cancelled = false;

    const loadIdentity = async () => {
      setIdentity({ loading: true, error: null, data: null });
      try {
        const result = await getCompanyOperatorSummary(companyId);
        if (cancelled) {
          return;
        }
        if (!result.success || !result.data) {
          const errorType = classifyClientError(
            null,
            undefined,
            result.errorType,
          );
          setIdentity({
            loading: false,
            error: getErrorMessageByType(
              errorType,
              result.error || 'No se pudo cargar el resumen de la empresa',
            ),
            data: null,
          });
          return;
        }
        setIdentity({ loading: false, error: null, data: result.data });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const errorType = classifyClientError(error);
        setIdentity({
          loading: false,
          error: getErrorMessageByType(
            errorType,
            'No se pudo cargar el resumen de la empresa',
          ),
          data: null,
        });
      }
    };

    const loadReadiness = async () => {
      setReadiness({ loading: true, error: null, data: null });
      try {
        const result = await getCompanyReadiness(companyId);
        if (cancelled) {
          return;
        }
        if (!result.success || !result.data) {
          const errorType = classifyClientError(
            null,
            undefined,
            result.errorType,
          );
          setReadiness({
            loading: false,
            error: getErrorMessageByType(
              errorType,
              result.error || 'No se pudo cargar la preparación',
            ),
            data: null,
          });
          return;
        }
        setReadiness({ loading: false, error: null, data: result.data });
      } catch (error) {
        if (cancelled) {
          return;
        }
        const errorType = classifyClientError(error);
        setReadiness({
          loading: false,
          error: getErrorMessageByType(
            errorType,
            'No se pudo cargar la preparación',
          ),
          data: null,
        });
      }
    };

    void loadIdentity();
    void loadReadiness();

    return () => {
      cancelled = true;
    };
  }, [companyId, isSystemTenant]);

  if (!companyId) {
    return (
      <TripledEmptyState
        icon={<Building2 className="h-4 w-4" aria-hidden />}
        title="Sin empresa seleccionada"
        description="Selecciona una empresa en la lista para ver su resumen operativo."
      />
    );
  }

  if (isSystemTenant) {
    return (
      <TripledEmptyState
        icon={<Building2 className="h-4 w-4" aria-hidden />}
        title="Empresa del sistema"
        description="Elige una empresa operativa (no la empresa Sistema) para revisar salud operativa."
      />
    );
  }

  const summary = identity.data;

  return (
    <div className="space-y-4 border-t border-border/60 pt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Resumen: {selectedCompany?.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            Contexto activo para operaciones entre empresas.
          </p>
        </div>
        {summary ? (
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href={summary.editHref}>Editar empresa</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" aria-hidden />
              Identidad y ciclo de vida
            </CardTitle>
            <CardDescription>Estado operativo de la empresa</CardDescription>
          </CardHeader>
          <CardContent>
            {identity.loading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : identity.error ? (
              <p className="text-sm text-destructive" role="alert">
                {identity.error}
              </p>
            ) : summary ? (
              <dl className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="sr-only">Estado</dt>
                  <dd>
                    <Badge
                      variant={
                        summary.lifecycle === 'ACTIVE' ? 'default' : 'secondary'
                      }
                    >
                      {summary.lifecycleLabel}
                    </Badge>
                  </dd>
                  {!summary.allowsAuthentication ? (
                    <Badge variant="destructive">Sin acceso de usuarios</Badge>
                  ) : null}
                </div>
                <div>
                  <dt className="text-muted-foreground">Correo</dt>
                  <dd className="truncate">{summary.email}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd>{summary.phone}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Roles</dt>
                  <dd>{summary.roleCount}</dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4" aria-hidden />
              Preparación (go-live)
            </CardTitle>
            <CardDescription>Requisitos antes de operar en producción</CardDescription>
          </CardHeader>
          <CardContent>
            {readiness.loading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : readiness.error ? (
              <p className="text-sm text-destructive" role="alert">
                {readiness.error}
              </p>
            ) : readiness.data ? (
              <div className="space-y-3 text-sm">
                {readiness.data.productionReady ? (
                  <Badge variant="default">Lista para operar</Badge>
                ) : (
                  <>
                    <Badge variant="secondary">Pendientes de configuración</Badge>
                    <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                      {readiness.data.missingLabels.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

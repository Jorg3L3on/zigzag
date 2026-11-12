'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, useSelectedLayoutSegment } from 'next/navigation';
import { Building2, ChevronsUpDown, Download, FileSearch, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { getOperatorCompanyFleet } from '@/actions/company-operator';
import { setCompanyLifecycleStatus } from '@/actions/company-lifecycle';
import { CompanyBrandAvatar } from '@/components/companies/company-brand-avatar';
import { DesktopSwitch } from '@/components/desktop-switch';
import { ListRowMenu, ListStatusPill, ListViewTabs } from '@/components/list-page';
import {
  OperatorCompanyProvider,
  useOperatorCompany,
} from '@/components/operator-console/operator-company-context';
import { useOperatorCompanyActions } from '@/components/operator-console/use-operator-company-actions';
import {
  TripledDashboardShell,
  TripledEmptyState,
  TripledPageHeader,
} from '@/components/tripled';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import type { OperatorFleetRow } from '@/lib/company-operator-fleet';
import type { CompanyOperatorSummary } from '@/lib/company-operator-summary';
import {
  formatFullDay,
  formatOnDay,
  LIFECYCLE_TONE,
  plural,
} from '@/lib/operator-console-format';
import { resolveOperatorPrimaryCta } from '@/lib/operator-primary-cta';
import {
  OPERATOR_COMPANY_TABS,
  operatorConsoleCompanyHref,
  operatorTenantHref,
  type OperatorCompanyTab,
} from '@/lib/operator-tenant-scope';
import { cn } from '@/lib/utils';

const TAB_LABEL: Record<OperatorCompanyTab, string> = {
  resumen: 'Resumen',
  actividad: 'Actividad',
  acceso: 'Acceso',
  'ciclo-de-vida': 'Ciclo de vida',
};

const isTab = (value: string | null): value is OperatorCompanyTab =>
  OPERATOR_COMPANY_TABS.includes(value as OperatorCompanyTab);

export const tabCaption = (
  tab: OperatorCompanyTab,
  summary: CompanyOperatorSummary | null,
): string | null => {
  if (!summary) return null;
  switch (tab) {
    case 'resumen':
      return summary.pendingCount > 0
        ? plural(summary.pendingCount, 'pendiente', 'pendientes')
        : 'Al día';
    case 'actividad':
      return summary.alert ? '1 alerta' : 'Últimos 7 días';
    case 'acceso':
      return `${plural(summary.peopleCount, 'persona', 'personas')} · ${plural(summary.roleCount, 'rol', 'roles')}`;
    case 'ciclo-de-vida':
      return summary.statusSince
        ? `${summary.lifecycleLabel} desde ${formatOnDay(summary.statusSince)}`
        : summary.lifecycleLabel;
    default:
      return null;
  }
};

/** «Cambiar de empresa»: a plain list of the fleet, opened on demand (ZIG-I38 decision). */
const CompanySwitcher = ({
  companyId,
  tab,
}: {
  companyId: number;
  tab: OperatorCompanyTab;
}) => {
  const [rows, setRows] = React.useState<OperatorFleetRow[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  const load = React.useCallback(async () => {
    if (rows) return;
    setFailed(false);
    const result = await getOperatorCompanyFleet();
    if (result.success && result.data) {
      setRows([...result.data].sort((a, b) => a.name.localeCompare(b.name, 'es')));
    } else {
      setFailed(true);
    }
  }, [rows]);

  return (
    <DropdownMenu onOpenChange={(open) => open && void load()}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7 rounded-lg text-muted-foreground"
          aria-label="Cambiar de empresa"
        >
          <ChevronsUpDown className="size-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
        <DropdownMenuLabel>Cambiar de empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {failed ? (
          <DropdownMenuItem disabled>No se pudo cargar la flota</DropdownMenuItem>
        ) : rows == null ? (
          <DropdownMenuItem disabled>Cargando…</DropdownMenuItem>
        ) : (
          rows.map((row) => (
            <DropdownMenuItem key={row.id} asChild disabled={row.id === companyId}>
              <Link href={operatorConsoleCompanyHref(row.id, tab)} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <ListStatusPill tone={LIFECYCLE_TONE[row.lifecycle]} className="h-5 px-2">
                  {row.lifecycleLabel}
                </ListStatusPill>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

const CompanyHeader = ({ tab }: { tab: OperatorCompanyTab }) => {
  const { companyId, summary, loading, refresh } = useOperatorCompany();
  const { operateAs, exportData, exporting } = useOperatorCompanyActions();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  if (!summary) {
    return (
      <div className="flex items-center gap-4" aria-busy="true" aria-label="Cargando empresa">
        <Skeleton className="size-14 rounded-[14px]" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
    );
  }

  const cta = resolveOperatorPrimaryCta({
    companyId,
    lifecycle: summary.lifecycle,
    profileReady: summary.profile.missing === 0,
    editHref: summary.editHref,
  });
  const editHref = operatorTenantHref(summary.editHref, companyId);

  const handlePrimary = () => {
    if (!cta) return;
    if (cta.kind === 'operate_as') {
      operateAs({ id: summary.id, name: summary.name, logo: summary.logo });
      return;
    }
    if (cta.lifecycleTarget) setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!cta?.lifecycleTarget) return;
    setBusy(true);
    try {
      const result = await setCompanyLifecycleStatus(companyId, cta.lifecycleTarget);
      if (!result.success) {
        toast.error(result.error || 'No se pudo actualizar el estado');
        return;
      }
      toast.success(cta.kind === 'restore_access' ? 'Acceso restaurado' : 'Empresa activada');
      setConfirmOpen(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const contactLine = [
    summary.email,
    summary.phone,
    `ID ${summary.id}`,
    `Alta el ${formatFullDay(summary.createdAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <CompanyBrandAvatar
            name={summary.name}
            logoUrl={summary.logo}
            fallbackTone="primary"
            imageSizes="56px"
            className="size-14 shrink-0 rounded-[14px] text-lg"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="truncate text-2xl font-semibold tracking-tight"
                title={summary.name}
              >
                {summary.name}
              </h1>
              <CompanySwitcher companyId={companyId} tab={tab} />
              <ListStatusPill tone={LIFECYCLE_TONE[summary.lifecycle]}>
                {summary.lifecycleLabel}
              </ListStatusPill>
              {summary.alert ? <ListStatusPill tone="red">1 alerta</ListStatusPill> : null}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground" title={contactLine}>
              {contactLine}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {cta?.kind === 'complete_profile' && cta.href ? (
            <>
              <Button asChild>
                <Link href={cta.href}>{cta.label}</Link>
              </Button>
              {/* Frame 6A: activation shows, disabled, with what is missing (audit L2). */}
              <span className="flex flex-col items-end gap-0.5">
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  aria-describedby="operator-activate-hint"
                >
                  Activar empresa
                </Button>
                <span id="operator-activate-hint" className="max-w-64 text-right text-caption text-muted-foreground">
                  Activar se habilita con el perfil completo. Falta: {summary.profile.missingLabels.join(', ')}.
                </span>
              </span>
            </>
          ) : cta ? (
            <Button type="button" onClick={handlePrimary} disabled={loading}>
              {cta.label}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={() => void exportData(companyId)}
            >
              <Download className="h-4 w-4" aria-hidden />
              {exporting ? 'Exportando…' : 'Exportar datos'}
            </Button>
          )}
          <div className="[&_button]:size-10 [&_button]:rounded-[10px] [&_button]:border [&_button]:border-border">
            <ListRowMenu
              label={`Más acciones de ${summary.name}`}
              items={[
                ...(summary.lifecycle !== 'ARCHIVED'
                  ? [
                      {
                        label: 'Editar empresa',
                        icon: <Pencil className="h-4 w-4" aria-hidden />,
                        onSelect: () => router.push(editHref),
                      },
                    ]
                  : []),
                ...(cta
                  ? [
                      {
                        label: 'Exportar datos',
                        icon: <Download className="h-4 w-4" aria-hidden />,
                        onSelect: () => void exportData(companyId),
                      },
                    ]
                  : []),
                {
                  label: 'Ver en Auditoría',
                  icon: <FileSearch className="h-4 w-4" aria-hidden />,
                  onSelect: () => router.push(`/audit?target_company_id=${companyId}`),
                },
              ]}
            />
          </div>
        </div>
      </header>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !busy && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cta?.kind === 'restore_access' ? '¿Restaurar acceso?' : '¿Activar empresa?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Las personas de {summary.name} podrán iniciar sesión y operar según sus permisos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {busy ? 'Aplicando…' : cta?.label ?? 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

const CompanyTabs = ({ tab }: { tab: OperatorCompanyTab }) => {
  const { companyId, summary } = useOperatorCompany();
  const tabs = OPERATOR_COMPANY_TABS.map((id) => ({
    id,
    label: TAB_LABEL[id],
    count: null,
    caption: tabCaption(id, summary) ?? ' ',
  }));
  return (
    <DesktopSwitch
      phone={
        <nav aria-label="Secciones de la empresa" className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <Link
              key={item.id}
              href={operatorConsoleCompanyHref(companyId, item.id)}
              aria-current={item.id === tab ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center rounded-xl border px-4 text-sm font-medium',
                item.id === tab
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      }
      desktop={
        <ListViewTabs
          label="Secciones de la empresa"
          tabs={tabs}
          isSelected={(id) => id === tab}
          getHref={(id) => operatorConsoleCompanyHref(companyId, id)}
        />
      }
    />
  );
};

const ShellBody = ({ children }: { children: React.ReactNode }) => {
  const { summary, error, loading, refresh } = useOperatorCompany();
  const segment = useSelectedLayoutSegment();
  const tab: OperatorCompanyTab = isTab(segment) ? segment : 'resumen';

  const crumbs = [
    { label: 'Consola operadora', href: '/operator-console' },
    { label: summary?.name ?? 'Empresa' },
  ];

  if (!summary && error && !loading) {
    return (
      <>
        <TripledPageHeader items={crumbs} />
        <TripledDashboardShell>
          <TripledEmptyState
            icon={<Building2 className="h-4 w-4" aria-hidden />}
            title="Empresa no disponible"
            description={error}
            action={
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void refresh()}>
                  Reintentar
                </Button>
                <Button asChild variant="outline">
                  <Link href="/operator-console">Volver a la flota</Link>
                </Button>
              </div>
            }
          />
        </TripledDashboardShell>
      </>
    );
  }

  return (
    <>
      <TripledPageHeader items={crumbs} />
      <TripledDashboardShell contentClassName="gap-5">
        <CompanyHeader tab={tab} />
        <CompanyTabs tab={tab} />
        <div className="min-w-0">{children}</div>
      </TripledDashboardShell>
    </>
  );
};

/** The company page of the console: breadcrumbs, header, tabs as routes (ZIG-I38-2). */
export const OperatorCompanyShell = ({
  companyId,
  children,
}: {
  companyId: number;
  children: React.ReactNode;
}) => (
  <OperatorCompanyProvider companyId={companyId}>
    <ShellBody>{children}</ShellBody>
  </OperatorCompanyProvider>
);

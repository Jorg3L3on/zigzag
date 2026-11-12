'use client';

import React from 'react';
import Link from 'next/link';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, CircleAlert } from 'lucide-react';
import { fetchDashboardMetrics, type DashboardMetrics } from '@/actions/dashboard';
import { fetchOperatorCompanyUsage } from '@/actions/operator-company-usage';
import { resetUserTemporaryPassword } from '@/actions/users';
import { useOperatorCompany } from '@/components/operator-console/operator-company-context';
import { ListError, ListStatusPill } from '@/components/list-page';
import { TemporaryPasswordDialog } from '@/components/users/temporary-password-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { CompanyOperatorSummary } from '@/lib/company-operator-summary';
import type { DashboardKpi, DashboardKpiKey } from '@/lib/dashboard-kpi';
import { formatCompactCurrency } from '@/lib/format-compact';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  describeWeekDelta,
  weekDeltaTone,
  type OperatorCompanyPerson,
  type OperatorCompanyUsage,
} from '@/lib/operator-company-usage';
import { formatRelative, formatWhenShort, plural } from '@/lib/operator-console-format';
import {
  operatorConsoleCompanyHref,
  operatorTenantHref,
} from '@/lib/operator-tenant-scope';
import { cn } from '@/lib/utils';

const KPI_LABEL: Record<DashboardKpiKey, string> = {
  revenue: 'Ingresos del mes',
  cashCollected: 'Efectivo cobrado',
  outstandingBalance: 'Saldo por cobrar',
  activeTickets: 'Tickets activos',
};

const KPI_ORDER: DashboardKpiKey[] = ['revenue', 'cashCollected', 'outstandingBalance', 'activeTickets'];

const SECTION_TITLE = 'text-[15px] font-semibold';
const KPI_GRID =
  'grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4';

const kpiValue = (kpi: DashboardKpi) =>
  kpi.format === 'currency'
    ? formatCompactCurrency(kpi.value)
    : new Intl.NumberFormat('es-MX').format(kpi.value);

const kpiDelta = (kpi: DashboardKpi, previousMonth: string): string => {
  if (kpi.deltaPercent == null) return `Sin datos de ${previousMonth}`;
  const rounded = Math.round(kpi.deltaPercent);
  if (rounded === 0) return `Igual que ${previousMonth}`;
  return `${Math.abs(rounded)}% ${rounded > 0 ? 'más' : 'menos'} que ${previousMonth}`;
};

type PendingItem = {
  key: string;
  tone: 'red' | 'amber';
  tag: string;
  title: string;
  detail: string;
  action: React.ReactNode;
};

const Pendientes = ({ items }: { items: PendingItem[] }) => {
  if (items.length === 0) return null;
  return (
    <section aria-label="Pendientes" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border/60 px-4 py-3.5">
        <h2 className={SECTION_TITLE}>
          Pendientes <span className="font-normal text-muted-foreground">· {items.length}</span>
        </h2>
      </div>
      <ul>
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border/60 px-4 py-3.5 last:border-b-0"
          >
            <ListStatusPill tone={item.tone} className="shrink-0">
              {item.tag}
            </ListStatusPill>
            <div className="min-w-0 flex-[1_1_20rem]">
              <p className="font-medium">{item.title}</p>
              <p className="text-caption text-muted-foreground">{item.detail}</p>
            </div>
            {item.action}
          </li>
        ))}
      </ul>
    </section>
  );
};

const UsageBand = ({ usage, summary }: { usage: OperatorCompanyUsage; summary: CompanyOperatorSummary }) => {
  const total = usage.people.length;
  const toneClass = (current: number, previous: number) =>
    weekDeltaTone(current, previous) === 'up' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground';
  return (
    <section aria-label="Uso">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className={SECTION_TITLE}>Uso</h2>
        <span className="text-caption text-muted-foreground">
          Últimos 7 días, comparados con los 7 anteriores
        </span>
      </div>
      <dl className={KPI_GRID}>
        <div className="bg-card px-[18px] py-4">
          <dt className="text-caption text-muted-foreground">Último acceso</dt>
          <dd className="mt-1.5">
            <span className="block text-2xl font-semibold tracking-tight">
              {usage.lastSignIn ? formatRelative(usage.lastSignIn.at) : 'Nunca'}
            </span>
            <span className="text-caption text-muted-foreground">
              {usage.lastSignIn?.name ?? 'Nadie ha entrado'}
            </span>
          </dd>
        </div>
        <div className="bg-card px-[18px] py-4">
          <dt className="text-caption text-muted-foreground">Personas activas</dt>
          <dd className="mt-1.5">
            <span className="block text-2xl font-semibold tabular-nums tracking-tight">
              {usage.activePeople} de {total}
            </span>
            <span className="text-caption text-muted-foreground">
              {summary.neverSignedInCount > 0
                ? `${summary.neverSignedInCount} nunca ${summary.neverSignedInCount === 1 ? 'ha' : 'han'} entrado`
                : 'Todas han entrado alguna vez'}
            </span>
          </dd>
        </div>
        <div className="bg-card px-[18px] py-4">
          <dt className="text-caption text-muted-foreground">Tickets creados</dt>
          <dd className="mt-1.5">
            <span className="block text-2xl font-semibold tabular-nums tracking-tight">
              {usage.ticketsCreated.current}
            </span>
            <span className={cn('text-caption', toneClass(usage.ticketsCreated.current, usage.ticketsCreated.previous))}>
              {describeWeekDelta(usage.ticketsCreated.current, usage.ticketsCreated.previous)}
            </span>
          </dd>
        </div>
        <div className="bg-card px-[18px] py-4">
          <dt className="text-caption text-muted-foreground">Cobros registrados</dt>
          <dd className="mt-1.5">
            <span className="block text-2xl font-semibold tabular-nums tracking-tight">
              {usage.paymentsRecorded.current}
            </span>
            <span className={cn('text-caption', toneClass(usage.paymentsRecorded.current, usage.paymentsRecorded.previous))}>
              {describeWeekDelta(usage.paymentsRecorded.current, usage.paymentsRecorded.previous)}
            </span>
          </dd>
        </div>
      </dl>
    </section>
  );
};

const MoneyBand = ({
  metrics,
  error,
  onRetry,
  companyId,
}: {
  metrics: DashboardMetrics | null;
  error: string | null;
  onRetry: () => void;
  companyId: number;
}) => {
  const now = new Date();
  const month = format(now, 'MMMM yyyy', { locale: es });
  const previousMonth = format(subMonths(now, 1), 'MMMM', { locale: es });
  const kpis = KPI_ORDER.map((key) => metrics?.kpis.find((kpi) => kpi.key === key)).filter(
    (kpi): kpi is DashboardKpi => Boolean(kpi),
  );
  return (
    <section aria-label="Dinero">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className={SECTION_TITLE}>
          Dinero <span className="font-normal text-muted-foreground">· {month}</span>
        </h2>
        <Link
          href={operatorTenantHref('/dashboard', companyId)}
          className="text-sm lg:text-[13px] font-medium text-primary hover:underline"
        >
          Abrir su tablero
        </Link>
      </div>
      {error ? (
        <ListError description={error} onRetry={onRetry} />
      ) : !metrics ? (
        <Skeleton className="h-[74px] w-full rounded-xl" />
      ) : (
        <dl className={KPI_GRID}>
          {kpis.map((kpi) => (
            <div key={kpi.key} className="bg-card px-[18px] py-3">
              <dt className="text-caption text-muted-foreground">{KPI_LABEL[kpi.key]}</dt>
              <dd className="mt-1">
                <span className="block text-lg font-semibold tabular-nums">{kpiValue(kpi)}</span>
                <span className="text-caption text-muted-foreground">{kpiDelta(kpi, previousMonth)}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

const PeopleCard = ({ people, companyId }: { people: OperatorCompanyPerson[]; companyId: number }) => (
  <section aria-label="Personas" className={cn(LIST_TABLE_CARD_CLASS, 'min-w-0 flex-[3_1_27.5rem]')}>
    <div className="flex items-baseline justify-between gap-3 px-4 py-3.5">
      <h2 className={SECTION_TITLE}>
        Personas <span className="font-normal text-muted-foreground">· {people.length}</span>
      </h2>
      <Link
        href={operatorConsoleCompanyHref(companyId, 'acceso')}
        className="text-sm lg:text-[13px] font-medium text-primary hover:underline"
      >
        Gestionar en Acceso
      </Link>
    </div>
    {people.length === 0 ? (
      <p className="border-t border-border/60 px-4 py-6 text-sm text-muted-foreground">
        Esta empresa todavía no tiene personas.
      </p>
    ) : (
      <Table
        className={cn(LIST_TABLE_CLASS, LIST_TABLE_PADDING_CLASS)}
        aria-label="Personas de la empresa"
      >
        <TableHeader>
          <TableRow>
            <TableHead className="border-t border-border/60">Persona</TableHead>
            <TableHead className="w-36 border-t border-border/60">Rol</TableHead>
            <TableHead className="w-40 border-t border-border/60">Último acceso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((person) => (
            <TableRow key={person.id}>
              <TableCell>
                <div className="min-w-0">
                  <p className="truncate font-medium" title={person.name}>{person.name}</p>
                  <p className="truncate text-caption text-muted-foreground" title={person.email}>
                    {person.email}
                  </p>
                </div>
              </TableCell>
              <TableCell className="text-slate-700 dark:text-slate-300">{person.roleName ?? '—'}</TableCell>
              <TableCell>
                {person.lastSignedInAt ? (
                  <span className="text-slate-700 dark:text-slate-300">{formatRelative(person.lastSignedInAt)}</span>
                ) : (
                  <ListStatusPill tone="amber">Nunca ha entrado</ListStatusPill>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )}
  </section>
);

const ProfileCard = ({ summary, editHref }: { summary: CompanyOperatorSummary; editHref: string }) => {
  const { profile } = summary;
  const complete = profile.missing === 0;
  const pct = Math.round((profile.done / profile.total) * 100);
  return (
    <section aria-label="Perfil de la empresa" className="min-w-0 flex-[2_1_18.75rem] rounded-xl border border-border bg-card px-4 pb-4 pt-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className={SECTION_TITLE}>Perfil de la empresa</h2>
        <span
          className={cn(
            'text-sm lg:text-[13px] font-semibold',
            complete ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300',
          )}
        >
          {profile.done} de {profile.total} datos
        </span>
      </div>
      <div aria-hidden className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', complete ? 'bg-emerald-500' : 'bg-amber-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-3.5 flex flex-col gap-3">
        {profile.groups.map((group) => {
          const done = group.items.filter((item) => item.done).length;
          const groupComplete = done === group.items.length;
          const missing = group.items.filter((item) => !item.done);
          return (
            <li key={group.id}>
              <div className="flex items-center gap-2.5">
                {groupComplete ? (
                  <Check role="img" aria-label="Completo" className="size-4 text-emerald-700" strokeWidth={2.5} />
                ) : (
                  <CircleAlert role="img" aria-label="Incompleto" className="size-4 text-amber-600" />
                )}
                <span className="flex-1">{group.label}</span>
                <span className="text-caption text-muted-foreground">
                  {done} de {group.items.length}
                </span>
              </div>
              {missing.length > 0 ? (
                <ul className="ml-[26px] mt-1.5 space-y-1">
                  {missing.map((item) => (
                    <li key={item.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">Falta: {item.label}</span>
                      <Link
                        href={`${editHref}#${item.field}`}
                        className="text-sm lg:text-[13px] font-medium text-primary hover:underline"
                      >
                        Completar
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3.5 text-caption text-muted-foreground">
        Es el requisito para activar una empresa. Lo completa el dueño en Mi empresa o tú desde{' '}
        <Link href={editHref} className="text-primary hover:underline">
          Editar empresa
        </Link>
        .
      </p>
    </section>
  );
};

const ResumenSkeleton = () => (
  <div className="space-y-5" aria-busy="true" aria-label="Cargando resumen">
    <Skeleton className="h-[106px] w-full rounded-xl" />
    <Skeleton className="h-[74px] w-full rounded-xl" />
    <div className="flex flex-wrap gap-5">
      <Skeleton className="h-64 min-w-0 flex-[3_1_27.5rem] rounded-xl" />
      <Skeleton className="h-64 min-w-0 flex-[2_1_18.75rem] rounded-xl" />
    </div>
  </div>
);

/**
 * Resumen (ZIG-I38-4, frames 2 and 6A): pending items only when there are
 * some, usage first, money of the month in a compact band, people with their
 * last sign-in and the grouped company profile.
 */
export const OperatorCompanyOverview = () => {
  const { companyId, summary } = useOperatorCompany();
  const [usage, setUsage] = React.useState<OperatorCompanyUsage | null>(null);
  const [usageError, setUsageError] = React.useState<string | null>(null);
  const [metrics, setMetrics] = React.useState<DashboardMetrics | null>(null);
  const [metricsError, setMetricsError] = React.useState<string | null>(null);
  const [resetPerson, setResetPerson] = React.useState<OperatorCompanyPerson | null>(null);
  const [reloadUsage, setReloadUsage] = React.useState(0);
  const [reloadMetrics, setReloadMetrics] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setUsage(null);
    setUsageError(null);
    fetchOperatorCompanyUsage(companyId)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) setUsage(result.data);
        else
          setUsageError(
            getErrorMessageByType(
              classifyClientError(null, undefined, result.errorType),
              result.error || 'No se pudo cargar el uso',
            ),
          );
      })
      .catch((error) => {
        if (!cancelled)
          setUsageError(getErrorMessageByType(classifyClientError(error), 'No se pudo cargar el uso'));
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, reloadUsage]);

  React.useEffect(() => {
    let cancelled = false;
    setMetrics(null);
    setMetricsError(null);
    fetchDashboardMetrics({ companyId })
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) setMetrics(result.data);
        else
          setMetricsError(
            getErrorMessageByType(
              classifyClientError(null, undefined, result.errorType),
              result.error || 'No se pudo cargar el dinero del mes',
            ),
          );
      })
      .catch((error) => {
        if (!cancelled)
          setMetricsError(
            getErrorMessageByType(classifyClientError(error), 'No se pudo cargar el dinero del mes'),
          );
      });
    return () => {
      cancelled = true;
    };
  }, [companyId, reloadMetrics]);

  if (usageError) {
    return <ListError description={usageError} onRetry={() => setReloadUsage((n) => n + 1)} />;
  }
  if (!summary || !usage) {
    return <ResumenSkeleton />;
  }

  const editHref = operatorTenantHref(summary.editHref, companyId);
  const archived = summary.lifecycle === 'ARCHIVED';
  const pending: PendingItem[] = [];
  if (!archived && summary.alert) {
    pending.push({
      key: 'alert',
      tone: 'red',
      tag: 'Alerta de seguridad',
      title:
        summary.alert.kind === 'sign_in_burst'
          ? `${summary.alert.count} inicios de sesión fallidos en 15 minutos`
          : summary.alert.label,
      detail: [
        summary.alert.account ? `Cuenta ${summary.alert.account}` : null,
        formatWhenShort(summary.alert.at),
      ]
        .filter(Boolean)
        .join(' · '),
      action: (
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={`${operatorConsoleCompanyHref(companyId, 'actividad')}?alertas=1`}>
            Ver en Actividad
          </Link>
        </Button>
      ),
    });
  }
  if (!archived && summary.profile.missing > 0) {
    pending.push({
      key: 'profile',
      tone: 'amber',
      tag: 'Faltan datos',
      title: `${plural(summary.profile.missing, 'dato', 'datos')} del perfil sin llenar`,
      detail: summary.profile.missingLabels.join(', '),
      action: (
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href={editHref}>Completar datos</Link>
        </Button>
      ),
    });
  }
  if (!archived) {
    for (const person of usage.people.filter((p) => !p.lastSignedInAt)) {
      pending.push({
        key: `never-${person.id}`,
        tone: 'amber',
        tag: 'Acceso',
        title: `${person.name} nunca ha iniciado sesión`,
        detail: [person.roleName, `alta ${formatRelative(person.createdAt)}`].filter(Boolean).join(' · '),
        action: (
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setResetPerson(person)}>
            Dar contraseña temporal
          </Button>
        ),
      });
    }
  }

  return (
    <div className="space-y-5">
      <Pendientes items={pending} />
      <UsageBand usage={usage} summary={summary} />
      <MoneyBand
        metrics={metrics}
        error={metricsError}
        onRetry={() => setReloadMetrics((n) => n + 1)}
        companyId={companyId}
      />
      <div className="flex flex-wrap items-start gap-5">
        <PeopleCard people={usage.people} companyId={companyId} />
        <ProfileCard summary={summary} editHref={editHref} />
      </div>
      <TemporaryPasswordDialog
        target={resetPerson}
        onReset={() =>
          resetPerson
            ? resetUserTemporaryPassword(BigInt(resetPerson.id))
            : Promise.resolve({ success: false })
        }
        onOpenChange={(open) => {
          if (!open) setResetPerson(null);
        }}
      />
    </div>
  );
};

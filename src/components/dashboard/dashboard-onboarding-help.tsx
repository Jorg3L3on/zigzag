'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type DashboardOnboardingHelpProps = {
  totalClients: number;
  totalServices: number;
  totalTickets: number;
  totalServicesSold: number;
  canCreateClients: boolean;
  canCreateServices: boolean;
  canCreateTickets: boolean;
  canCreateSchedules: boolean;
  canCollectPayments: boolean;
  needsCompanyContext?: boolean;
};

type Step = {
  key: string;
  title: string;
  description: string;
  complete: boolean;
  href?: string;
  action?: string;
  canAct: boolean;
};

export const shouldShowDashboardOnboardingHelp = ({
  totalClients,
  totalServices,
  totalTickets,
  needsCompanyContext,
}: Pick<
  DashboardOnboardingHelpProps,
  'totalClients' | 'totalServices' | 'totalTickets' | 'needsCompanyContext'
>) =>
  Boolean(needsCompanyContext) ||
  totalClients === 0 ||
  totalServices === 0 ||
  totalTickets === 0;

export const DashboardOnboardingHelp = ({
  totalClients,
  totalServices,
  totalTickets,
  totalServicesSold,
  canCreateClients,
  canCreateServices,
  canCreateTickets,
  canCreateSchedules,
  canCollectPayments,
  needsCompanyContext = false,
}: DashboardOnboardingHelpProps) => {
  if (
    !shouldShowDashboardOnboardingHelp({
      totalClients,
      totalServices,
      totalTickets,
      needsCompanyContext,
    })
  ) {
    return null;
  }

  if (needsCompanyContext) {
    return (
      <section className="rounded-xl border border-dashed bg-muted/20 p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Selecciona una empresa</h2>
          <p className="text-sm text-muted-foreground">
            El flujo operativo aparece cuando eliges una empresa en el menú
            superior. Así puedes revisar clientes, servicios, tickets,
            recordatorios y pagos en el contexto correcto.
          </p>
        </div>
      </section>
    );
  }

  const steps: Step[] = [
    {
      key: 'clients',
      title: '1. Registra clientes',
      description: 'Guarda datos de contacto antes de abrir tickets.',
      complete: totalClients > 0,
      href: '/dashboard/clients/new',
      action: 'Nuevo cliente',
      canAct: canCreateClients,
    },
    {
      key: 'services',
      title: '2. Define servicios',
      description: 'Mantén precios y descripciones listos para facturar.',
      complete: totalServices > 0,
      href: '/dashboard/services/new',
      action: 'Nuevo servicio',
      canAct: canCreateServices,
    },
    {
      key: 'tickets',
      title: '3. Crea tickets',
      description: 'Combina cliente, servicios, PDF y seguimiento de pago.',
      complete: totalTickets > 0,
      href: '/dashboard/tickets/create',
      action: 'Crear ticket',
      canAct: canCreateTickets,
    },
    {
      key: 'schedules',
      title: '4. Programa recordatorios',
      description: 'Planifica servicios recurrentes desde clientes y tickets.',
      complete: totalServicesSold > 0,
      href: '/dashboard/service-schedules',
      action: 'Ver recordatorios',
      canAct: canCreateSchedules,
    },
    {
      key: 'payments',
      title: '5. Cobra y finaliza',
      description: 'Registra abonos, salda tickets y marca trabajos listos.',
      complete: totalTickets > 0,
      href: '/dashboard/tickets',
      action: 'Ver tickets',
      canAct: canCollectPayments,
    },
  ];

  return (
    <section className="rounded-xl border border-dashed bg-muted/20 p-4">
      <div className="mb-3 space-y-1">
        <h2 className="text-sm font-semibold">Ruta de inicio</h2>
        <p className="text-sm text-muted-foreground">
          Sigue este orden para poner la empresa en operación sin perder datos
          de cliente, servicio, ticket o pago.
        </p>
      </div>
      <ol className="grid gap-3 lg:grid-cols-5">
        {steps.map((step) => {
          const Icon = step.complete ? CheckCircle2 : CircleDot;
          return (
            <li
              key={step.key}
              className="min-w-0 rounded-lg border bg-background/70 p-3"
            >
              <div className="flex items-start gap-2">
                <Icon
                  className={
                    step.complete
                      ? 'mt-0.5 h-4 w-4 shrink-0 text-emerald-600'
                      : 'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground'
                  }
                  aria-hidden
                />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </div>
              {step.href && step.action && step.canAct ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto min-h-9 px-2"
                >
                  <Link href={step.href}>
                    {step.action}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

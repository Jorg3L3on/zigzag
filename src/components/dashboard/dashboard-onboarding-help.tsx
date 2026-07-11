'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, CheckCircle2, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CompanyOnboardingChecklistSnapshot } from '@/lib/company-onboarding-checklist';

export type DashboardOnboardingHelpProps = {
  checklist: CompanyOnboardingChecklistSnapshot;
  needsCompanyContext?: boolean;
};

export const DashboardOnboardingHelp = ({
  checklist,
  needsCompanyContext = false,
}: DashboardOnboardingHelpProps) => {
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

  if (!checklist.shouldShow) {
    return null;
  }

  return (
    <section className="rounded-xl border border-dashed bg-muted/20 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Inicio rápido</h2>
          <p className="text-sm text-muted-foreground">
            Sigue este orden la primera vez que operes tu empresa — como en la
            guía de 5 minutos.
          </p>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {checklist.progress.completed} de {checklist.progress.total}
        </p>
      </div>
      <ol className="grid gap-3 lg:grid-cols-3">
        {checklist.steps.map((step) => {
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
              {step.href && step.actionLabel && step.canAct ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto min-h-9 px-2"
                >
                  <Link href={step.href}>
                    {step.actionLabel}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              ) : null}
              {step.secondaryHref &&
              step.secondaryActionLabel &&
              step.secondaryCanAct ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto min-h-9 px-2"
                >
                  <Link href={step.secondaryHref}>
                    {step.secondaryActionLabel}
                    <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              ) : null}
              {step.guideHref ? (
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto min-h-8 px-2 text-xs text-muted-foreground"
                >
                  <a
                    href={step.guideHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <BookOpen className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Ver guía
                  </a>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

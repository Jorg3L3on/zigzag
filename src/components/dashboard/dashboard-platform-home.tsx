'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { cn } from '@/lib/utils';

const PLATFORM_LINKS = [
  {
    key: 'operator-console',
    href: '/operator-console',
    title: 'Consola operadora',
    description: 'Busca empresas, revisa readiness y opera entre tenants',
    icon: Building2,
  },
  {
    key: 'companies',
    href: '/companies',
    title: 'Empresas',
    description: 'Altas recientes, estado y activación',
    icon: Building2,
  },
  {
    key: 'audit',
    href: '/audit',
    title: 'Auditoría',
    description: 'Resumen de eventos y denegaciones de la plataforma',
    icon: ClipboardList,
  },
] as const;

/**
 * System-company home when no tenant is selected.
 * Reuses navigation destinations; does not duplicate operator-console panels.
 */
export const DashboardPlatformHome = () => {
  return (
    <section className="space-y-4" aria-label="Plataforma">
      <div
        className={cn(DASHBOARD_CARD_CLASS, 'rounded-xl border p-4 sm:p-5')}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
            <Shield className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold tracking-tight">
              Operación de plataforma
            </h2>
            <p className="text-sm text-muted-foreground">
              Selecciona una empresa en el menú superior para ver su dashboard
              operativo, o usa los atajos de plataforma.
            </p>
          </div>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {PLATFORM_LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <article
                className={cn(
                  DASHBOARD_CARD_CLASS,
                  'flex h-full flex-col rounded-xl border p-4',
                )}
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">
                  {item.description}
                </p>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-4 h-9 justify-between rounded-lg"
                >
                  <Link href={item.href}>
                    Abrir
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </article>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

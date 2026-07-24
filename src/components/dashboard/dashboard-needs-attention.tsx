'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import type { DashboardAttentionItem } from '@/lib/dashboard-attention';
import { cn } from '@/lib/utils';

export type DashboardNeedsAttentionProps = {
  items: DashboardAttentionItem[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
};

export const DashboardNeedsAttention = ({
  items,
  loading = false,
  emptyTitle = 'Nada urgente por ahora',
  emptyDescription = 'No hay cobros pendientes, tickets activos ni recordatorios urgentes que requieran tu atención.',
}: DashboardNeedsAttentionProps) => {
  if (loading) {
    return (
      <section
        aria-busy="true"
        aria-label="Cargando lo que necesita atención"
        className={cn(DASHBOARD_CARD_CLASS, 'rounded-xl border p-4 sm:p-5')}
      >
        <Skeleton className="mb-4 h-5 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg" />
          <Skeleton className="h-28 rounded-lg sm:col-span-2 xl:col-span-1" />
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section
        className={cn(
          DASHBOARD_CARD_CLASS,
          'rounded-xl border p-4 sm:p-5',
        )}
        aria-label="Lo que necesita atención"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold tracking-tight">
              {emptyTitle}
            </h2>
            <p className="text-sm text-muted-foreground">
              {emptyDescription}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="space-y-3"
      aria-label="Lo que necesita atención"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          className="h-4 w-4 text-amber-600 dark:text-amber-400"
          aria-hidden
        />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Necesita atención
        </h2>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.key}>
            <article
              className={cn(
                DASHBOARD_CARD_CLASS,
                'flex h-full flex-col rounded-xl border p-4',
                item.tone === 'urgent' && 'border-amber-500/30 bg-amber-500/[0.03]',
              )}
            >
              <div className="space-y-1">
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {item.count.toLocaleString('es-MX')}
                </p>
                <h3 className="text-sm font-medium leading-snug">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.explanation}</p>
              </div>
              <div className="mt-4">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-9 w-full justify-between rounded-lg sm:w-auto"
                >
                  <Link href={item.href}>
                    {item.ctaLabel}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
};

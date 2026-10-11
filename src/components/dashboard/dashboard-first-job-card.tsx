'use client';

import Link from 'next/link';
import { PenLine } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { isFirstJobPending } from '@/lib/company-onboarding-checklist';
import { PERMISSIONS } from '@/lib/permissions';
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { cn } from '@/lib/utils';

type DashboardFirstJobCardProps = {
  /** Tickets the company has; the card hides as soon as there is one. */
  totalTickets: number | null | undefined;
};

/** First run on Hoy (ZIG-I18-12): one big step toward Anotar trabajo. */
export const DashboardFirstJobCard = ({ totalTickets }: DashboardFirstJobCardProps) => {
  const { can } = usePermissions();
  if (!isFirstJobPending(totalTickets) || !can(PERMISSIONS.tickets.write)) {
    return null;
  }

  return (
    <section
      aria-labelledby="first-job-title"
      data-testid="dashboard-first-job"
      className={cn(DASHBOARD_CARD_CLASS, 'flex flex-col gap-3 p-4 xl:col-span-3')}
    >
      <div className="space-y-1">
        <h2 id="first-job-title" className="text-xl font-bold">
          Anota tu primer trabajo
        </h2>
        <p className="text-base text-muted-foreground">
          Escribe el cliente, lo que hiciste y cuánto cobraste. Así lo tienes a la mano.
        </p>
      </div>
      <Link
        href="/anotar"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PenLine className="size-5" aria-hidden />
        Anotar trabajo
      </Link>
    </section>
  );
};

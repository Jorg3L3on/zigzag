import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  TripledDashboardShell,
  TripledMobileAppBar,
  TripledResourceCard,
} from '@/components/tripled/mobile-first';

type TripledRouteStateProps = {
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
};

export const TripledRouteState = ({
  title,
  description,
  icon,
  action,
  backHref = '/dashboard',
  backLabel = 'Volver al dashboard',
  children,
}: TripledRouteStateProps) => (
  <TripledDashboardShell maxWidthClassName="max-w-2xl">
    <TripledMobileAppBar title={title} className="mb-3" />
    <TripledResourceCard
      title={title}
      description={description}
      icon={icon}
      action={action}
    >
      <div className="space-y-4">
        {children ? (
          children
        ) : (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        <Button variant="outline" asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
        </Button>
      </div>
    </TripledResourceCard>
  </TripledDashboardShell>
);

type TripledRetryButtonProps = {
  onRetry: () => void;
  label?: string;
};

export const TripledRetryButton = ({
  onRetry,
  label = 'Reintentar',
}: TripledRetryButtonProps) => (
  <Button type="button" onClick={onRetry}>
    <RotateCcw className="mr-2 h-4 w-4" aria-hidden />
    {label}
  </Button>
);

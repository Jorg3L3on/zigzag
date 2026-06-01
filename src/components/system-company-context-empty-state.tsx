'use client';

import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { TripledEmptyState } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import {
  SYSTEM_COMPANY_CONTEXT_MESSAGE,
  SYSTEM_COMPANY_CONTEXT_TITLE,
} from '@/lib/system-company-context';

type SystemCompanyContextEmptyStateProps = {
  resourceLabel?: string;
};

export const SystemCompanyContextEmptyState = ({
  resourceLabel = 'datos',
}: SystemCompanyContextEmptyStateProps) => (
  <TripledEmptyState
    icon={<Building2 className="h-5 w-5 text-muted-foreground" aria-hidden />}
    title={SYSTEM_COMPANY_CONTEXT_TITLE}
    description={`${SYSTEM_COMPANY_CONTEXT_MESSAGE} Los ${resourceLabel} aparecerán aquí cuando elijas una empresa.`}
    action={
      <Button asChild variant="outline">
        <Link href="/dashboard">Ir al dashboard</Link>
      </Button>
    }
  />
);

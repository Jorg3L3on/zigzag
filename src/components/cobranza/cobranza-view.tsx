'use client';

import * as React from 'react';
import { Banknote } from 'lucide-react';
import { CobranzaDesktop } from '@/components/cobranza/cobranza-desktop';
import { CobranzaList } from '@/components/cobranza/cobranza-list';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { TripledEmptyState, TripledListLoadingState } from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canWriteTickets } from '@/lib/tickets-rbac';

/**
 * The phone keeps its cards (CobranzaList); from md the queue is the table of
 * ZIG-I31. Only one of them mounts, so the page loads the queue once.
 */
export const CobranzaView = () => {
  const isMobile = useIsMobile();
  const [hydrated, setHydrated] = React.useState(false);
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canRead = permissions.can(PERMISSIONS.tickets.read);
  const missingCompany = needsSelectedCompanyContext(
    permissions.isSystem,
    selectedCompany?.id,
  );

  // The server cannot know the width; wait for the client before choosing.
  React.useEffect(() => setHydrated(true), []);

  if (!hydrated) {
    return <TripledListLoadingState label="Cargando cobranza…" />;
  }

  if (isMobile) {
    return <CobranzaList />;
  }

  if (missingCompany) {
    return <SystemCompanyContextEmptyState />;
  }

  if (!permissions.loading && !canRead) {
    return (
      <TripledEmptyState
        icon={<Banknote className="size-8" aria-hidden />}
        title="Sin acceso"
        description="No tienes permiso para ver la cobranza."
      />
    );
  }

  return <CobranzaDesktop canWrite={canWriteTickets(permissions.can)} />;
};

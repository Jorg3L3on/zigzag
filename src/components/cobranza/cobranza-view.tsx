'use client';

import * as React from 'react';
import { Banknote } from 'lucide-react';
import { CobranzaDesktop } from '@/components/cobranza/cobranza-desktop';
import { CobranzaList } from '@/components/cobranza/cobranza-list';
import { DesktopSwitch } from '@/components/desktop-switch';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { TripledEmptyState } from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { useDesktopViewport } from '@/hooks/use-desktop';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canWriteTickets } from '@/lib/tickets-rbac';

/**
 * Below lg the phone cards (CobranzaList); from lg the list-standard table (ZIG-I31,
 * ZIG-I33-3). DesktopSwitch keeps both trees on the first frame so each paints its
 * own loading state, then mounts only the one that owns the width; until the width
 * is known neither loads the queue.
 */
export const CobranzaView = () => {
  const isDesktop = useDesktopViewport();
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const canRead = permissions.can(PERMISSIONS.tickets.read);
  const missingCompany = needsSelectedCompanyContext(
    permissions.isSystem,
    selectedCompany?.id,
  );

  let desktop: React.ReactNode;
  if (missingCompany) {
    desktop = <SystemCompanyContextEmptyState />;
  } else if (!permissions.loading && !canRead) {
    desktop = (
      <TripledEmptyState
        icon={<Banknote className="size-8" aria-hidden />}
        title="Sin acceso"
        description="No tienes permiso para ver la cobranza."
      />
    );
  } else {
    desktop = (
      <CobranzaDesktop canWrite={canWriteTickets(permissions.can)} enabled={isDesktop === true} />
    );
  }

  return (
    <DesktopSwitch
      phone={<CobranzaList enabled={isDesktop === false} />}
      desktop={desktop}
    />
  );
};

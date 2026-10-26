'use client';

import * as React from 'react';
import { Banknote } from 'lucide-react';
import { CobranzaDesktop } from '@/components/cobranza/cobranza-desktop';
import { CobranzaList } from '@/components/cobranza/cobranza-list';
import { SystemCompanyContextEmptyState } from '@/components/system-company-context-empty-state';
import { TripledEmptyState } from '@/components/tripled';
import { useCompany } from '@/contexts/company-context';
import { usePermissions } from '@/hooks/use-permissions';
import { DESKTOP_BREAKPOINT_PX } from '@/lib/breakpoints';
import { PERMISSIONS } from '@/lib/permissions';
import { needsSelectedCompanyContext } from '@/lib/system-company-context';
import { canWriteTickets } from '@/lib/tickets-rbac';

const DESKTOP_QUERY = `(min-width: ${DESKTOP_BREAKPOINT_PX}px)`;

/** Null until the client knows the width, then whether the desktop layout owns it. */
const useDesktopViewport = (): boolean | null => {
  const [isDesktop, setIsDesktop] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setIsDesktop(false);
      return;
    }
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return isDesktop;
};

/**
 * Below lg the phone cards (CobranzaList); from lg, as in the canvas, the table of
 * ZIG-I31. CSS picks what shows, so each layout paints its own loading state on the
 * first frame, and only the one that owns the viewport loads the queue.
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
    <>
      <div className="lg:hidden">
        <CobranzaList enabled={isDesktop === false} />
      </div>
      <div className="hidden lg:block">{desktop}</div>
    </>
  );
};

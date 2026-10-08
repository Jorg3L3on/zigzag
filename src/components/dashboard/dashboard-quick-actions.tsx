'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  ClipboardList,
  Package,
  Ticket,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/use-permissions';
import { quickActionPriority } from '@/lib/dashboard-composition';
import type { DashboardPersona } from '@/lib/dashboard-persona';
import { PERMISSIONS } from '@/lib/permissions';
import { canReadServiceSchedules } from '@/lib/service-schedules-rbac';

type QuickAction = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
};

export type DashboardQuickActionsProps = {
  persona?: DashboardPersona;
};

export const DashboardQuickActions = ({
  persona = 'admin',
}: DashboardQuickActionsProps) => {
  const { can } = usePermissions();

  const candidates: QuickAction[] = [];

  if (can(PERMISSIONS.tickets.write)) {
    candidates.push({
      key: 'create-ticket',
      label: 'Crear ticket',
      href: '/tickets/create',
      icon: <Ticket className="h-4 w-4" aria-hidden />,
    });
  }

  if (can(PERMISSIONS.clients.write)) {
    candidates.push({
      key: 'create-client',
      label: 'Crear cliente',
      href: '/clients/new',
      icon: <Users className="h-4 w-4" aria-hidden />,
    });
  }

  if (can(PERMISSIONS.services.write)) {
    candidates.push({
      key: 'create-service',
      label: 'Crear servicio',
      href: '/services/new',
      icon: <Package className="h-4 w-4" aria-hidden />,
    });
  }

  if (can(PERMISSIONS.tickets.read)) {
    candidates.push({
      key: 'view-tickets',
      label: 'Ver tickets',
      href: '/tickets',
      icon: <ClipboardList className="h-4 w-4" aria-hidden />,
    });
  }

  if (canReadServiceSchedules(can)) {
    candidates.push({
      key: 'view-schedules',
      label: 'Recordatorios',
      href: '/service-schedules',
      icon: <CalendarClock className="h-4 w-4" aria-hidden />,
    });
  }

  if (can(PERMISSIONS.users.write)) {
    candidates.push({
      key: 'create-user',
      label: 'Invitar usuario',
      href: '/users',
      icon: <UserPlus className="h-4 w-4" aria-hidden />,
    });
  }

  const priority = quickActionPriority(persona);
  const actions = [...candidates].sort((a, b) => {
    const ai = priority.indexOf(a.key);
    const bi = priority.indexOf(b.key);
    const aRank = ai === -1 ? priority.length : ai;
    const bRank = bi === -1 ? priority.length : bi;
    return aRank - bRank;
  });

  // Viewers: composition hides the row entirely. If shown, only keep
  // actions the user can execute (already filtered by `can`).
  if (actions.length === 0) {
    return null;
  }

  const primaryKey = actions[0]?.key;

  // Chip row under the greeting: scrolls sideways on phones, wraps from sm up.
  return (
    <nav aria-label="Acciones rápidas" data-testid="dashboard-quick-actions">
      <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
        {actions.map((action) => (
          <li key={action.key} className="shrink-0 snap-start">
            <Button
              asChild
              variant={action.key === primaryKey ? 'default' : 'outline'}
              size="sm"
              className="min-h-11 gap-2 rounded-xl sm:min-h-9"
            >
              <Link href={action.href}>
                {action.icon}
                {action.label}
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

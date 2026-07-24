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
import { DASHBOARD_CARD_CLASS } from '@/components/dashboard/dashboard-surface';
import { usePermissions } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/lib/permissions';
import { canReadServiceSchedules } from '@/lib/service-schedules-rbac';
import { cn } from '@/lib/utils';

type QuickAction = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
};

export const DashboardQuickActions = () => {
  const { can } = usePermissions();

  const actions: QuickAction[] = [];

  if (can(PERMISSIONS.tickets.write)) {
    actions.push({
      key: 'create-ticket',
      label: 'Crear ticket',
      href: '/tickets/create',
      icon: <Ticket className="h-4 w-4" aria-hidden />,
    });
  }

  if (can(PERMISSIONS.clients.write)) {
    actions.push({
      key: 'create-client',
      label: 'Crear cliente',
      href: '/clients/new',
      icon: <Users className="h-4 w-4" aria-hidden />,
    });
  }

  if (can(PERMISSIONS.services.write)) {
    actions.push({
      key: 'create-service',
      label: 'Crear servicio',
      href: '/services/new',
      icon: <Package className="h-4 w-4" aria-hidden />,
    });
  }

  if (can(PERMISSIONS.tickets.read)) {
    actions.push({
      key: 'view-tickets',
      label: 'Ver tickets',
      href: '/tickets',
      icon: <ClipboardList className="h-4 w-4" aria-hidden />,
    });
  }

  if (canReadServiceSchedules(can)) {
    actions.push({
      key: 'view-schedules',
      label: 'Recordatorios',
      href: '/service-schedules',
      icon: <CalendarClock className="h-4 w-4" aria-hidden />,
    });
  }

  if (can(PERMISSIONS.users.write)) {
    actions.push({
      key: 'create-user',
      label: 'Invitar usuario',
      href: '/users',
      icon: <UserPlus className="h-4 w-4" aria-hidden />,
    });
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(DASHBOARD_CARD_CLASS, 'rounded-xl border p-4 sm:p-5')}
      aria-label="Acciones rápidas"
    >
      <div className="mb-3 space-y-1">
        <h2 className="text-base font-semibold tracking-tight">
          Acciones rápidas
        </h2>
        <p className="text-sm text-muted-foreground">
          Atajos a las tareas más frecuentes
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <li key={action.key}>
            <Button
              asChild
              variant={action.key === 'create-ticket' ? 'default' : 'outline'}
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
    </section>
  );
};

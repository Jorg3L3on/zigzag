'use client';

import type { Column, ColumnDef } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { FormattedDate } from '@/components/formatted-date';
import { Button } from '@/components/ui/button';
import {
  teamMemberInitials,
  teamMemberStatusLabel,
  type TeamMember,
} from '@/lib/team-members';
import { cn } from '@/lib/utils';
import { TeamMemberMenu, type TeamMemberMenuHandlers } from './team-member-menu';

const SortableHeader = ({
  column,
  label,
}: {
  column: Column<TeamMember>;
  label: string;
}) => {
  const sorted = column.getIsSorted();
  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-2 h-8 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-transparent"
      onClick={column.getToggleSortingHandler()}
    >
      {label}
      {sorted === 'desc' ? (
        <ArrowDown className="ml-1.5 size-3.5" aria-hidden />
      ) : sorted === 'asc' ? (
        <ArrowUp className="ml-1.5 size-3.5" aria-hidden />
      ) : (
        <ArrowUpDown className="ml-1.5 size-3.5 opacity-50" aria-hidden />
      )}
    </Button>
  );
};

export const TeamAvatar = ({ name }: { name: string }) => (
  <span
    aria-hidden
    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
  >
    {teamMemberInitials(name)}
  </span>
);

export const TeamRoleChip = ({ name }: { name: string | null }) => (
  <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
    {name ?? 'Sin rol'}
  </span>
);

export const TeamStatus = ({ member }: { member: TeamMember }) => (
  <span
    className={cn(
      'text-xs font-semibold',
      member.emailVerified
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-amber-700 dark:text-amber-400',
    )}
  >
    {teamMemberStatusLabel(member)}
  </span>
);

export const createTeamColumns = (
  handlers: TeamMemberMenuHandlers | null,
): ColumnDef<TeamMember>[] => {
  const columns: ColumnDef<TeamMember>[] = [
    {
      id: 'usuario',
      accessorKey: 'name',
      header: ({ column }) => <SortableHeader column={column} label="Usuario" />,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-3">
          <TeamAvatar name={row.original.name} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">
              {row.original.name}
              {row.original.isSelf ? (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  (tú)
                </span>
              ) : null}
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {row.original.email}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'rol',
      accessorFn: (member) => member.roleName ?? '',
      header: ({ column }) => <SortableHeader column={column} label="Rol" />,
      cell: ({ row }) => <TeamRoleChip name={row.original.roleName} />,
    },
    {
      id: 'estado',
      accessorFn: (member) => (member.emailVerified ? 1 : 0),
      header: ({ column }) => <SortableHeader column={column} label="Estado" />,
      cell: ({ row }) => <TeamStatus member={row.original} />,
    },
    {
      id: 'alta',
      accessorKey: 'createdAt',
      header: ({ column }) => <SortableHeader column={column} label="Alta" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          <FormattedDate date={new Date(row.original.createdAt)} />
        </span>
      ),
    },
  ];

  if (handlers) {
    columns.push({
      id: 'acciones',
      enableSorting: false,
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <TeamMemberMenu member={row.original} {...handlers} />
        </div>
      ),
    });
  }

  return columns;
};

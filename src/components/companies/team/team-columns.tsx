'use client';

import type { Column, ColumnDef } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

import { FormattedDate } from '@/components/formatted-date';
import { Button } from '@/components/ui/button';
import {
  TEAM_ACCESS_LABELS,
  teamMemberAccess,
  teamMemberInitials,
  teamRoleLabel,
  teamRoleTone,
  type TeamMember,
  type TeamRoleTone,
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
      className="-ml-2 h-8 px-2 text-caption font-semibold uppercase tracking-wider text-muted-foreground hover:bg-transparent"
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

export const TeamAvatar = ({ name, tint }: { name: string; tint?: string }) => (
  <span
    aria-hidden
    className={cn(
      'flex size-9 shrink-0 items-center justify-center rounded-full text-caption font-bold',
      tint ?? 'bg-muted text-muted-foreground',
    )}
  >
    {teamMemberInitials(name)}
  </span>
);

const ROLE_TONE_CLASS: Record<TeamRoleTone, string> = {
  admin: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  operator: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  viewer: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  other: 'bg-muted text-foreground',
};

const ACCESS_TONE_CLASS = {
  active: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  must_change_password: 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
  deactivated: 'bg-muted text-muted-foreground',
} as const;

const chipClass = 'inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-caption font-semibold';

export const TeamRolePill = ({ name }: { name: string | null }) => (
  <span className={cn(chipClass, ROLE_TONE_CLASS[teamRoleTone(name)])}>{teamRoleLabel(name)}</span>
);

export const TeamAccessPill = ({ member }: { member: TeamMember }) => {
  const access = teamMemberAccess(member);
  return (
    <span className={cn(chipClass, ACCESS_TONE_CLASS[access])} data-testid="team-member-access">
      {TEAM_ACCESS_LABELS[access]}
    </span>
  );
};

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
                <span className="ml-1.5 text-caption font-normal text-muted-foreground">
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
      accessorFn: (member) => teamRoleLabel(member.roleName),
      header: ({ column }) => <SortableHeader column={column} label="Rol" />,
      cell: ({ row }) => <TeamRolePill name={row.original.roleName} />,
    },
    {
      id: 'acceso',
      accessorFn: (member) => TEAM_ACCESS_LABELS[teamMemberAccess(member)],
      header: ({ column }) => <SortableHeader column={column} label="Acceso" />,
      cell: ({ row }) => <TeamAccessPill member={row.original} />,
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

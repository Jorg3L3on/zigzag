'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { KeyRound, Pencil, ShieldCheck, UserX } from 'lucide-react';

import {
  ListRowMenu,
  ListShortDate,
  ListSortableHeader,
  ListStatusPill,
  type ListRowMenuItem,
  type ListStatusTone,
} from '@/components/list-page';
import {
  TEAM_ACCESS_LABELS,
  teamAvatarTint,
  teamMemberAccess,
  teamMemberInitials,
  teamRoleLabel,
  teamRoleTone,
  type TeamMember,
  type TeamMemberAccess,
  type TeamRoleTone,
} from '@/lib/team-members';
import { cn } from '@/lib/utils';
import type { TeamMemberMenuHandlers } from './team-member-menu';

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

/* Phone cards (unchanged by ZIG-I33); the desktop table uses ListStatusPill below. */

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

/* Desktop (ZIG-I33-6): the shared status pill. Admin blue, Operador violet, the rest slate. */

const ROLE_LIST_TONE: Record<TeamRoleTone, ListStatusTone> = {
  admin: 'blue',
  operator: 'violet',
  viewer: 'slate',
  other: 'slate',
};

const ACCESS_LIST_TONE: Record<TeamMemberAccess, ListStatusTone> = {
  active: 'emerald',
  must_change_password: 'amber',
  deactivated: 'slate',
};

const TeamRoleStatus = ({ name }: { name: string | null }) => (
  // Company roles can have long names: truncate inside the column.
  <ListStatusPill tone={ROLE_LIST_TONE[teamRoleTone(name)]} className="max-w-full">
    <span className="min-w-0 truncate">{teamRoleLabel(name)}</span>
  </ListStatusPill>
);

const TeamAccessStatus = ({ member, wrap = false }: { member: TeamMember; wrap?: boolean }) => {
  const access = teamMemberAccess(member);
  return (
    <span className="inline-flex max-w-full" data-testid="team-member-access">
      <ListStatusPill
        tone={ACCESS_LIST_TONE[access]}
        // Table column: «Debe cambiar contraseña» may take two lines to save width.
        className={cn(wrap && 'h-auto min-h-6 whitespace-normal py-0.5 leading-tight')}
      >
        {TEAM_ACCESS_LABELS[access]}
      </ListStatusPill>
    </span>
  );
};

/**
 * The ⋯ of a desktop row. Same guards as the phone menu: deactivated people have
 * none (the caller passes no menu), and your own row only offers Editar, since
 * there is no self role change, reset or deactivation (ZIG-I32 review).
 * `ListRowMenu` has no disabled items, so the blocked ones are left out.
 */
export const teamRowMenuItems = (
  member: TeamMember,
  handlers: TeamMemberMenuHandlers,
): ListRowMenuItem[] => {
  const edit: ListRowMenuItem = {
    label: 'Editar',
    icon: <Pencil className="size-4" aria-hidden />,
    onSelect: () => handlers.onEdit(member),
  };
  if (member.isSelf) return [edit];
  return [
    edit,
    {
      label: 'Cambiar rol',
      icon: <ShieldCheck className="size-4" aria-hidden />,
      onSelect: () => handlers.onChangeRole(member),
    },
    {
      label: 'Restablecer contraseña',
      icon: <KeyRound className="size-4" aria-hidden />,
      onSelect: () => handlers.onResetPassword(member),
    },
    {
      label: 'Desactivar',
      icon: <UserX className="size-4" aria-hidden />,
      onSelect: () => handlers.onDeactivate(member),
      destructive: true,
    },
  ];
};

// Narrow hub column (1024 with the sidebar open): Rol and Acceso move under the
// name as pills, like the phone card; Alta needs a bit more room.
const WIDE = 'hidden @min-[36rem]:table-cell';
const WIDER = 'hidden @min-[46rem]:table-cell';

/** Persona · Rol · Acceso · Alta · ⋯ (ZIG-I32-2 columns on the ZIG-I33 table). */
export const createTeamColumns = (
  handlers: TeamMemberMenuHandlers | null,
): ColumnDef<TeamMember>[] => [
  {
    id: 'persona',
    accessorKey: 'name',
    header: ({ column }) => <ListSortableHeader column={column} label="Persona" />,
    cell: ({ row }) => {
      const member = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3 py-2">
          <TeamAvatar name={member.name} tint={teamAvatarTint(member)} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">
              {member.name}
              {member.isSelf ? (
                <span className="ml-1.5 font-normal text-muted-foreground">(tú)</span>
              ) : null}
            </span>
            <span className="truncate text-caption text-muted-foreground">{member.email}</span>
            <span className="mt-1 flex flex-wrap gap-1.5 @min-[36rem]:hidden">
              <TeamRoleStatus name={member.roleName} />
              <TeamAccessStatus member={member} />
            </span>
          </div>
        </div>
      );
    },
  },
  {
    id: 'rol',
    accessorFn: (member) => teamRoleLabel(member.roleName),
    header: ({ column }) => <ListSortableHeader column={column} label="Rol" />,
    cell: ({ row }) => <TeamRoleStatus name={row.original.roleName} />,
    meta: { className: cn('w-32', WIDE) },
  },
  {
    id: 'acceso',
    accessorFn: (member) => TEAM_ACCESS_LABELS[teamMemberAccess(member)],
    header: ({ column }) => <ListSortableHeader column={column} label="Acceso" />,
    cell: ({ row }) => <TeamAccessStatus member={row.original} wrap />,
    meta: { className: cn('w-44', WIDE) },
  },
  {
    id: 'alta',
    accessorFn: (member) => new Date(member.createdAt).getTime(),
    header: ({ column }) => <ListSortableHeader column={column} label="Alta" />,
    cell: ({ row }) => <ListShortDate date={row.original.createdAt} />,
    meta: { className: cn('w-28', WIDER) },
  },
  // Readers get no ⋯ column at all.
  ...(handlers
    ? [
        {
          id: 'acciones',
          enableSorting: false,
          header: () => <span className="sr-only">Acciones</span>,
          cell: ({ row }) =>
            row.original.deactivated ? null : (
              <ListRowMenu
                label={`Acciones de ${row.original.name}`}
                items={teamRowMenuItems(row.original, handlers)}
              />
            ),
          meta: { className: 'w-12' },
        } satisfies ColumnDef<TeamMember>,
      ]
    : []),
];

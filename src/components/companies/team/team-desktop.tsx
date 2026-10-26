'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Search, Users } from 'lucide-react';

import { TripledEmptyState } from '@/components/tripled';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  filterTeamMembers,
  summarizeTeamRoles,
  TEAM_ACCESS_FILTERS,
  teamAvatarTint,
  teamRoleLabel,
  type TeamAccessFilter,
  type TeamMember,
  type TeamRoleOption,
} from '@/lib/team-members';
import { cn } from '@/lib/utils';
import { TeamAccessPill, TeamAvatar, TeamRolePill } from './team-columns';
import { TeamMemberMenu, type TeamMemberMenuHandlers } from './team-member-menu';

const ALL_ROLES = 'all';

const headClass = 'text-caption font-semibold uppercase tracking-wider text-muted-foreground';

type TeamDesktopProps = {
  members: TeamMember[];
  deactivated: TeamMember[];
  roles: TeamRoleOption[];
  /** Null for readers: no add button, no row actions. */
  handlers: TeamMemberMenuHandlers | null;
  onAdd: () => void;
  className?: string;
};

/**
 * Equipo on md+ (ZIG-I32-2, canvas EmpEquipo): header with the role
 * breakdown, search, role and access filters, and a Persona · Rol · Acceso ·
 * Alta table whose Cambiar rol / Restablecer contraseña appear on hover or
 * focus (the ZIG-I28-4 pattern); ⋮ stays visible.
 */
export const TeamDesktop = ({
  members,
  deactivated,
  roles,
  handlers,
  onAdd,
  className,
}: TeamDesktopProps) => {
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>(ALL_ROLES);
  const [access, setAccess] = React.useState<TeamAccessFilter>('active');

  const everyone = React.useMemo(() => [...members, ...deactivated], [members, deactivated]);
  const rows = React.useMemo(
    () =>
      filterTeamMembers(everyone, {
        search,
        roleId: roleFilter === ALL_ROLES ? null : Number(roleFilter),
        access,
      }),
    [everyone, search, roleFilter, access],
  );
  const breakdown = summarizeTeamRoles(members);

  return (
    <div className={cn('space-y-4', className)} data-testid="team-desktop">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            Equipo <span className="font-normal text-muted-foreground">· {members.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {breakdown ? `${breakdown}. ` : ''}Cada persona entra con su correo y una contraseña
            que tú le das.
          </p>
        </div>
        {handlers ? (
          <Button type="button" onClick={onAdd}>
            <Plus className="size-4" aria-hidden data-icon="inline-start" />
            Agregar persona
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Buscar en el equipo</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o correo"
            className="h-10 pl-9"
            type="search"
          />
        </label>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger
            className={cn('h-10 w-auto min-w-40', roleFilter !== ALL_ROLES && 'border-primary/40 bg-primary/10 text-primary')}
            aria-label="Filtrar por rol"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ROLES}>Todos los roles</SelectItem>
            {roles.map((role) => (
              <SelectItem key={role.id} value={String(role.id)}>
                {teamRoleLabel(role.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={access} onValueChange={(value) => setAccess(value as TeamAccessFilter)}>
          <SelectTrigger
            className={cn('h-10 w-auto min-w-32', access !== 'active' && 'border-primary/40 bg-primary/10 text-primary')}
            aria-label="Filtrar por acceso"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEAM_ACCESS_FILTERS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <TripledEmptyState
          icon={<Users className="size-4" aria-hidden />}
          title={everyone.length === 0 ? 'Aún no hay nadie en tu equipo' : 'Sin resultados'}
          description={
            everyone.length === 0
              ? 'Agrega a las personas que atienden tickets o administran la empresa.'
              : 'Ajusta la búsqueda o los filtros.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={headClass}>Persona</TableHead>
                <TableHead className={headClass}>Rol</TableHead>
                <TableHead className={headClass}>Acceso</TableHead>
                <TableHead className={headClass}>Alta</TableHead>
                <TableHead className="w-px text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((member) => (
                <TableRow
                  key={member.id}
                  className="group hover:bg-muted focus-within:bg-muted"
                  data-testid="team-member-row"
                >
                  <TableCell className="max-w-xs">
                    <div className="flex min-w-0 items-center gap-3">
                      <TeamAvatar name={member.name} tint={teamAvatarTint(member)} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">
                          {member.name}
                          {member.isSelf ? (
                            <span className="ml-1.5 font-normal text-muted-foreground">(tú)</span>
                          ) : null}
                        </span>
                        <span className="truncate text-caption text-muted-foreground">
                          {member.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TeamRolePill name={member.roleName} />
                  </TableCell>
                  <TableCell>
                    <TeamAccessPill member={member} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                    {format(new Date(member.createdAt), 'd MMM yy', { locale: es })}
                  </TableCell>
                  <TableCell className="relative w-px">
                    {handlers && !member.deactivated ? (
                      <TeamRowActions member={member} handlers={handlers} />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

/**
 * ⋮ always; Cambiar rol and Restablecer contraseña slide in over the row's
 * right side on hover or focus, so the table never grows sideways.
 */
const TeamRowActions = ({
  member,
  handlers,
}: {
  member: TeamMember;
  handlers: TeamMemberMenuHandlers;
}) => (
  <div className="flex items-center justify-end">
    <div className="pointer-events-none absolute inset-y-0 right-full flex items-center gap-1 bg-gradient-to-r from-transparent via-muted to-muted pl-8 pr-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="whitespace-nowrap bg-background"
        onClick={() => handlers.onChangeRole(member)}
        aria-label={`Cambiar rol de ${member.name}`}
      >
        Cambiar rol
      </Button>
      {member.isSelf ? null : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="whitespace-nowrap bg-background"
          onClick={() => handlers.onResetPassword(member)}
          aria-label={`Restablecer contraseña de ${member.name}`}
        >
          Restablecer contraseña
        </Button>
      )}
    </div>
    <TeamMemberMenu
      member={member}
      {...handlers}
      resetPasswordLabel="Restablecer contraseña"
      compact
    />
  </div>
);

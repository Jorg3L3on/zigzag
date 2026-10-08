'use client';

import { MoreHorizontal, Pencil, ShieldCheck, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TeamMember } from '@/lib/team-members';

export type TeamMemberMenuHandlers = {
  onEdit: (member: TeamMember) => void;
  onChangeRole: (member: TeamMember) => void;
  onDeactivate: (member: TeamMember) => void;
};

type TeamMemberMenuProps = TeamMemberMenuHandlers & {
  member: TeamMember;
};

export const TeamMemberMenu = ({
  member,
  onEdit,
  onChangeRole,
  onDeactivate,
}: TeamMemberMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        aria-label={`Acciones de ${member.name}`}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => onEdit(member)}>
        <Pencil className="mr-2 size-4" aria-hidden />
        Editar
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onChangeRole(member)}>
        <ShieldCheck className="mr-2 size-4" aria-hidden />
        Cambiar rol
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={member.isSelf}
        onSelect={() => onDeactivate(member)}
        className="text-destructive focus:text-destructive"
      >
        <UserX className="mr-2 size-4" aria-hidden />
        {member.isSelf ? 'Desactivar (eres tú)' : 'Desactivar'}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

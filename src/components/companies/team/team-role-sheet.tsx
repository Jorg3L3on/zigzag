'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { changeTeamMemberRole } from '@/actions/team';
import { Button } from '@/components/ui/button';
import type { TeamMember, TeamRoleOption } from '@/lib/team-members';
import { showTeamActionError } from './team-member-sheet';
import { TeamRolePicker } from './team-role-picker';
import { TeamSheet } from './team-sheet';

type TeamRoleSheetProps = {
  member: TeamMember | null;
  roles: TeamRoleOption[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export const TeamRoleSheet = ({
  member,
  roles,
  onOpenChange,
  onSaved,
}: TeamRoleSheetProps) => {
  const [roleId, setRoleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRoleId(member?.roleId ?? null);
  }, [member]);

  const save = async () => {
    if (!member || roleId === null) {
      return;
    }
    setSaving(true);
    const result = await changeTeamMemberRole(member.id, roleId);
    setSaving(false);
    if (!result.success) {
      showTeamActionError(result, 'No se pudo cambiar el rol');
      return;
    }
    toast.success('Rol actualizado');
    onOpenChange(false);
    onSaved();
  };

  return (
    <TeamSheet
      open={Boolean(member)}
      onOpenChange={onOpenChange}
      title="Cambiar rol"
      description={
        member
          ? `${member.name} tendrá los permisos del rol que elijas. Su sesión se renovará.`
          : undefined
      }
    >
      <div className="space-y-4">
        <TeamRolePicker
          name="team-change-role"
          legend="Nuevo rol"
          roles={roles}
          value={roleId}
          onChange={setRoleId}
        />
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={() => void save()}
            disabled={saving || roleId === null || roleId === member?.roleId}
          >
            {saving ? 'Guardando…' : 'Guardar rol'}
          </Button>
        </div>
      </div>
    </TeamSheet>
  );
};

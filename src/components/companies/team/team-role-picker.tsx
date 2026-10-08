'use client';

import type { TeamRoleOption } from '@/lib/team-members';
import { cn } from '@/lib/utils';

type TeamRolePickerProps = {
  roles: TeamRoleOption[];
  value: number | null;
  onChange: (roleId: number) => void;
  name: string;
  legend?: string;
  error?: string;
};

/** Radio list of roles with their descriptions (wireframe 7). */
export const TeamRolePicker = ({
  roles,
  value,
  onChange,
  name,
  legend = 'Rol',
  error,
}: TeamRolePickerProps) => (
  <fieldset className="space-y-2" aria-invalid={error ? true : undefined}>
    <legend className="pb-1 text-sm font-medium">{legend}</legend>
    {roles.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No hay roles disponibles. Crea uno en la pestaña Roles.
      </p>
    ) : (
      roles.map((role) => {
        const checked = value === role.id;
        return (
          <label
            key={role.id}
            className={cn(
              'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
              'focus-within:ring-2 focus-within:ring-ring',
              checked
                ? 'border-primary bg-primary/10'
                : 'border-border bg-background hover:bg-muted/50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={role.id}
              checked={checked}
              onChange={() => onChange(role.id)}
              className="size-5 shrink-0 accent-primary"
            />
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">{role.name}</span>
              {role.description ? (
                <span className="text-xs text-muted-foreground">
                  {role.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })
    )}
    {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
  </fieldset>
);

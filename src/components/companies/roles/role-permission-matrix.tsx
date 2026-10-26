'use client';

import {
  ROLE_MATRIX_MODULES,
  setMatrixCell,
  type RoleMatrix,
} from '@/lib/role-matrix';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type RolePermissionMatrixProps = {
  value: RoleMatrix;
  onChange: (next: RoleMatrix) => void;
  disabled?: boolean;
  /**
   * 'checkbox' (default, phones) or 'switch' (md+, ZIG-I32-3). The switch
   * matrix drops the footnote: the Roles header already says it.
   */
  control?: 'checkbox' | 'switch';
};

const MatrixSwitch = ({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <Switch
    aria-label={label}
    checked={checked}
    disabled={disabled}
    onCheckedChange={onChange}
  />
);

const MatrixCheckbox = ({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label
    className={cn(
      'flex size-11 items-center justify-center rounded-lg',
      disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted',
    )}
  >
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="size-5 accent-primary"
    />
  </label>
);

/** Ver / Editar by module, mapped to the existing permission keys (ZIG-I3-5). */
export const RolePermissionMatrix = ({
  value,
  onChange,
  disabled,
  control = 'checkbox',
}: RolePermissionMatrixProps) => {
  const Cell = control === 'switch' ? MatrixSwitch : MatrixCheckbox;
  const columns =
    control === 'switch'
      ? 'grid-cols-[minmax(0,1fr)_4.5rem_4.5rem]'
      : 'grid-cols-[minmax(0,1fr)_3.5rem_3.5rem]';
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="pb-1 text-sm font-medium">Permisos</legend>
      <div className="overflow-hidden rounded-xl border">
        <div
          className={cn(
            'grid items-center gap-x-1 border-b bg-muted/40 px-3 py-2 text-caption font-semibold uppercase tracking-wider text-muted-foreground',
            columns,
          )}
        >
          <span>Módulo</span>
          <span className="text-center">Ver</span>
          <span className="text-center">Editar</span>
        </div>
        <ul>
          {ROLE_MATRIX_MODULES.map((matrixModule) => {
            const cell = value[matrixModule.key];
            return (
              <li
                key={matrixModule.key}
                data-testid={`role-matrix-row-${matrixModule.key}`}
                className={cn(
                  'grid items-center gap-x-1 border-b px-3 last:border-b-0',
                  columns,
                  control === 'switch' ? 'py-2.5' : 'py-1.5',
                )}
              >
                <span className="flex min-w-0 flex-col py-1">
                  <span className="text-sm font-semibold">{matrixModule.label}</span>
                  {matrixModule.hint ? (
                    <span className="text-caption text-muted-foreground">{matrixModule.hint}</span>
                  ) : null}
                </span>
                {matrixModule.read ? (
                  <>
                    <span className="flex justify-center">
                      <Cell
                        label={`Ver ${matrixModule.label}`}
                        checked={cell.read}
                        disabled={disabled}
                        onChange={(checked) =>
                          onChange(setMatrixCell(value, matrixModule.key, 'read', checked))
                        }
                      />
                    </span>
                    <span className="flex justify-center">
                      <Cell
                        label={`Editar ${matrixModule.label}`}
                        checked={cell.write}
                        disabled={disabled}
                        onChange={(checked) =>
                          onChange(setMatrixCell(value, matrixModule.key, 'write', checked))
                        }
                      />
                    </span>
                  </>
                ) : (
                  // Switch matrix: one "Administrar" switch centred with its label below (canvas EmpRoles).
                  <span
                    className={cn(
                      'col-span-2 flex items-center justify-center',
                      control === 'switch' ? 'flex-col gap-0.5' : 'gap-1',
                    )}
                  >
                    <Cell
                      label={`${matrixModule.writeLabel} ${matrixModule.label}`}
                      checked={cell.write}
                      disabled={disabled}
                      onChange={(checked) =>
                        onChange(setMatrixCell(value, matrixModule.key, 'write', checked))
                      }
                    />
                    <span className="text-caption text-muted-foreground" aria-hidden>
                      {matrixModule.writeLabel}
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {control === 'switch' ? null : (
        <p className="text-caption text-muted-foreground">
          Editar incluye Ver. Los cambios aplican en la siguiente acción de cada persona.
        </p>
      )}
    </fieldset>
  );
};

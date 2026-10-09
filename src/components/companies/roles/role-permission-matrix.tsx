'use client';

import {
  ROLE_MATRIX_MODULES,
  setMatrixCell,
  type RoleMatrix,
} from '@/lib/role-matrix';
import { cn } from '@/lib/utils';

type RolePermissionMatrixProps = {
  value: RoleMatrix;
  onChange: (next: RoleMatrix) => void;
  disabled?: boolean;
};

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
}: RolePermissionMatrixProps) => (
  <fieldset className="space-y-2" disabled={disabled}>
    <legend className="pb-1 text-sm font-medium">Permisos</legend>
    <div className="overflow-hidden rounded-xl border">
      <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-x-1 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center gap-x-1 border-b px-3 py-1.5 last:border-b-0"
            >
              <span className="flex min-w-0 flex-col py-1">
                <span className="text-sm font-semibold">{matrixModule.label}</span>
                {matrixModule.hint ? (
                  <span className="text-xs text-muted-foreground">{matrixModule.hint}</span>
                ) : null}
              </span>
              {matrixModule.read ? (
                <>
                  <span className="flex justify-center">
                    <MatrixCheckbox
                      label={`Ver ${matrixModule.label}`}
                      checked={cell.read}
                      disabled={disabled}
                      onChange={(checked) =>
                        onChange(setMatrixCell(value, matrixModule.key, 'read', checked))
                      }
                    />
                  </span>
                  <span className="flex justify-center">
                    <MatrixCheckbox
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
                <span className="col-span-2 flex items-center justify-center gap-1">
                  <MatrixCheckbox
                    label={`${matrixModule.writeLabel} ${matrixModule.label}`}
                    checked={cell.write}
                    disabled={disabled}
                    onChange={(checked) =>
                      onChange(setMatrixCell(value, matrixModule.key, 'write', checked))
                    }
                  />
                  <span className="text-xs text-muted-foreground" aria-hidden>
                    {matrixModule.writeLabel}
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
    <p className="text-xs text-muted-foreground">
      Editar incluye Ver. Los cambios aplican en la siguiente acción de cada persona.
    </p>
  </fieldset>
);

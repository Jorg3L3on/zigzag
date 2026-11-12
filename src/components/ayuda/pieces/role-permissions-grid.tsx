'use client';

import { useState } from 'react';
import { AppButton, AppField } from '@/components/ayuda/pieces/app-field';
import { APP_MUTED, APP_PIECE_CARD, TOUCH_RING_SM } from '@/components/ayuda/pieces/app-look';
import {
  ROLE_MATRIX_MODULES,
  ROLE_TEMPLATES,
  setMatrixCell,
  templateMatrix,
  type RoleTemplateKey,
} from '@/lib/role-matrix';

/** Role editor top (RoleEditor): Nombre del rol and the templates, the chosen one ringed. */
export const RoleTemplatePiece = ({ name, template }: { name: string; template: RoleTemplateKey }) => (
  <div aria-hidden className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
    <AppField label="Nombre del rol" value={name} />
    <span className="font-medium">Empezar desde una plantilla:</span>
    <span className="flex flex-wrap gap-2">
      {ROLE_TEMPLATES.map((item) => (
        <span
          key={item.key}
          className={`inline-flex min-h-11 items-center rounded-full border px-3.5 ${
            item.key === template
              ? `border-[#2563EB] bg-[#DBEAFE] font-semibold ${TOUCH_RING_SM}`
              : 'border-[#E2E8F0]'
          }`}
        >
          {item.label}
        </span>
      ))}
    </span>
  </div>
);

/**
 * Permisos grid on the phone (RolePermissionMatrix, checkboxes) to try on the
 * page, with the app's own rule: Editar ticks Ver, unticking Ver unticks Editar.
 */
export const RolePermissionsGridPiece = ({ template }: { template: RoleTemplateKey }) => {
  const [matrix, setMatrix] = useState(() => templateMatrix(template));
  return (
    <div className={`${APP_PIECE_CARD} flex flex-col gap-3 p-3.5`}>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="pb-1 font-medium">Permisos</legend>
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
          <div
            className={`grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 font-semibold uppercase tracking-wider ${APP_MUTED}`}
          >
            <span>Módulo</span>
            <span className="text-center">Ver</span>
            <span className="text-center">Editar</span>
          </div>
          {ROLE_MATRIX_MODULES.map((matrixModule) => {
            const cell = matrix[matrixModule.key];
            const box = (level: 'read' | 'write', label: string, checked: boolean) => (
              <label className="flex size-11 cursor-pointer items-center justify-center rounded-lg">
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={checked}
                  onChange={(event) =>
                    setMatrix(setMatrixCell(matrix, matrixModule.key, level, event.target.checked))
                  }
                  className="size-5 accent-[#2563EB]"
                />
              </label>
            );
            return (
              <div
                key={matrixModule.key}
                className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem] items-center border-b border-[#E2E8F0] px-3 py-1 last:border-b-0"
              >
                <span className="flex min-w-0 flex-col py-1">
                  <span className="font-semibold">{matrixModule.label}</span>
                  {matrixModule.hint ? <span className={APP_MUTED}>{matrixModule.hint}</span> : null}
                </span>
                {matrixModule.read ? (
                  <>
                    <span className="flex justify-center">
                      {box('read', `Ver ${matrixModule.label}`, cell.read)}
                    </span>
                    <span className="flex justify-center">
                      {box('write', `Editar ${matrixModule.label}`, cell.write)}
                    </span>
                  </>
                ) : (
                  <span className="col-span-2 flex items-center justify-center gap-1">
                    {box('write', `${matrixModule.writeLabel} ${matrixModule.label}`, cell.write)}
                    <span aria-hidden className={APP_MUTED}>
                      {matrixModule.writeLabel}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <p className={`m-0 ${APP_MUTED}`}>
          Editar incluye Ver. Los cambios aplican en la siguiente acción de cada persona.
        </p>
      </fieldset>
      <AppButton primary ringed>
        Crear rol
      </AppButton>
    </div>
  );
};

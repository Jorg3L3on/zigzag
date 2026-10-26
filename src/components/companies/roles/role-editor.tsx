'use client';

import * as React from 'react';
import Link from 'next/link';
import { Copy, Lock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  deleteCompanyRole,
  saveCompanyRole,
  type CompanyRoleSummary,
} from '@/actions/company-roles';
import { TripledMobileStickyActionBar } from '@/components/tripled';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { COMPANY_HUB_TEAM_PATH } from '@/lib/company-hub';
import type { ActionErrorType } from '@/lib/errors';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  matrixEquals,
  ROLE_TEMPLATES,
  templateMatrix,
  toMatrix,
  toPermissionKeys,
  type RoleTemplateKey,
} from '@/lib/role-matrix';
import { cn } from '@/lib/utils';
import { RolePermissionMatrix } from './role-permission-matrix';

export type RoleEditorSeed = {
  name: string;
  description: string;
  permissionKeys: string[];
};

type RoleEditorProps = {
  /** Existing role, or null for a new one. */
  role: CompanyRoleSummary | null;
  /** Initial values for a new role (Duplicar). */
  seed?: RoleEditorSeed | null;
  canWrite: boolean;
  /** `page` = mobile full-screen route with a sticky Guardar rol. */
  variant: 'panel' | 'page';
  onSaved: (id: number) => void;
  onDeleted: () => void;
  onCancel: () => void;
  onDuplicate?: (seed: RoleEditorSeed) => void;
};

const showError = (
  result: { error?: string; errorType?: ActionErrorType },
  fallback: string,
) => {
  const type = classifyClientError(null, undefined, result.errorType);
  toast.error(getErrorMessageByType(type, result.error || fallback));
};

const usersLabel = (count: number) =>
  count === 1 ? '1 usuario con este rol' : `${count} usuarios con este rol`;

const peopleLabel = (count: number) =>
  count === 1 ? '1 persona con este rol' : `${count} personas con este rol`;

export const RoleEditor = ({
  role,
  seed,
  canWrite,
  variant,
  onSaved,
  onDeleted,
  onCancel,
  onDuplicate,
}: RoleEditorProps) => {
  const isMobile = useIsMobile();
  // md+ look (ZIG-I32-3): amber shared notice, tinted template chips, switch
  // matrix and a footer with Ver en Equipo. Phones keep the ZIG-I3-5 editor.
  const desktop = variant === 'panel' || !isMobile;
  const initialKeys = role?.permissionKeys ?? seed?.permissionKeys ?? [];
  // Fixed per mount; the parent remounts the editor (key) when the role changes.
  const [baseline] = React.useState(() => toMatrix(initialKeys));
  const [name, setName] = React.useState(role?.name ?? seed?.name ?? '');
  const [description, setDescription] = React.useState(
    role?.description ?? seed?.description ?? '',
  );
  const [matrix, setMatrix] = React.useState(baseline);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] =
    React.useState<RoleTemplateKey | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const readOnly = !canWrite;
  const isShared = Boolean(role?.isGlobal);
  const isNew = role === null;
  const userCount = role?.userCount ?? 0;
  const deleteBlockedReason = isShared
    ? 'Los roles compartidos no se eliminan desde una empresa.'
    : role?.isProtected
    ? 'El rol de administrador principal no se puede eliminar.'
    : userCount > 0
      ? 'Se habilita cuando nadie tiene este rol.'
      : null;

  const sharedCopyNote = readOnly
    ? null
    : `Al guardar se crea una copia solo para tu empresa${
        userCount > 0
          ? ` y ${userCount === 1 ? 'la persona que lo tiene pasa' : `las ${userCount} personas que lo tienen pasan`} a ella`
          : ''
      }; las demás empresas no cambian.`;

  const applyTemplate = (key: RoleTemplateKey) => {
    setMatrix(templateMatrix(key));
    setPendingTemplate(null);
  };

  const requestTemplate = (key: RoleTemplateKey) => {
    // Ask before replacing a matrix the user already touched.
    if (!matrixEquals(matrix, baseline) && !matrixEquals(matrix, templateMatrix(key))) {
      setPendingTemplate(key);
      return;
    }
    applyTemplate(key);
  };

  const save = async () => {
    if (!name.trim()) {
      setNameError('El nombre es requerido');
      return;
    }
    setNameError(null);
    setSaving(true);
    const result = await saveCompanyRole({
      id: role?.id,
      name: name.trim(),
      description: description.trim(),
      // Keys outside the matrix (e.g. permissions.read) stay as they were.
      permissionKeys: toPermissionKeys(matrix, initialKeys),
    });
    setSaving(false);
    if (!result.success) {
      showError(result, isNew ? 'No se pudo crear el rol' : 'No se pudo guardar el rol');
      return;
    }
    toast.success(
      isNew ? 'Rol creado' : isShared ? 'Rol guardado como copia de tu empresa' : 'Rol guardado',
    );
    onSaved(result.data?.id ?? role?.id ?? 0);
  };

  const remove = async () => {
    if (!role) {
      return;
    }
    setDeleting(true);
    const result = await deleteCompanyRole(role.id);
    setDeleting(false);
    if (!result.success) {
      showError(result, 'No se pudo eliminar el rol');
      return;
    }
    setConfirmDelete(false);
    toast.success('Rol eliminado');
    onDeleted();
  };

  const saveLabel = saving ? 'Guardando…' : isNew ? 'Crear rol' : 'Guardar rol';

  return (
    <section
      aria-label={isNew ? 'Nuevo rol' : `Editar rol ${role?.name}`}
      className="flex flex-col gap-5"
    >
      {role && isShared ? (
        <div
          className={cn(
            'flex flex-col gap-3 rounded-xl border sm:flex-row sm:items-center',
            desktop
              ? 'border-amber-300 bg-amber-50 p-3.5 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
              : 'bg-muted/40 p-4',
          )}
          data-testid="shared-role-notice"
        >
          {desktop ? null : (
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          {desktop ? (
            <p className="flex-1 text-sm">
              <span className="font-semibold">Rol compartido de la plataforma.</span>
              {sharedCopyNote ? ` ${sharedCopyNote}` : null}
            </p>
          ) : (
            // One text node on phones, as before ZIG-I32 (kerning stays identical).
            <p className="flex-1 text-sm text-muted-foreground">
              {sharedCopyNote
                ? `Rol compartido de la plataforma. ${sharedCopyNote}`
                : 'Rol compartido de la plataforma.'}
            </p>
          )}
          {canWrite && onDuplicate ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                onDuplicate({
                  name: `${role.name} (copia)`,
                  description: role.description ?? '',
                  permissionKeys: role.permissionKeys,
                })
              }
            >
              <Copy className="mr-2 size-4" aria-hidden />
              Duplicar
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-2">
          <Label htmlFor="role-editor-name">Nombre del rol</Label>
          <Input
            id="role-editor-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={readOnly}
            maxLength={60}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'role-editor-name-error' : undefined}
            className="h-11"
          />
          {nameError ? (
            <p id="role-editor-name-error" className="text-sm font-medium text-destructive">
              {nameError}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="role-editor-description">Descripción</Label>
          <Input
            id="role-editor-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={readOnly}
            maxLength={200}
            placeholder="Para qué sirve este rol"
            className="h-11"
          />
        </div>
      </div>

      {readOnly ? null : desktop ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Empezar desde una plantilla</span>
          <div role="group" aria-label="Plantillas" className="flex flex-wrap gap-2">
            {ROLE_TEMPLATES.map((template) => {
              const active = matrixEquals(matrix, templateMatrix(template.key));
              return (
                <Button
                  key={template.key}
                  type="button"
                  variant="outline"
                  aria-pressed={active}
                  title={template.description}
                  className={cn(
                    'h-8 rounded-full px-3.5 text-sm',
                    active &&
                      'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
                  )}
                  onClick={() => requestTemplate(template.key)}
                >
                  {template.label}
                </Button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-sm font-medium">Empezar desde una plantilla:</span>
          <div role="group" aria-label="Plantillas" className="-mx-1 flex gap-2 overflow-x-auto px-1">
            {ROLE_TEMPLATES.map((template) => {
              const active = matrixEquals(matrix, templateMatrix(template.key));
              return (
                <Button
                  key={template.key}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  aria-pressed={active}
                  title={template.description}
                  className="h-9 shrink-0 rounded-full px-4"
                  onClick={() => requestTemplate(template.key)}
                >
                  {template.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      <RolePermissionMatrix
        value={matrix}
        onChange={setMatrix}
        disabled={readOnly}
        control={desktop ? 'switch' : 'checkbox'}
      />

      {desktop ? (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          {isNew ? null : (
            <p className="text-sm text-muted-foreground">
              {peopleLabel(userCount)} ·{' '}
              <Link
                href={COMPANY_HUB_TEAM_PATH}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver en Equipo
              </Link>
            </p>
          )}
          {isNew || readOnly || isShared ? null : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={Boolean(deleteBlockedReason) || deleting}
                aria-describedby={deleteBlockedReason ? 'role-delete-reason' : undefined}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" aria-hidden data-icon="inline-start" />
                Eliminar rol
              </Button>
              {deleteBlockedReason ? (
                <span id="role-delete-reason" className="text-caption text-muted-foreground">
                  {deleteBlockedReason}
                </span>
              ) : null}
            </div>
          )}
          {readOnly ? null : (
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saveLabel}
              </Button>
            </div>
          )}
        </div>
      ) : (
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:flex-wrap sm:items-center">
        {readOnly ? null : (
          <div className={cn('flex gap-2', variant === 'page' && 'hidden md:flex')}>
            <Button type="button" onClick={() => void save()} disabled={saving} className="h-10">
              {saveLabel}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="h-10">
              Cancelar
            </Button>
          </div>
        )}
        {isNew ? null : (
          <p className="text-sm text-muted-foreground sm:ml-auto">{usersLabel(userCount)}</p>
        )}
        {isNew || readOnly || isShared ? null : (
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="ghost"
              className="h-10 justify-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:justify-center"
              disabled={Boolean(deleteBlockedReason) || deleting}
              aria-describedby={deleteBlockedReason ? 'role-delete-reason' : undefined}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 size-4" aria-hidden />
              Eliminar rol
            </Button>
            {deleteBlockedReason ? (
              <span id="role-delete-reason" className="text-caption text-muted-foreground">
                {deleteBlockedReason}
              </span>
            ) : null}
          </div>
        )}
      </div>
      )}

      {variant === 'page' && !readOnly ? (
        <TripledMobileStickyActionBar>
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={() => void save()}
            disabled={saving}
          >
            {saveLabel}
          </Button>
        </TripledMobileStickyActionBar>
      ) : null}

      <AlertDialog
        open={pendingTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPendingTemplate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar los permisos?</AlertDialogTitle>
            <AlertDialogDescription>
              La plantilla sustituye los permisos que marcaste en este rol.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingTemplate && applyTemplate(pendingTemplate)}
            >
              Usar plantilla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el rol {role?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Nadie lo tiene asignado. Esta acción no se puede deshacer desde aquí.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

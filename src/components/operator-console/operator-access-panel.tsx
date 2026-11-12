'use client';

import React from 'react';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Eye, KeyRound, Pencil, ShieldCheck, UserPlus, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  getOperatorCompanyAccess,
  operatorAddMember,
  operatorChangeMemberRole,
  operatorDeactivateMember,
  type OperatorAccessData,
  type OperatorAccessMember,
  type OperatorAccessRole,
} from '@/actions/operator-company-access';
import { resetUserTemporaryPassword } from '@/actions/users';
import {
  TeamTemporaryPasswordBox,
  type CreatedTeamMember,
} from '@/components/companies/team/team-temporary-password-box';
import { DesktopSwitch } from '@/components/desktop-switch';
import {
  ListEmpty,
  ListError,
  ListFilterSelect,
  ListFooter,
  ListLoading,
  ListNoResults,
  ListRowMenu,
  ListShortDate,
  ListSortableHeader,
  ListStatusPill,
  ListTable,
  ListTableCard,
  ListToolbar,
  type ListRowMenuItem,
} from '@/components/list-page';
import { useOperatorCompany } from '@/components/operator-console/operator-company-context';
import { TripledMobileRecordCard } from '@/components/tripled';
import { TemporaryPasswordDialog } from '@/components/users/temporary-password-dialog';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { formatRelative, plural } from '@/lib/operator-console-format';
import { operatorTenantHref } from '@/lib/operator-tenant-scope';

type AccessFilter = 'all' | 'active' | 'never' | 'deactivated';

const ACCESS_OPTIONS: { value: AccessFilter; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activas' },
  { value: 'never', label: 'Nunca han entrado' },
  { value: 'deactivated', label: 'Desactivadas' },
];

const accessOf = (member: OperatorAccessMember): { label: string; tone: 'emerald' | 'amber' | 'slate' } => {
  if (member.deactivated) return { label: 'Desactivada', tone: 'slate' };
  if (!member.lastSignedInAt) return { label: 'Nunca ha entrado', tone: 'amber' };
  return { label: 'Activa', tone: 'emerald' };
};

const matchesAccess = (member: OperatorAccessMember, filter: AccessFilter) => {
  if (filter === 'active') return !member.deactivated && Boolean(member.lastSignedInAt);
  if (filter === 'never') return !member.deactivated && !member.lastSignedInAt;
  if (filter === 'deactivated') return member.deactivated;
  return true;
};

const showError = (result: { error?: string; errorCode?: string }, fallback: string) => {
  toast.error(result.error || fallback, {
    description: result.errorCode ? `Código ${result.errorCode}` : undefined,
  });
};

const RoleDialog = ({
  member,
  roles,
  onClose,
  onSave,
}: {
  member: OperatorAccessMember | null;
  roles: OperatorAccessRole[];
  onClose: () => void;
  onSave: (member: OperatorAccessMember, roleId: number) => Promise<boolean>;
}) => {
  const [roleId, setRoleId] = React.useState<string>('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setRoleId(member?.roleId != null ? String(member.roleId) : ''), [member]);
  return (
    <Dialog open={Boolean(member)} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar rol</DialogTitle>
          <DialogDescription>{member ? `Rol de ${member.name}.` : null}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="operator-role-select">Rol</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger id="operator-role-select" className="h-11">
              <SelectValue placeholder="Elige un rol" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={String(role.id)}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy || !roleId || String(member?.roleId) === roleId}
            onClick={async () => {
              if (!member) return;
              setBusy(true);
              const ok = await onSave(member, Number(roleId));
              setBusy(false);
              if (ok) onClose();
            }}
          >
            {busy ? 'Aplicando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddPersonDialog = ({
  open,
  roles,
  companyName,
  onClose,
  onAdd,
}: {
  open: boolean;
  roles: OperatorAccessRole[];
  companyName: string;
  onClose: () => void;
  onAdd: (data: { name: string; email: string; role_id: number }) => Promise<string | null>;
}) => {
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [roleId, setRoleId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [created, setCreated] = React.useState<CreatedTeamMember | null>(null);
  React.useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setRoleId('');
      setCreated(null);
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar persona</DialogTitle>
          <DialogDescription>
            Entra con una contraseña temporal y la cambia en su primer inicio de sesión.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (created) return onClose();
            setBusy(true);
            const password = await onAdd({ name: name.trim(), email: email.trim(), role_id: Number(roleId) });
            setBusy(false);
            if (password) setCreated({ name: name.trim(), email: email.trim(), password });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="operator-add-name">Nombre</Label>
            <Input id="operator-add-name" value={name} onChange={(e) => setName(e.target.value)} required disabled={Boolean(created)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="operator-add-email">Correo</Label>
            <Input id="operator-add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={Boolean(created)} className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="operator-add-role">Rol</Label>
            <Select value={roleId} onValueChange={setRoleId} disabled={Boolean(created)}>
              <SelectTrigger id="operator-add-role" className="h-11">
                <SelectValue placeholder="Elige un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TeamTemporaryPasswordBox created={created} companyName={companyName} />
          <DialogFooter>
            {created ? null : (
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={busy || (!created && (!name.trim() || !email.trim() || !roleId))}>
              {created ? 'Listo' : busy ? 'Agregando…' : 'Agregar persona'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Acceso (ZIG-I38-6, frame 4): Personas and Roles as two stacked standard
 * tables, a ⋯ per row and «Agregar persona» in outline; no inner tabs and no
 * buttons that leave the console (audit C1–C5). Every write goes through the
 * users actions with the company of the route, so the role-rank guard holds.
 */
export const OperatorAccessPanel = () => {
  const { companyId, refresh } = useOperatorCompany();
  const [data, setData] = React.useState<OperatorAccessData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [accessFilter, setAccessFilter] = React.useState<AccessFilter>('all');
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'persona', desc: false }]);
  const [roleSorting, setRoleSorting] = React.useState<SortingState>([{ id: 'rol', desc: false }]);
  const [resetting, setResetting] = React.useState<OperatorAccessMember | null>(null);
  const [changing, setChanging] = React.useState<OperatorAccessMember | null>(null);
  const [deactivating, setDeactivating] = React.useState<OperatorAccessMember | null>(null);
  const [deactivateBusy, setDeactivateBusy] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [viewingRole, setViewingRole] = React.useState<OperatorAccessRole | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const result = await getOperatorCompanyAccess(companyId);
      if (result.success && result.data) setData(result.data);
      else
        setError(
          getErrorMessageByType(
            classifyClientError(null, undefined, result.errorType),
            result.error || 'No se pudo cargar el acceso',
          ),
        );
    } catch (loadError) {
      setError(getErrorMessageByType(classifyClientError(loadError), 'No se pudo cargar el acceso'));
    }
  }, [companyId]);

  React.useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  React.useEffect(() => {
    const id = window.setTimeout(() => setSearch(searchValue.trim().toLowerCase()), 300);
    return () => window.clearTimeout(id);
  }, [searchValue]);

  const afterChange = React.useCallback(async () => {
    await Promise.all([load(), refresh()]);
  }, [load, refresh]);

  const canWrite = Boolean(data?.canWrite);
  const members = React.useMemo(
    () =>
      (data?.members ?? []).filter(
        (member) =>
          (!search ||
            member.name.toLowerCase().includes(search) ||
            member.email.toLowerCase().includes(search) ||
            (member.roleName ?? '').toLowerCase().includes(search)) &&
          (roleFilter === 'all' || String(member.roleId) === roleFilter) &&
          matchesAccess(member, accessFilter),
      ),
    [data, search, roleFilter, accessFilter],
  );

  const memberMenu = React.useCallback(
    (member: OperatorAccessMember): ListRowMenuItem[] => [
      {
        label: 'Dar contraseña temporal',
        icon: <KeyRound className="size-4" aria-hidden />,
        onSelect: () => setResetting(member),
        disabled: !canWrite,
      },
      {
        label: 'Cambiar rol',
        icon: <ShieldCheck className="size-4" aria-hidden />,
        onSelect: () => setChanging(member),
        disabled: !canWrite,
      },
      {
        label: 'Desactivar',
        icon: <UserX className="size-4" aria-hidden />,
        onSelect: () => setDeactivating(member),
        destructive: true,
        disabled: !canWrite,
      },
    ],
    [canWrite],
  );

  const memberColumns = React.useMemo<ColumnDef<OperatorAccessMember>[]>(
    () => [
      {
        id: 'persona',
        accessorKey: 'name',
        header: ({ column }) => <ListSortableHeader column={column} label="Persona" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium" title={row.original.name}>{row.original.name}</p>
            <p className="truncate text-caption text-muted-foreground" title={row.original.email}>{row.original.email}</p>
          </div>
        ),
      },
      {
        id: 'rol',
        accessorFn: (member) => member.roleName ?? '',
        meta: { className: 'w-36' },
        header: ({ column }) => <ListSortableHeader column={column} label="Rol" />,
        cell: ({ row }) => <span className="truncate text-slate-700 dark:text-slate-300">{row.original.roleName ?? '—'}</span>,
      },
      {
        id: 'acceso',
        accessorFn: (member) => accessOf(member).label,
        meta: { className: 'w-48' },
        header: ({ column }) => <ListSortableHeader column={column} label="Acceso" />,
        cell: ({ row }) => {
          const access = accessOf(row.original);
          return (
            <div className="min-w-0">
              <ListStatusPill tone={access.tone}>{access.label}</ListStatusPill>
              {row.original.failedToday > 0 ? (
                <p className="mt-0.5 truncate text-caption text-red-700 dark:text-red-300">
                  {plural(row.original.failedToday, 'intento fallido', 'intentos fallidos')} hoy
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'ultimo',
        accessorFn: (member) => member.lastSignedInAt ?? '',
        meta: { className: 'w-36' },
        header: ({ column }) => <ListSortableHeader column={column} label="Último acceso" />,
        cell: ({ row }) => (
          <span className="text-slate-700 dark:text-slate-300">
            {row.original.lastSignedInAt ? formatRelative(row.original.lastSignedInAt) : '—'}
          </span>
        ),
      },
      {
        id: 'alta',
        accessorKey: 'createdAt',
        meta: { className: 'w-28' },
        header: ({ column }) => <ListSortableHeader column={column} label="Alta" />,
        cell: ({ row }) => <ListShortDate date={row.original.createdAt} />,
      },
      {
        id: 'acciones',
        enableSorting: false,
        meta: { className: 'w-14' },
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) =>
          row.original.deactivated ? null : (
            <div className="flex justify-end">
              <ListRowMenu label={`Acciones de ${row.original.name}`} items={memberMenu(row.original)} />
            </div>
          ),
      },
    ],
    [memberMenu],
  );

  const roleColumns = React.useMemo<ColumnDef<OperatorAccessRole>[]>(
    () => [
      {
        id: 'rol',
        accessorKey: 'name',
        meta: { className: 'w-64' },
        header: ({ column }) => <ListSortableHeader column={column} label="Rol" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium">
              {row.original.name}
              {row.original.shared ? <span className="ml-1.5 font-normal text-muted-foreground">(de ZigZag)</span> : null}
            </p>
            {row.original.description ? (
              <p className="truncate text-caption text-muted-foreground" title={row.original.description}>
                {row.original.description}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        id: 'puede',
        enableSorting: false,
        header: 'Qué puede hacer',
        cell: ({ row }) => (
          <span className="line-clamp-2 text-slate-700 dark:text-slate-300" title={row.original.areas}>
            {row.original.areas}
          </span>
        ),
      },
      {
        id: 'personas',
        accessorKey: 'peopleCount',
        meta: { align: 'right', className: 'w-24' },
        header: ({ column }) => <ListSortableHeader column={column} label="Personas" align="right" />,
        cell: ({ row }) => <span className="tabular-nums">{row.original.peopleCount}</span>,
      },
      {
        id: 'permisos',
        accessorKey: 'permissionCount',
        meta: { align: 'right', className: 'w-24' },
        header: ({ column }) => <ListSortableHeader column={column} label="Permisos" align="right" />,
        cell: ({ row }) => <span className="tabular-nums">{row.original.permissionCount}</span>,
      },
      {
        id: 'acciones',
        enableSorting: false,
        meta: { className: 'w-14' },
        header: () => <span className="sr-only">Acciones</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <ListRowMenu
              label={`Acciones del rol ${row.original.name}`}
              items={[
                {
                  label: 'Ver permisos',
                  icon: <Eye className="size-4" aria-hidden />,
                  onSelect: () => setViewingRole(row.original),
                },
                {
                  label: 'Editar',
                  icon: <Pencil className="size-4" aria-hidden />,
                  onSelect: () => window.location.assign(operatorTenantHref('/roles', companyId)),
                  disabled: row.original.shared,
                  hint: row.original.shared ? 'rol de ZigZag' : undefined,
                },
              ]}
            />
          </div>
        ),
      },
    ],
    [companyId],
  );

  const memberTable = useReactTable({
    data: members,
    columns: memberColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const roleTable = useReactTable({
    data: data?.roles ?? [],
    columns: roleColumns,
    state: { sorting: roleSorting },
    onSortingChange: setRoleSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (error) return <ListError description={error} onRetry={() => void load()} />;
  if (!data) return <ListLoading label="Cargando acceso" columns={5} />;

  const hasFilters = search !== '' || roleFilter !== 'all' || accessFilter !== 'all';
  const clear = () => {
    setSearchValue('');
    setSearch('');
    setRoleFilter('all');
    setAccessFilter('all');
  };
  const activeCount = data.members.filter((member) => !member.deactivated).length;

  const addButton = canWrite ? (
    <Button type="button" variant="outline" onClick={() => setAdding(true)}>
      <UserPlus className="size-4" aria-hidden />
      Agregar persona
    </Button>
  ) : null;

  const desktop = (
    <div className="space-y-8">
      <section aria-labelledby="operator-access-people" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="operator-access-people" className="text-[15px] font-semibold">
            Personas <span className="font-normal text-muted-foreground">· {activeCount}</span>
          </h2>
          {addButton}
        </div>
        <ListToolbar
          search={{ value: searchValue, onChange: setSearchValue, placeholder: 'Buscar persona, correo o rol', ariaLabel: 'Buscar personas' }}
          filters={
            <>
              <ListFilterSelect
                value={roleFilter}
                allValue="all"
                onChange={setRoleFilter}
                options={[{ value: 'all', label: 'Todos los roles' }, ...data.roles.map((role) => ({ value: String(role.id), label: role.name }))]}
                ariaLabel="Rol"
              />
              <ListFilterSelect value={accessFilter} allValue="all" onChange={setAccessFilter} options={ACCESS_OPTIONS} ariaLabel="Acceso" />
            </>
          }
          hasActiveFilters={hasFilters}
          onClear={clear}
          clearAriaLabel="Limpiar filtros de personas"
        />
        {data.members.length === 0 ? (
          <ListEmpty
            icon={<Users className="h-4 w-4 text-muted-foreground" aria-hidden />}
            title="Sin personas"
            description="Esta empresa todavía no tiene a nadie."
            action={addButton}
          />
        ) : members.length === 0 ? (
          <ListNoResults description="Nadie coincide con estos filtros." onClear={clear} />
        ) : (
          <ListTableCard footer={<ListFooter total={data.members.length} shown={members.length} noun="personas" />}>
            <ListTable table={memberTable} ariaLabel="Personas de la empresa" rowTestId="operator-access-person" />
          </ListTableCard>
        )}
      </section>

      <section aria-labelledby="operator-access-roles" className="space-y-4">
        <h2 id="operator-access-roles" className="text-[15px] font-semibold">
          Roles <span className="font-normal text-muted-foreground">· {data.roles.length}</span>
        </h2>
        <ListTableCard footer={<ListFooter total={data.roles.length} noun="roles" />}>
          <ListTable table={roleTable} ariaLabel="Roles de la empresa" rowTestId="operator-access-role" />
        </ListTableCard>
      </section>
    </div>
  );

  const phone = (
    <div className="space-y-4">
      {addButton ? <div className="[&_button]:min-h-11 [&_button]:w-full">{addButton}</div> : null}
      <h2 className="text-base font-semibold">Personas · {activeCount}</h2>
      {data.members.map((member) => {
        const access = accessOf(member);
        return (
          <TripledMobileRecordCard key={member.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-semibold">{member.name}</p>
                <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                <div className="flex flex-wrap gap-1.5">
                  <ListStatusPill tone="slate">{member.roleName ?? 'Sin rol'}</ListStatusPill>
                  <ListStatusPill tone={access.tone}>{access.label}</ListStatusPill>
                </div>
              </div>
              {member.deactivated ? null : <ListRowMenu label={`Acciones de ${member.name}`} items={memberMenu(member)} />}
            </div>
          </TripledMobileRecordCard>
        );
      })}
      <h2 className="pt-2 text-base font-semibold">Roles · {data.roles.length}</h2>
      {data.roles.map((role) => (
        <TripledMobileRecordCard key={role.id}>
          <p className="font-semibold">{role.name}</p>
          <p className="text-sm text-muted-foreground">{role.areas}</p>
          <p className="text-caption text-muted-foreground">
            {plural(role.peopleCount, 'persona', 'personas')} · {plural(role.permissionCount, 'permiso', 'permisos')}
          </p>
        </TripledMobileRecordCard>
      ))}
    </div>
  );

  return (
    <>
      <DesktopSwitch phone={phone} desktop={desktop} />
      <TemporaryPasswordDialog
        target={resetting}
        onReset={() => (resetting ? resetUserTemporaryPassword(BigInt(resetting.id)) : Promise.resolve({ success: false }))}
        onOpenChange={(open) => {
          if (!open) setResetting(null);
        }}
        onDone={() => void load()}
      />
      <RoleDialog
        member={changing}
        roles={data.roles}
        onClose={() => setChanging(null)}
        onSave={async (member, roleId) => {
          const result = await operatorChangeMemberRole(companyId, member.id, roleId);
          if (!result.success) {
            showError(result, 'No se pudo cambiar el rol');
            return false;
          }
          toast.success('Rol actualizado');
          await afterChange();
          return true;
        }}
      />
      <AlertDialog open={Boolean(deactivating)} onOpenChange={(open) => !open && !deactivateBusy && setDeactivating(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar a {deactivating?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no podrá iniciar sesión. Sus tickets y su historial se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivateBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivateBusy}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={async (event) => {
                event.preventDefault();
                if (!deactivating) return;
                setDeactivateBusy(true);
                const result = await operatorDeactivateMember(companyId, deactivating.id);
                setDeactivateBusy(false);
                if (!result.success) {
                  showError(result, 'No se pudo desactivar');
                  return;
                }
                toast.success('Persona desactivada');
                setDeactivating(null);
                await afterChange();
              }}
            >
              {deactivateBusy ? 'Aplicando…' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(viewingRole)} onOpenChange={(open) => !open && setViewingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permisos de {viewingRole?.name}</DialogTitle>
            <DialogDescription>{viewingRole?.description ?? 'Qué puede hacer este rol.'}</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm">
            {(viewingRole?.areas ?? '').split(', ').map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">
            {viewingRole ? plural(viewingRole.permissionCount, 'permiso', 'permisos') : null}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewingRole(null)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddPersonDialog
        open={adding}
        roles={data.roles}
        companyName={data.companyName}
        onClose={() => setAdding(false)}
        onAdd={async (input) => {
          const result = await operatorAddMember(companyId, input);
          if (!result.success || !result.data) {
            showError(result, 'No se pudo agregar a la persona');
            return null;
          }
          toast.success('Persona agregada');
          void afterChange();
          return result.data.temporaryPassword;
        }}
      />
    </>
  );
};


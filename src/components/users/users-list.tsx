'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { getUsers } from '@/actions/users';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TripledEmptyState } from '@/components/tripled';
import {
  Loader2,
  Search,
  Users as UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateUserDialog } from '@/app/dashboard/users/create-user-dialog';
import { UpdateUserDialog } from '@/app/dashboard/users/update-user-dialog';
import { DeleteUserDialog } from '@/app/dashboard/users/delete-user-dialog';
import { UserActionsMenu } from '@/components/users/user-actions-menu';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import {
  createUsersColumns,
  type UserWithRelations,
} from '@/components/users/users-columns';
import {
  DEFAULT_USERS_SORTING,
  USERS_MOBILE_SORT_OPTIONS,
  decodeSortingState,
  encodeSortingState,
} from '@/components/users/users-sort-presets';
import { FormattedDate } from '@/components/formatted-date';
import { Badge } from '@/components/ui/badge';

type VerificationFilter = 'all' | 'verified' | 'unverified';
type CompanyAssignmentFilter = 'all' | 'assigned' | 'unassigned';

export function UsersList() {
  const [users, setUsers] = React.useState<UserWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [searchValue, setSearchValue] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [verificationFilter, setVerificationFilter] =
    React.useState<VerificationFilter>('all');
  const [companyAssignmentFilter, setCompanyAssignmentFilter] =
    React.useState<CompanyAssignmentFilter>('all');
  const [sorting, setSorting] =
    React.useState<SortingState>(DEFAULT_USERS_SORTING);
  const [editUser, setEditUser] = React.useState<UserWithRelations | null>(
    null,
  );
  const [deleteUser, setDeleteUser] = React.useState<UserWithRelations | null>(
    null,
  );

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const fetchUsers = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getUsers();
      if (result.success && result.data) {
        setUsers(result.data as UserWithRelations[]);
      } else {
        const errorType = classifyClientError(
          null,
          undefined,
          result.errorType,
        );
        setLoadError(
          getErrorMessageByType(
            errorType,
            result.error || 'No se pudieron cargar los usuarios',
          ),
        );
      }
    } catch (error) {
      console.error(error);
      const errorType = classifyClientError(error);
      setLoadError(
        getErrorMessageByType(
          errorType,
          'No se pudieron cargar los usuarios',
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return users.filter((row) => {
      const matchesSearch =
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        (row.company?.name ?? '').toLowerCase().includes(q) ||
        (row.role?.name ?? '').toLowerCase().includes(q) ||
        row.id.toString().includes(q);

      if (!matchesSearch) {
        return false;
      }

      if (verificationFilter === 'verified' && !row.email_verified_at) {
        return false;
      }
      if (verificationFilter === 'unverified' && row.email_verified_at) {
        return false;
      }

      if (
        companyAssignmentFilter === 'assigned' &&
        row.company_id == null
      ) {
        return false;
      }
      if (
        companyAssignmentFilter === 'unassigned' &&
        row.company_id != null
      ) {
        return false;
      }

      return true;
    });
  }, [
    users,
    debouncedSearch,
    verificationFilter,
    companyAssignmentFilter,
  ]);

  const columns = React.useMemo(
    () =>
      createUsersColumns({
        renderActions: (userRow) => (
          <div
            className="flex justify-end"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <UserActionsMenu
              onEditRequest={() => setEditUser(userRow)}
              onDeleteRequest={() => setDeleteUser(userRow)}
            />
          </div>
        ),
      }),
    [],
  );

  const table = useReactTable({
    data: filteredUsers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const mobileSortValue = encodeSortingState(sorting);

  const verificationOptions: Array<{
    value: VerificationFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Todos' },
    { value: 'verified', label: 'Verificados' },
    { value: 'unverified', label: 'Sin verificar' },
  ];

  const companyOptions: Array<{
    value: CompanyAssignmentFilter;
    label: string;
  }> = [
    { value: 'all', label: 'Empresa: todas' },
    { value: 'assigned', label: 'Con empresa' },
    { value: 'unassigned', label: 'Sin empresa' },
  ];

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader className="space-y-0 border-b border-border/50 bg-gradient-to-br from-muted/35 via-background to-background px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-balance text-2xl font-semibold tracking-tight">
                Usuarios
              </CardTitle>
              <CardDescription className="text-base">
                Lista de todos los usuarios registrados en el sistema.
              </CardDescription>
            </div>
            <div className="shrink-0 self-end sm:self-start">
              <CreateUserDialog onCreated={fetchUsers} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 pt-5 sm:p-6 sm:pt-6">
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por nombre, correo, empresa, rol o ID..."
                className="pl-9"
                aria-label="Buscar usuarios"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {verificationOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      verificationFilter === option.value
                        ? 'default'
                        : 'outline'
                    }
                    size="sm"
                    onClick={() => setVerificationFilter(option.value)}
                    aria-label={`Filtrar correo: ${option.label.toLowerCase()}`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {companyOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={
                      companyAssignmentFilter === option.value
                        ? 'default'
                        : 'outline'
                    }
                    size="sm"
                    onClick={() => setCompanyAssignmentFilter(option.value)}
                    aria-label={`Filtrar ${option.label.toLowerCase()}`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <div className="w-full sm:w-auto md:hidden">
                <Select
                  value={mobileSortValue}
                  onValueChange={(value) =>
                    setSorting(decodeSortingState(value))
                  }
                >
                  <SelectTrigger
                    className="h-10 w-full sm:w-[min(100%,18rem)]"
                    aria-label="Ordenar lista de usuarios"
                  >
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    {USERS_MOBILE_SORT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!loading && !loadError ? (
              <p className="text-xs text-muted-foreground sm:text-sm">
                Mostrando{' '}
                <span className="font-medium text-foreground">
                  {filteredUsers.length}
                </span>
                {users.length !== filteredUsers.length ? (
                  <>
                    {' '}
                    de{' '}
                    <span className="font-medium text-foreground">
                      {users.length}
                    </span>
                  </>
                ) : null}{' '}
                usuarios
              </p>
            ) : null}
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <div className="space-y-4">
              <TripledEmptyState
                icon={<UsersIcon className="h-4 w-4" />}
                title="Error de carga"
                description={loadError}
              />
              <div className="flex justify-center">
                <Button type="button" variant="outline" onClick={fetchUsers}>
                  Reintentar
                </Button>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <TripledEmptyState
              icon={<UsersIcon className="h-4 w-4" />}
              title="Sin resultados"
              description={
                users.length === 0
                  ? 'No hay usuarios registrados.'
                  : 'No hay usuarios que coincidan con los filtros o la búsqueda.'
              }
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {table.getRowModel().rows.map((row) => {
                  const u = row.original;
                  return (
                    <article
                      key={row.id}
                      className="cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30"
                      tabIndex={0}
                      role="button"
                      aria-label={`Editar usuario ${u.name}`}
                      onClick={() => setEditUser(u)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setEditUser(u);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm font-semibold text-foreground">
                            {u.name}
                          </h3>
                          <p className="truncate text-sm text-muted-foreground">
                            {u.email}
                          </p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {u.email_verified_at ? (
                              <Badge variant="secondary" className="text-xs">
                                Correo verificado
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground"
                              >
                                Sin verificar
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div onClick={(event) => event.stopPropagation()}>
                          <UserActionsMenu
                            onEditRequest={() => setEditUser(u)}
                            onDeleteRequest={() => setDeleteUser(u)}
                          />
                        </div>
                      </div>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">ID</dt>
                          <dd className="tabular-nums">{u.id.toString()}</dd>
                        </div>
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Empresa</dt>
                          <dd className="truncate">
                            {u.company?.name ?? 'N/A'}
                          </dd>
                        </div>
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Rol</dt>
                          <dd className="truncate">{u.role?.name ?? 'N/A'}</dd>
                        </div>
                        <div className="grid grid-cols-[88px_1fr] gap-2">
                          <dt className="text-muted-foreground">Alta</dt>
                          <dd>
                            <FormattedDate date={u.created_at} />
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-xl border border-border/70 shadow-sm md:block">
                <Table
                  className={
                    '[&_td]:py-2.5 [&_th]:h-10 [&_th]:py-2 [&_th]:align-middle [&_tr]:border-border/60'
                  }
                >
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className={
                              header.column.id === 'actions'
                                ? 'text-right'
                                : undefined
                            }
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        tabIndex={0}
                        aria-label={`Editar usuario ${row.original.name}`}
                        onClick={() => setEditUser(row.original)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setEditUser(row.original);
                          }
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={
                              cell.column.id === 'actions'
                                ? 'text-right'
                                : undefined
                            }
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {editUser ? (
        <UpdateUserDialog
          user={editUser}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditUser(null);
            }
          }}
          onSuccess={fetchUsers}
        />
      ) : null}
      {deleteUser ? (
        <DeleteUserDialog
          user={deleteUser}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleteUser(null);
            }
          }}
          onSuccess={fetchUsers}
        />
      ) : null}
    </>
  );
}

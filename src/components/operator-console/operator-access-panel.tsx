'use client';

import Link from 'next/link';
import React from 'react';
import { getRoles } from '@/actions/roles';
import { getUsers } from '@/actions/users';
import { CreateUserDialog } from '@/app/(app)/users/create-user-dialog';
import type { UserWithRelations } from '@/components/users/users-columns';
import type { Role } from '@/components/roles/roles-columns';
import { useCompany } from '@/contexts/company-context';
import { TripledEmptyState } from '@/components/tripled';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { usePermissions } from '@/hooks/use-permissions';
import { operatorManagementHref } from '@/lib/operator-tenant-scope';
import { PERMISSIONS } from '@/lib/permissions';
import { classifyClientError, getErrorMessageByType } from '@/lib/network-awareness';
import { cn } from '@/lib/utils';
import { Loader2, Shield, Users } from 'lucide-react';

type AccessTab = 'users' | 'roles';

const countRolePermissions = (role: Role) =>
  role.permissions.filter((row) => row.permission != null).length;

export const OperatorAccessPanel = () => {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;
  const canWriteUsers =
    permissions.isSystem && permissions.can(PERMISSIONS.users.write);
  const canReadUsers = permissions.can(PERMISSIONS.users.read);
  const canReadRoles = permissions.can(PERMISSIONS.roles.read);

  const [activeTab, setActiveTab] = React.useState<AccessTab>('users');
  const [users, setUsers] = React.useState<UserWithRelations[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [loadingRoles, setLoadingRoles] = React.useState(false);
  const [usersError, setUsersError] = React.useState<string | null>(null);
  const [rolesError, setRolesError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    if (!companyId || isSystemTenant) {
      setUsers([]);
      setRoles([]);
      setUsersError(null);
      setRolesError(null);
      return;
    }

    let cancelled = false;

    const loadUsers = async () => {
      if (!canReadUsers) {
        setUsers([]);
        setUsersError(null);
        return;
      }
      setLoadingUsers(true);
      setUsersError(null);
      try {
        const result = await getUsers();
        if (cancelled) {
          return;
        }
        if (!result.success || !result.data) {
          const errorType = classifyClientError(
            null,
            undefined,
            result.errorType,
          );
          setUsersError(
            getErrorMessageByType(
              errorType,
              result.error || 'No se pudieron cargar los usuarios',
            ),
          );
          setUsers([]);
          return;
        }
        setUsers(
          (result.data as UserWithRelations[]).filter(
            (row) => row.company_id === companyId,
          ),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        setUsersError(
          getErrorMessageByType(
            classifyClientError(error),
            'No se pudieron cargar los usuarios',
          ),
        );
        setUsers([]);
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    };

    const loadRoles = async () => {
      if (!canReadRoles) {
        setRoles([]);
        setRolesError(null);
        return;
      }
      setLoadingRoles(true);
      setRolesError(null);
      try {
        const result = await getRoles();
        if (cancelled) {
          return;
        }
        if (!result.success || !result.data) {
          const errorType = classifyClientError(
            null,
            undefined,
            result.errorType,
          );
          setRolesError(
            getErrorMessageByType(
              errorType,
              result.error || 'No se pudieron cargar los roles',
            ),
          );
          setRoles([]);
          return;
        }
        setRoles(
          (result.data as Role[]).filter((row) => row.company?.id === companyId),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        setRolesError(
          getErrorMessageByType(
            classifyClientError(error),
            'No se pudieron cargar los roles',
          ),
        );
        setRoles([]);
      } finally {
        if (!cancelled) {
          setLoadingRoles(false);
        }
      }
    };

    void loadUsers();
    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, [canReadRoles, canReadUsers, companyId, isSystemTenant, reloadToken]);

  if (!companyId || isSystemTenant) {
    return null;
  }

  const handleCreatedUser = () => {
    setActiveTab('users');
    setReloadToken((token) => token + 1);
  };

  return (
    <section className="space-y-4 border-t border-border/60 pt-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Acceso y cuentas
        </h2>
        <p className="text-sm text-muted-foreground">
          Administra usuarios y roles de la empresa seleccionada.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href={operatorManagementHref('/users', companyId)}>
            <Users
              className="mr-2 h-4 w-4"
              aria-hidden
              data-icon="inline-start"
            />
            Gestionar usuarios
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href={operatorManagementHref('/roles', companyId)}>
            <Shield
              className="mr-2 h-4 w-4"
              aria-hidden
              data-icon="inline-start"
            />
            Gestionar roles
          </Link>
        </Button>
        {canWriteUsers ? (
          <CreateUserDialog
            defaultCompanyId={companyId}
            defaultCompanyName={selectedCompany?.name}
            lockCompany
            onCreated={handleCreatedUser}
          />
        ) : null}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-4 pb-2">
          <div>
            <CardTitle className="text-base">Cuentas de la empresa</CardTitle>
            <CardDescription>
              Usuarios y roles en {selectedCompany?.name}
            </CardDescription>
          </div>
          <div
            role="tablist"
            aria-label="Secciones de acceso"
            className="flex flex-wrap gap-2"
          >
            <Button
              type="button"
              role="tab"
              id="operator-access-tab-users"
              aria-selected={activeTab === 'users'}
              aria-controls="operator-access-panel-users"
              variant={activeTab === 'users' ? 'default' : 'outline'}
              className="min-h-11 rounded-xl"
              onClick={() => setActiveTab('users')}
            >
              <Users className="mr-2 h-4 w-4" aria-hidden />
              Usuarios
              <Badge
                variant={activeTab === 'users' ? 'secondary' : 'outline'}
                className="ml-2"
              >
                {users.length}
              </Badge>
            </Button>
            <Button
              type="button"
              role="tab"
              id="operator-access-tab-roles"
              aria-selected={activeTab === 'roles'}
              aria-controls="operator-access-panel-roles"
              variant={activeTab === 'roles' ? 'default' : 'outline'}
              className="min-h-11 rounded-xl"
              onClick={() => setActiveTab('roles')}
            >
              <Shield className="mr-2 h-4 w-4" aria-hidden />
              Roles
              <Badge
                variant={activeTab === 'roles' ? 'secondary' : 'outline'}
                className="ml-2"
              >
                {roles.length}
              </Badge>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div
            role="tabpanel"
            id="operator-access-panel-users"
            aria-labelledby="operator-access-tab-users"
            hidden={activeTab !== 'users'}
            className={cn(activeTab === 'users' ? 'block' : 'hidden')}
          >
            {!canReadUsers ? (
              <TripledEmptyState
                icon={<Users className="h-4 w-4" aria-hidden />}
                title="Sin permiso"
                description="No tienes permiso para ver usuarios de esta empresa."
              />
            ) : loadingUsers ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : usersError ? (
              <p className="text-sm text-destructive" role="alert">
                {usersError}
              </p>
            ) : users.length === 0 ? (
              <TripledEmptyState
                icon={<Users className="h-4 w-4" aria-hidden />}
                title="Sin usuarios"
                description="No hay usuarios asignados a esta empresa."
              />
            ) : (
              <ul className="space-y-3">
                {users.map((userRow) => (
                  <li
                    key={String(userRow.id)}
                    className="rounded-lg border border-border/60 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{userRow.name}</p>
                        <p className="text-muted-foreground">{userRow.email}</p>
                      </div>
                      <Badge variant="secondary">
                        {userRow.role?.name ?? 'Sin rol'}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            role="tabpanel"
            id="operator-access-panel-roles"
            aria-labelledby="operator-access-tab-roles"
            hidden={activeTab !== 'roles'}
            className={cn(activeTab === 'roles' ? 'block' : 'hidden')}
          >
            {!canReadRoles ? (
              <TripledEmptyState
                icon={<Shield className="h-4 w-4" aria-hidden />}
                title="Sin permiso"
                description="No tienes permiso para ver roles de esta empresa."
              />
            ) : loadingRoles ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rolesError ? (
              <p className="text-sm text-destructive" role="alert">
                {rolesError}
              </p>
            ) : roles.length === 0 ? (
              <TripledEmptyState
                icon={<Shield className="h-4 w-4" aria-hidden />}
                title="Sin roles"
                description="No hay roles configurados para esta empresa."
              />
            ) : (
              <ul className="space-y-3">
                {roles.map((roleRow) => (
                  <li
                    key={roleRow.id}
                    className="rounded-lg border border-border/60 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{roleRow.name}</span>
                      <Badge variant="secondary">
                        {countRolePermissions(roleRow)} permiso
                        {countRolePermissions(roleRow) === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    {roleRow.description ? (
                      <p className="mt-1 text-muted-foreground">
                        {roleRow.description}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {roleRow.permissions
                        .map((row) => row.permission?.name)
                        .filter(Boolean)
                        .slice(0, 6)
                        .map((name) => (
                          <Badge
                            key={name}
                            variant="outline"
                            className="text-xs"
                          >
                            {name}
                          </Badge>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
};

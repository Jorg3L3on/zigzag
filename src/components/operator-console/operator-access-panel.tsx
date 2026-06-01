'use client';

import Link from 'next/link';
import React from 'react';
import { getRoles } from '@/actions/roles';
import { CreateUserDialog } from '@/app/dashboard/users/create-user-dialog';
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
import { Loader2, Shield, Users } from 'lucide-react';
import type { Role } from '@/components/roles/roles-columns';

const countRolePermissions = (role: Role) =>
  role.permissions.filter((row) => row.permission != null).length;

export const OperatorAccessPanel = () => {
  const { selectedCompany } = useCompany();
  const permissions = usePermissions();
  const companyId = selectedCompany?.id ?? null;
  const isSystemTenant = selectedCompany?.is_system === true;
  const canWriteUsers =
    permissions.isSystem && permissions.can(PERMISSIONS.users.write);
  const canReadRoles = permissions.can(PERMISSIONS.roles.read);

  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!companyId || isSystemTenant || !canReadRoles) {
      setRoles([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
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
          setLoadError(
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
        setLoadError(
          getErrorMessageByType(
            classifyClientError(error),
            'No se pudieron cargar los roles',
          ),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [canReadRoles, companyId, isSystemTenant]);

  if (!companyId || isSystemTenant) {
    return null;
  }

  return (
    <section className="space-y-4 border-t border-border/60 pt-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Acceso y cuentas
        </h2>
        <p className="text-sm text-muted-foreground">
          Administra usuarios y roles del tenant seleccionado.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href={operatorManagementHref('/dashboard/users', companyId)}>
            <Users className="mr-2 h-4 w-4" aria-hidden />
            Gestionar usuarios
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link href={operatorManagementHref('/dashboard/roles', companyId)}>
            <Shield className="mr-2 h-4 w-4" aria-hidden />
            Gestionar roles
          </Link>
        </Button>
        {canWriteUsers ? (
          <CreateUserDialog
            defaultCompanyId={companyId}
            defaultCompanyName={selectedCompany?.name}
            lockCompany
          />
        ) : null}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Roles del tenant</CardTitle>
          <CardDescription>
            Permisos asignados por rol en {selectedCompany?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive" role="alert">
              {loadError}
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
                        <Badge key={name} variant="outline" className="text-xs">
                          {name}
                        </Badge>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
};

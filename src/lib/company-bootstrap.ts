import { and, isNull } from 'drizzle-orm';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import { hash } from 'bcryptjs';
import {
  company,
  permission,
  role,
  rolePermission,
  user,
  type Company,
  type Role,
} from '@/db/schema';
import {
  normalizeCompanySettingsForDb,
  type CompanyFormValues,
} from '@/lib/company-schema';
import {
  recordGovernanceAudit,
  sanitizeCompanyForAudit,
  sanitizeRoleForAudit,
  sanitizeUserForAudit,
  type GovernanceAuditActor,
} from '@/lib/governance-audit';
import { PERMISSIONS, type PermissionName } from '@/lib/permissions';
import * as schema from '@/db/schema';

/** Platform-level permissions never assigned to tenant bootstrap roles. */
export const TENANT_EXCLUDED_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.companies.read,
  PERMISSIONS.companies.write,
  PERMISSIONS.permissions.write,
];

/** @deprecated Use `TENANT_EXCLUDED_PERMISSIONS`. */
export const TENANT_OWNER_EXCLUDED_PERMISSIONS = TENANT_EXCLUDED_PERMISSIONS;

export const TENANT_BOOTSTRAP_ADMIN_ROLE_NAME = 'Admin';
export const TENANT_BOOTSTRAP_OPERATOR_ROLE_NAME = 'Operator';
export const TENANT_BOOTSTRAP_VIEWER_ROLE_NAME = 'Viewer';

export type CompanyBootstrapOwnerInput = {
  name: string;
  email: string;
  password: string;
};

export type CompanyBootstrapInput = {
  company: CompanyFormValues;
  owner: CompanyBootstrapOwnerInput;
  actor: GovernanceAuditActor;
};

export type CompanyBootstrapResult = {
  company: Company;
  owner: typeof user.$inferSelect;
  ownerRole: Role;
};

type DbTransaction = PgTransaction<
  PgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

type TenantRoleTemplate = {
  name: string;
  description: string;
  permissionNames: PermissionName[];
};

/** Legacy bootstrap admin role name kept for delete-protection on older tenants. */
export const tenantOwnerRoleName = (companyId: number): string =>
  `tenant-admin-${companyId}`;

export const isProtectedBootstrapAdminRole = (
  roleName: string,
  roleCompanyId: number | null,
  companyId: number,
): boolean =>
  roleCompanyId === companyId &&
  (roleName === TENANT_BOOTSTRAP_ADMIN_ROLE_NAME ||
    roleName === tenantOwnerRoleName(companyId));

export const filterTenantAssignablePermissionNames = (
  permissionNames: string[],
): string[] =>
  permissionNames.filter(
    (name) =>
      !TENANT_EXCLUDED_PERMISSIONS.includes(name as PermissionName),
  );

/** @deprecated Use `filterTenantAssignablePermissionNames`. */
export const filterTenantOwnerPermissionNames = filterTenantAssignablePermissionNames;

const TENANT_OPERATOR_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.tickets.read,
  PERMISSIONS.tickets.write,
  PERMISSIONS.services.read,
  PERMISSIONS.services.write,
  PERMISSIONS.clients.read,
  PERMISSIONS.clients.write,
  PERMISSIONS.users.read,
  PERMISSIONS.company.manage,
];

const TENANT_VIEWER_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.tickets.read,
  PERMISSIONS.services.read,
  PERMISSIONS.clients.read,
];

const buildTenantRoleTemplates = (
  adminPermissionNames: PermissionName[],
): TenantRoleTemplate[] => [
  {
    name: TENANT_BOOTSTRAP_ADMIN_ROLE_NAME,
    description: 'Rol administrador con acceso completo dentro de la empresa',
    permissionNames: adminPermissionNames,
  },
  {
    name: TENANT_BOOTSTRAP_OPERATOR_ROLE_NAME,
    description:
      'Puede gestionar tickets, clientes y servicios pero no administración global',
    permissionNames: TENANT_OPERATOR_PERMISSIONS,
  },
  {
    name: TENANT_BOOTSTRAP_VIEWER_ROLE_NAME,
    description: 'Solo lectura de tickets, clientes y servicios',
    permissionNames: TENANT_VIEWER_PERMISSIONS,
  },
];

const loadGlobalPermissionCatalog = async (tx: DbTransaction) =>
  tx
    .select({ id: permission.id, name: permission.name })
    .from(permission)
    .where(
      and(isNull(permission.company_id), isNull(permission.deleted_at)),
    );

const resolvePermissionIds = (
  permissionNames: PermissionName[],
  permissionIdByName: Map<string, number>,
): number[] => {
  const ids: number[] = [];
  for (const name of permissionNames) {
    const id = permissionIdByName.get(name);
    if (id == null) {
      throw new Error(`Missing global permission catalog row: ${name}`);
    }
    ids.push(id);
  }
  return ids;
};

export const resolveTenantOwnerPermissionIds = async (
  tx: DbTransaction,
): Promise<number[]> => {
  const rows = await loadGlobalPermissionCatalog(tx);
  const allowedNames = filterTenantAssignablePermissionNames(
    rows.map((row) => row.name),
  );
  const permissionIdByName = new Map(rows.map((row) => [row.name, row.id]));
  return resolvePermissionIds(
    allowedNames as PermissionName[],
    permissionIdByName,
  );
};

export const bootstrapCompanyTenant = async (
  input: CompanyBootstrapInput,
): Promise<CompanyBootstrapResult> => {
  const { db } = await import('@/lib/db');
  const settings = normalizeCompanySettingsForDb(input.company.settings);
  const hashedPassword = await hash(input.owner.password, 10);

  return db.transaction(async (tx) => {
    const [createdCompany] = await tx
      .insert(company)
      .values({
        name: input.company.name,
        phone: input.company.phone,
        email: input.company.email,
        logo: null,
        street: input.company.street,
        interior_number: input.company.interior_number?.trim()
          ? input.company.interior_number.trim()
          : null,
        exterior_number: input.company.exterior_number,
        neighborhood: input.company.neighborhood,
        city: input.company.city,
        state: input.company.state,
        country: input.company.country,
        postal_code: input.company.postal_code,
        status: 'SETUP',
        settings,
        is_system: false,
        updated_at: new Date(),
      })
      .returning();

    const catalogRows = await loadGlobalPermissionCatalog(tx);
    if (catalogRows.length === 0) {
      throw new Error('No global permissions available for tenant bootstrap');
    }

    const permissionIdByName = new Map(
      catalogRows.map((row) => [row.name, row.id]),
    );
    const adminPermissionNames = filterTenantAssignablePermissionNames(
      catalogRows.map((row) => row.name),
    ) as PermissionName[];
    const roleTemplates = buildTenantRoleTemplates(adminPermissionNames);
    const actor = input.actor;
    const targetCompanyId = createdCompany.id;
    let ownerRole: Role | null = null;

    for (const template of roleTemplates) {
      const permissionIds = resolvePermissionIds(
        template.permissionNames,
        permissionIdByName,
      );

      const [createdRole] = await tx
        .insert(role)
        .values({
          name: template.name,
          description: template.description,
          company_id: createdCompany.id,
          updated_at: new Date(),
        })
        .returning();

      await tx.insert(rolePermission).values(
        permissionIds.map((permissionId) => ({
          role_id: createdRole.id,
          permission_id: permissionId,
          created_at: new Date(),
        })),
      );

      if (template.name === TENANT_BOOTSTRAP_ADMIN_ROLE_NAME) {
        ownerRole = createdRole;
      }

      await recordGovernanceAudit(tx, {
        actor,
        resourceType: 'role',
        resourceId: createdRole.id,
        targetCompanyId,
        eventType: 'created',
        after: sanitizeRoleForAudit(createdRole, permissionIds),
      });
    }

    if (!ownerRole) {
      throw new Error('Tenant bootstrap failed to create the Admin role');
    }

    const [owner] = await tx
      .insert(user)
      .values({
        name: input.owner.name,
        email: input.owner.email.trim().toLowerCase(),
        password: hashedPassword,
        company_id: createdCompany.id,
        role_id: ownerRole.id,
        email_verified_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    await recordGovernanceAudit(tx, {
      actor,
      resourceType: 'company',
      resourceId: createdCompany.id,
      targetCompanyId,
      eventType: 'created',
      after: sanitizeCompanyForAudit(createdCompany),
    });

    await recordGovernanceAudit(tx, {
      actor,
      resourceType: 'user',
      resourceId: owner.id,
      targetCompanyId,
      eventType: 'created',
      after: sanitizeUserForAudit(owner),
    });

    return {
      company: createdCompany,
      owner,
      ownerRole,
    };
  });
};

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
import { PERMISSIONS, type PermissionName } from '@/lib/permissions';
import * as schema from '@/db/schema';

export const TENANT_OWNER_ROLE_DESCRIPTION =
  'Administrador del tenant con permisos operativos (sin administración global de empresas).';

/** Permissions granted to the default tenant owner role (global catalog rows only). */
export const TENANT_OWNER_EXCLUDED_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.companies.read,
  PERMISSIONS.companies.write,
];

export type CompanyBootstrapOwnerInput = {
  name: string;
  email: string;
  password: string;
};

export type CompanyBootstrapInput = {
  company: CompanyFormValues;
  owner: CompanyBootstrapOwnerInput;
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

export const tenantOwnerRoleName = (companyId: number): string =>
  `tenant-admin-${companyId}`;

export const filterTenantOwnerPermissionNames = (
  permissionNames: string[],
): string[] =>
  permissionNames.filter(
    (name) =>
      !TENANT_OWNER_EXCLUDED_PERMISSIONS.includes(name as PermissionName),
  );

export const resolveTenantOwnerPermissionIds = async (
  tx: DbTransaction,
): Promise<number[]> => {
  const rows = await tx
    .select({ id: permission.id, name: permission.name })
    .from(permission)
    .where(
      and(isNull(permission.company_id), isNull(permission.deleted_at)),
    );

  const allowedNames = filterTenantOwnerPermissionNames(
    rows.map((row) => row.name),
  );
  const allowedSet = new Set(allowedNames);

  return rows.filter((row) => allowedSet.has(row.name)).map((row) => row.id);
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

    const permissionIds = await resolveTenantOwnerPermissionIds(tx);
    if (permissionIds.length === 0) {
      throw new Error('No global permissions available for tenant bootstrap');
    }

    const [ownerRole] = await tx
      .insert(role)
      .values({
        name: tenantOwnerRoleName(createdCompany.id),
        description: TENANT_OWNER_ROLE_DESCRIPTION,
        company_id: createdCompany.id,
        updated_at: new Date(),
      })
      .returning();

    await tx.insert(rolePermission).values(
      permissionIds.map((permissionId) => ({
        role_id: ownerRole.id,
        permission_id: permissionId,
        created_at: new Date(),
      })),
    );

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

    return {
      company: createdCompany,
      owner,
      ownerRole,
    };
  });
};

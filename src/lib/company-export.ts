import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import {
  client,
  clientServiceSchedule,
  company,
  governanceAuditEvent,
  permission,
  role,
  rolePermission,
  service,
  servicesTickets,
  ticket,
  ticketAuditEvent,
  ticketPayment,
  user,
} from '@/db/schema';
import { db } from '@/lib/db';
import { sanitizeUserForAudit, toAuditJson } from '@/lib/governance-audit';
import { convertBigIntToString } from '@/lib/utils';
import { COMPANY_OFFBOARDING_RETENTION_POLICY } from '@/lib/company-offboarding';

export const COMPANY_EXPORT_VERSION = '1';

export type CompanyExportBundle = {
  export_version: typeof COMPANY_EXPORT_VERSION;
  generated_at: string;
  company_id: number;
  retention_policy: typeof COMPANY_OFFBOARDING_RETENTION_POLICY;
  counts: Record<string, number>;
  company: Record<string, unknown> | null;
  users: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  permissions: Record<string, unknown>[];
  role_permissions: Record<string, unknown>[];
  clients: Record<string, unknown>[];
  services: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
  services_tickets: Record<string, unknown>[];
  ticket_payments: Record<string, unknown>[];
  ticket_audit_events: Record<string, unknown>[];
  governance_audit_events: Record<string, unknown>[];
  client_service_schedules: Record<string, unknown>[];
};

const tenantCompanyScope = (companyId: number) => eq(company.id, companyId);

const tenantUsersScope = (companyId: number) =>
  eq(user.company_id, companyId);

const tenantRolesScope = (companyId: number) =>
  eq(role.company_id, companyId);

const tenantPermissionsScope = (companyId: number) =>
  or(eq(permission.company_id, companyId), isNull(permission.company_id));

const tenantClientsScope = (companyId: number) =>
  eq(client.company_id, companyId);

const tenantServicesScope = (companyId: number) =>
  eq(service.company_id, companyId);

const tenantTicketsScope = (companyId: number) =>
  eq(ticket.company_id, companyId);

const sanitizeExportRows = <T extends Record<string, unknown>>(
  rows: T[],
  sanitizer?: (row: T) => Record<string, unknown> | null,
): Record<string, unknown>[] =>
  rows
    .map((row) => (sanitizer ? sanitizer(row) : row))
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => convertBigIntToString(row) as Record<string, unknown>);

export const buildCompanyExportBundle = async (
  companyId: number,
): Promise<CompanyExportBundle | null> => {
  const [companyRow] = await db
    .select()
    .from(company)
    .where(tenantCompanyScope(companyId))
    .limit(1);

  if (!companyRow || companyRow.is_system) {
    return null;
  }

  const users = await db
    .select()
    .from(user)
    .where(tenantUsersScope(companyId));

  const roles = await db
    .select()
    .from(role)
    .where(tenantRolesScope(companyId));

  const roleIds = roles.map((row) => row.id);

  const permissions = await db
    .select()
    .from(permission)
    .where(tenantPermissionsScope(companyId));

  const rolePermissions =
    roleIds.length > 0
      ? await db
          .select()
          .from(rolePermission)
          .where(inArray(rolePermission.role_id, roleIds))
      : [];

  const clients = await db
    .select()
    .from(client)
    .where(tenantClientsScope(companyId));

  const services = await db
    .select()
    .from(service)
    .where(tenantServicesScope(companyId));

  const tickets = await db
    .select()
    .from(ticket)
    .where(tenantTicketsScope(companyId));

  const ticketIds = tickets.map((row) => row.id);

  const lineItems =
    ticketIds.length > 0
      ? await db
          .select()
          .from(servicesTickets)
          .where(inArray(servicesTickets.ticket_id, ticketIds))
      : [];

  const payments =
    ticketIds.length > 0
      ? await db
          .select()
          .from(ticketPayment)
          .where(
            and(
              eq(ticketPayment.company_id, companyId),
              inArray(ticketPayment.ticket_id, ticketIds),
            ),
          )
      : [];

  const ticketAuditEvents =
    ticketIds.length > 0
      ? await db
          .select()
          .from(ticketAuditEvent)
          .where(
            and(
              eq(ticketAuditEvent.company_id, companyId),
              inArray(ticketAuditEvent.ticket_id, ticketIds),
            ),
          )
      : [];

  const governanceAuditEvents = await db
    .select()
    .from(governanceAuditEvent)
    .where(eq(governanceAuditEvent.company_id, companyId));

  const schedules = await db
    .select()
    .from(clientServiceSchedule)
    .where(eq(clientServiceSchedule.company_id, companyId));

  const sanitizedUsers = sanitizeExportRows(users, (row) =>
    sanitizeUserForAudit(row),
  );

  const bundle: CompanyExportBundle = {
    export_version: COMPANY_EXPORT_VERSION,
    generated_at: new Date().toISOString(),
    company_id: companyId,
    retention_policy: COMPANY_OFFBOARDING_RETENTION_POLICY,
    counts: {
      users: sanitizedUsers.length,
      roles: roles.length,
      permissions: permissions.length,
      role_permissions: rolePermissions.length,
      clients: clients.length,
      services: services.length,
      tickets: tickets.length,
      services_tickets: lineItems.length,
      ticket_payments: payments.length,
      ticket_audit_events: ticketAuditEvents.length,
      governance_audit_events: governanceAuditEvents.length,
      client_service_schedules: schedules.length,
    },
    company: convertBigIntToString(companyRow) as Record<string, unknown>,
    users: sanitizedUsers,
    roles: sanitizeExportRows(roles),
    permissions: sanitizeExportRows(permissions),
    role_permissions: sanitizeExportRows(rolePermissions),
    clients: sanitizeExportRows(clients),
    services: sanitizeExportRows(services),
    tickets: sanitizeExportRows(tickets),
    services_tickets: sanitizeExportRows(lineItems),
    ticket_payments: sanitizeExportRows(payments),
    ticket_audit_events: sanitizeExportRows(
      ticketAuditEvents.map((row) => ({
        ...row,
        payload: toAuditJson(row.payload),
      })),
    ),
    governance_audit_events: sanitizeExportRows(
      governanceAuditEvents.map((row) => ({
        ...row,
        payload: toAuditJson(row.payload),
      })),
    ),
    client_service_schedules: sanitizeExportRows(schedules),
  };

  return bundle;
};

export const serializeCompanyExportBundle = (
  bundle: CompanyExportBundle,
): string => JSON.stringify(bundle, null, 2);

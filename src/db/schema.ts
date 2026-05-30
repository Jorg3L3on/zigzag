import { relations, sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const companyStatusEnum = pgEnum('CompanyStatus', [
  'SETUP',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
  'INACTIVE',
]);

export type CompanyLifecycleStatus =
  | 'SETUP'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'ARCHIVED';

export type CompanySettingsJson = {
  rfc?: string;
  invoice_footer_note?: string;
  default_currency?: string;
};

export const company = pgTable(
  'Company',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    logo: text('logo'),
    is_system: boolean('is_system').notNull().default(false),
    street: text('street').notNull(),
    interior_number: text('interior_number'),
    exterior_number: text('exterior_number').notNull(),
    neighborhood: text('neighborhood').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    country: text('country').notNull(),
    postal_code: text('postal_code').notNull(),
    status: companyStatusEnum('status').notNull().default('ACTIVE'),
    settings: jsonb('settings').$type<CompanySettingsJson | null>(),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
  },
  (t) => [uniqueIndex('Company_name_key').on(t.name)],
);

export const role = pgTable(
  'Role',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
    company_id: integer('company_id').references(() => company.id),
  },
  (t) => [
    uniqueIndex('Role_name_key').on(t.name),
    index('Role_company_id_idx').on(t.company_id),
  ],
);

export const permission = pgTable(
  'Permission',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
    company_id: integer('company_id').references(() => company.id),
  },
  (t) => [
    uniqueIndex('Permission_name_key').on(t.name),
    index('Permission_company_id_idx').on(t.company_id),
  ],
);

export const user = pgTable(
  'User',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    email_verified_at: timestamp('email_verified_at', {
      precision: 3,
      mode: 'date',
    }),
    password: text('password').notNull(),
    remember_token: text('remember_token'),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
    company_id: integer('company_id').references(() => company.id),
    role_id: integer('role_id').references(() => role.id),
  },
  (t) => [
    uniqueIndex('User_email_key').on(t.email),
    index('User_company_id_idx').on(t.company_id),
    index('User_role_id_idx').on(t.role_id),
  ],
);

export const client = pgTable(
  'Client',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: varchar('email', { length: 100 }),
    phone: varchar('phone', { length: 20 }),
    document: varchar('document', { length: 100 }),
    address: text('address'),
    street: text('street'),
    exterior_number: text('exterior_number'),
    interior_number: text('interior_number'),
    neighborhood: text('neighborhood'),
    city: text('city'),
    state: text('state'),
    postal_code: text('postal_code'),
    country: text('country'),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
    company_id: integer('company_id'),
  },
  (t) => [index('Client_company_id_idx').on(t.company_id)],
);

export const service = pgTable(
  'Service',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    price: doublePrecision('price').notNull(),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
    company_id: integer('company_id'),
  },
  (t) => [index('Service_company_id_idx').on(t.company_id)],
);

export const ticket = pgTable(
  'Ticket',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    client_id: integer('client_id'),
    client_name: varchar('client_name', { length: 100 }),
    client_tel: varchar('client_tel', { length: 10 }),
    ticket_date: timestamp('ticket_date', { precision: 3, mode: 'date' }),
    total: doublePrecision('total'),
    paid: doublePrecision('paid'),
    email: varchar('email', { length: 40 }),
    finished: boolean('finished').notNull().default(false),
    document: varchar('document', { length: 100 }),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
    company_id: integer('company_id'),
    userId: bigint('userId', { mode: 'bigint' }),
  },
  (t) => [
    index('Ticket_company_id_idx').on(t.company_id),
    index('Ticket_client_id_idx').on(t.client_id),
  ],
);

export const servicesTickets = pgTable(
  'ServicesTickets',
  {
    id: serial('id').primaryKey(),
    service_id: integer('service_id').notNull(),
    ticket_id: bigint('ticket_id', { mode: 'bigint' }).notNull(),
    quantity: integer('quantity').notNull(),
    price: doublePrecision('price').notNull(),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
  },
  (t) => [
    index('ServicesTickets_service_id_idx').on(t.service_id),
    index('ServicesTickets_ticket_id_idx').on(t.ticket_id),
  ],
);

export const clientServiceSchedule = pgTable(
  'ClientServiceSchedule',
  {
    id: serial('id').primaryKey(),
    company_id: integer('company_id').notNull(),
    client_id: integer('client_id').notNull(),
    service_id: integer('service_id').notNull(),
    interval_value: integer('interval_value').notNull(),
    interval_unit: varchar('interval_unit', { length: 10 }).notNull(),
    last_service_at: timestamp('last_service_at', { precision: 3, mode: 'date' }),
    next_due_at: timestamp('next_due_at', { precision: 3, mode: 'date' }).notNull(),
    paused_at: timestamp('paused_at', { precision: 3, mode: 'date' }),
    pause_reason: text('pause_reason'),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
    updated_at: timestamp('updated_at', { precision: 3, mode: 'date' }),
    deleted_at: timestamp('deleted_at', { precision: 3, mode: 'date' }),
  },
  (t) => [
    index('ClientServiceSchedule_company_id_idx').on(t.company_id),
    index('ClientServiceSchedule_next_due_at_idx').on(t.next_due_at),
    index('ClientServiceSchedule_client_id_idx').on(t.client_id),
    uniqueIndex('ClientServiceSchedule_company_client_service_uidx')
      .on(t.company_id, t.client_id, t.service_id)
      .where(sql`${t.deleted_at} is null`),
  ],
);

/** Registro de cada abono o cobro aplicado al ticket (historial). */
export const ticketPayment = pgTable(
  'TicketPayment',
  {
    id: serial('id').primaryKey(),
    ticket_id: bigint('ticket_id', { mode: 'bigint' }).notNull(),
    amount: doublePrecision('amount').notNull(),
    company_id: integer('company_id'),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('TicketPayment_ticket_id_idx').on(t.ticket_id),
    index('TicketPayment_company_id_idx').on(t.company_id),
  ],
);

export const ticketAuditEvent = pgTable(
  'TicketAuditEvent',
  {
    id: serial('id').primaryKey(),
    ticket_id: bigint('ticket_id', { mode: 'bigint' }).notNull(),
    company_id: integer('company_id'),
    actor_user_id: bigint('actor_user_id', { mode: 'bigint' }),
    event_type: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown> | null>(),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('TicketAuditEvent_ticket_id_idx').on(t.ticket_id),
    index('TicketAuditEvent_company_id_idx').on(t.company_id),
    index('TicketAuditEvent_actor_user_id_idx').on(t.actor_user_id),
  ],
);

export const rolePermission = pgTable(
  'RolePermission',
  {
    role_id: integer('role_id')
      .notNull()
      .references(() => role.id),
    permission_id: integer('permission_id')
      .notNull()
      .references(() => permission.id),
    created_at: timestamp('created_at', { precision: 3, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.role_id, t.permission_id] }),
    index('RolePermission_role_id_idx').on(t.role_id),
    index('RolePermission_permission_id_idx').on(t.permission_id),
  ],
);

export const companyRelations = relations(company, ({ many }) => ({
  users: many(user),
  tickets: many(ticket),
  services: many(service),
  clients: many(client),
  roles: many(role),
  permissions: many(permission),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  company: one(company, { fields: [user.company_id], references: [company.id] }),
  role: one(role, { fields: [user.role_id], references: [role.id] }),
  tickets: many(ticket),
}));

export const roleRelations = relations(role, ({ one, many }) => ({
  company: one(company, { fields: [role.company_id], references: [company.id] }),
  permissions: many(rolePermission),
  users: many(user),
}));

export const permissionRelations = relations(permission, ({ one, many }) => ({
  company: one(company, {
    fields: [permission.company_id],
    references: [company.id],
  }),
  roles: many(rolePermission),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(role, { fields: [rolePermission.role_id], references: [role.id] }),
  permission: one(permission, {
    fields: [rolePermission.permission_id],
    references: [permission.id],
  }),
}));

export const clientRelations = relations(client, ({ one, many }) => ({
  company: one(company, { fields: [client.company_id], references: [company.id] }),
  tickets: many(ticket),
  service_schedules: many(clientServiceSchedule),
}));

export const serviceRelations = relations(service, ({ one, many }) => ({
  company: one(company, { fields: [service.company_id], references: [company.id] }),
  services_tickets: many(servicesTickets),
  client_schedules: many(clientServiceSchedule),
}));

export const clientServiceScheduleRelations = relations(
  clientServiceSchedule,
  ({ one }) => ({
    company: one(company, {
      fields: [clientServiceSchedule.company_id],
      references: [company.id],
    }),
    client: one(client, {
      fields: [clientServiceSchedule.client_id],
      references: [client.id],
    }),
    service: one(service, {
      fields: [clientServiceSchedule.service_id],
      references: [service.id],
    }),
  }),
);

export const ticketRelations = relations(ticket, ({ one, many }) => ({
  company: one(company, { fields: [ticket.company_id], references: [company.id] }),
  client: one(client, { fields: [ticket.client_id], references: [client.id] }),
  User: one(user, { fields: [ticket.userId], references: [user.id] }),
  services_tickets: many(servicesTickets),
  ticket_payments: many(ticketPayment),
  audit_events: many(ticketAuditEvent),
}));

export const ticketPaymentRelations = relations(ticketPayment, ({ one }) => ({
  ticket: one(ticket, {
    fields: [ticketPayment.ticket_id],
    references: [ticket.id],
  }),
}));

export const ticketAuditEventRelations = relations(ticketAuditEvent, ({ one }) => ({
  ticket: one(ticket, {
    fields: [ticketAuditEvent.ticket_id],
    references: [ticket.id],
  }),
  actor: one(user, {
    fields: [ticketAuditEvent.actor_user_id],
    references: [user.id],
  }),
}));

export const servicesTicketsRelations = relations(servicesTickets, ({ one }) => ({
  service: one(service, {
    fields: [servicesTickets.service_id],
    references: [service.id],
  }),
  ticket: one(ticket, {
    fields: [servicesTickets.ticket_id],
    references: [ticket.id],
  }),
}));

/** UI / API row types derived from the Drizzle schema. */
export type Company = typeof company.$inferSelect;
export type User = typeof user.$inferSelect;
export type Role = typeof role.$inferSelect;
export type Permission = typeof permission.$inferSelect;
export type Client = typeof client.$inferSelect;
export type ClientRow = typeof client.$inferSelect;
/** Service row (table `Service`) */
export type Service = typeof service.$inferSelect;
export type ServiceRow = typeof service.$inferSelect;
export type TicketRow = typeof ticket.$inferSelect;
export type TicketPaymentRow = typeof ticketPayment.$inferSelect;
export type TicketAuditEventRow = typeof ticketAuditEvent.$inferSelect;
export type ServicesTicketsRow = typeof servicesTickets.$inferSelect;
export type ClientServiceScheduleRow = typeof clientServiceSchedule.$inferSelect;
export type RolePermissionRow = typeof rolePermission.$inferSelect;

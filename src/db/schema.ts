import { relations } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const company = pgTable(
  'Company',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    address: text('address').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull(),
    logo: text('logo'),
    is_system: boolean('is_system').notNull().default(false),
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
    company_id: integer('company_id'),
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
    company_id: integer('company_id'),
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
    company_id: integer('company_id'),
    role_id: integer('role_id'),
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

export const rolePermission = pgTable(
  'RolePermission',
  {
    role_id: integer('role_id').notNull(),
    permission_id: integer('permission_id').notNull(),
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
}));

export const serviceRelations = relations(service, ({ one, many }) => ({
  company: one(company, { fields: [service.company_id], references: [company.id] }),
  services_tickets: many(servicesTickets),
}));

export const ticketRelations = relations(ticket, ({ one, many }) => ({
  company: one(company, { fields: [ticket.company_id], references: [company.id] }),
  client: one(client, { fields: [ticket.client_id], references: [client.id] }),
  User: one(user, { fields: [ticket.userId], references: [user.id] }),
  services_tickets: many(servicesTickets),
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

/** UI / API row types (replaces `@/generated/prisma/client` imports) */
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
export type ServicesTicketsRow = typeof servicesTickets.$inferSelect;
export type RolePermissionRow = typeof rolePermission.$inferSelect;

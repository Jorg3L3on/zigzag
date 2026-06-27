import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import {
  company,
  permission,
  role,
  rolePermission,
  service,
  servicesTickets,
  ticket,
  user,
} from '../src/db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

const TABLES_NEED_SEQUENCE_SYNC = [
  'Company',
  'Service',
  'Ticket',
  'ServicesTickets',
  'User',
  'Role',
  'Permission',
] as const;

async function syncPostgresIdSequences() {
  for (const table of TABLES_NEED_SEQUENCE_SYNC) {
    await db.execute(
      sql.raw(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id')::regclass, (SELECT MAX(id) FROM "${table}"))`,
      ),
    );
  }
}

async function main() {
  // Reset to keep local seed deterministic.
  await db.execute(
    sql`TRUNCATE TABLE "RolePermission", "Role", "Permission", "ServicesTickets", "Ticket", "Client", "User", "Service", "Company" RESTART IDENTITY CASCADE`,
  );

  await db.insert(company).values([
    {
      id: 1,
      name: 'SOLUCIONES CHANO',
      street: 'C. Camarote',
      exterior_number: '121',
      neighborhood: 'Centro',
      city: 'Ponce',
      state: 'Puerto Rico',
      country: 'México',
      postal_code: '00716',
      phone: '(939) 165-46-35',
      email: 'chano@test.com',
      logo: null,
      is_system: false,
      status: 'ACTIVE',
      settings: { rfc: 'SCH010101AAA', default_currency: 'MXN' },
    },
    {
      id: 2,
      name: 'zigzag',
      street: 'C. Camarote',
      exterior_number: '121',
      neighborhood: 'Centro',
      city: 'Ponce',
      state: 'Puerto Rico',
      country: 'México',
      postal_code: '00716',
      phone: '(939) 165-46-35',
      email: 'zigzag@test.com',
      logo: '/icons/icon-192.png',
      is_system: true,
      status: 'ACTIVE',
      settings: { rfc: 'ZZG010101AAA', default_currency: 'MXN' },
    },
    {
      id: 3,
      name: 'Empresa de prueba',
      street: 'direccion',
      exterior_number: 'S/N',
      neighborhood: 'Centro',
      city: 'Ponce',
      state: 'Puerto Rico',
      country: 'México',
      postal_code: '00716',
      phone: '999',
      email: 'empresa@test.com',
      logo: null,
      is_system: false,
      status: 'ACTIVE',
      settings: { rfc: 'EPR010101AAA', default_currency: 'MXN' },
    },
  ]);

  // Seed base permissions used in code (global, company_id = null)
  await db.insert(permission).values([
    // Tickets
    {
      id: 1,
      name: 'tickets.read',
      description: 'Puede ver tickets',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      name: 'tickets.write',
      description: 'Puede crear y editar tickets',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Services
    {
      id: 3,
      name: 'services.read',
      description: 'Puede ver servicios',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 4,
      name: 'services.write',
      description: 'Puede crear y editar servicios',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Clients
    {
      id: 5,
      name: 'clients.read',
      description: 'Puede ver clientes',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 6,
      name: 'clients.write',
      description: 'Puede crear y editar clientes',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Users
    {
      id: 7,
      name: 'users.read',
      description: 'Puede ver usuarios',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 8,
      name: 'users.write',
      description: 'Puede crear y editar usuarios',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Roles
    {
      id: 9,
      name: 'roles.read',
      description: 'Puede ver roles',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 10,
      name: 'roles.write',
      description: 'Puede crear y editar roles',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Permissions
    {
      id: 11,
      name: 'permissions.read',
      description: 'Puede ver permisos',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 12,
      name: 'permissions.write',
      description: 'Puede crear y editar permisos',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Companies
    {
      id: 13,
      name: 'companies.read',
      description: 'Puede ver empresas',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 14,
      name: 'companies.write',
      description: 'Puede crear y editar empresas',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    // Own company self-administration (tenant scope)
    {
      id: 15,
      name: 'company.manage',
      description: 'Puede administrar su propia empresa (perfil, logo, datos)',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  // Seed roles (global, company-agnostic)
  await db.insert(role).values([
    {
      id: 1,
      name: 'Admin',
      description: 'Rol administrador con acceso completo',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 2,
      name: 'Operator',
      description:
        'Puede gestionar tickets, clientes y servicios pero no administración global',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: 3,
      name: 'Viewer',
      description: 'Solo lectura de tickets, clientes y servicios',
      company_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);

  // Assign permissions to roles
  await db.insert(rolePermission).values([
    // Admin: all permissions (1–15)
    ...Array.from({ length: 15 }, (_, idx) => ({
      role_id: 1,
      permission_id: idx + 1,
      created_at: new Date(),
    })),
    // Operator: read/write tickets, services, clients; read users; read companies
    { role_id: 2, permission_id: 1, created_at: new Date() }, // tickets.read
    { role_id: 2, permission_id: 2, created_at: new Date() }, // tickets.write
    { role_id: 2, permission_id: 3, created_at: new Date() }, // services.read
    { role_id: 2, permission_id: 4, created_at: new Date() }, // services.write
    { role_id: 2, permission_id: 5, created_at: new Date() }, // clients.read
    { role_id: 2, permission_id: 6, created_at: new Date() }, // clients.write
    { role_id: 2, permission_id: 7, created_at: new Date() }, // users.read
    { role_id: 2, permission_id: 13, created_at: new Date() }, // companies.read
    { role_id: 2, permission_id: 15, created_at: new Date() }, // company.manage
    // Viewer: read tickets, services, clients
    { role_id: 3, permission_id: 1, created_at: new Date() }, // tickets.read
    { role_id: 3, permission_id: 3, created_at: new Date() }, // services.read
    { role_id: 3, permission_id: 5, created_at: new Date() }, // clients.read
  ]);

  await db.insert(user).values([
    {
      id: 1n,
      name: 'jorge',
      email: 'jorgeleon983@outlook.com',
      company_id: 1,
      role_id: 1,
      password:
        '$2b$12$6SjcCwTOEYxnZwWPprPg9OrS5QIJ.g8axo3OpmE7CGfJUhx9fwlHK',
    },
    {
      id: 2n,
      name: 'jorg',
      email: 'jorge@jorge.com',
      company_id: 2,
      role_id: 1,
      password:
        '$2b$12$6SjcCwTOEYxnZwWPprPg9OrS5QIJ.g8axo3OpmE7CGfJUhx9fwlHK',
    },
    {
      id: 3n,
      name: 'carmen',
      email: 'carmen@solorzano.com',
      company_id: 3,
      role_id: 2,
      password:
        '$2b$10$/LQ52AQ6cG.uC9AleMV72OdDLVrcNpvcNp6.w5V6O2grk9Dd7ZCPO',
    },
    {
      id: 4n,
      name: 'viewer',
      email: 'viewer@test.com',
      company_id: 1,
      role_id: 3,
      password:
        '$2b$12$6SjcCwTOEYxnZwWPprPg9OrS5QIJ.g8axo3OpmE7CGfJUhx9fwlHK',
    },
  ]);

  await db.insert(service).values([
    {
      id: 1,
      name: 'Mantenimiento A/C',
      description: 'Description for Mantenimiento A/C',
      price: 700.0,
      company_id: 1,
    },
    {
      id: 2,
      name: 'Instalación A/C',
      description: 'Description for Instalación A/C',
      price: 3900.0,
      company_id: 1,
    },
    {
      id: 3,
      name: 'Limpiar alfombras',
      description: 'Alfombras limpias',
      price: 59.99,
      company_id: 1,
    },
    {
      id: 4,
      name: 'Diagnóstico general',
      description: 'Inspección y diagnóstico',
      price: 250.0,
      company_id: 2,
    },
  ]);

  await db.insert(ticket).values([
    {
      id: 1n,
      client_name: 'Hotel Bugambilias',
      client_tel: '9613151559',
      ticket_date: new Date('2025-06-02'),
      email: 'admin@example.com',
      finished: true,
      total: 240.17,
      company_id: 1,
      userId: 1n,
    },
    {
      id: 2n,
      client_name: 'TELMEX 1',
      client_tel: '9613151559',
      ticket_date: new Date('2025-06-09'),
      email: 'jorge@jorge.com',
      finished: false,
      total: 250.0,
      company_id: 2,
      userId: 2n,
    },
  ]);

  await db.insert(servicesTickets).values([
    {
      id: 1,
      service_id: 1,
      ticket_id: 1n,
      price: 700.0,
      quantity: 1,
    },
    {
      id: 2,
      service_id: 3,
      ticket_id: 1n,
      price: 59.99,
      quantity: 2,
    },
    {
      id: 3,
      service_id: 4,
      ticket_id: 2n,
      price: 250.0,
      quantity: 1,
    },
  ]);

  await syncPostgresIdSequences();
}

main()
  .then(async () => {
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });

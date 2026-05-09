import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { company, service, servicesTickets, ticket, user } from '../src/db/schema';

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
    sql`TRUNCATE TABLE "ServicesTickets", "Ticket", "Client", "User", "Service", "Company" RESTART IDENTITY CASCADE`,
  );

  await db.insert(company).values([
    {
      id: 1,
      name: 'SOLUCIONES CHANO',
      address: 'C. Camarote #121',
      phone: '(939) 165-46-35',
      email: 'chano@test.com',
      logo: null,
      is_system: false,
    },
    {
      id: 2,
      name: 'zigzag',
      address: 'C. Camarote #121',
      phone: '(939) 165-46-35',
      email: 'zigzag@test.com',
      logo: '/favicon.ico',
      is_system: true,
    },
    {
      id: 3,
      name: 'Empresa de prueba',
      address: 'direccion',
      phone: '999',
      email: 'empresa@test.com',
      logo: '',
      is_system: false,
    },
  ]);

  await db.insert(user).values([
    {
      id: 1n,
      name: 'jorge',
      email: 'jorgeleon983@outlook.com',
      company_id: 1,
      password:
        '$2b$12$6SjcCwTOEYxnZwWPprPg9OrS5QIJ.g8axo3OpmE7CGfJUhx9fwlHK',
    },
    {
      id: 2n,
      name: 'jorg',
      email: 'jorge@jorge.com',
      company_id: 2,
      password:
        '$2b$12$6SjcCwTOEYxnZwWPprPg9OrS5QIJ.g8axo3OpmE7CGfJUhx9fwlHK',
    },
    {
      id: 3n,
      name: 'carmen',
      email: 'carmen@solorzano.com',
      company_id: 3,
      password:
        '$2b$10$/LQ52AQ6cG.uC9AleMV72OdDLVrcNpvcNp6.w5V6O2grk9Dd7ZCPO',
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

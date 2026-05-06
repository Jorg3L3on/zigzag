import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import { company, service, servicesTickets, ticket, user } from '../src/db/schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

async function main() {
  await db.insert(company).values({
    id: 1,
    name: 'Root Company',
    address: 'Local Address',
    phone: '0000000000',
    email: 'root@local.dev',
    is_system: true,
  });

  await db.insert(service).values([
    {
      id: 1,
      name: 'Mantenimiento A/C',
      description: 'Mantenimiento general de aire acondicionado',
      price: 700.0,
    },
    {
      id: 2,
      name: 'Instalación A/C',
      description: 'Instalación de nuevo equipo de aire acondicionado',
      price: 1200.0,
    },
    {
      id: 3,
      name: 'Revisión de forros de tuvería',
      description: 'Revisión y ajuste de forros de tubería',
      price: 0.0,
    },
    {
      id: 4,
      name: 'Ajuste de presión de Refrigerador',
      description: 'Ajuste de presión en sistema de refrigeración',
      price: 0.0,
    },
    {
      id: 5,
      name: 'Lavado de condensador',
      description: 'Limpieza y lavado de condensador',
      price: 0.0,
    },
    {
      id: 6,
      name: 'Desmontar equipo',
      description: 'Desmontaje de equipo de aire acondicionado',
      price: 0.0,
    },
  ]);

  await db.insert(ticket).values([
    {
      id: 1n,
      client_name: 'Primera prueba',
      client_tel: '9613151559',
      ticket_date: new Date('2024-10-02'),
      email: 'jorgeleon983@gmail.com',
      finished: false,
      created_at: new Date('2024-10-03T08:20:32'),
      updated_at: new Date('2024-10-03T08:20:32'),
    },
    {
      id: 2n,
      client_name: 'Segunda prueba',
      client_tel: '9613151559',
      ticket_date: new Date('2024-10-01'),
      email: 'jorgeleon983@gmail.com',
      finished: false,
      created_at: new Date('2024-10-03T08:31:56'),
      updated_at: new Date('2024-10-03T08:31:56'),
    },
  ]);

  await db.insert(servicesTickets).values({
    id: 1,
    service_id: 2,
    ticket_id: 1n,
    price: 1200.0,
    quantity: 1,
    created_at: new Date('2024-10-03T08:22:41'),
    updated_at: new Date('2024-10-03T08:22:41'),
  });

  await db.insert(user).values({
    id: 1n,
    name: 'jorge',
    email: 'jorgeleon983@outlook.com',
    company_id: 1,
    password:
      '$2b$12$XRd9/lHxdk7pzGgss6VIEuHvGFImk0198cPJRyEYOsXKSYTImV2pi',
    created_at: new Date('2024-10-03T08:15:18'),
    updated_at: new Date('2024-10-03T08:15:18'),
  });
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

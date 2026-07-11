import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  addDays,
  addMonths,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';
import {
  client,
  clientServiceSchedule,
  company,
  notification,
  service,
  servicesTickets,
  ticket,
  ticketAuditEvent,
  ticketPayment,
  user,
} from '../src/db/schema';
import {
  DEMO_ADMIN_EMAIL,
  DEMO_COMPANY_EMAIL,
  DEMO_COMPANY_LOGO_PATH,
  DEMO_COMPANY_NAME,
  DEMO_OPERATOR_EMAIL,
  DEMO_SHOWCASE_CLIENT_NAME,
  DEMO_SHOWCASE_TICKET_ID,
  DEMO_VIEWER_EMAIL,
} from '../src/lib/demo-company';
import { materializeScheduleNotificationsForCompany } from '../src/lib/notifications';

const DEFAULT_PASSWORD =
  '$2b$12$6SjcCwTOEYxnZwWPprPg9OrS5QIJ.g8axo3OpmE7CGfJUhx9fwlHK';

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const DEMO_SERVICES = [
  {
    name: 'Mantenimiento preventivo A/C',
    description: 'Revisión de filtros, gas, bandejas y rendimiento del equipo.',
    price: 850,
  },
  {
    name: 'Instalación mini-split',
    description: 'Instalación completa de equipo split incluyendo línea fría.',
    price: 4200,
  },
  {
    name: 'Diagnóstico técnico',
    description: 'Inspección eléctrica y de refrigeración con reporte.',
    price: 320,
  },
  {
    name: 'Limpieza profunda de ductos',
    description: 'Desinfección y limpieza de ductos de aire acondicionado.',
    price: 1450,
  },
  {
    name: 'Recarga de gas refrigerante',
    description: 'Recarga R410A con prueba de fugas.',
    price: 980,
  },
  {
    name: 'Servicio de urgencia 24h',
    description: 'Atención prioritaria fuera de horario laboral.',
    price: 1600,
  },
  {
    name: 'Mantenimiento de cuarto frío',
    description: 'Calibración de temperatura y revisión de compresores.',
    price: 2100,
  },
  {
    name: 'Instalación de termostato inteligente',
    description: 'Configuración Wi-Fi y zonificación básica.',
    price: 650,
  },
  {
    name: 'Limpieza de evaporadora',
    description: 'Lavado químico de serpentín y drenaje.',
    price: 540,
  },
  {
    name: 'Contrato anual de mantenimiento',
    description: 'Cuatro visitas programadas por sitio al año.',
    price: 3600,
  },
] as const;

const DEMO_CLIENTS = [
  { name: 'Hotel Riviera Dorada', city: 'Cancún', email: 'reservaciones@rivieradorada.demo' },
  { name: 'Plaza Comercial Aurora', city: 'Mérida', email: 'operaciones@aurora.demo' },
  { name: 'Residencial Las Palmas', city: 'Playa del Carmen', email: 'admin@laspalmas.demo' },
  { name: 'Hospital Regional del Sureste', city: 'Villahermosa', email: 'mantenimiento@hrsureste.demo' },
  { name: 'Universidad TecnoSur', city: 'Tuxtla Gutiérrez', email: 'facilities@tecnosur.demo' },
  { name: 'Restaurante Mar & Tierra', city: 'Campeche', email: 'gerencia@martyerra.demo' },
  { name: 'Centro Logístico Norte', city: 'Monterrey', email: 'ops@logisticonorte.demo' },
  { name: 'Gimnasio FitPro Elite', city: 'Cancún', email: 'soporte@fitproelite.demo' },
  { name: 'Oficinas Corporativas Altus', city: 'Mérida', email: 'facilities@altus.demo' },
  { name: 'Clínica Dental Sonrisa', city: 'Chetumal', email: 'clinica@sonrisa.demo' },
  { name: 'Supermercado La Canasta', city: 'Cozumel', email: 'tienda@lacanasta.demo' },
  { name: 'Manufactura DeltaPack', city: 'Puebla', email: 'planta@deltapack.demo' },
  { name: 'Hotel Boutique Casa Blanca', city: 'San Miguel de Allende', email: 'hotel@casablanca.demo' },
  { name: 'Coworking Nodo Centro', city: 'Querétaro', email: 'community@nodo.demo' },
  { name: 'Spa Agua Serena', city: 'Tulum', email: 'spa@aguaserena.demo' },
  { name: 'Escuela Bilingüe Horizonte', city: 'Mérida', email: 'direccion@horizonte.demo' },
  { name: 'Farmacia Salud Total', city: 'Valladolid', email: 'sucursal@saludtotal.demo' },
  { name: 'Centro de Datos CloudMX', city: 'León', email: 'noc@cloudmx.demo' },
  { name: 'Museo de Arte Contemporáneo', city: 'Oaxaca', email: 'operaciones@maco.demo' },
  { name: 'Terminal de Autobuses del Caribe', city: 'Cancún', email: 'terminal@caribe.demo' },
] as const;

export type SeedDemoCompanyOptions = {
  /** When set (e.g. from `scripts/seed.ts`), use this company id. */
  fixedCompanyId?: number;
  adminUserId?: bigint;
  operatorUserId?: bigint;
  viewerUserId?: bigint;
  /** Reference date for relative ticket/schedule history. Defaults to now. */
  referenceDate?: Date;
};

export type SeedDemoCompanyResult = {
  companyId: number;
  adminUserId: bigint;
  showcaseTicketId: bigint;
  clientCount: number;
  serviceCount: number;
  ticketCount: number;
  scheduleCount: number;
};

const cleanupDemoCompanyData = async (
  db: ReturnType<typeof drizzle>,
  companyId: number,
) => {
  const demoEmails = [
    DEMO_ADMIN_EMAIL,
    DEMO_OPERATOR_EMAIL,
    DEMO_VIEWER_EMAIL,
  ];

  await db.execute(sql`
    DELETE FROM "Notification" WHERE "company_id" = ${companyId}
  `);
  await db.execute(sql`
    DELETE FROM "TicketAuditEvent"
    WHERE "company_id" = ${companyId}
       OR "ticket_id" IN (SELECT "id" FROM "Ticket" WHERE "company_id" = ${companyId})
  `);
  await db.execute(sql`
    DELETE FROM "TicketPayment"
    WHERE "company_id" = ${companyId}
       OR "ticket_id" IN (SELECT "id" FROM "Ticket" WHERE "company_id" = ${companyId})
  `);
  await db.execute(sql`
    DELETE FROM "ServicesTickets"
    WHERE "ticket_id" IN (SELECT "id" FROM "Ticket" WHERE "company_id" = ${companyId})
  `);
  await db.execute(sql`
    DELETE FROM "Ticket" WHERE "company_id" = ${companyId}
  `);
  await db.execute(sql`
    DELETE FROM "ClientServiceSchedule" WHERE "company_id" = ${companyId}
  `);
  await db.execute(sql`
    DELETE FROM "Client" WHERE "company_id" = ${companyId}
  `);
  await db.execute(sql`
    DELETE FROM "Service" WHERE "company_id" = ${companyId}
  `);
  await db.delete(user).where(
    and(eq(user.company_id, companyId), inArray(user.email, demoEmails)),
  );
};

const upsertDemoCompany = async (
  db: ReturnType<typeof drizzle>,
  fixedCompanyId?: number,
) => {
  const profile = {
    name: DEMO_COMPANY_NAME,
    street: 'Av. Insurgentes Sur',
    exterior_number: '1602',
    interior_number: 'Piso 8',
    neighborhood: 'Crédito Constructor',
    city: 'Ciudad de México',
    state: 'CDMX',
    country: 'México',
    postal_code: '03940',
    phone: '+52 55 4123 8900',
    email: DEMO_COMPANY_EMAIL,
    logo: DEMO_COMPANY_LOGO_PATH,
    is_system: false,
    status: 'ACTIVE' as const,
    plan_id: 3,
    settings: {
      rfc: 'CTD010101ABC',
      default_currency: 'MXN',
      plan: 'enterprise' as const,
      invoice_footer_note:
        'Gracias por confiar en ClimaTotal Demo — soluciones integrales en climatización.',
    },
    updated_at: new Date(),
  };

  if (fixedCompanyId != null) {
    await db
      .insert(company)
      .values({ id: fixedCompanyId, ...profile })
      .onConflictDoUpdate({
        target: company.id,
        set: profile,
      });
    return fixedCompanyId;
  }

  const [existing] = await db
    .select({ id: company.id })
    .from(company)
    .where(eq(company.name, DEMO_COMPANY_NAME))
    .limit(1);

  if (existing) {
    await cleanupDemoCompanyData(db, existing.id);
    await db.update(company).set(profile).where(eq(company.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db.insert(company).values(profile).returning({
    id: company.id,
  });
  return inserted.id;
};

export const seedDemoCompany = async (
  db: ReturnType<typeof drizzle>,
  options: SeedDemoCompanyOptions = {},
): Promise<SeedDemoCompanyResult> => {
  const now = options.referenceDate ?? new Date();
  const companyId = await upsertDemoCompany(db, options.fixedCompanyId);

  if (options.fixedCompanyId != null) {
    await cleanupDemoCompanyData(db, companyId);
  }

  const adminUserId = options.adminUserId ?? 10n;
  const operatorUserId = options.operatorUserId ?? 11n;
  const viewerUserId = options.viewerUserId ?? 12n;

  const passwordHash =
    process.env.DEMO_SEED_PASSWORD != null
      ? await bcrypt.hash(process.env.DEMO_SEED_PASSWORD, 12)
      : DEFAULT_PASSWORD;

  await db.insert(user).values([
    {
      id: adminUserId,
      name: 'Ana Administradora',
      email: DEMO_ADMIN_EMAIL,
      password: passwordHash,
      company_id: companyId,
      role_id: 1,
    },
    {
      id: operatorUserId,
      name: 'Carlos Operador',
      email: DEMO_OPERATOR_EMAIL,
      password: passwordHash,
      company_id: companyId,
      role_id: 2,
    },
    {
      id: viewerUserId,
      name: 'Lucía Consulta',
      email: DEMO_VIEWER_EMAIL,
      password: passwordHash,
      company_id: companyId,
      role_id: 3,
    },
  ]);

  const insertedServices = await db
    .insert(service)
    .values(
      DEMO_SERVICES.map((row) => ({
        ...row,
        price: row.price,
        company_id: companyId,
      })),
    )
    .returning({ id: service.id, price: service.price, name: service.name });

  const clientRows = [
    ...DEMO_CLIENTS.map((row, index) => ({
      name: row.name,
      email: row.email,
      phone: `998${String(1000000 + index).slice(-7)}`,
      street: `Calle ${index + 10}`,
      exterior_number: String(100 + index),
      neighborhood: 'Centro',
      city: row.city,
      state: 'Quintana Roo',
      postal_code: '77500',
      country: 'México',
      company_id: companyId,
      deleted_at: null as Date | null,
    })),
    {
      name: 'Cliente archivado (demo)',
      email: 'archivado@demo.zigzag.app',
      phone: '9980000000',
      street: 'Calle Demo',
      exterior_number: '1',
      neighborhood: 'Centro',
      city: 'Cancún',
      state: 'Quintana Roo',
      postal_code: '77500',
      country: 'México',
      company_id: companyId,
      deleted_at: subMonths(now, 2),
    },
  ];

  const insertedClients = await db
    .insert(client)
    .values(clientRows)
    .returning({ id: client.id, name: client.name });

  // Soft-deleted service for papelera demos.
  await db.insert(service).values({
    name: 'Servicio descontinuado (demo)',
    description: 'Servicio de ejemplo archivado para demostrar la papelera.',
    price: 199,
    company_id: companyId,
    deleted_at: subMonths(now, 1),
  });

  const activeClients = insertedClients.filter(
    (row) => row.name !== 'Cliente archivado (demo)',
  );
  const clientByName = new Map(activeClients.map((row) => [row.name, row.id]));

  type TicketDraft = {
    id?: bigint;
    clientName: string;
    monthsAgo: number;
    day: number;
    finished: boolean;
    paidRatio: number;
    serviceIndexes: Array<{ index: number; quantity: number }>;
  };

  const ticketDrafts: TicketDraft[] = [];

  // Showcase ticket — flagship for guides and PDF demo.
  ticketDrafts.push({
    id: DEMO_SHOWCASE_TICKET_ID,
    clientName: DEMO_SHOWCASE_CLIENT_NAME,
    monthsAgo: 0,
    day: 3,
    finished: true,
    paidRatio: 1,
    serviceIndexes: [
      { index: 0, quantity: 1 },
      { index: 2, quantity: 1 },
      { index: 8, quantity: 2 },
    ],
  });

  // Historical finished tickets across 12 months for charts.
  for (let monthsAgo = 0; monthsAgo < 12; monthsAgo += 1) {
    const ticketsThisMonth = monthsAgo === 0 ? 5 : monthsAgo < 4 ? 4 : 3;
    for (let i = 0; i < ticketsThisMonth; i += 1) {
      if (monthsAgo === 0 && i === 0) {
        continue;
      }
      const clientIndex = (monthsAgo * 3 + i) % activeClients.length;
      ticketDrafts.push({
        clientName: activeClients[clientIndex].name,
        monthsAgo,
        day: Math.min(2 + i * 5, 26),
        finished: true,
        paidRatio: i % 5 === 0 ? 0.5 : 1,
        serviceIndexes: [
          { index: (i + monthsAgo) % insertedServices.length, quantity: 1 },
          ...(i % 2 === 0
            ? [{ index: (i + 2) % insertedServices.length, quantity: 1 }]
            : []),
        ],
      });
    }
  }

  // Active / in-progress tickets.
  for (let i = 0; i < 8; i += 1) {
    ticketDrafts.push({
      clientName: activeClients[i].name,
      monthsAgo: 0,
      day: Math.max(1, now.getDate() - i),
      finished: false,
      paidRatio: i % 3 === 0 ? 0.35 : 0,
      serviceIndexes: [{ index: i % insertedServices.length, quantity: 1 }],
    });
  }

  // Pending payment on finished tickets.
  for (let i = 0; i < 4; i += 1) {
    ticketDrafts.push({
      clientName: activeClients[activeClients.length - 1 - i].name,
      monthsAgo: 1,
      day: 10 + i,
      finished: true,
      paidRatio: 0,
      serviceIndexes: [{ index: 5, quantity: 1 }],
    });
  }

  const buildTicketDate = (monthsAgo: number, day: number) => {
    const base = subMonths(startOfMonth(now), monthsAgo);
    return new Date(base.getFullYear(), base.getMonth(), day, 10, 0, 0);
  };

  let autoTicketId = 1001n;
  const ticketInserts: Array<typeof ticket.$inferInsert> = [];
  const lineInserts: Array<typeof servicesTickets.$inferInsert> = [];
  const paymentInserts: Array<typeof ticketPayment.$inferInsert> = [];
  const auditInserts: Array<typeof ticketAuditEvent.$inferInsert> = [];

  for (const draft of ticketDrafts) {
    const ticketId = draft.id ?? autoTicketId++;
    const clientId = clientByName.get(draft.clientName);
    const clientMeta = DEMO_CLIENTS.find((row) => row.name === draft.clientName);

    let total = 0;
    for (const line of draft.serviceIndexes) {
      total += insertedServices[line.index].price * line.quantity;
    }
    total = roundMoney(total);
    const paid = roundMoney(total * draft.paidRatio);
    const ticketDate = buildTicketDate(draft.monthsAgo, draft.day);

    ticketInserts.push({
      id: ticketId,
      client_id: clientId,
      client_name: draft.clientName,
      client_tel: '9981234567',
      email: clientMeta?.email ?? 'cliente@demo.zigzag.app',
      ticket_date: ticketDate,
      total,
      paid: draft.finished ? paid : paid,
      finished: draft.finished,
      company_id: companyId,
      userId: draft.finished ? adminUserId : operatorUserId,
      created_at: ticketDate,
      updated_at: ticketDate,
    });

    for (const line of draft.serviceIndexes) {
      const svc = insertedServices[line.index];
      lineInserts.push({
        service_id: svc.id,
        ticket_id: ticketId,
        quantity: line.quantity,
        price: svc.price,
        created_at: ticketDate,
      });
    }

    auditInserts.push({
      ticket_id: ticketId,
      company_id: companyId,
      actor_user_id: adminUserId,
      event_type: 'created',
      payload: { clientName: draft.clientName, total },
      created_at: ticketDate,
    });

    if (paid > 0) {
      paymentInserts.push({
        ticket_id: ticketId,
        amount: paid,
        company_id: companyId,
        created_at: addDays(ticketDate, 1),
      });
      auditInserts.push({
        ticket_id: ticketId,
        company_id: companyId,
        actor_user_id: adminUserId,
        event_type: 'payment_collected',
        payload: { amount: paid },
        created_at: addDays(ticketDate, 1),
      });
    }

    if (draft.finished) {
      auditInserts.push({
        ticket_id: ticketId,
        company_id: companyId,
        actor_user_id: adminUserId,
        event_type: 'finished',
        payload: { total, paid },
        created_at: addDays(ticketDate, draft.paidRatio >= 1 ? 2 : 5),
      });
    }
  }

  await db.insert(ticket).values(ticketInserts);
  await db.insert(servicesTickets).values(lineInserts);
  if (paymentInserts.length > 0) {
    await db.insert(ticketPayment).values(paymentInserts);
  }
  await db.insert(ticketAuditEvent).values(auditInserts);

  const scheduleRows: Array<typeof clientServiceSchedule.$inferInsert> = [];
  const scheduleSpecs = [
    { clientIndex: 0, serviceIndex: 0, daysOffset: -6, unit: 'month', value: 1 },
    { clientIndex: 1, serviceIndex: 3, daysOffset: -2, unit: 'month', value: 3 },
    { clientIndex: 2, serviceIndex: 1, daysOffset: 5, unit: 'month', value: 6 },
    { clientIndex: 3, serviceIndex: 6, daysOffset: 9, unit: 'month', value: 1 },
    { clientIndex: 4, serviceIndex: 0, daysOffset: 12, unit: 'month', value: 1 },
    { clientIndex: 5, serviceIndex: 8, daysOffset: -12, unit: 'month', value: 1 },
    { clientIndex: 6, serviceIndex: 4, daysOffset: 3, unit: 'month', value: 2 },
    { clientIndex: 7, serviceIndex: 2, daysOffset: 18, unit: 'month', value: 1 },
    { clientIndex: 8, serviceIndex: 9, daysOffset: -1, unit: 'month', value: 12 },
    { clientIndex: 9, serviceIndex: 5, daysOffset: 7, unit: 'month', value: 1 },
    { clientIndex: 10, serviceIndex: 7, daysOffset: 40, unit: 'month', value: 1 },
    { clientIndex: 11, serviceIndex: 0, daysOffset: -20, unit: 'month', value: 1 },
    { clientIndex: 12, serviceIndex: 3, daysOffset: 14, unit: 'month', value: 1 },
    { clientIndex: 13, serviceIndex: 6, daysOffset: -4, unit: 'month', value: 1, paused: true },
  ] as const;

  for (const spec of scheduleSpecs) {
    const nextDue = addDays(startOfMonth(now), spec.daysOffset);
    const lastService = subDays(nextDue, 30);
    scheduleRows.push({
      company_id: companyId,
      client_id: activeClients[spec.clientIndex].id,
      service_id: insertedServices[spec.serviceIndex].id,
      interval_value: spec.value,
      interval_unit: spec.unit,
      last_service_at: lastService,
      next_due_at: nextDue,
      paused_at: 'paused' in spec && spec.paused ? subDays(now, 10) : null,
      pause_reason:
        'paused' in spec && spec.paused
          ? 'Cliente solicitó pausa temporal por remodelación.'
          : null,
    });
  }

  await db.insert(clientServiceSchedule).values(scheduleRows);

  await materializeScheduleNotificationsForCompany(companyId, now);

  // Ensure at least one unread notification for the bell badge in demos.
  await db.insert(notification).values({
    company_id: companyId,
    user_id: null,
    type: 'demo_welcome',
    title: 'Bienvenido a ClimaTotal Demo',
    body: 'Explora tickets, recordatorios y métricas con datos de ejemplo.',
    dedupe_key: `demo:welcome:${companyId}`,
    read_at: null,
  });

  await db.execute(
    sql.raw(
      `SELECT setval(pg_get_serial_sequence('"Ticket"', 'id')::regclass, GREATEST((SELECT MAX(id) FROM "Ticket"), 1))`,
    ),
  );
  await db.execute(
    sql.raw(
      `SELECT setval(pg_get_serial_sequence('"Client"', 'id')::regclass, GREATEST((SELECT MAX(id) FROM "Client"), 1))`,
    ),
  );
  await db.execute(
    sql.raw(
      `SELECT setval(pg_get_serial_sequence('"Service"', 'id')::regclass, GREATEST((SELECT MAX(id) FROM "Service"), 1))`,
    ),
  );
  await db.execute(
    sql.raw(
      `SELECT setval(pg_get_serial_sequence('"User"', 'id')::regclass, GREATEST((SELECT MAX(id) FROM "User"), 1))`,
    ),
  );

  return {
    companyId,
    adminUserId,
    showcaseTicketId: DEMO_SHOWCASE_TICKET_ID,
    clientCount: clientRows.length,
    serviceCount: insertedServices.length + 1,
    ticketCount: ticketInserts.length,
    scheduleCount: scheduleRows.length,
  };
};

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    const result = await seedDemoCompany(db);
    console.log(`Demo company "${DEMO_COMPANY_NAME}" ready (id=${result.companyId}).`);
    console.log(`  Clients: ${result.clientCount}`);
    console.log(`  Services: ${result.serviceCount}`);
    console.log(`  Tickets: ${result.ticketCount}`);
    console.log(`  Schedules: ${result.scheduleCount}`);
    console.log(`  Showcase ticket: #${result.showcaseTicketId}`);
    console.log(`  Admin login: ${DEMO_ADMIN_EMAIL}`);
  } finally {
    await pool.end();
  }
}

const isDirectRun = process.argv[1]?.includes('seed-demo-company');

if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

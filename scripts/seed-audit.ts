/**
 * Audit tenants for the pre-release walkthroughs (ZIG-I36-1).
 *
 *   npm run seed:audit                 # Auditoría Normal + Auditoría Pesada
 *   AUDIT_HEAVY=0 npm run seed:audit   # Normal only
 *
 * - Auditoría Normal: 15 clients, 10 services with default materials, 20
 *   materials, ~40 tickets over 90 days in every state, 12 presupuestos.
 * - Auditoría Pesada: 1 000 clients (one with 400 tickets), 10 000 tickets,
 *   100 services, 200 materials, 500 presupuestos; 5 % of documents with 15+
 *   lines, accents, emoji, 120-character names and 7-figure amounts.
 *
 * Both tenants get the same users: dueno@, oficina@, tecnico@, tecnico2@ and
 * lectura@ on auditoria-normal.test / auditoria-pesada.test, all with
 * AUDIT_SEED_PASSWORD below (override with the env var of the same name).
 * In each tenant the last client never gets a document (the empty state).
 *
 * Idempotent: a re-run keeps the two companies, their roles and users, and
 * replaces everything else they hold (documents made during a walkthrough
 * included). Other tenants are never touched. Runs only against a database on
 * this machine and refuses Neon before connecting (scripts/seed-audit-target.ts).
 *
 * Pending offline documents live in the phone's IndexedDB, so no server seed
 * can create them. To get three: sign in as tecnico@ on the installed PWA (or
 * Playwright mobile-chrome), open Nuevo ticket once online, switch to airplane
 * mode (Playwright: `context.setOffline(true)`), then save three tickets from
 * the composer. They stay in "Por enviar" until the connection comes back.
 */
import './load-env.cjs';
import bcrypt from 'bcryptjs';
import { sql, type SQL } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import * as schema from '../src/db/schema';
import { client, material, service, serviceMaterial } from '../src/db/schema';
import { filterTenantAssignablePermissionNames } from '../src/lib/company-bootstrap';
import { clabeCheckDigit } from '../src/lib/company-payment-info';
import { backfillMissingFolios } from '../src/lib/folio-backfill';
import { ALL_PERMISSIONS } from '../src/lib/rbac-role-matrix';
import { ROLE_TEMPLATES } from '../src/lib/role-matrix';
import { checkAuditSeedTarget } from './seed-audit-target';

/** Test password of every audit user. Local tenants only; not a real credential. */
export const AUDIT_SEED_PASSWORD = process.env.AUDIT_SEED_PASSWORD ?? 'Auditoria-2026';

type Db = NodePgDatabase<typeof schema>;

type TenantSpec = {
  name: string;
  domain: string;
  clients: number;
  services: number;
  /** Services priced in 6–7 figures, picked by one ticket in 500. */
  bigServices: number;
  materials: number;
  tickets: number;
  presupuestos: number;
  /** Tickets of client #0 (the one with a long history); 0 = spread evenly. */
  bigClientTickets: number;
  days: number;
};

const NORMAL: TenantSpec = {
  name: 'Auditoría Normal',
  domain: 'auditoria-normal.test',
  clients: 15,
  services: 10,
  bigServices: 0,
  materials: 20,
  tickets: 40,
  presupuestos: 12,
  bigClientTickets: 0,
  days: 90,
};

const HEAVY: TenantSpec = {
  name: 'Auditoría Pesada',
  domain: 'auditoria-pesada.test',
  clients: 1000,
  services: 100,
  bigServices: 3,
  materials: 200,
  tickets: 10000,
  presupuestos: 500,
  bigClientTickets: 400,
  days: 400,
};

/** A trusted integer from a TenantSpec, inlined so Postgres knows its type. */
const n = (value: number) => sql.raw(String(Math.trunc(value)));

/** Wall-clock UTC, the way the app writes `timestamp without time zone`. */
const NOW_UTC = sql`(now() at time zone 'utc')`;

const fill120 = (base: string) =>
  `${base} — sucursal poniente, segundo piso, acceso por estacionamiento de proveedores y caseta norte`.slice(0, 120);

// ---------------------------------------------------------------- catalogs

type ClientSeed = { name: string; phone: string | null; street?: string };

const NORMAL_CLIENTS: ClientSeed[] = [
  { name: 'Fernanda Ruiz Olvera', phone: '5551234501' },
  { name: 'Taller Mecánico Hermanos Ibáñez', phone: '5551234502' },
  {
    name: 'Condominio Residencial Jardines del Pedregal de San Ángel, Torre B, Administración y Mantenimiento General',
    phone: '5551234503',
    street:
      'Prolongación Avenida de los Insurgentes Sur entre Calle Río Churubusco y Eje 8 Sur Popocatépetl, Edificio de Servicios',
  },
  { name: 'Ramiro Esquivel', phone: null },
  { name: 'Panadería La Espiga de Oro', phone: '5551234505' },
  { name: 'Consultorio Dra. Mónica Saldaña', phone: '5551234506' },
  { name: fill120('Bodega de Abarrotes y Distribuidora Comercial del Valle de Toluca'), phone: '5551234507', street: fill120('Carretera Federal México–Toluca kilómetro 52.5, Parque Industrial') },
  { name: 'Escuela Primaria Benito Juárez', phone: '5551234508' },
  { name: 'Óscar Peña Cázares', phone: '5551234509' },
  { name: 'Lavandería Burbujas', phone: '5551234510' },
  { name: 'Farmacia San Judas', phone: '5551234511' },
  { name: 'Gimnasio Fuerza Norte', phone: '5551234512' },
  { name: 'Lucía Domínguez Ávila', phone: '5551234513' },
  { name: 'Restaurante El Fogón de Doña Chuy', phone: '5551234514' },
  { name: 'Ana Sofía Treviño (sin tickets)', phone: '5551234515' },
];

const NORMAL_SERVICES: Array<{ name: string; description: string; price: number }> = [
  { name: 'Mantenimiento preventivo minisplit', description: 'Limpieza de filtros, serpentín y revisión de presiones.', price: 850 },
  { name: 'Instalación de minisplit 1 ton', description: 'Instalación con hasta 3 m de línea.', price: 3800 },
  { name: 'Diagnóstico', description: 'Revisión eléctrica y de refrigeración.', price: 350 },
  { name: 'Carga de gas R410A', description: 'Recarga y prueba de fugas.', price: 1100 },
  { name: 'Limpieza profunda con hidrolavadora', description: 'Desmontaje de evaporadora y lavado químico.', price: 1450 },
  { name: 'Cambio de capacitor', description: 'Sustitución y prueba de arranque.', price: 450 },
  { name: 'Reparación de fuga en línea', description: 'Localización, soldadura y vacío.', price: 1800 },
  { name: 'Desinstalación de equipo', description: 'Recuperación de gas y retiro.', price: 900 },
  { name: 'Visita de urgencia', description: 'Atención el mismo día fuera de horario.', price: 1200 },
  { name: 'Mantenimiento de cámara de refrigeración comercial con revisión completa de compresor y tablero', description: 'Nombre largo a propósito.', price: 4200 },
];

const NORMAL_MATERIALS: Array<{ name: string; unit: string; price: number }> = [
  { name: 'Gas R410A', unit: 'kg', price: 380 },
  { name: 'Gas R22', unit: 'kg', price: 520 },
  { name: 'Tubo de cobre 1/4"', unit: 'm', price: 95 },
  { name: 'Tubo de cobre 3/8"', unit: 'm', price: 120 },
  { name: 'Tubo de cobre 1/2"', unit: 'm', price: 160 },
  { name: 'Armaflex 3/8"', unit: 'm', price: 35 },
  { name: 'Capacitor 35+5 µF', unit: 'pza', price: 280 },
  { name: 'Capacitor 45 µF', unit: 'pza', price: 310 },
  { name: 'Cinta vinil', unit: 'pza', price: 45 },
  { name: 'Soporte para condensadora', unit: 'pza', price: 450 },
  { name: 'Cable uso rudo 3x12', unit: 'm', price: 42 },
  { name: 'Pastilla termomagnética 2x20', unit: 'pza', price: 260 },
  { name: 'Manguera de drenaje', unit: 'm', price: 18 },
  { name: 'Limpiador de serpentín', unit: 'lt', price: 190 },
  { name: 'Soldadura de plata 5 %', unit: 'pza', price: 85 },
  { name: 'Taquete y pija 1/4"', unit: 'pza', price: 4.5 },
  { name: 'Control remoto universal', unit: 'pza', price: 350 },
  { name: 'Bomba de condensados', unit: 'pza', price: 1650 },
  { name: 'Filtro deshidratador', unit: 'pza', price: 210 },
  { name: 'Mano de obra adicional', unit: 'hr', price: 250 },
];

const FIRST = ['José', 'María', 'Juan', 'Guadalupe', 'Luis', 'Verónica', 'Jesús', 'Rocío', 'Ángel', 'Martha', 'Raúl', 'Patricia', 'Andrés', 'Begoña', 'Íñigo', 'Ñeli', 'Héctor', 'Zoé', 'Joaquín', 'Inés'];
const LAST = ['Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Gómez', 'Díaz', 'Muñoz', 'Velázquez', 'Ordóñez', 'Íñiguez', 'Peña', 'Núñez', 'Báez', 'Echeverría'];
const BUSINESS = ['Taller', 'Farmacia', 'Hotel', 'Clínica', 'Restaurante', 'Bodega', 'Oficinas', 'Escuela', 'Panadería', 'Gimnasio'];
const EMOJI = ['🔧', '❄️', '🏠', '⭐', '🍕'];
const CITIES = ['Ciudad de México', 'Querétaro', 'León', 'Mérida', 'Torreón', 'Culiacán', 'Oaxaca', 'Pachuca'];

const heavyClients = (count: number): ClientSeed[] =>
  Array.from({ length: count }, (_, i) => {
    if (i === 0) {
      return { name: 'Hospital Ángeles del Sur · Mantenimiento', phone: '5550000000' };
    }
    const person = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]} ${LAST[(i * 3 + 1) % LAST.length]}`;
    let name = i % 4 === 0 ? `${BUSINESS[i % BUSINESS.length]} ${LAST[i % LAST.length]} ${i}` : `${person} ${i}`;
    if (i % 37 === 0) name = `${name} ${EMOJI[i % EMOJI.length]}`;
    if (i % 97 === 0) name = fill120(name);
    return { name, phone: i % 23 === 0 ? null : String(5550000000 + i) };
  });

const SERVICE_BASES = ['Mantenimiento preventivo', 'Instalación', 'Diagnóstico', 'Carga de gas', 'Limpieza profunda', 'Reparación', 'Desinstalación', 'Visita de urgencia', 'Cambio de compresor', 'Revisión eléctrica'];
const SERVICE_TIERS = ['1 ton', '1.5 ton', '2 ton', '3 ton', '5 ton', 'comercial', 'industrial', 'casa', 'oficina', 'nave'];

const heavyServices = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    if (i === 0) return { name: 'Proyecto integral de climatización hospital', description: 'Precio de 7 cifras.', price: 2_450_000 };
    if (i === 1) return { name: 'Sustitución de chiller 200 ton', description: 'Precio de 7 cifras.', price: 1_280_000.5 };
    if (i === 2) return { name: 'Contrato anual planta industrial', description: 'Precio de 6 cifras.', price: 985_000 };
    let name = `${SERVICE_BASES[i % SERVICE_BASES.length]} ${SERVICE_TIERS[Math.floor(i / SERVICE_BASES.length) % SERVICE_TIERS.length]} #${i}`;
    if (i % 31 === 0) name = fill120(name);
    if (i % 17 === 0) name = `${name} ${EMOJI[i % EMOJI.length]}`;
    return { name, description: 'Servicio generado para la auditoría.', price: 250 + (i % 40) * 75 };
  });

const MATERIAL_BASES = ['Tubo de cobre', 'Gas R410A', 'Capacitor', 'Cable', 'Armaflex', 'Soporte', 'Filtro', 'Válvula', 'Manguera', 'Contactor'];
const MATERIAL_UNITS = ['m', 'kg', 'pza', 'm', 'm', 'pza', 'pza', 'pza', 'm', 'pza'];

const heavyMaterials = (count: number) =>
  Array.from({ length: count }, (_, i) => {
    const base = MATERIAL_BASES[i % MATERIAL_BASES.length];
    let name = `${base} modelo ${i}`;
    if (i % 41 === 0) name = `${name} — presentación de distribuidor con ficha técnica completa`.slice(0, 100);
    return { name, unit: MATERIAL_UNITS[i % MATERIAL_UNITS.length], price: 5 + (i % 50) * 37.5 };
  });

// ---------------------------------------------------------------- tenant

const clabeFor = (first17: string) => `${first17}${clabeCheckDigit(first17)}`;

const upsertCompany = async (db: Db, spec: TenantSpec): Promise<number> => {
  const isNormal = spec === NORMAL;
  const profile = {
    name: spec.name,
    phone: '5550001000',
    email: `empresa@${spec.domain}`,
    street: 'Calle Auditoría',
    exterior_number: '36',
    neighborhood: 'Centro',
    city: 'Ciudad de México',
    state: 'CDMX',
    country: 'México',
    postal_code: '06000',
    is_system: false,
    status: 'ACTIVE' as const,
    settings: {
      rfc: 'AUD010101AAA',
      default_currency: 'MXN',
      tagline: 'Empresa de prueba para la auditoría',
      ...(isNormal
        ? {
            payment_kind: 'clabe' as const,
            payment_clabe: clabeFor('01218000123456789'),
            payment_holder: 'Auditoría Normal SA de CV',
            payment_note: 'Manda tu comprobante por WhatsApp',
          }
        : {}),
    },
    updated_at: new Date(),
    deleted_at: null,
  };
  const [row] = await db
    .insert(schema.company)
    .values(profile)
    .onConflictDoUpdate({ target: schema.company.name, set: profile })
    .returning({ id: schema.company.id });
  return row.id;
};

/** Everything the tenant holds except the company, its roles and its users. */
const wipeTenantData = async (db: Db, companyId: number) => {
  const ticketsOfCompany = sql`SELECT id FROM "Ticket" WHERE company_id = ${companyId}`;
  await db.execute(sql`
    DELETE FROM "TicketLineMaterial" WHERE services_tickets_id IN (
      SELECT id FROM "ServicesTickets" WHERE ticket_id IN (${ticketsOfCompany}))`);
  await db.execute(sql`DELETE FROM "ServicesTickets" WHERE ticket_id IN (${ticketsOfCompany})`);
  await db.execute(sql`DELETE FROM "TicketPayment" WHERE company_id = ${companyId} OR ticket_id IN (${ticketsOfCompany})`);
  await db.execute(sql`DELETE FROM "TicketAuditEvent" WHERE company_id = ${companyId} OR ticket_id IN (${ticketsOfCompany})`);
  await db.execute(sql`DELETE FROM "Notification" WHERE company_id = ${companyId}`);
  await db.execute(sql`DELETE FROM "ClientServiceSchedule" WHERE company_id = ${companyId}`);
  await db.execute(sql`
    DELETE FROM "ServiceMaterial" WHERE service_id IN (SELECT id FROM "Service" WHERE company_id = ${companyId})
       OR material_id IN (SELECT id FROM "Material" WHERE company_id = ${companyId})`);
  await db.execute(sql`DELETE FROM "Ticket" WHERE company_id = ${companyId}`);
  await db.execute(sql`DELETE FROM "Client" WHERE company_id = ${companyId}`);
  await db.execute(sql`DELETE FROM "Material" WHERE company_id = ${companyId}`);
  await db.execute(sql`DELETE FROM "Service" WHERE company_id = ${companyId}`);
  await db.execute(sql`DELETE FROM "AuditEvent" WHERE target_company_id = ${companyId} OR actor_company_id = ${companyId}`);
  await db.execute(sql`DELETE FROM "GovernanceAuditEvent" WHERE company_id = ${companyId} OR actor_company_id = ${companyId}`);
  // Folios restart at 1 with the documents they number.
  await db.execute(sql`DELETE FROM "DocumentFolioCounter" WHERE company_id = ${companyId}`);
};

const TENANT_ROLES: Array<{ name: string; description: string; permissions: string[] }> = [
  {
    // Same name and grants as a signup owner (company-bootstrap), so it is the protected Admin.
    name: 'Admin',
    description: 'Dueño: todo dentro de la empresa',
    permissions: filterTenantAssignablePermissionNames(ALL_PERMISSIONS),
  },
  ...ROLE_TEMPLATES.map((template) => ({
    name: template.label,
    description: template.description,
    permissions: template.keys,
  })),
];

const AUDIT_USERS = [
  { local: 'dueno', name: 'Dueña Auditoría', role: 'Admin' },
  { local: 'oficina', name: 'Oficina Auditoría', role: 'Administrador' },
  { local: 'tecnico', name: 'Técnico Uno', role: 'Técnico' },
  { local: 'tecnico2', name: 'Técnica Dos', role: 'Técnico' },
  { local: 'lectura', name: 'Consulta Auditoría', role: 'Solo lectura' },
] as const;

const upsertRolesAndUsers = async (db: Db, companyId: number, spec: TenantSpec, passwordHash: string) => {
  const permissionRows = await db.execute<{ id: number; name: string }>(
    sql`SELECT id, name FROM "Permission" WHERE company_id IS NULL AND deleted_at IS NULL`,
  );
  const permissionId = new Map(permissionRows.rows.map((row) => [row.name, row.id]));

  const roleId = new Map<string, number>();
  for (const roleSpec of TENANT_ROLES) {
    const [row] = await db
      .insert(schema.role)
      .values({ name: roleSpec.name, description: roleSpec.description, company_id: companyId, updated_at: new Date() })
      .onConflictDoUpdate({
        target: [schema.role.company_id, schema.role.name],
        set: { description: roleSpec.description, deleted_at: null, updated_at: new Date() },
      })
      .returning({ id: schema.role.id });
    roleId.set(roleSpec.name, row.id);
    await db.execute(sql`DELETE FROM "RolePermission" WHERE role_id = ${row.id}`);
    const ids = roleSpec.permissions.map((name) => {
      const id = permissionId.get(name);
      if (id == null) throw new Error(`Missing global permission: ${name}`);
      return id;
    });
    await db.insert(schema.rolePermission).values(ids.map((id) => ({ role_id: row.id, permission_id: id })));
  }

  const userId = new Map<string, bigint>();
  for (const u of AUDIT_USERS) {
    const values = {
      name: u.name,
      email: `${u.local}@${spec.domain}`,
      password: passwordHash,
      company_id: companyId,
      role_id: roleId.get(u.role)!,
      email_verified_at: new Date(),
      must_change_password: false,
      deleted_at: null,
      updated_at: new Date(),
    };
    const [row] = await db
      .insert(schema.user)
      .values(values)
      .onConflictDoUpdate({ target: schema.user.email, set: values })
      .returning({ id: schema.user.id });
    userId.set(u.local, row.id);
  }
  return userId;
};

const insertChunked = async <T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) => {
  for (let i = 0; i < rows.length; i += 500) {
    await insert(rows.slice(i, i + 500));
  }
};

const seedCatalogs = async (db: Db, companyId: number, spec: TenantSpec) => {
  const isNormal = spec === NORMAL;
  const clientRows = (isNormal ? NORMAL_CLIENTS : heavyClients(spec.clients)).map((row, i) => ({
    name: row.name,
    phone: row.phone,
    email: i % 41 === 5 ? null : `cliente${i}@${spec.domain}`,
    street: row.street ?? `Calle ${i + 1}`,
    exterior_number: String(100 + i),
    neighborhood: 'Centro',
    city: CITIES[i % CITIES.length],
    state: 'México',
    postal_code: String(10000 + i).slice(0, 5),
    country: 'México',
    company_id: companyId,
    created_at: new Date(Date.now() - (i % 700) * 86_400_000),
  }));
  await insertChunked(clientRows, (chunk) => db.insert(client).values(chunk));

  const serviceRows = (isNormal ? NORMAL_SERVICES : heavyServices(spec.services)).map((row) => ({
    ...row,
    company_id: companyId,
  }));
  await insertChunked(serviceRows, (chunk) => db.insert(service).values(chunk));

  const materialRows = (isNormal ? NORMAL_MATERIALS : heavyMaterials(spec.materials)).map((row) => ({
    ...row,
    company_id: companyId,
  }));
  await insertChunked(materialRows, (chunk) => db.insert(material).values(chunk));

  // 0–3 default materials per service.
  const [services, materials] = await Promise.all([
    db.execute<{ id: number }>(sql`SELECT id FROM "Service" WHERE company_id = ${companyId} ORDER BY id`),
    db.execute<{ id: number }>(sql`SELECT id FROM "Material" WHERE company_id = ${companyId} ORDER BY id`),
  ]);
  const defaults = services.rows.flatMap((svc, i) =>
    Array.from({ length: i % 4 }, (_, j) => ({
      service_id: svc.id,
      material_id: materials.rows[(i * 3 + j) % materials.rows.length].id,
      quantity: j === 0 ? 1.5 : 1,
      sort_order: j,
    })),
  );
  await insertChunked(defaults, (chunk) => db.insert(serviceMaterial).values(chunk));
};

/**
 * Documents, all in SQL so 10 000 tickets take seconds. `audit_doc` holds one
 * row per document with its id taken from the sequence up front, so lines and
 * materials can point at it without reading anything back.
 */
const seedDocuments = async (db: Db, companyId: number, spec: TenantSpec, users: Map<string, bigint>) => {
  const T = spec.tickets;
  const P = spec.presupuestos;
  const C = spec.clients;
  const owner = users.get('dueno')!;
  const tec1 = users.get('tecnico')!;
  const tec2 = users.get('tecnico2')!;
  const exec = (query: SQL) => db.execute(query);

  await exec(sql`
    CREATE TEMP TABLE audit_client ON COMMIT DROP AS
    SELECT row_number() OVER (ORDER BY id) - 1 AS idx, id, name, phone, email
    FROM "Client" WHERE company_id = ${n(companyId)}`);
  await exec(sql`
    CREATE TEMP TABLE audit_service ON COMMIT DROP AS
    SELECT row_number() OVER (ORDER BY id) - 1 AS idx, id, price
    FROM "Service" WHERE company_id = ${n(companyId)}`);
  await exec(sql`
    CREATE TEMP TABLE audit_material ON COMMIT DROP AS
    SELECT row_number() OVER (ORDER BY id) - 1 AS idx, id, name, unit, price
    FROM "Material" WHERE company_id = ${n(companyId)}`);

  // Work tickets g = 1..T. The first four are today's (Hoy); client #0 gets
  // every 25th when the tenant has a big client; the last client gets nothing.
  // State by g % 10: 0–1 abierto, 2 abierto con abono, 3 terminado sin pagar,
  // 4 parcial, 5–9 pagado; #9 and one in 100 sit in the Papelera.
  await exec(sql`
    CREATE TEMP TABLE audit_doc ON COMMIT DROP AS
    SELECT
      g,
      nextval(pg_get_serial_sequence('"Ticket"', 'id')) AS ticket_id,
      'ticket'::text AS kind,
      CASE
        WHEN g = 1 THEN 'abierto'
        WHEN g = 2 THEN 'abono'
        WHEN g = 3 THEN 'terminado'
        WHEN g = 4 THEN 'pagado'
        WHEN g % 10 IN (0, 1) THEN 'abierto'
        WHEN g % 10 = 2 THEN 'abono'
        WHEN g % 10 = 3 THEN 'terminado'
        WHEN g % 10 = 4 THEN 'parcial'
        WHEN g = 9 OR g % 100 = 9 THEN 'papelera'
        ELSE 'pagado'
      END AS state,
      CASE
        WHEN ${n(spec.bigClientTickets)} > 0 AND g % 25 = 0 THEN 0
        WHEN ${n(spec.bigClientTickets)} > 0 THEN 1 + (g * 7919) % ${n(C - 2)}
        ELSE (g * 5) % ${n(C - 1)}
      END AS client_idx,
      CASE g % 4 WHEN 0 THEN ${owner}::bigint WHEN 1 THEN ${tec2}::bigint ELSE ${tec1}::bigint END AS user_id,
      CASE
        WHEN g <= 4 THEN ${NOW_UTC} - (g * interval '20 minutes')
        ELSE ${NOW_UTC} - (((g - 4) * ${n(spec.days)})::numeric / ${n(Math.max(T - 4, 1))} * interval '1 day') - (g % 9) * interval '1 hour'
      END AS doc_date,
      CASE WHEN g % 20 = 7 THEN 15 + g % 6 ELSE 1 + g % 3 END AS n_lines,
      g AS line_seed,
      NULL::int AS src_g
    FROM generate_series(1, ${n(T)}) AS g`);

  // Presupuestos g = T+1..T+P. State by (g - T) % 5: 1 abierto, 2 vencido,
  // 3 aceptado (convertido), 4 cancelado, 0 abierto que vence en 2 días.
  await exec(sql`
    INSERT INTO audit_doc
    SELECT
      g,
      nextval(pg_get_serial_sequence('"Ticket"', 'id')),
      'presupuesto',
      CASE (g - ${n(T)}) % 5 WHEN 1 THEN 'abierto' WHEN 2 THEN 'vencido' WHEN 3 THEN 'convertido' WHEN 4 THEN 'cancelado' ELSE 'por_vencer' END,
      (g * 13) % ${n(C - 1)},
      CASE g % 2 WHEN 0 THEN ${owner}::bigint ELSE ${tec1}::bigint END,
      ${NOW_UTC} - (((g - ${n(T)}) * 60)::numeric / ${n(P)} * interval '1 day') - interval '1 day',
      CASE WHEN g % 20 = 7 THEN 15 + g % 6 ELSE 1 + g % 3 END,
      g,
      NULL
    FROM generate_series(${n(T + 1)}, ${n(T + P)}) AS g`);

  // The ticket each accepted presupuesto became: same client and lines.
  await exec(sql`
    INSERT INTO audit_doc
    SELECT
      ${n(T + P)} + row_number() OVER (ORDER BY p.g),
      nextval(pg_get_serial_sequence('"Ticket"', 'id')),
      'ticket',
      CASE WHEN p.g % 2 = 0 THEN 'pagado' ELSE 'terminado' END,
      p.client_idx,
      ${tec1}::bigint,
      LEAST(p.doc_date + interval '3 days', ${NOW_UTC}),
      p.n_lines,
      p.line_seed,
      p.g
    FROM audit_doc p
    WHERE p.kind = 'presupuesto' AND p.state = 'convertido'`);

  await exec(sql`
    INSERT INTO "Ticket" (
      id, client_id, client_name, client_tel, email, work_notes, ticket_date, total, paid,
      finished, document_kind, expires_at, canceled_at, converted_from_ticket_id,
      company_id, "userId", created_at, updated_at, deleted_at
    )
    SELECT
      d.ticket_id, c.id, left(c.name, 100), c.phone, left(c.email, 40),
      CASE WHEN d.g % 6 = 0 THEN 'Se revisó el equipo y se dejó funcionando. Cliente pide regresar en 6 meses.' END,
      d.doc_date, 0, 0,
      d.kind = 'ticket' AND d.state IN ('terminado', 'parcial', 'pagado', 'papelera'),
      d.kind,
      CASE d.state
        WHEN 'abierto' THEN CASE WHEN d.kind = 'presupuesto' THEN ${NOW_UTC} + interval '15 days' END
        WHEN 'por_vencer' THEN ${NOW_UTC} + interval '2 days'
        WHEN 'vencido' THEN LEAST(d.doc_date + interval '15 days', ${NOW_UTC} - interval '2 days')
        WHEN 'convertido' THEN d.doc_date + interval '15 days'
        WHEN 'cancelado' THEN d.doc_date + interval '15 days'
      END,
      CASE WHEN d.state = 'cancelado' THEN d.doc_date + interval '2 days' END,
      src.ticket_id,
      ${n(companyId)}, d.user_id, d.doc_date, d.doc_date,
      CASE WHEN d.state = 'papelera' THEN LEAST(d.doc_date + interval '1 day', ${NOW_UTC}) END
    FROM audit_doc d
    JOIN audit_client c ON c.idx = d.client_idx
    LEFT JOIN audit_doc src ON src.g = d.src_g`);

  await exec(sql`
    UPDATE "Ticket" p SET converted_to_ticket_id = t.ticket_id
    FROM audit_doc t JOIN audit_doc src ON src.g = t.src_g
    WHERE p.id = src.ticket_id`);

  // Lines: every 6th is an inline line; one document in 500 carries a 7-figure service.
  await exec(sql`
    CREATE TEMP TABLE audit_line ON COMMIT DROP AS
    SELECT
      nextval(pg_get_serial_sequence('"ServicesTickets"', 'id'))::int AS id,
      d.ticket_id, d.doc_date, d.line_seed AS seed, k
    FROM audit_doc d CROSS JOIN LATERAL generate_series(1, d.n_lines) AS k`);
  await exec(sql`
    INSERT INTO "ServicesTickets" (id, service_id, ticket_id, name, description, quantity, price, created_at)
    SELECT
      l.id,
      s.id,
      l.ticket_id,
      CASE WHEN s.id IS NULL THEN CASE WHEN l.seed % 4 = 0 THEN 'Trabajo adicional en azotea con andamio y retiro de escombro del área de equipos' ELSE 'Trabajo adicional en sitio' END END,
      CASE WHEN s.id IS NULL THEN 'Línea escrita en el momento, sin catálogo.' END,
      CASE (l.seed + l.k) % 7 WHEN 0 THEN 1.5 WHEN 1 THEN 2 ELSE 1 END,
      COALESCE(s.price, 350 + (l.seed % 7) * 50),
      l.doc_date
    FROM audit_line l
    LEFT JOIN audit_service s ON (l.seed + l.k) % 6 <> 0 AND s.idx = CASE
      WHEN ${n(spec.bigServices)} > 0 AND l.seed % 500 = 0 AND l.k = 1 THEN l.seed % ${n(Math.max(spec.bigServices, 1))}
      ELSE ${n(spec.bigServices)} + (l.seed * 13 + l.k * 7) % ${n(spec.services - spec.bigServices)}
    END`);

  // Materials on every third line: one or two, catalog snapshots, some decimal.
  await exec(sql`
    INSERT INTO "TicketLineMaterial" (services_tickets_id, material_id, name, unit, quantity, price, sort_order, created_at)
    SELECT
      l.id, m.id, m.name, m.unit,
      CASE WHEN j = 1 THEN 2.5 ELSE 1 + l.seed % 3 END,
      m.price, j, l.doc_date
    FROM audit_line l
    CROSS JOIN LATERAL generate_series(0, (l.seed + l.k) % 2) AS j
    JOIN audit_material m ON m.idx = (l.seed * 5 + l.k * 3 + j) % ${n(spec.materials)}
    WHERE (l.seed + l.k) % 3 = 0`);

  // Totals the way syncTicketTotal adds them: lines plus their materials.
  await exec(sql`
    UPDATE "Ticket" t SET total = x.total
    FROM (
      SELECT l.ticket_id,
        SUM(round(st.quantity * st.price, 2)) + COALESCE(SUM(mat.amount), 0) AS total
      FROM audit_line l
      JOIN "ServicesTickets" st ON st.id = l.id
      LEFT JOIN (
        SELECT services_tickets_id, SUM(round(quantity * price, 2)) AS amount
        FROM "TicketLineMaterial" GROUP BY services_tickets_id
      ) mat ON mat.services_tickets_id = l.id
      GROUP BY l.ticket_id
    ) x
    WHERE t.id = x.ticket_id`);
  await exec(sql`
    UPDATE "Ticket" t SET paid = round(t.total * CASE d.state
      WHEN 'abono' THEN 0.3 WHEN 'parcial' THEN 0.5 WHEN 'pagado' THEN 1 WHEN 'papelera' THEN 1 ELSE 0 END, 2)
    FROM audit_doc d
    WHERE t.id = d.ticket_id AND d.kind = 'ticket'`);

  // Payments: fully paid even tickets were paid in two parts.
  await exec(sql`
    INSERT INTO "TicketPayment" (ticket_id, amount, company_id, created_at)
    SELECT t.id, part.amount, ${n(companyId)}, LEAST(t.created_at + part.after, ${NOW_UTC})
    FROM "Ticket" t
    JOIN audit_doc d ON d.ticket_id = t.id
    CROSS JOIN LATERAL (
      SELECT round(t.paid / 2, 2) AS amount, interval '1 hour' AS after WHERE t.paid = t.total AND d.g % 2 = 0
      UNION ALL
      SELECT t.paid - round(t.paid / 2, 2), interval '1 day' WHERE t.paid = t.total AND d.g % 2 = 0
      UNION ALL
      SELECT t.paid, interval '1 day' WHERE NOT (t.paid = t.total AND d.g % 2 = 0)
    ) part
    WHERE t.paid > 0`);

  await exec(sql`
    INSERT INTO "TicketAuditEvent" (ticket_id, company_id, actor_user_id, event_type, payload, created_at)
    SELECT d.ticket_id, ${n(companyId)}, d.user_id, 'created', jsonb_build_object('seed', 'audit'), d.doc_date
    FROM audit_doc d
    UNION ALL
    SELECT d.ticket_id, ${n(companyId)}, d.user_id, 'finished', jsonb_build_object('seed', 'audit'), LEAST(d.doc_date + interval '2 hours', ${NOW_UTC})
    FROM audit_doc d WHERE d.kind = 'ticket' AND d.state IN ('terminado', 'parcial', 'pagado', 'papelera')
    UNION ALL
    SELECT p.ticket_id, ${n(companyId)}, ${owner}::bigint, 'payment_collected', jsonb_build_object('amount', p.amount), p.created_at
    FROM "TicketPayment" p WHERE p.company_id = ${n(companyId)}`);
};

const countTenant = async (db: Db, companyId: number) => {
  const result = await db.execute<Record<string, string>>(sql`
    SELECT
      (SELECT count(*) FROM "Client" WHERE company_id = ${companyId}) AS clients,
      (SELECT count(*) FROM "Service" WHERE company_id = ${companyId}) AS services,
      (SELECT count(*) FROM "Material" WHERE company_id = ${companyId}) AS materials,
      (SELECT count(*) FROM "ServiceMaterial" sm JOIN "Service" s ON s.id = sm.service_id WHERE s.company_id = ${companyId}) AS service_materials,
      (SELECT count(*) FROM "Ticket" WHERE company_id = ${companyId} AND document_kind = 'ticket' AND deleted_at IS NULL) AS tickets,
      (SELECT count(*) FROM "Ticket" WHERE company_id = ${companyId} AND document_kind = 'ticket' AND deleted_at IS NOT NULL) AS tickets_papelera,
      (SELECT count(*) FROM "Ticket" WHERE company_id = ${companyId} AND document_kind = 'ticket' AND deleted_at IS NULL AND NOT finished) AS tickets_abiertos,
      (SELECT count(*) FROM "Ticket" WHERE company_id = ${companyId} AND document_kind = 'ticket' AND deleted_at IS NULL AND finished AND paid < total) AS tickets_con_saldo,
      (SELECT count(*) FROM "Ticket" WHERE company_id = ${companyId} AND document_kind = 'presupuesto') AS presupuestos,
      (SELECT count(*) FROM "Ticket" WHERE company_id = ${companyId} AND document_kind = 'presupuesto' AND converted_to_ticket_id IS NOT NULL) AS presupuestos_aceptados,
      (SELECT count(*) FROM "Ticket" WHERE company_id = ${companyId} AND document_kind = 'presupuesto' AND canceled_at IS NOT NULL) AS presupuestos_cancelados,
      (SELECT count(*) FROM "Ticket" t WHERE company_id = ${companyId} AND (SELECT count(*) FROM "ServicesTickets" st WHERE st.ticket_id = t.id) >= 15) AS docs_15_lineas,
      (SELECT count(*) FROM "ServicesTickets" st JOIN "Ticket" t ON t.id = st.ticket_id WHERE t.company_id = ${companyId}) AS lines,
      (SELECT count(*) FROM "TicketLineMaterial" m JOIN "ServicesTickets" st ON st.id = m.services_tickets_id JOIN "Ticket" t ON t.id = st.ticket_id WHERE t.company_id = ${companyId}) AS line_materials,
      (SELECT count(*) FROM "TicketPayment" WHERE company_id = ${companyId}) AS payments,
      (SELECT max(total) FROM "Ticket" WHERE company_id = ${companyId}) AS max_total,
      (SELECT max(n) FROM (SELECT count(*) AS n FROM "Ticket" WHERE company_id = ${companyId} GROUP BY client_id) x) AS most_tickets_one_client,
      (SELECT count(*) FROM "User" WHERE company_id = ${companyId} AND deleted_at IS NULL) AS users
  `);
  return result.rows[0];
};

const seedTenant = async (db: Db, spec: TenantSpec, passwordHash: string) => {
  const started = Date.now();
  const companyId = await upsertCompany(db, spec);
  await wipeTenantData(db, companyId);
  const users = await upsertRolesAndUsers(db, companyId, spec, passwordHash);
  await seedCatalogs(db, companyId, spec);
  await seedDocuments(db, companyId, spec, users);
  return { companyId, started };
};

async function main() {
  const target = checkAuditSeedTarget(process.env.DATABASE_URL);
  if (!target.ok) {
    console.error(target.message);
    process.exit(1);
  }
  console.log(`Seeding audit tenants into ${target.target}`);

  const specs = process.env.AUDIT_HEAVY === '0' ? [NORMAL] : [NORMAL, HEAVY];
  const passwordHash = await bcrypt.hash(AUDIT_SEED_PASSWORD, 10);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // One connection: the temp tables live on it, and each tenant is one transaction.
  const conn: PoolClient = await pool.connect();
  const db = drizzle(conn, { schema });

  try {
    for (const spec of specs) {
      await conn.query('BEGIN');
      try {
        const { companyId, started } = await seedTenant(db, spec, passwordHash);
        await backfillMissingFolios(db);
        await conn.query('COMMIT');
        console.log(`${spec.name} (id=${companyId}) in ${Date.now() - started} ms`);
        console.table(await countTenant(db, companyId));
      } catch (error) {
        await conn.query('ROLLBACK');
        throw error;
      }
    }
    console.log(
      `Users: ${AUDIT_USERS.map((u) => `${u.local}@`).join(', ')} on ${specs.map((s) => s.domain).join(' / ')}; password in scripts/seed-audit.ts (AUDIT_SEED_PASSWORD).`,
    );
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

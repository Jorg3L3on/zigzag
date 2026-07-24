import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import {
  DEMO_ADMIN_EMAIL,
  DEMO_COMPANY_NAME,
  DEMO_VIEWER_EMAIL,
} from '../src/lib/demo-company';

dotenv.config();

const viewerEmail = process.env.E2E_VIEWER_EMAIL ?? DEMO_VIEWER_EMAIL;
const systemEmail = process.env.E2E_SYSTEM_EMAIL ?? 'jorge@jorge.com';
const tenantEmail = process.env.E2E_EMAIL ?? DEMO_ADMIN_EMAIL;

/** Align seeded users with E2E_PASSWORD so authenticated Playwright specs can log in. */
export default async function globalSetup() {
  const password = process.env.E2E_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;

  if (!password || !databaseUrl) {
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(
      `UPDATE "User" SET password = $1 WHERE email = $2 AND deleted_at IS NULL`,
      [hash, viewerEmail],
    );

    // Legacy seed email still present in scripts/seed.ts — keep password in sync.
    await pool.query(
      `UPDATE "User" SET password = $1 WHERE email = $2 AND deleted_at IS NULL`,
      [hash, 'viewer@test.com'],
    );

    await pool.query(
      `
      INSERT INTO "User" (name, email, password, company_id, role_id, created_at)
      SELECT 'Lucía Consulta', $1, $2, c.id, 3, NOW()
      FROM "Company" c
      WHERE c.name = $3 AND c.deleted_at IS NULL
      ON CONFLICT ("email") DO UPDATE
        SET password = EXCLUDED.password,
            company_id = EXCLUDED.company_id,
            role_id = EXCLUDED.role_id,
            deleted_at = NULL,
            updated_at = NOW()
      `,
      [viewerEmail, hash, DEMO_COMPANY_NAME],
    );

    await pool.query(
      `UPDATE "User" SET password = $1 WHERE email = $2 AND deleted_at IS NULL`,
      [hash, systemEmail],
    );

    await pool.query(
      `
      INSERT INTO "User" (name, email, password, company_id, role_id, created_at)
      SELECT 'jorg', $1, $2, 2, 1, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "User" WHERE email = $1 AND deleted_at IS NULL
      )
      `,
      [systemEmail, hash],
    );

    await pool.query(
      `UPDATE "User" SET password = $1 WHERE email = $2 AND deleted_at IS NULL`,
      [hash, DEMO_ADMIN_EMAIL],
    );

    await pool.query(
      `
      INSERT INTO "User" (name, email, password, company_id, role_id, created_at)
      SELECT 'Ana Administradora', $1, $2, c.id, 1, NOW()
      FROM "Company" c
      WHERE c.name = $3 AND c.deleted_at IS NULL
      ON CONFLICT ("email") DO UPDATE
        SET password = EXCLUDED.password,
            company_id = EXCLUDED.company_id,
            role_id = EXCLUDED.role_id,
            deleted_at = NULL,
            updated_at = NOW()
      `,
      [DEMO_ADMIN_EMAIL, hash, DEMO_COMPANY_NAME],
    );

    await pool.query(
      `UPDATE "User" SET password = $1 WHERE email = $2 AND deleted_at IS NULL`,
      [hash, tenantEmail],
    );
  } finally {
    await pool.end();
  }
}

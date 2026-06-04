import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const viewerEmail = process.env.E2E_VIEWER_EMAIL ?? 'viewer@test.com';
const systemEmail = process.env.E2E_SYSTEM_EMAIL ?? 'jorge@jorge.com';

/** Align seed viewer/system users with E2E_PASSWORD so RBAC and audit specs can log in. */
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

    await pool.query(
      `
      INSERT INTO "User" (name, email, password, company_id, role_id, created_at)
      SELECT 'viewer', $1, $2, 1, 3, NOW()
      WHERE NOT EXISTS (
        SELECT 1 FROM "User" WHERE email = $1 AND deleted_at IS NULL
      )
      `,
      [viewerEmail, hash],
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
  } finally {
    await pool.end();
  }
}

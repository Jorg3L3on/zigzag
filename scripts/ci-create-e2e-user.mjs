// Creates (or updates) a deterministic E2E user with a known password so the
// authenticated Playwright suite can log in during CI. Attaches the user to the
// seeded ACTIVE company (id 1) with the global Admin role (id 1).
import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

if (!email || !password) {
  console.error('E2E_EMAIL and E2E_PASSWORD must be set');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL must be set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO "User"
       ("name", "email", "password", "company_id", "role_id",
        "email_verified_at", "token_version", "two_factor_enabled",
        "created_at", "updated_at")
     VALUES ($1, $2, $3, 1, 1, NOW(), 0, false, NOW(), NOW())
     ON CONFLICT ("email") DO UPDATE
       SET "password" = EXCLUDED."password",
           "company_id" = EXCLUDED."company_id",
           "role_id" = EXCLUDED."role_id",
           "email_verified_at" = EXCLUDED."email_verified_at",
           "two_factor_enabled" = false,
           "deleted_at" = NULL,
           "updated_at" = NOW()`,
    ['E2E User', email, passwordHash],
  );
  console.log(`E2E user ready: ${email}`);
}

main()
  .then(() => pool.end())
  .catch((error) => {
    console.error('Failed to create E2E user:', error);
    return pool.end().finally(() => process.exit(1));
  });

import { execSync } from 'node:child_process';

const run = (command) => {
  execSync(command, { stdio: 'inherit', env: process.env });
};

const vercelEnv = process.env.VERCEL_ENV ?? '';
const isProduction = vercelEnv === 'production';
const migrateOnPreview =
  process.env.MIGRATE_ON_PREVIEW === '1' ||
  process.env.MIGRATE_ON_PREVIEW === 'true';

if (isProduction || migrateOnPreview) {
  const label = isProduction ? 'production' : 'preview';
  console.log(`[vercel-build] Running Drizzle migrations (${label})…`);
  run('npm run migrate:deploy');
} else {
  console.log(
    `[vercel-build] Skipping migrations (VERCEL_ENV=${vercelEnv || 'local'}).`,
  );
}

console.log('[vercel-build] Running Next.js production build…');
run('npm run build');

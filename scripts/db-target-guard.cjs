/**
 * Refuse to run drizzle-kit commands that write to a remote database (Neon
 * production) unless the run is explicitly allowed.
 *
 * Why: drizzle-kit loads `.env` itself before `drizzle.config.ts` imports
 * `scripts/load-env.cjs`, and dotenv never overrides, so a plain
 * `npm run db:migrate` targets whatever `.env` holds, which is production.
 *
 * Import it for its side effect in drizzle.config.ts:
 *   import { enforceSafeDbTarget } from './scripts/db-target-guard.cjs';
 *   enforceSafeDbTarget();
 */

/** drizzle-kit subcommands that change data or schema on the target database. */
const WRITING_COMMANDS = new Set(['migrate', 'push', 'studio']);

const isLocalHost = (hostname) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
};

/** host/database without credentials, safe to print. */
const describeTarget = (url) => `${url.host}${url.pathname}`;

/**
 * @param {{ argv?: string[], env?: Record<string, string | undefined> }} [options]
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
const checkDbTarget = ({ argv = process.argv, env = process.env } = {}) => {
  const command = argv.slice(2).find((arg) => WRITING_COMMANDS.has(arg));
  if (!command) {
    return { ok: true };
  }

  // Same precedence as drizzle.config.ts.
  const rawUrl = env.DIRECT_URL ?? env.DATABASE_URL;
  if (!rawUrl) {
    return { ok: true }; // drizzle-kit reports the missing URL itself.
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      message: `Refusing to run \`drizzle-kit ${command}\`: the database URL cannot be parsed, so its host cannot be checked.`,
    };
  }

  if (isLocalHost(url.hostname)) {
    return { ok: true };
  }

  // Vercel production builds and the "Production migrations" GitHub workflow
  // are the two sanctioned ways to migrate a remote database.
  if (env.VERCEL === '1' || env.GITHUB_ACTIONS === 'true') {
    return { ok: true };
  }
  if (env.ALLOW_REMOTE_DB_MIGRATE === '1') {
    return { ok: true };
  }

  return {
    ok: false,
    message: [
      `Refusing to run \`drizzle-kit ${command}\` against the remote database ${describeTarget(url)}.`,
      '',
      'That is production data. Production migrations run automatically in the Vercel',
      'build when sandbox is merged into main (or via the "Production migrations"',
      'GitHub workflow), not from a laptop.',
      '',
      'To migrate your local copy, pass its URL explicitly:',
      '  DATABASE_URL="$(grep ^DATABASE_URL= .env.local | cut -d= -f2-)" npm run db:migrate',
      '',
      'To really run against this database, set ALLOW_REMOTE_DB_MIGRATE=1 for that one command',
      'and take a Neon snapshot first.',
    ].join('\n'),
  };
};

const enforceSafeDbTarget = (options) => {
  const result = checkDbTarget(options);
  if (!result.ok) {
    process.stderr.write(`\n${result.message}\n\n`);
    process.exit(1);
  }
};

module.exports = { checkDbTarget, enforceSafeDbTarget, isLocalHost };

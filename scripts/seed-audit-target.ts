/**
 * Where `npm run seed:audit` may write (ZIG-I36-1): the local :5433 copy or a
 * disposable clone on this machine, never Neon. Kept apart from the seed so the
 * check can be tested without a database.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export type AuditSeedTargetCheck =
  | { ok: true; target: string }
  | { ok: false; message: string };

export const checkAuditSeedTarget = (
  rawUrl: string | undefined,
): AuditSeedTargetCheck => {
  if (!rawUrl) {
    return { ok: false, message: 'DATABASE_URL is not set.' };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      message: 'DATABASE_URL cannot be parsed, so its host cannot be checked.',
    };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  // host/database without credentials, safe to print.
  const target = `${url.host}${url.pathname}`;

  if (host.endsWith('neon.tech')) {
    return {
      ok: false,
      message: `Refusing to seed the audit tenants into ${target}: that is Neon (production). Use the local :5433 copy or a disposable clone.`,
    };
  }
  if (!LOCAL_HOSTS.has(host) && !host.endsWith('.localhost')) {
    return {
      ok: false,
      message: `Refusing to seed the audit tenants into ${target}: only a database on this machine is allowed.`,
    };
  }
  return { ok: true, target };
};

/** @jest-environment node */
import { checkDbTarget, isLocalHost } from './db-target-guard.cjs';

const NEON = 'postgresql://app:fake-password@ep-example-pooler.example-region.aws.neon.tech/appdb?sslmode=require';
const LOCAL = 'postgresql://dev@localhost:5433/zigzag';
const argv = (command: string) => ['node', '/x/node_modules/drizzle-kit/bin.cjs', command];

describe('checkDbTarget', () => {
  it('refuses migrate against a remote database and never prints credentials', () => {
    const result = checkDbTarget({ argv: argv('migrate'), env: { DATABASE_URL: NEON } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('neon.tech');
      expect(result.message).toContain('ALLOW_REMOTE_DB_MIGRATE=1');
      expect(result.message).not.toContain('fake-password');
    }
  });

  it.each(['push', 'studio'])('refuses %s against a remote database', (command) => {
    expect(checkDbTarget({ argv: argv(command), env: { DATABASE_URL: NEON } }).ok).toBe(false);
  });

  it('uses DIRECT_URL before DATABASE_URL, like drizzle.config.ts', () => {
    const env = { DATABASE_URL: LOCAL, DIRECT_URL: NEON };
    expect(checkDbTarget({ argv: argv('migrate'), env }).ok).toBe(false);
    expect(checkDbTarget({ argv: argv('migrate'), env: { DATABASE_URL: NEON, DIRECT_URL: LOCAL } }).ok).toBe(true);
  });

  it.each([
    'postgresql://ci:ci@localhost:5432/zigzag',
    'postgresql://u@127.0.0.1:5433/zigzag',
    'postgresql://u@[::1]:5433/zigzag',
    'postgresql://u@db.localhost:5433/zigzag',
  ])('allows a local database: %s', (url) => {
    expect(checkDbTarget({ argv: argv('migrate'), env: { DATABASE_URL: url } }).ok).toBe(true);
  });

  it('does not touch commands that never write (generate, check, up)', () => {
    for (const command of ['generate', 'check', 'up']) {
      expect(checkDbTarget({ argv: argv(command), env: { DATABASE_URL: NEON } }).ok).toBe(true);
    }
  });

  it('allows the sanctioned remote paths: Vercel build, GitHub Actions, explicit override', () => {
    for (const extra of [{ VERCEL: '1' }, { GITHUB_ACTIONS: 'true' }, { ALLOW_REMOTE_DB_MIGRATE: '1' }]) {
      expect(checkDbTarget({ argv: argv('migrate'), env: { DATABASE_URL: NEON, ...extra } }).ok).toBe(true);
    }
  });

  it('does not accept look-alike override values', () => {
    for (const value of ['true', '0', '']) {
      expect(
        checkDbTarget({ argv: argv('migrate'), env: { DATABASE_URL: NEON, ALLOW_REMOTE_DB_MIGRATE: value } }).ok,
      ).toBe(false);
    }
  });

  it('fails closed on a URL it cannot parse', () => {
    const result = checkDbTarget({ argv: argv('migrate'), env: { DATABASE_URL: 'not a url' } });
    expect(result.ok).toBe(false);
  });

  it('leaves a missing URL to drizzle-kit', () => {
    expect(checkDbTarget({ argv: argv('migrate'), env: {} }).ok).toBe(true);
  });
});

describe('isLocalHost', () => {
  it('only treats loopback names as local', () => {
    expect(isLocalHost('localhost')).toBe(true);
    expect(isLocalHost('LOCALHOST')).toBe(true);
    expect(isLocalHost('localhost.evil.com')).toBe(false);
    expect(isLocalHost('ep-x.neon.tech')).toBe(false);
  });
});

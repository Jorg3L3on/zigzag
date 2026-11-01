/** @jest-environment node */
import { checkAuditSeedTarget } from './seed-audit-target';

const NEON = 'postgresql://app:fake-password@ep-example-pooler.example-region.aws.neon.tech/appdb?sslmode=require';

describe('checkAuditSeedTarget', () => {
  it('refuses a neon.tech URL and never prints credentials', () => {
    const result = checkAuditSeedTarget(NEON);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('neon.tech');
      expect(result.message).not.toContain('fake-password');
    }
  });

  it('refuses any other remote host', () => {
    expect(checkAuditSeedTarget('postgresql://u:p@db.example.com:5432/zigzag').ok).toBe(false);
  });

  it('refuses a missing or unparsable URL', () => {
    expect(checkAuditSeedTarget(undefined).ok).toBe(false);
    expect(checkAuditSeedTarget('not a url').ok).toBe(false);
  });

  it.each([
    'postgresql://dev@localhost:5433/zigzag',
    'postgresql://postgres@127.0.0.1:55432/zigzag_audit',
    'postgresql://postgres@[::1]:5433/zigzag',
    'postgresql://postgres@db.localhost:5433/zigzag',
  ])('allows %s', (url) => {
    expect(checkAuditSeedTarget(url)).toEqual(
      expect.objectContaining({ ok: true }),
    );
  });
});

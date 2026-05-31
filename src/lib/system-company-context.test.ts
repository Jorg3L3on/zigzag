import {
  needsSelectedCompanyContext,
  SYSTEM_COMPANY_CONTEXT_MESSAGE,
  SYSTEM_COMPANY_CONTEXT_TITLE,
} from '@/lib/system-company-context';

describe('system company context', () => {
  it('requires selected company for system users only', () => {
    expect(needsSelectedCompanyContext(true, null)).toBe(true);
    expect(needsSelectedCompanyContext(true, undefined)).toBe(true);
    expect(needsSelectedCompanyContext(true, 0)).toBe(true);
    expect(needsSelectedCompanyContext(true, 42)).toBe(false);
    expect(needsSelectedCompanyContext(false, null)).toBe(false);
  });

  it('exports user-facing copy', () => {
    expect(SYSTEM_COMPANY_CONTEXT_TITLE).toMatch(/empresa/i);
    expect(SYSTEM_COMPANY_CONTEXT_MESSAGE.length).toBeGreaterThan(10);
  });
});

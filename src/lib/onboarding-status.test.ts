import { dismissOnboardingChecklist } from '@/actions/onboarding-status';
import { db } from '@/lib/db';
import { requireActionPermission } from '@/lib/security';

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/db', () => ({
  db: {
    update: jest.fn(),
    query: {
      company: { findFirst: jest.fn() },
    },
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionPermission: jest.fn(),
  checkPermission: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

describe('dismissOnboardingChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects cross-tenant dismiss attempts', async () => {
    (requireActionPermission as jest.Mock).mockResolvedValue({ companyId: 1 });

    const result = await dismissOnboardingChecklist({ companyId: 2 });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('auth');
  });

  it('persists dismiss timestamp for the session company', async () => {
    (requireActionPermission as jest.Mock).mockResolvedValue({ companyId: 7 });
    (db.query.company.findFirst as jest.Mock).mockResolvedValue({
      id: 7,
      settings: { rfc: 'ACM010101AAA' },
    });
    (db.update as jest.Mock).mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    });

    const result = await dismissOnboardingChecklist();

    expect(result.success).toBe(true);
    expect(db.update).toHaveBeenCalled();
    const setCall = (db.update as jest.Mock).mock.results[0]?.value.set;
    expect(setCall).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          rfc: 'ACM010101AAA',
          onboarding_checklist_dismissed_at: expect.any(String),
        }),
      }),
    );
  });
});

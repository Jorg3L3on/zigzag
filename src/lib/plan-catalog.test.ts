import { asc, eq } from 'drizzle-orm';

import { plan } from '@/db/schema';
import { getPlanById, getPlanBySlug, listPlans } from '@/lib/plan-catalog';

const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();

jest.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

describe('plan catalog loader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockOrderBy.mockResolvedValue([
      { id: 1, slug: 'starter', name: 'Starter', limits: {}, created_at: new Date() },
      { id: 2, slug: 'standard', name: 'Standard', limits: {}, created_at: new Date() },
    ]);
    mockLimit.mockResolvedValue([
      { id: 2, slug: 'standard', name: 'Standard', limits: {}, created_at: new Date() },
    ]);
  });

  it('lists the seeded catalog ordered by id', async () => {
    const rows = await listPlans();

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith(plan);
    expect(mockOrderBy).toHaveBeenCalledWith(asc(plan.id));
    expect(rows).toHaveLength(2);
  });

  it('loads a plan by slug', async () => {
    const row = await getPlanBySlug('standard');

    expect(mockWhere).toHaveBeenCalledWith(eq(plan.slug, 'standard'));
    expect(row?.slug).toBe('standard');
  });

  it('loads a plan by id', async () => {
    const row = await getPlanById(2);

    expect(mockWhere).toHaveBeenCalledWith(eq(plan.id, 2));
    expect(row?.id).toBe(2);
  });

  it('returns null when a plan is not found', async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(getPlanBySlug('missing')).resolves.toBeNull();
  });
});

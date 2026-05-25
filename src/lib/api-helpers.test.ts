import { requireSession } from '@/lib/api-helpers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({ body, init })),
  },
}));

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      user: {
        findFirst: jest.fn(),
      },
    },
  },
}));

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockDb = db as unknown as {
  query: {
    user: {
      findFirst: jest.Mock;
    };
  };
};

describe('api helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refreshes company claims from persisted user data', async () => {
    const session = {
      user: {
        id: '7',
        company_id: 99,
        company_name: 'Stale Co',
        company_is_system: true,
      },
    } as Awaited<ReturnType<typeof auth>>;

    mockAuth.mockResolvedValue(session);
    mockDb.query.user.findFirst.mockResolvedValue({
      id: 7n,
      company_id: 10,
      company: {
        id: 10,
        name: 'Fresh Co',
        deleted_at: null,
        status: 'ACTIVE',
        is_system: false,
      },
    });

    const result = await requireSession();

    expect(result.unauthorized).toBeNull();
    expect(result.session?.user.company_id).toBe(10);
    expect(result.session?.user.company_name).toBe('Fresh Co');
    expect(result.session?.user.company_is_system).toBe(false);
  });
});

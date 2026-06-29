import { GET } from '@/app/api/realtime/route';
import { requireSession } from '@/lib/api-helpers';
import { IDOR_COMPANY_B, buildIdorSession } from '@/test/idor-fixtures';
import { Client } from 'pg';

jest.mock('@/lib/api-helpers', () => ({
  requireSession: jest.fn(),
}));

jest.mock('@/lib/observability', () => ({
  captureException: jest.fn(),
}));

jest.mock('pg', () => ({
  Pool: jest.fn(() => ({})),
  Client: jest.fn(() => ({
    connect: jest.fn(async () => undefined),
    query: jest.fn(async () => undefined),
    on: jest.fn(),
    end: jest.fn(async () => undefined),
  })),
}));

const mockRequireSession = requireSession as jest.MockedFunction<
  typeof requireSession
>;
const MockedClient = Client as unknown as jest.Mock;
const makeRequest = (url: string) =>
  ({
    url,
    signal: {
      addEventListener: jest.fn(),
    },
  }) as unknown as Request;

describe('cross-tenant IDOR - /api/realtime', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const OriginalResponse = globalThis.Response;

  beforeAll(() => {
    if (typeof globalThis.Response === 'undefined') {
      globalThis.Response = class {
        status: number;
        body: unknown;
        headers: { get: jest.Mock };

        constructor(body?: unknown, init?: { status?: number }) {
          this.body = body;
          this.status = init?.status ?? 200;
          this.headers = { get: jest.fn(() => null) };
        }
      } as unknown as typeof Response;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://localhost/zigzag';
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    globalThis.Response = OriginalResponse;
  });

  it('returns unauthorized response when session is missing', async () => {
    mockRequireSession.mockResolvedValue({
      session: null,
      unauthorized: { status: 401 } as Response,
    });

    const response = await GET(makeRequest('http://localhost/api/realtime'));

    expect(response.status).toBe(401);
    expect(MockedClient).not.toHaveBeenCalled();
  });

  it('treats realtime as session-scoped and blocks when DB is unavailable', async () => {
    mockRequireSession.mockResolvedValue({
      session: buildIdorSession(IDOR_COMPANY_B, '201'),
      unauthorized: null,
    });
    delete process.env.DATABASE_URL;

    const response = await GET(makeRequest('http://localhost/api/realtime'));

    expect(response.status).toBe(503);
    expect(MockedClient).not.toHaveBeenCalled();
  });
});

import type { Session } from 'next-auth';
import {
  buildIdorSession,
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
  mockApiPermissionAllowed,
  mockApiPermissionCrossTenantDenied,
} from '@/test/idor-fixtures';

export { IDOR_COMPANY_A, IDOR_COMPANY_B, IDOR_RESOURCES_A, mockApiPermissionCrossTenantDenied };

export const makeGetRequest = (url: string) => ({ url }) as Request;

export const makeJsonRequest = (
  url: string,
  body: unknown,
  method = 'POST',
) =>
  ({
    url,
    method,
    json: async () => body,
  }) as Request;

export const makeIdContext = (key: string, value: string) => ({
  params: Promise.resolve({ [key]: value }),
});

export const tenantASession = (): Session => buildIdorSession(IDOR_COMPANY_A, '101');
export const tenantBSession = (): Session => buildIdorSession(IDOR_COMPANY_B, '201');

export const mockTenantBAllowed = () =>
  mockApiPermissionAllowed(tenantBSession(), IDOR_COMPANY_B.id);

export const mockTenantBCrossTenantDenied = () => mockApiPermissionCrossTenantDenied();

/** Drizzle select().from().where().orderBy() → empty rows */
export const mockSelectChain = (rows: unknown[] = []) => {
  const orderBy = jest.fn(async () => rows);
  const limit = jest.fn(async () => rows);
  const where = jest.fn(() => ({ orderBy, limit }));
  const from = jest.fn(() => ({ where }));
  return { from, where, orderBy, limit };
};

/** Drizzle select().from().where() for count queries */
export const mockCountChain = (total = 0) => {
  const where = jest.fn(async () => [{ total }]);
  const from = jest.fn(() => ({ where }));
  return { from, where };
};

/** Drizzle update().set().where().returning() → empty (not found) */
export const mockUpdateReturningEmpty = () => {
  const returning = jest.fn(async () => []);
  const where = jest.fn(() => ({ returning }));
  const set = jest.fn(() => ({ where }));
  return { set, where, returning };
};

/** db.query.*.findFirst → undefined */
export const mockFindFirstUndefined = () => jest.fn(async () => undefined);

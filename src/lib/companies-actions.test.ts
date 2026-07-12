import {
  createCompany,
  deleteCompany,
  getCompanies,
  getCompany,
  getCompanyReadiness,
  getOwnCompany,
  getOwnCompanyReadiness,
  removeCompanyLogo,
  updateCompany,
  updateOwnCompany,
  uploadCompanyLogo,
} from '@/actions/companies';
import {
  downloadCompanyExportJson,
  exportCompanyData,
  offboardCompany,
} from '@/actions/company-portability';
import { setCompanyLifecycleStatus } from '@/actions/company-lifecycle';
import { getCompanyOperatorSummary } from '@/actions/company-operator';
import { requestCompanyExport } from '@/actions/exports';
import { requireActionAuth, requireActionPermission } from '@/lib/security';
import {
  IDOR_COMPANY_A,
  mockActionCrossTenantDenied,
  tenantBContext,
} from '@/test/cross-tenant-action-helpers';

jest.mock('@/lib/db', () => ({
  db: {
    select: jest.fn(),
    update: jest.fn(),
    insert: jest.fn(),
    query: {
      company: { findFirst: jest.fn(), findMany: jest.fn() },
      user: { findFirst: jest.fn() },
    },
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionAuth: jest.fn(),
  requireActionPermission: jest.fn(),
  requireSystemUser: jest.fn(),
}));
jest.mock('@/lib/authz-context', () => ({ requireSystemUser: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/governance-audit', () => ({
  actionAuthToGovernanceActor: jest.fn(),
  recordGovernanceAudit: jest.fn(),
  sanitizeCompanyForAudit: jest.fn(),
}));
jest.mock('@/lib/company-logo-upload', () => ({ parseCompanyLogoFile: jest.fn() }));
jest.mock('@/lib/company-logo-blob', () => ({
  uploadCompanyLogoBlob: jest.fn(),
  deleteCompanyLogoBlob: jest.fn(),
}));
jest.mock('@/lib/company-bootstrap', () => ({ bootstrapCompanyTenant: jest.fn() }));
jest.mock('@/lib/company-export', () => ({
  buildCompanyExportBundle: jest.fn(),
  serializeCompanyExportBundle: jest.fn(),
}));
jest.mock('@/lib/company-offboarding', () => ({
  buildOffboardingSummary: jest.fn(),
  canStartCompanyOffboarding: jest.fn(),
}));
jest.mock('@/lib/company-lifecycle-change', () => ({
  validateCompanyLifecycleChange: jest.fn(),
}));
jest.mock('@/lib/company-readiness', () => ({
  assessCompanyReadiness: jest.fn(),
  listCompanyProfileGaps: jest.fn(),
}));
jest.mock('@/lib/company-operator-summary-loader', () => ({
  loadCompanyOperatorSummary: jest.fn(),
}));
jest.mock('@/lib/jobs/queue', () => ({ enqueueJob: jest.fn() }));

const mockRequireActionPermission = requireActionPermission as jest.MockedFunction<
  typeof requireActionPermission
>;
const mockRequireActionAuth = requireActionAuth as jest.MockedFunction<
  typeof requireActionAuth
>;

describe('cross-tenant IDOR - company and operator actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireActionAuth.mockResolvedValue(tenantBContext());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['getCompanies', () => getCompanies(), 'companies.read', 20],
    ['getCompany', () => getCompany(IDOR_COMPANY_A.id), 'companies.read', undefined],
    ['getOwnCompany', () => getOwnCompany(), 'company.manage', undefined],
    [
      'getCompanyReadiness',
      () => getCompanyReadiness(IDOR_COMPANY_A.id),
      'companies.read',
      IDOR_COMPANY_A.id,
    ],
    [
      'getOwnCompanyReadiness',
      () => getOwnCompanyReadiness(),
      'company.manage',
      undefined,
    ],
    [
      'createCompany',
      () =>
        createCompany({
          name: 'Foreign',
          phone: '5551234567',
          email: 'foreign@example.com',
          status: 'SETUP',
          street: 'Street',
          exterior_number: '1',
          interior_number: null,
          neighborhood: 'Center',
          city: 'CDMX',
          state: 'CDMX',
          country: 'MX',
          postal_code: '01000',
          settings: {},
          owner: {
            first_name: 'Owner',
            last_name: 'Tenant',
            email: 'owner@example.com',
            password: 'password123',
          },
        }),
      'companies.write',
      undefined,
    ],
    [
      'updateCompany',
      () =>
        updateCompany(IDOR_COMPANY_A.id, {
          name: 'Foreign',
          phone: '5551234567',
          email: 'foreign@example.com',
          status: 'ACTIVE',
          street: 'Street',
          exterior_number: '1',
          interior_number: null,
          neighborhood: 'Center',
          city: 'CDMX',
          state: 'CDMX',
          country: 'MX',
          postal_code: '01000',
          settings: {},
        }),
      'companies.write',
      undefined,
    ],
    [
      'updateOwnCompany',
      () =>
        updateOwnCompany({
          name: 'Foreign',
          phone: '5551234567',
          email: 'foreign@example.com',
          status: 'ACTIVE',
          street: 'Street',
          exterior_number: '1',
          interior_number: null,
          neighborhood: 'Center',
          city: 'CDMX',
          state: 'CDMX',
          country: 'MX',
          postal_code: '01000',
          settings: {},
        }),
      'company.manage',
      undefined,
    ],
    [
      'uploadCompanyLogo',
      () => uploadCompanyLogo(IDOR_COMPANY_A.id, {} as FormData),
      'company.manage',
      undefined,
    ],
    [
      'removeCompanyLogo',
      () => removeCompanyLogo(IDOR_COMPANY_A.id),
      'company.manage',
      undefined,
    ],
    ['deleteCompany', () => deleteCompany(IDOR_COMPANY_A.id), 'companies.write', undefined],
    [
      'exportCompanyData',
      () => exportCompanyData(IDOR_COMPANY_A.id),
      'companies.read',
      IDOR_COMPANY_A.id,
    ],
    [
      'downloadCompanyExportJson',
      () => downloadCompanyExportJson(IDOR_COMPANY_A.id),
      'companies.read',
      IDOR_COMPANY_A.id,
    ],
    [
      'offboardCompany',
      () => offboardCompany(IDOR_COMPANY_A.id),
      'companies.write',
      IDOR_COMPANY_A.id,
    ],
    [
      'setCompanyLifecycleStatus',
      () => setCompanyLifecycleStatus(IDOR_COMPANY_A.id, 'ACTIVE'),
      'companies.write',
      IDOR_COMPANY_A.id,
    ],
    [
      'getCompanyOperatorSummary',
      () => getCompanyOperatorSummary(IDOR_COMPANY_A.id),
      'companies.read',
      IDOR_COMPANY_A.id,
    ],
    [
      'requestCompanyExport',
      () => requestCompanyExport(IDOR_COMPANY_A.id),
      'companies.read',
      IDOR_COMPANY_A.id,
    ],
  ])(
    '%s denies tenant B for company A surface',
    async (_name, call, permission, targetCompanyId) => {
      mockActionCrossTenantDenied(mockRequireActionPermission);

      const result = await call();

      expect(result.success).toBe(false);
      if (targetCompanyId === undefined) {
        expect(mockRequireActionPermission).toHaveBeenCalledWith(permission);
      } else {
        expect(mockRequireActionPermission).toHaveBeenCalledWith(
          permission,
          targetCompanyId,
        );
      }
    },
  );
});

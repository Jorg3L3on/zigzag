import { AuthorizationError } from '@/lib/errors';
import {
  buildIdorActionContext,
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
} from '@/test/idor-fixtures';

export { IDOR_COMPANY_A, IDOR_COMPANY_B, IDOR_RESOURCES_A };

export const tenantBContext = () => buildIdorActionContext(IDOR_COMPANY_B, '201');

export const mockActionCrossTenantDenied = (
  mockRequireActionPermission: jest.Mock,
) => {
  mockRequireActionPermission.mockRejectedValue(
    new AuthorizationError('Access denied to requested company'),
  );
};

export const mockActionAuthorized = (
  mockRequireActionPermission: jest.Mock,
  companyId = IDOR_COMPANY_B.id,
) => {
  mockRequireActionPermission.mockResolvedValue({
    context: buildIdorActionContext(
      companyId === IDOR_COMPANY_A.id ? IDOR_COMPANY_A : IDOR_COMPANY_B,
      '201',
    ),
    companyId,
  });
};

export const mockActionPermissionDenied = (
  mockRequireActionPermission: jest.Mock,
) => {
  mockRequireActionPermission.mockRejectedValue(
    new AuthorizationError('Insufficient permissions'),
  );
};

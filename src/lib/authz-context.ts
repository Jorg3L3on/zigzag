import { AuthorizationError } from './errors';

export type ActionAuthContext = {
  userId: string;
  companyId: number | null;
  companyIsSystem: boolean;
};

export function resolveWritableCompanyId(
  context: ActionAuthContext,
  requestedCompanyId?: number | null,
): number {
  if (context.companyIsSystem) {
    const companyId = requestedCompanyId ?? context.companyId;
    if (!companyId) {
      throw new AuthorizationError('System user must provide company context');
    }
    return companyId;
  }

  if (!context.companyId) {
    throw new AuthorizationError('Company context not found');
  }

  if (
    requestedCompanyId !== undefined &&
    requestedCompanyId !== null &&
    requestedCompanyId !== context.companyId
  ) {
    throw new AuthorizationError('Access denied to requested company');
  }

  return context.companyId;
}

export function requireSystemUser(context: ActionAuthContext): void {
  if (!context.companyIsSystem) {
    throw new AuthorizationError('System-level access required');
  }
}

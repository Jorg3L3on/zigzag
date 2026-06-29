import { assertTenantOwnership } from '@/lib/tenant';
import { AuthorizationError } from '@/lib/errors';

describe('assertTenantOwnership', () => {
  it('passes when the row belongs to the company', () => {
    expect(() =>
      assertTenantOwnership({ company_id: 5 }, 5),
    ).not.toThrow();
  });

  it('throws for a different company', () => {
    expect(() => assertTenantOwnership({ company_id: 9 }, 5)).toThrow(
      AuthorizationError,
    );
  });

  it('throws for null/undefined rows', () => {
    expect(() => assertTenantOwnership(null, 5)).toThrow(AuthorizationError);
    expect(() => assertTenantOwnership(undefined, 5)).toThrow(
      AuthorizationError,
    );
  });

  it('throws when the row has a null company_id', () => {
    expect(() => assertTenantOwnership({ company_id: null }, 5)).toThrow(
      AuthorizationError,
    );
  });
});

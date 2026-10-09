import { describe, expect, it } from '@jest/globals';
import { hideShadowedSharedRoles } from '@/lib/role-visibility';

describe('hideShadowedSharedRoles', () => {
  it('hides a shared role once the company owns one with the same name', () => {
    const roles = [
      { id: 1, name: 'Admin', company_id: null },
      { id: 2, name: 'Operator', company_id: null },
      { id: 3, name: 'Viewer', company_id: null },
      { id: 9, name: 'operator ', company_id: 4 },
    ];

    expect(hideShadowedSharedRoles(roles).map((role) => role.id)).toEqual([1, 3, 9]);
  });

  it('keeps everything when nothing is shadowed', () => {
    const roles = [
      { id: 1, name: 'Admin', company_id: null },
      { id: 9, name: 'Técnico', company_id: 4 },
    ];

    expect(hideShadowedSharedRoles(roles)).toEqual(roles);
  });
});

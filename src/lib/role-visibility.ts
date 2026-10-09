/**
 * After copy-on-write (ZIG-I3-5) a company owns a role with the same name as a
 * shared global one. Tenants should see only their own copy: drop shared roles
 * shadowed by a company role of the same name (case-insensitive).
 */
export const hideShadowedSharedRoles = <
  T extends { name: string; company_id: number | null },
>(
  roles: T[],
): T[] => {
  const ownNames = new Set(
    roles
      .filter((role) => role.company_id !== null)
      .map((role) => role.name.trim().toLocaleLowerCase('es')),
  );
  return roles.filter(
    (role) =>
      role.company_id !== null ||
      !ownNames.has(role.name.trim().toLocaleLowerCase('es')),
  );
};

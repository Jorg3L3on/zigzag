/**
 * «Qué puede hacer» in words (ZIG-I38-6, audit C3): permission keys such as
 * `tickets.read` become areas («Tickets: ver y editar») instead of keys.
 */
const AREA_LABEL: Record<string, string> = {
  tickets: 'Tickets',
  clients: 'Clientes',
  services: 'Servicios',
  users: 'Personas',
  roles: 'Roles',
  permissions: 'Permisos',
  companies: 'Empresas',
  company: 'Mi empresa',
};

const AREA_ORDER = ['tickets', 'clients', 'services', 'company', 'users', 'roles', 'permissions', 'companies'];

export const describeRoleAreas = (permissionNames: string[]): string => {
  const byArea = new Map<string, Set<string>>();
  for (const name of permissionNames) {
    const [area, verb] = name.split('.');
    if (!area) continue;
    const verbs = byArea.get(area) ?? new Set<string>();
    if (verb) verbs.add(verb);
    byArea.set(area, verbs);
  }
  if (byArea.size === 0) return 'Nada todavía';
  const parts = Array.from(byArea.entries())
    .sort(([a], [b]) => {
      const ia = AREA_ORDER.indexOf(a);
      const ib = AREA_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    })
    .map(([area, verbs]) => {
      const label = AREA_LABEL[area] ?? area;
      const canWrite = verbs.has('write') || verbs.has('delete') || verbs.has('create');
      return canWrite ? label : `${label} (solo ver)`;
    });
  return parts.join(', ');
};

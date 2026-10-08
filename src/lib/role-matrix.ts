import { PERMISSIONS } from '@/lib/permissions';

/**
 * Ver / Editar matrix over the existing permission keys (ZIG-I3-5). A UI over
 * RolePermission rows: no new keys, `write` always implies `read`.
 */
export type RoleMatrixModuleKey =
  | 'tickets'
  | 'clients'
  | 'services'
  | 'users'
  | 'roles'
  | 'company';

export type RoleMatrixModule = {
  key: RoleMatrixModuleKey;
  label: string;
  hint?: string;
  /** Absent for single-box modules (Mi empresa). */
  read?: string;
  write: string;
  writeLabel: string;
};

export const ROLE_MATRIX_MODULES: RoleMatrixModule[] = [
  {
    key: 'tickets',
    label: 'Tickets',
    hint: 'Tickets, cobranza, presupuestos y recordatorios',
    read: PERMISSIONS.tickets.read,
    write: PERMISSIONS.tickets.write,
    writeLabel: 'Editar',
  },
  {
    key: 'clients',
    label: 'Clientes',
    hint: 'Directorio y contactos',
    read: PERMISSIONS.clients.read,
    write: PERMISSIONS.clients.write,
    writeLabel: 'Editar',
  },
  {
    key: 'services',
    label: 'Servicios',
    hint: 'Catálogo y precios',
    read: PERMISSIONS.services.read,
    write: PERMISSIONS.services.write,
    writeLabel: 'Editar',
  },
  {
    key: 'users',
    label: 'Equipo',
    hint: 'Usuarios de la empresa',
    read: PERMISSIONS.users.read,
    write: PERMISSIONS.users.write,
    writeLabel: 'Editar',
  },
  {
    key: 'roles',
    label: 'Roles',
    hint: 'Roles y sus permisos',
    read: PERMISSIONS.roles.read,
    write: PERMISSIONS.roles.write,
    writeLabel: 'Editar',
  },
  {
    key: 'company',
    label: 'Mi empresa',
    hint: 'Datos, logo, RFC y configuración',
    write: PERMISSIONS.company.manage,
    writeLabel: 'Administrar',
  },
];

export type RoleMatrixCell = { read: boolean; write: boolean };
export type RoleMatrix = Record<RoleMatrixModuleKey, RoleMatrixCell>;

/** Every key the matrix can express. Anything else on a role is preserved untouched. */
export const ROLE_MATRIX_KEYS: string[] = ROLE_MATRIX_MODULES.flatMap((matrixModule) =>
  matrixModule.read ? [matrixModule.read, matrixModule.write] : [matrixModule.write],
);

export const emptyRoleMatrix = (): RoleMatrix =>
  Object.fromEntries(
    ROLE_MATRIX_MODULES.map((matrixModule) => [matrixModule.key, { read: false, write: false }]),
  ) as RoleMatrix;

export const toMatrix = (permissionKeys: Iterable<string>): RoleMatrix => {
  const keys = new Set(permissionKeys);
  const matrix = emptyRoleMatrix();
  for (const matrixModule of ROLE_MATRIX_MODULES) {
    const write = keys.has(matrixModule.write);
    const read = matrixModule.read ? write || keys.has(matrixModule.read) : write;
    matrix[matrixModule.key] = { read, write };
  }
  return matrix;
};

/**
 * Matrix back to keys, write ⇒ read. `preservedKeys` (e.g. the role's current
 * keys) keep anything the matrix does not cover, such as permissions.read.
 */
export const toPermissionKeys = (
  matrix: RoleMatrix,
  preservedKeys: Iterable<string> = [],
): string[] => {
  const keys = new Set<string>();
  for (const key of preservedKeys) {
    if (!ROLE_MATRIX_KEYS.includes(key)) {
      keys.add(key);
    }
  }
  for (const matrixModule of ROLE_MATRIX_MODULES) {
    const cell = matrix[matrixModule.key];
    if (cell.write) {
      keys.add(matrixModule.write);
    }
    if (matrixModule.read && (cell.read || cell.write)) {
      keys.add(matrixModule.read);
    }
  }
  return Array.from(keys).sort();
};

/** Ticking Editar ticks Ver; unticking Ver unticks Editar. */
export const setMatrixCell = (
  matrix: RoleMatrix,
  moduleKey: RoleMatrixModuleKey,
  level: keyof RoleMatrixCell,
  checked: boolean,
): RoleMatrix => {
  const matrixModule = ROLE_MATRIX_MODULES.find((item) => item.key === moduleKey);
  const current = matrix[moduleKey];
  let next: RoleMatrixCell;
  if (!matrixModule?.read) {
    // Single box: read mirrors write.
    next = { read: checked, write: checked };
  } else if (level === 'write') {
    next = { read: checked ? true : current.read, write: checked };
  } else {
    next = { read: checked, write: checked ? current.write : false };
  }
  return { ...matrix, [moduleKey]: next };
};

export const matrixEquals = (a: RoleMatrix, b: RoleMatrix): boolean =>
  ROLE_MATRIX_MODULES.every(
    (matrixModule) =>
      a[matrixModule.key].read === b[matrixModule.key].read &&
      a[matrixModule.key].write === b[matrixModule.key].write,
  );

export type RoleTemplateKey = 'administrador' | 'tecnico' | 'soloLectura';

export const ROLE_TEMPLATES: Array<{
  key: RoleTemplateKey;
  label: string;
  description: string;
  keys: string[];
}> = [
  {
    key: 'administrador',
    label: 'Administrador',
    description: 'Todo, incluido el equipo, los roles y la empresa',
    keys: ROLE_MATRIX_KEYS,
  },
  {
    key: 'tecnico',
    label: 'Técnico',
    description: 'Trabaja tickets y clientes; consulta servicios',
    keys: [
      PERMISSIONS.tickets.read,
      PERMISSIONS.tickets.write,
      PERMISSIONS.clients.read,
      PERMISSIONS.clients.write,
      PERMISSIONS.services.read,
    ],
  },
  {
    key: 'soloLectura',
    label: 'Solo lectura',
    description: 'Consulta tickets, clientes y servicios',
    keys: [
      PERMISSIONS.tickets.read,
      PERMISSIONS.clients.read,
      PERMISSIONS.services.read,
    ],
  },
];

export const templateMatrix = (templateKey: RoleTemplateKey): RoleMatrix =>
  toMatrix(ROLE_TEMPLATES.find((template) => template.key === templateKey)?.keys ?? []);

/** Short summary for role list rows, e.g. "Tickets, Clientes · solo ver Servicios". */
export const summarizeMatrix = (matrix: RoleMatrix): string => {
  const editable = ROLE_MATRIX_MODULES.filter((m) => matrix[m.key].write).map(
    (m) => m.label,
  );
  const readOnly = ROLE_MATRIX_MODULES.filter(
    (m) => matrix[m.key].read && !matrix[m.key].write,
  ).map((m) => m.label);
  const parts: string[] = [];
  if (editable.length > 0) {
    parts.push(`Edita ${editable.join(', ')}`);
  }
  if (readOnly.length > 0) {
    parts.push(`ve ${readOnly.join(', ')}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sin permisos';
};

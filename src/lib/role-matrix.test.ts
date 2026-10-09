import { describe, expect, it } from '@jest/globals';
import {
  emptyRoleMatrix,
  matrixEquals,
  ROLE_MATRIX_KEYS,
  setMatrixCell,
  summarizeMatrix,
  templateMatrix,
  toMatrix,
  toPermissionKeys,
} from '@/lib/role-matrix';

describe('role-matrix', () => {
  it('covers exactly the tenant keys (no companies.* or permissions.*)', () => {
    expect([...ROLE_MATRIX_KEYS].sort()).toEqual([
      'clients.read',
      'clients.write',
      'company.manage',
      'roles.read',
      'roles.write',
      'services.read',
      'services.write',
      'tickets.read',
      'tickets.write',
      'users.read',
      'users.write',
    ]);
  });

  it('round-trips keys through the matrix', () => {
    const keys = ['clients.read', 'company.manage', 'tickets.read', 'tickets.write'];
    expect(toPermissionKeys(toMatrix(keys))).toEqual(keys);
  });

  it('reads write-only rows as Ver + Editar and saves both keys', () => {
    const matrix = toMatrix(['services.write']);
    expect(matrix.services).toEqual({ read: true, write: true });
    expect(toPermissionKeys(matrix)).toEqual(['services.read', 'services.write']);
  });

  it('preserves keys the matrix does not cover', () => {
    const current = ['permissions.read', 'tickets.read', 'companies.read'];
    const next = setMatrixCell(toMatrix(current), 'tickets', 'read', false);
    expect(toPermissionKeys(next, current)).toEqual([
      'companies.read',
      'permissions.read',
    ]);
  });

  it('ticking Editar ticks Ver; unticking Ver unticks Editar', () => {
    let matrix = emptyRoleMatrix();
    matrix = setMatrixCell(matrix, 'clients', 'write', true);
    expect(matrix.clients).toEqual({ read: true, write: true });

    matrix = setMatrixCell(matrix, 'clients', 'write', false);
    expect(matrix.clients).toEqual({ read: true, write: false });

    matrix = setMatrixCell(matrix, 'clients', 'write', true);
    matrix = setMatrixCell(matrix, 'clients', 'read', false);
    expect(matrix.clients).toEqual({ read: false, write: false });
  });

  it('treats Mi empresa as a single Administrar box', () => {
    const matrix = setMatrixCell(emptyRoleMatrix(), 'company', 'write', true);
    expect(matrix.company).toEqual({ read: true, write: true });
    expect(toPermissionKeys(matrix)).toEqual(['company.manage']);
  });

  it('applies the three templates', () => {
    expect(toPermissionKeys(templateMatrix('administrador'))).toEqual(
      [...ROLE_MATRIX_KEYS].sort(),
    );
    expect(toPermissionKeys(templateMatrix('tecnico'))).toEqual([
      'clients.read',
      'clients.write',
      'services.read',
      'tickets.read',
      'tickets.write',
    ]);
    expect(toPermissionKeys(templateMatrix('soloLectura'))).toEqual([
      'clients.read',
      'services.read',
      'tickets.read',
    ]);
  });

  it('compares and summarizes matrices', () => {
    expect(matrixEquals(templateMatrix('tecnico'), templateMatrix('tecnico'))).toBe(
      true,
    );
    expect(
      matrixEquals(templateMatrix('tecnico'), templateMatrix('soloLectura')),
    ).toBe(false);
    expect(summarizeMatrix(templateMatrix('tecnico'))).toBe(
      'Edita Tickets, Clientes · ve Servicios',
    );
    expect(summarizeMatrix(emptyRoleMatrix())).toBe('Sin permisos');
  });
});

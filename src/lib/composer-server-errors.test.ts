import { ZodError, z } from 'zod';

import { mapServerIssues } from '@/lib/composer-server-errors';
import { composerServiceLineSchema } from '@/lib/ticket-service-line-schema';
import { toValidationIssues } from '@/lib/validation-issues';

const lines = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];

const issuesFor = (input: unknown[]) => {
  const result = z.array(composerServiceLineSchema).safeParse(input);
  expect(result.success).toBe(false);
  return toValidationIssues((result as { error: ZodError }).error);
};

describe('toValidationIssues + mapServerIssues (ZIG-I12)', () => {
  it('names the line and field for a price over the maximum', () => {
    const issues = issuesFor([
      { service_id: 1, quantity: 1, price: 1 },
      { kind: 'custom', name: 'Servicio', quantity: 1, price: 999_999_999 },
    ]);

    expect(issues.some((issue) => issue.path.join('.') === '1.price')).toBe(true);
    const mapped = mapServerIssues(
      issues.map((issue) => ({ ...issue, path: ['lines', ...issue.path] })),
      lines,
    );
    expect(mapped.rowErrors).toEqual({ b: 'Precio: Máximo $99,999,999.99' });
    expect(mapped.summary).toBe('Línea 2 · Precio: Máximo $99,999,999.99');
  });

  it('explains quantity limits and the decimals rule on a catalog line', () => {
    const issues = issuesFor([{ service_id: 1, quantity: 99999, price: 1 }]);
    const mapped = mapServerIssues(
      issues.map((issue) => ({ ...issue, path: ['lines', ...issue.path] })),
      lines,
    );
    expect(mapped.rowErrors.a).toBe('Cantidad: Máximo 9,999.99');

    const decimals = issuesFor([{ service_id: 1, quantity: 1.234, price: 1 }]);
    expect(
      mapServerIssues(
        decimals.map((issue) => ({ ...issue, path: ['lines', ...issue.path] })),
        lines,
      ).rowErrors.a,
    ).toBe('Cantidad: Usa máximo 2 decimales');
  });

  it('marks a missing inline name and a material quantity', () => {
    const mapped = mapServerIssues(
      [
        { path: ['lines', 2, 'name'], code: 'too_small', message: 'x' },
        { path: ['lines', 0, 'materials', 1, 'quantity'], code: 'too_big', message: 'x' },
      ],
      lines,
    );
    expect(mapped.rowErrors.c).toBe('Nombre: El nombre es obligatorio');
    expect(mapped.rowErrors.a).toBe('Material 2 · Cantidad: Máximo 9,999.99');
  });

  it('summarizes at most two issues and counts the rest', () => {
    const mapped = mapServerIssues(
      [
        { path: ['lines', 0, 'price'], code: 'too_big', message: 'x' },
        { path: ['lines', 1, 'price'], code: 'too_big', message: 'x' },
        { path: ['lines', 2, 'price'], code: 'too_big', message: 'x' },
      ],
      lines,
    );
    expect(mapped.summary).toContain('Línea 1');
    expect(mapped.summary).toContain('Línea 2');
    expect(mapped.summary?.endsWith(' y 1 más')).toBe(true);
  });

  it('places notes issues under the notes field and the update path (services)', () => {
    const mapped = mapServerIssues(
      [
        { path: ['work_notes'], code: 'too_big', message: 'x' },
        { path: ['services', 0, 'quantity'], code: 'too_small', message: 'x' },
      ],
      lines,
    );
    expect(mapped.notesError).toBe('Notas: máximo 2,000 caracteres');
    expect(mapped.rowErrors.a).toBe('Cantidad: Mínimo 0.01');
  });

  it('returns nothing to place for unrelated issues', () => {
    expect(mapServerIssues([{ path: ['client_id'], code: 'invalid_type', message: 'x' }], lines)).toEqual({
      rowErrors: {},
      notesError: null,
      summary: null,
    });
    expect(mapServerIssues(undefined, lines).summary).toBeNull();
  });
});

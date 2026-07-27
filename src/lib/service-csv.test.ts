import {
  SERVICE_CSV_HEADERS,
  SERVICE_CSV_MAX_ROWS,
  assertServiceCsvRowCount,
  buildServiceCsvPlantilla,
  normalizeServiceCsvRecord,
} from '@/lib/service-csv';

describe('service CSV schema', () => {
  it('exports Spanish canonical headers', () => {
    expect([...SERVICE_CSV_HEADERS]).toEqual([
      'nombre',
      'descripción',
      'precio',
    ]);
  });

  it('normalizes Spanish headers', () => {
    expect(
      normalizeServiceCsvRecord({
        nombre: 'A',
        descripción: 'B',
        precio: '10',
      }),
    ).toEqual({ name: 'A', description: 'B', price: '10' });
  });

  it('accepts unaccented descripcion and English aliases', () => {
    expect(
      normalizeServiceCsvRecord({
        name: 'A',
        description: 'B',
        price: '10',
      }),
    ).toEqual({ name: 'A', description: 'B', price: '10' });

    expect(
      normalizeServiceCsvRecord({
        Nombre: 'A',
        descripcion: 'B',
        Precio: '10',
      }),
    ).toEqual({ name: 'A', description: 'B', price: '10' });
  });

  it('returns null when a required column is missing', () => {
    expect(normalizeServiceCsvRecord({ nombre: 'A', precio: '1' })).toBeNull();
  });

  it('enforces max 500 data rows', () => {
    expect(assertServiceCsvRowCount(0)).toEqual({
      ok: false,
      error: 'El archivo no contiene filas de datos',
    });
    expect(assertServiceCsvRowCount(SERVICE_CSV_MAX_ROWS).ok).toBe(true);
    expect(assertServiceCsvRowCount(SERVICE_CSV_MAX_ROWS + 1)).toEqual({
      ok: false,
      error: `Máximo ${SERVICE_CSV_MAX_ROWS} filas por archivo`,
    });
  });

  it('builds plantilla with headers and two example rows', () => {
    const csv = buildServiceCsvPlantilla();
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toBe('nombre,descripción,precio');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Lavado express');
    expect(lines[2]).toContain('Detallado premium');
  });
});

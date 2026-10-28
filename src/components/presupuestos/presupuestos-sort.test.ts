import {
  DEFAULT_PRESUPUESTO_SORTING,
  parsePresupuestoSortParam,
  presupuestoSortForServer,
  presupuestoSortParam,
} from '@/components/presupuestos/presupuestos-sort';

describe('presupuestos ?orden= and the server sort (ZIG-I33-2)', () => {
  it('reads what the headers write', () => {
    expect(parsePresupuestoSortParam('total-desc')).toEqual([{ id: 'total', desc: true }]);
    expect(parsePresupuestoSortParam('cliente-asc')).toEqual([{ id: 'cliente', desc: false }]);
    expect(parsePresupuestoSortParam('vence-desc')).toEqual([{ id: 'vence', desc: true }]);
  });

  it('reads the old select values as the same orders', () => {
    expect(parsePresupuestoSortParam('vence')).toEqual([{ id: 'vence', desc: false }]);
    expect(parsePresupuestoSortParam('recientes')).toEqual([{ id: 'emitido', desc: true }]);
    expect(parsePresupuestoSortParam('total')).toEqual([{ id: 'total', desc: true }]);
  });

  it('falls back to Vencen primero for anything else', () => {
    for (const value of [null, '', 'estado-asc', 'trabajo-desc', 'total-up', 'total:desc', '-asc']) {
      expect(parsePresupuestoSortParam(value)).toBe(DEFAULT_PRESUPUESTO_SORTING);
    }
  });

  it('sends a whitelisted column to the server', () => {
    expect(presupuestoSortForServer([{ id: 'emitido', desc: true }])).toEqual({
      column: 'emitido',
      direction: 'desc',
    });
    expect(presupuestoSortForServer([])).toEqual({ column: 'vence', direction: 'asc' });
    expect(presupuestoSortForServer([{ id: 'estado', desc: false }])).toEqual({
      column: 'vence',
      direction: 'asc',
    });
  });

  it('keeps the default out of the URL', () => {
    expect(presupuestoSortParam(DEFAULT_PRESUPUESTO_SORTING)).toBeNull();
    expect(presupuestoSortParam([{ id: 'vence', desc: true }])).toBe('vence-desc');
    expect(presupuestoSortParam([{ id: 'folio', desc: false }])).toBe('folio-asc');
  });
});

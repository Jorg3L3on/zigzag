import {
  filterPresupuestosBySearch,
  matchesPresupuestoSearch,
} from '@/lib/presupuestos-search';

const plaza = { id: '1069', clientName: 'Plaza Comercial Aurora', clientTel: '33 1234 5678' };
const jose = { id: '1070', clientName: 'José Pérez', clientTel: null };

describe('matchesPresupuestoSearch', () => {
  it('matches everything on an empty query', () => {
    expect(matchesPresupuestoSearch(plaza, '   ')).toBe(true);
  });

  it('matches client names ignoring case and accents', () => {
    expect(matchesPresupuestoSearch(plaza, 'plaza')).toBe(true);
    expect(matchesPresupuestoSearch(jose, 'jose perez')).toBe(true);
    expect(matchesPresupuestoSearch(jose, 'PÉREZ')).toBe(true);
    expect(matchesPresupuestoSearch(plaza, 'perez')).toBe(false);
  });

  it('matches #id and id digits', () => {
    expect(matchesPresupuestoSearch(plaza, '#1069')).toBe(true);
    expect(matchesPresupuestoSearch(plaza, '1069')).toBe(true);
    expect(matchesPresupuestoSearch(jose, '#1069')).toBe(false);
  });

  it('matches phone digits regardless of formatting', () => {
    expect(matchesPresupuestoSearch(plaza, '331234')).toBe(true);
    expect(matchesPresupuestoSearch(plaza, '33 1234')).toBe(true);
    expect(matchesPresupuestoSearch(jose, '331234')).toBe(false);
  });

  it('limits a #-query to the id, never the phone', () => {
    expect(matchesPresupuestoSearch(plaza, '#1234')).toBe(false);
  });
});

describe('filterPresupuestosBySearch', () => {
  it('keeps matching items only', () => {
    expect(filterPresupuestosBySearch([plaza, jose], 'plaza')).toEqual([plaza]);
  });
});

import {
  getServiceLineDescription,
  getServiceLineName,
  isInlineServiceLine,
} from '@/lib/service-line-display';

describe('service line display (ZIG-I5)', () => {
  it('reads catalog lines from the joined service', () => {
    const line = {
      service_id: 3,
      name: null,
      description: null,
      service: { name: 'Mantenimiento', description: 'Limpieza de filtros' },
    };
    expect(isInlineServiceLine(line)).toBe(false);
    expect(getServiceLineName(line)).toBe('Mantenimiento');
    expect(getServiceLineDescription(line)).toBe('Limpieza de filtros');
  });

  it('reads inline lines from their own name and description', () => {
    const line = {
      service_id: null,
      name: 'Cambio de capacitor',
      description: '35 µF',
      service: null,
    };
    expect(isInlineServiceLine(line)).toBe(true);
    expect(getServiceLineName(line)).toBe('Cambio de capacitor');
    expect(getServiceLineDescription(line)).toBe('35 µF');
  });

  it('falls back to Servicio when nothing is set', () => {
    expect(getServiceLineName({ service_id: null, service: null })).toBe('Servicio');
    expect(getServiceLineDescription({ service_id: null })).toBe('');
  });
});

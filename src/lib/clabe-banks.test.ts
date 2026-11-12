import { bankDiffersFromClabe, bankFromClabe, CLABE_BANKS } from '@/lib/clabe-banks';

// Every prefix in the table, checked against the Banxico CEP-SCL list
// (2026-10-30) and the FedGlobal appendix G ABM numbers.
const EXPECTED: [string, string][] = [
  ['002', 'Banamex'],
  ['006', 'Bancomext'],
  ['009', 'Banobras'],
  ['012', 'BBVA México'],
  ['014', 'Santander'],
  ['019', 'Banjército'],
  ['021', 'HSBC'],
  ['030', 'BanBajío'],
  ['036', 'Inbursa'],
  ['042', 'Mifel'],
  ['044', 'Scotiabank'],
  ['058', 'Banregio'],
  ['059', 'Invex'],
  ['060', 'Bansi'],
  ['062', 'Afirme'],
  ['072', 'Banorte'],
  ['106', 'Bank of America'],
  ['108', 'MUFG'],
  ['110', 'J.P. Morgan'],
  ['112', 'Banco Monex'],
  ['113', 'Ve por Más'],
  ['124', 'Citi México'],
  ['127', 'Banco Azteca'],
  ['128', 'Kapital'],
  ['129', 'Barclays'],
  ['130', 'Compartamos'],
  ['132', 'Multiva'],
  ['133', 'Actinver'],
  ['135', 'Nafin'],
  ['136', 'Intercam'],
  ['137', 'BanCoppel'],
  ['138', 'Ualá'],
  ['140', 'Consubanco'],
  ['141', 'Volkswagen Bank'],
  ['145', 'Banco Base'],
  ['147', 'Bankaool'],
  ['148', 'PagaTodo'],
  ['150', 'Banco Inmobiliario'],
  ['151', 'Dondé'],
  ['152', 'Bancrea'],
  ['154', 'Banco Covalto'],
  ['155', 'ICBC'],
  ['156', 'Sabadell'],
  ['157', 'Shinhan'],
  ['158', 'Mizuho'],
  ['159', 'Bank of China'],
  ['160', 'Banco S3'],
  ['166', 'Banco del Bienestar'],
  ['167', 'Hey Banco'],
  ['168', 'Hipotecaria Federal'],
  ['600', 'Monex Casa de Bolsa'],
  ['601', 'GBM'],
  ['602', 'Masari'],
  ['605', 'Value'],
  ['616', 'Finamex'],
  ['617', 'Valmex'],
  ['620', 'Profuturo'],
  ['631', 'TRF'],
  ['634', 'Fincomún'],
  ['638', 'Nu México'],
  ['646', 'STP'],
  ['652', 'Credicapital'],
  ['653', 'Kuspit'],
  ['656', 'Unagra'],
  ['659', 'ASP Integra OPC'],
  ['661', 'Klar'],
  ['670', 'Libertad'],
  ['677', 'Caja Popular Mexicana'],
  ['680', 'Cristóbal Colón'],
  ['683', 'Caja Telefonistas'],
  ['684', 'Transfer'],
  ['685', 'Fondo FIRA'],
  ['688', 'Crediclub'],
  ['699', 'Fondeadora'],
  ['703', 'Tesored'],
  ['706', 'Arcus'],
  ['710', 'NVIO'],
  ['714', 'PPBalance'],
  ['715', 'Cashi'],
  ['720', 'MexPago'],
  ['721', 'albo'],
  ['723', 'Cuenca'],
  ['725', 'Coopdesarrollo'],
  ['729', 'Dep y Pag Dig'],
  ['730', 'Clip'],
  ['732', 'Peibo'],
  ['734', 'Finco Pay'],
  ['738', 'Fintoc'],
];

describe('bankFromClabe (ZIG-36)', () => {
  it('lists exactly the 88 confirmed prefixes', () => {
    expect(Object.keys(CLABE_BANKS).sort()).toEqual(EXPECTED.map(([prefix]) => prefix));
    expect(EXPECTED).toHaveLength(88);
  });

  it.each(EXPECTED)('maps %s to %s', (prefix, name) => {
    expect(bankFromClabe(`${prefix}000000000000000`)).toBe(name);
    expect(bankFromClabe(prefix)).toBe(name);
  });

  it('reads the prefix through spaces and dashes', () => {
    expect(bankFromClabe('012 180 00000000000 0')).toBe('BBVA México');
    expect(bankFromClabe('0-1-2')).toBe('BBVA México');
  });

  it('returns null for short, empty, non-digit or unknown input', () => {
    expect(bankFromClabe('')).toBeNull();
    expect(bankFromClabe(null)).toBeNull();
    expect(bankFromClabe(undefined)).toBeNull();
    expect(bankFromClabe('01')).toBeNull();
    expect(bankFromClabe('01a456')).toBeNull();
    expect(bankFromClabe('999000000000000000')).toBeNull();
    // Unconfirmed against the ABM numbers, left out on purpose.
    for (const prefix of ['170', '660', '722', '727', '728']) {
      expect(bankFromClabe(prefix)).toBeNull();
    }
  });
});

describe('bankDiffersFromClabe (ZIG-36)', () => {
  const bbva = '012180000000000000';

  it('accepts the usual ways to write the same bank', () => {
    for (const typed of ['BBVA', 'bbva méxico', 'BBVA Bancomer', 'Bancomer', 'Banco BBVA']) {
      expect(bankDiffersFromClabe(typed, bbva)).toBe(false);
    }
    expect(bankDiffersFromClabe('Banco del Bajío', '030000')).toBe(false);
    expect(bankDiffersFromClabe('Nu', '638000')).toBe(false);
    expect(bankDiffersFromClabe('Coppel', '137000')).toBe(false);
    expect(bankDiffersFromClabe('Santand', '014000')).toBe(false);
  });

  it('flags a clearly different bank', () => {
    expect(bankDiffersFromClabe('Banorte', bbva)).toBe(true);
    expect(bankDiffersFromClabe('Santander', '002000')).toBe(true);
    expect(bankDiffersFromClabe('Nu', bbva)).toBe(true);
  });

  it('never flags an empty or filler-only bank, or an unknown CLABE', () => {
    expect(bankDiffersFromClabe('', bbva)).toBe(false);
    expect(bankDiffersFromClabe('  ', bbva)).toBe(false);
    expect(bankDiffersFromClabe('Banco', bbva)).toBe(false);
    expect(bankDiffersFromClabe(null, bbva)).toBe(false);
    expect(bankDiffersFromClabe('Banorte', '99')).toBe(false);
    expect(bankDiffersFromClabe('Banorte', '999000')).toBe(false);
  });
});

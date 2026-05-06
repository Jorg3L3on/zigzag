import { convertBigIntToString } from '@/lib/utils';

describe('convertBigIntToString', () => {
  it('converts bigint values recursively', () => {
    const input = {
      id: 1n,
      nested: {
        value: 2n,
      },
      list: [3n, { value: 4n }],
    };

    expect(convertBigIntToString(input)).toEqual({
      id: '1',
      nested: {
        value: '2',
      },
      list: ['3', { value: '4' }],
    });
  });

  it('converts dates to ISO strings', () => {
    const input = { created_at: new Date('2026-01-01T00:00:00.000Z') };
    expect(convertBigIntToString(input)).toEqual({
      created_at: '2026-01-01T00:00:00.000Z',
    });
  });
});

import { cn, convertBigIntToString } from '@/lib/utils';

describe('cn (ZIG-26)', () => {
  it('keeps text-caption and a text color together, in either order', () => {
    expect(cn('text-caption', 'text-muted-foreground')).toBe('text-caption text-muted-foreground');
    expect(cn('text-primary-foreground', 'text-caption')).toBe('text-primary-foreground text-caption');
    expect(cn('rounded-full text-caption font-semibold', 'bg-blue-500/15 text-blue-700')).toBe(
      'rounded-full text-caption font-semibold bg-blue-500/15 text-blue-700',
    );
  });

  it('still merges two sizes or two colors: the last one wins', () => {
    expect(cn('text-xs', 'text-caption')).toBe('text-caption');
    expect(cn('text-caption', 'text-sm')).toBe('text-sm');
    expect(cn('text-muted-foreground', 'text-destructive')).toBe('text-destructive');
    expect(cn('text-caption', 'md:text-sm')).toBe('text-caption md:text-sm');
  });
});

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

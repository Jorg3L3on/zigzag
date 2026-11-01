import { foldSearchText, matchesSearchText, searchPhoneDigits } from '@/lib/search-text';

describe('search text', () => {
  it('ignores accents and case', () => {
    expect(foldSearchText('Muñoz Ávila')).toBe('munoz avila');
    expect(matchesSearchText(['Juan Muñoz'], 'MUNOZ')).toBe(true);
    expect(matchesSearchText(['Juan Munoz'], 'muñoz')).toBe(true);
    expect(matchesSearchText(['Ana López'], 'perez')).toBe(false);
  });

  it('matches phones ignoring spaces, dashes and parentheses', () => {
    expect(matchesSearchText(['(555) 000-0632'], '555 000 0632')).toBe(true);
    expect(matchesSearchText(['5550000632'], '555-000-0632')).toBe(true);
    expect(matchesSearchText(['5550000632'], '555 000 9999')).toBe(false);
  });

  it('treats short or mixed text as not a phone', () => {
    expect(searchPhoneDigits('12')).toBe('');
    expect(searchPhoneDigits('R-0012')).toBe('');
    expect(searchPhoneDigits('(555) 000')).toBe('555000');
  });
});

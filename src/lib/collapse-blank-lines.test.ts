import { collapseBlankLines } from '@/lib/collapse-blank-lines';

describe('collapseBlankLines', () => {
  it('keeps single line breaks and one blank line', () => {
    expect(collapseBlankLines('a\nb\n\nc')).toBe('a\nb\n\nc');
  });

  it('collapses three or more line breaks into one blank line', () => {
    expect(collapseBlankLines('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('treats whitespace-only lines and CRLF as blank', () => {
    expect(collapseBlankLines('a\r\n  \r\n\t\r\n\r\nb')).toBe('a\n\nb');
  });

  it('trims the edges', () => {
    expect(collapseBlankLines('\n\n  a  \n\n')).toBe('a');
  });
});

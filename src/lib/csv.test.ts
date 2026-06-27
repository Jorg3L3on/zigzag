import { parseCsvRecords, parseCsvRows, toCsv } from '@/lib/csv';

describe('csv utilities', () => {
  it('serializes rows and escapes special characters', () => {
    const csv = toCsv(
      ['name', 'note'],
      [
        { name: 'Alice', note: 'hello' },
        { name: 'Bob, Jr.', note: 'line\nbreak' },
        { name: 'Quote "X"', note: '' },
      ],
    );
    expect(csv).toBe(
      'name,note\r\nAlice,hello\r\n"Bob, Jr.","line\nbreak"\r\n"Quote ""X""",',
    );
  });

  it('round-trips quoted fields with commas and escaped quotes', () => {
    const rows = parseCsvRows('a,b\r\n"x,y","he said ""hi"""');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,y', 'he said "hi"'],
    ]);
  });

  it('parses records keyed by lowercased headers', () => {
    const records = parseCsvRecords('Name,Email\r\nAlice,alice@example.com\r\n');
    expect(records).toEqual([
      { name: 'Alice', email: 'alice@example.com' },
    ]);
  });

  it('returns no records when only a header is present', () => {
    expect(parseCsvRecords('name,email')).toEqual([]);
  });

  it('ignores a leading BOM', () => {
    const records = parseCsvRecords('\ufeffname\r\nAlice');
    expect(records).toEqual([{ name: 'Alice' }]);
  });
});

/**
 * Minimal, dependency-free CSV utilities (RFC 4180-ish).
 * Handles quoted fields, escaped quotes (""), and CR/LF line endings.
 */

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/** Build a CSV string from a header row and an array of record objects. */
export const toCsv = (
  headers: string[],
  rows: ReadonlyArray<Record<string, unknown>>,
): string => {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header])).join(','),
  );
  return [headerLine, ...dataLines].join('\r\n');
};

/** Parse CSV text into an array of rows (each row is an array of string cells). */
export const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // Strip a leading BOM if present.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (char === '\r') {
      // Handle CRLF and lone CR.
      pushRow();
      if (input[i + 1] === '\n') {
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (char === '\n') {
      pushRow();
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // Flush the final field/row unless the input ended on a row boundary.
  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
};

export type CsvRecord = Record<string, string>;

/**
 * Parse CSV text into header-keyed records. Returns an empty array if there is
 * no data beyond the header. Header names are trimmed and lowercased.
 */
export const parseCsvRecords = (text: string): CsvRecord[] => {
  const rows = parseCsvRows(text).filter(
    (cells) => cells.length > 0 && cells.some((cell) => cell.trim() !== ''),
  );
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });
};

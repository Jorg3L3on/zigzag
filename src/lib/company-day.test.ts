import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  companyDay,
  companyDayRangeIso,
  companyDayStart,
  COMPANY_TIME_ZONE,
  parseCompanyDayIso,
} from '@/lib/company-day';

/** 23:00 in Mexico City, which is 05:00 UTC the next calendar day. */
const ELEVEN_PM_CDMX = new Date('2026-10-23T23:00:00-06:00');

describe('companyDay', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(ELEVEN_PM_CDMX);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the company calendar day at 23:00 CDMX, not the UTC date', () => {
    expect(ELEVEN_PM_CDMX.toISOString().slice(0, 10)).toBe('2026-10-24');
    expect(companyDay(new Date()).iso).toBe('2026-10-23');
    expect(companyDay(new Date(), COMPANY_TIME_ZONE).date.toISOString()).toBe(
      '2026-10-23T12:00:00.000Z',
    );
  });

  it('keeps a midday UTC instant on the same company day', () => {
    expect(companyDay(new Date('2026-10-23T18:00:00.000Z')).iso).toBe('2026-10-23');
  });

  it('is idempotent: noon UTC of a company day stays on that day', () => {
    const first = companyDay(ELEVEN_PM_CDMX);
    expect(companyDay(first.date).iso).toBe(first.iso);
  });
});

describe('companyDayStart and parseCompanyDayIso (ZIG-I30)', () => {
  it('starts the Mexico City day at 06:00 UTC', () => {
    const day = companyDay(ELEVEN_PM_CDMX).date;
    expect(companyDayStart(day).toISOString()).toBe('2026-10-23T06:00:00.000Z');
    expect(companyDayStart(day, 'UTC').toISOString()).toBe('2026-10-23T00:00:00.000Z');
  });

  it('parses a civil day to noon UTC and rejects anything else', () => {
    expect(parseCompanyDayIso('2026-02-28')?.toISOString()).toBe('2026-02-28T12:00:00.000Z');
    expect(parseCompanyDayIso('2026-02-30')).toBeNull();
    expect(parseCompanyDayIso('2026-2-3')).toBeNull();
    expect(parseCompanyDayIso('ayer')).toBeNull();
  });
});

describe('company day replaces UTC today slices (ZIG-25)', () => {
  const files = [
    'src/components/tickets/ticket-row-actions.tsx',
    'src/components/field/job-whatsapp-send-menu.tsx',
    'src/lib/mcp/domain/documents.ts',
    'src/lib/technician-day-queue.ts',
    'src/lib/schedule-buckets.ts',
    'src/lib/dashboard-day-queue-loader.ts',
    'src/lib/notifications.ts',
    'src/lib/receipt-pdf/payload.ts',
    'src/lib/ticket-pdf-data.ts',
  ];

  it.each(files)('%s does not take today from toISOString().slice(0, 10)', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(source).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
    expect(source).toContain('companyDay');
  });
});

describe('companyDayRangeIso (ZIG-I36-24)', () => {
  it('covers the company day, 06:00 UTC to 05:59:59.999 UTC next day', () => {
    const picked = new Date(2026, 9, 31, 0, 0, 0);
    expect(companyDayRangeIso(picked)).toEqual({
      from: '2026-10-31T06:00:00.000Z',
      to: '2026-11-01T05:59:59.999Z',
    });
  });

  it('around midnight UTC: 02:00 UTC on 1 Nov is still 31 Oct for the company', () => {
    const { from, to } = companyDayRangeIso(new Date(2026, 9, 31));
    const inRange = (iso: string) => iso >= from && iso <= to;
    expect(inRange('2026-11-01T02:00:00.000Z')).toBe(true); // 20:00 on 31 Oct in Mexico City
    expect(inRange('2026-10-31T05:59:59.999Z')).toBe(false); // 23:59 on 30 Oct
    expect(inRange('2026-11-01T06:00:00.000Z')).toBe(false); // 00:00 on 1 Nov
  });

  it('spans a range to the end of its last day', () => {
    const range = companyDayRangeIso(new Date(2026, 0, 5), new Date(2026, 0, 7));
    expect(range).toEqual({ from: '2026-01-05T06:00:00.000Z', to: '2026-01-08T05:59:59.999Z' });
  });
});

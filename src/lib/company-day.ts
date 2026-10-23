/**
 * Company calendar day (ZigZag operates in America/Mexico_City).
 *
 * Vercel runs in UTC. After 18:00 in Mexico City, `toISOString().slice(0, 10)`,
 * `startOfDay(new Date())` and `format(new Date(), …)` all land on the next
 * civil day. The PDF issue date and file name (ZIG-19), presupuesto vigencia
 * (ZIG-20), and Atrasados — the technician queue, the Inicio dashboard and the
 * overdue push (ZIG-25) — share that cause. They call this helper instead of
 * reading "today" from UTC. Stored timestamps are not rewritten.
 *
 * The returned `date` is 12:00 UTC of the civil day. Noon sits on the same
 * calendar day in UTC and in Mexico City, so date-fns calendar helpers
 * (`format`, `startOfDay`, `differenceInCalendarDays`, `addDays`) agree with
 * the company day in both zones.
 */

export const COMPANY_TIME_ZONE = 'America/Mexico_City';

export type CompanyDay = {
  /** 12:00 UTC of the civil day. */
  date: Date;
  /** `YYYY-MM-DD` in `timeZone`. */
  iso: string;
};

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Calendar day of `date` in `timeZone` (default America/Mexico_City).
 */
export const companyDay = (
  date: Date,
  timeZone: string = COMPANY_TIME_ZONE,
): CompanyDay => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    const parsed = Number(value);
    if (!value || Number.isNaN(parsed)) {
      throw new RangeError(`companyDay: missing ${type} for ${timeZone}`);
    }
    return parsed;
  };
  const year = read('year');
  const month = read('month');
  const day = read('day');
  return {
    date: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
    iso: `${year}-${pad(month)}-${pad(day)}`,
  };
};

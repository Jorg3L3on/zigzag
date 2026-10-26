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

/** Milliseconds `timeZone` is ahead of UTC at `instant` (Mexico City: -6 h). */
const zoneOffsetMs = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(
    read('year'),
    read('month') - 1,
    read('day'),
    read('hour'),
    read('minute'),
    read('second'),
  );
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

/**
 * The instant the civil day of `day` (a `companyDay().date`) starts in
 * `timeZone`: 06:00 UTC for Mexico City. SQL range filters compare stored
 * timestamps against it so they agree with `companyDay` (ZIG-I30).
 */
export const companyDayStart = (
  day: Date,
  timeZone: string = COMPANY_TIME_ZONE,
): Date => {
  const midnightUtc = Date.UTC(
    day.getUTCFullYear(),
    day.getUTCMonth(),
    day.getUTCDate(),
  );
  return new Date(midnightUtc - zoneOffsetMs(new Date(midnightUtc), timeZone));
};

/** `YYYY-MM-DD` → 12:00 UTC of that civil day (the `companyDay().date` shape), or null. */
export const parseCompanyDayIso = (iso: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
};
